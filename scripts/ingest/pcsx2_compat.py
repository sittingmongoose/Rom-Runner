"""Fetch PCSX2 compatibility list.

Official PCSX2 site hosts a compatibility list. The site structure has changed
over time; this script does best-effort scraping:

- Fetch the compat landing page
- Try to locate an embedded JSON payload
- Fallback to scraping the first HTML table it finds

If this stops working, capture the new HTML/JSON shape and adjust `parse_*`.

Output: out/compat/pcsx2.compat-source.json
"""

from __future__ import annotations

import argparse
import json
import re
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from .common import DEFAULT_HEADERS, ensure_dirs, json_dump, now_iso, requests_get_cached

COMPAT_URL = "https://pcsx2.net/compat/"

STATUS_ALIASES = {
    "perfect": "perfect",
    "playable": "playable",
    "in-game": "ingame",
    "ingame": "ingame",
    "intro": "intro",
    "menu": "intro",
    "boots": "boot",
    "boot": "boot",
    "broken": "broken",
    "unplayable": "broken",
}


def normalize_status(raw: str) -> str:
    s = (raw or "").strip().lower()
    return STATUS_ALIASES.get(s, "unknown")


def try_extract_embedded_json(html: str) -> Optional[Any]:
    """Try common patterns where the site embeds a JSON blob in a script tag."""
    # Pattern: window.__COMPAT__ = {...};
    m = re.search(r"__COMPAT__\s*=\s*(\{.*?\});", html, re.S)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass

    # Pattern: <script type="application/json" id="...">{...}</script>
    soup = BeautifulSoup(html, "html.parser")
    for sc in soup.find_all("script"):
        if sc.get("type") == "application/json" and sc.string:
            try:
                return json.loads(sc.string)
            except Exception:
                continue

    return None


def parse_from_table(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return []

    # Try to infer column positions
    headers = [th.get_text(" ", strip=True).lower() for th in table.find_all("th")]
    header_row = table.find("thead")
    if header_row:
        headers = [th.get_text(" ", strip=True).lower() for th in header_row.find_all("th")]

    def col_idx(name_contains: str) -> Optional[int]:
        for i, h in enumerate(headers):
            if name_contains in h:
                return i
        return None

    idx_title = col_idx("title") or 0
    idx_status = col_idx("status")
    idx_serial = col_idx("serial") or col_idx("slus") or col_idx("sles")

    records: List[Dict[str, Any]] = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue

        title = tds[idx_title].get_text(" ", strip=True) if idx_title < len(tds) else ""
        if not title:
            continue

        status_raw = ""
        if idx_status is not None and idx_status < len(tds):
            status_raw = tds[idx_status].get_text(" ", strip=True)

        serial = None
        if idx_serial is not None and idx_serial < len(tds):
            serial = tds[idx_serial].get_text(" ", strip=True) or None

        records.append(
            {
                "emulatorId": "pcsx2",
                "platformId": "ps2",
                "externalIdType": "serial" if serial else "name",
                "externalGameId": serial or title,
                "title": title,
                "status": {"raw": status_raw, "normalized": normalize_status(status_raw)},
                "links": {"source": COMPAT_URL},
            }
        )

    return records


def parse_records(html: str) -> List[Dict[str, Any]]:
    embedded = try_extract_embedded_json(html)
    if embedded is None:
        return parse_from_table(html)

    # Common shapes:
    # - { items: [...] }
    # - [...] directly
    items = None
    if isinstance(embedded, list):
        items = embedded
    elif isinstance(embedded, dict):
        for k in ("items", "games", "entries", "data"):
            if k in embedded and isinstance(embedded[k], list):
                items = embedded[k]
                break
    if not isinstance(items, list):
        return parse_from_table(html)

    records: List[Dict[str, Any]] = []
    for row in items:
        if not isinstance(row, dict):
            continue
        title = row.get("title") or row.get("name")
        status_raw = row.get("status") or row.get("state")
        serial = row.get("serial") or row.get("gameId") or row.get("id")

        if not title and not serial:
            continue

        records.append(
            {
                "emulatorId": "pcsx2",
                "platformId": "ps2",
                "externalIdType": "serial" if serial else "name",
                "externalGameId": str(serial or title),
                "title": title,
                "status": {"raw": status_raw, "normalized": normalize_status(str(status_raw or ""))},
                "links": {"source": COMPAT_URL},
                "raw": row,
            }
        )

    return records


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="out/compat")
    ap.add_argument("--cache-dir", default=".cache/http")
    ap.add_argument("--timeout", type=int, default=90)
    args = ap.parse_args()

    ensure_dirs(args.out_dir, args.cache_dir)

    resp = requests_get_cached(COMPAT_URL, cache_dir=args.cache_dir, headers=DEFAULT_HEADERS, timeout=args.timeout)
    records = parse_records(resp.text)

    out = {
        "schemaVersion": "compat-source-v1",
        "source": {"id": "pcsx2", "name": "PCSX2 Compatibility", "kind": "official", "url": COMPAT_URL},
        "generatedAt": now_iso(),
        "records": records,
    }

    json_dump(out, f"{args.out_dir}/pcsx2.compat-source.json")
    print(f"Wrote {len(records)} records Ã¢â€ â€™ {args.out_dir}/pcsx2.compat-source.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
