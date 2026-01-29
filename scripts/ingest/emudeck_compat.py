#!/usr/bin/env python3
"""
emudeck_compat.py â€” EmuDeck/Steam Deck community compatibility list ingestor.

Source:
https://brantje.github.io/emudeck-compatibility-list/

Notes:
- The site implementation can change. This ingestor tries multiple extraction strategies:
  1) Next.js __NEXT_DATA__ JSON
  2) Embedded window.__INITIAL_STATE__/window.__NUXT__ blobs
  3) Table scraping fallback (very basic)
- Output schema is layerC-v1, matching other community sources.

If extraction fails, run with --dump-debug to save the fetched HTML to the cache dir
to inspect locally.
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from bs4 import BeautifulSoup  # type: ignore

from layerC_common import (
    cache_response,
    clean_text,
    ensure_dirs,
    normalize_status,
    now_iso_utc,
)


SOURCE_ID = "emudeck_compat_site"
SOURCE_URL = "https://brantje.github.io/emudeck-compatibility-list/"

# Platforms claimed by your prompt/seed; used for optional filtering only.
KNOWN_PLATFORMS = ["ps3", "wiiu", "switch", "ps2", "3ds", "wii", "gamecube", "saturn", "xbox"]


def _deep_find_lists(obj: Any) -> list[list[Any]]:
    """Return candidate lists from a nested JSON structure."""
    out: list[list[Any]] = []

    def rec(x: Any) -> None:
        if isinstance(x, list):
            out.append(x)
            for i in x:
                rec(i)
        elif isinstance(x, dict):
            for v in x.values():
                rec(v)

    rec(obj)
    return out


def _looks_like_record(d: dict[str, Any]) -> bool:
    keys = {k.lower() for k in d.keys()}
    # Heuristic: must have something like game/title + system/platform + rating/status
    has_title = any(k in keys for k in ["game", "title", "name", "gametitle"])
    has_platform = any(k in keys for k in ["platform", "system", "console"])
    has_status = any(k in keys for k in ["status", "compatibility", "rating", "playability", "tier"])
    return has_title and has_platform and has_status


def _normalize_platform(raw: str) -> str:
    s = (raw or "").strip().lower()
    s = s.replace(" ", "")
    mapping = {
        "ps3": "ps3",
        "playstation3": "ps3",
        "wiiu": "wiiu",
        "wiiu(cemu)": "wiiu",
        "switch": "switch",
        "nintendoswitch": "switch",
        "ps2": "ps2",
        "playstation2": "ps2",
        "3ds": "3ds",
        "nintendo3ds": "3ds",
        "wii": "wii",
        "gamecube": "gamecube",
        "gc": "gamecube",
        "saturn": "saturn",
        "segasaturn": "saturn",
        "xbox": "xbox",
        "originalxbox": "xbox",
    }
    return mapping.get(s, (raw or "").strip().lower())


def extract_from_next_data(html: str) -> list[dict[str, Any]]:
    m = re.search(r'<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, flags=re.DOTALL)
    if not m:
        return []
    blob = m.group(1).strip()
    try:
        data = json.loads(blob)
    except Exception:
        return []

    candidates: list[dict[str, Any]] = []
    for lst in _deep_find_lists(data):
        # look for list of dicts
        if lst and all(isinstance(x, dict) for x in lst[: min(len(lst), 10)]):
            # if most look like records, accept
            score = sum(1 for x in lst[: min(len(lst), 30)] if isinstance(x, dict) and _looks_like_record(x))
            if score >= max(3, min(10, len(lst) // 4)):
                candidates.extend([x for x in lst if isinstance(x, dict)])
    # dedupe by identity
    uniq: list[dict[str, Any]] = []
    seen = set()
    for d in candidates:
        k = json.dumps(d, sort_keys=True, ensure_ascii=False)[:500]
        if k not in seen:
            seen.add(k)
            uniq.append(d)
    return uniq


def extract_from_window_state(html: str) -> list[dict[str, Any]]:
    # Try some common global assignments
    patterns = [
        r"window\.__INITIAL_STATE__\s*=\s*({.*?})\s*;\s*</script>",
        r"window\.__NUXT__\s*=\s*({.*?})\s*;\s*</script>",
        r"window\.__DATA__\s*=\s*({.*?})\s*;\s*</script>",
    ]
    for pat in patterns:
        m = re.search(pat, html, flags=re.DOTALL)
        if not m:
            continue
        blob = m.group(1)
        try:
            data = json.loads(blob)
        except Exception:
            continue
        candidates: list[dict[str, Any]] = []
        for lst in _deep_find_lists(data):
            if lst and all(isinstance(x, dict) for x in lst[: min(len(lst), 10)]):
                score = sum(1 for x in lst[: min(len(lst), 30)] if isinstance(x, dict) and _looks_like_record(x))
                if score >= max(3, min(10, len(lst) // 4)):
                    candidates.extend([x for x in lst if isinstance(x, dict)])
        if candidates:
            return candidates
    return []


def extract_from_html_table(html: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return []
    headers = [th.get_text(strip=True) for th in table.find_all("th")]
    rows = []
    for tr in table.find_all("tr")[1:]:
        tds = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
        if not tds:
            continue
        rec = {}
        for i, v in enumerate(tds):
            key = headers[i] if i < len(headers) else f"col{i}"
            rec[key] = v
        rows.append(rec)
    return rows


def to_layerc_items(records: list[dict[str, Any]], *, source_url: str) -> list[dict]:
    items: list[dict] = []
    for r in records:
        # Try multiple key variants
        title = clean_text(str(r.get("game") or r.get("title") or r.get("name") or r.get("Game") or r.get("Title") or ""))
        if not title:
            continue

        platform_raw = clean_text(str(r.get("platform") or r.get("system") or r.get("console") or r.get("Platform") or r.get("System") or ""))
        if not platform_raw:
            continue
        platform_id = _normalize_platform(platform_raw)

        status_raw = clean_text(str(r.get("status") or r.get("compatibility") or r.get("rating") or r.get("playability") or r.get("Status") or ""))
        normalized, tier = normalize_status(status_raw)

        notes = clean_text(str(r.get("notes") or r.get("comment") or r.get("comments") or r.get("Notes") or ""))

        items.append(
            {
                "platformId": platform_id,
                "gameTitle": title,
                "externalGameId": None,
                "performance": {"raw": status_raw, "normalized": normalized, "tier": tier},
                "emulatorId": None,
                "emulatorVersion": None,
                "settings": {"notes": notes} if notes else {},
                "confidence": "layerC",
                "sourceUrl": source_url,
            }
        )
    return items


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest EmuDeck compatibility list â†’ layerC-v1 JSON")
    ap.add_argument("--out", default="out/layerC.emudeck.json", help="Output path")
    ap.add_argument("--cache-dir", default=".cache/layerC", help="Cache directory (shared across ingestors)")
    ap.add_argument("--platform", action="append", help="Only include these platformIds (repeatable).")
    ap.add_argument("--dump-debug", action="store_true", help="Dump fetched HTML to cache dir for debugging.")
    args = ap.parse_args()

    ensure_dirs(args.out, args.cache_dir)

    html = cache_response(SOURCE_URL, args.cache_dir, ttl_secs=12 * 3600)

    if args.dump_debug:
        dbg = Path(args.cache_dir) / "emudeck_compat.debug.html"
        dbg.write_text(html, encoding="utf-8")
        print(f"Wrote debug HTML â†’ {dbg}")

    records = extract_from_next_data(html)
    if not records:
        records = extract_from_window_state(html)
    if not records:
        records = extract_from_html_table(html)

    if not records:
        raise SystemExit("Could not extract any records from the EmuDeck compatibility site. Try --dump-debug.")

    items = to_layerc_items(records, source_url=SOURCE_URL)

    if args.platform:
        allowed = set(args.platform)
        items = [it for it in items if it.get("platformId") in allowed]

    output = {
        "schemaVersion": "layerC-v1",
        "source": {
            "id": SOURCE_ID,
            "name": "EmuDeck/Steam Deck community compatibility list",
            "kind": "community",
            "url": SOURCE_URL,
            "hardwareScope": {"deviceFamily": "Steam Deck", "chipset": "AMD Van Gogh (Steam Deck)"},
        },
        "generatedAt": now_iso_utc(),
        "items": items,
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(items)} items â†’ {args.out}")


if __name__ == "__main__":
    main()
