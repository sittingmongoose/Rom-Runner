"""Fetch Cemu compatibility data from compat.cemu.info.

compat.cemu.info is a community-run compatibility tracker for the Cemu Wii U emulator.
We scrape the HTML table and emit compat-source-v1.

Output: out/compat/cemu.compat-source.json
"""

from __future__ import annotations

import argparse
import re
from typing import Any, Dict, List, Optional

from bs4 import BeautifulSoup

from .common import DEFAULT_HEADERS, ensure_dirs, json_dump, now_iso, requests_get_cached

BASE_URL = "https://compat.cemu.info"


def normalize_status(raw: str) -> str:
    s = (raw or "").strip().lower()
    # Common labels on compat.cemu.info: "Perfect", "Playable", "Runs", "Loads", "Intro", "Crash", "Unplayable".
    if s in {"perfect"}:
        return "perfect"
    if s in {"playable", "runs"}:
        return "playable"
    if s in {"loads", "boot"}:
        return "boot"
    if s in {"intro"}:
        return "intro"
    if s in {"crash", "unplayable", "broken"}:
        return "broken"
    return "unknown"


def extract_text(el) -> str:
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)) if el else ""


def parse_rows(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return []

    # Header mapping
    headers: List[str] = []
    thead = table.find("thead")
    if thead:
        for th in thead.find_all("th"):
            headers.append(extract_text(th).lower())

    records: List[Dict[str, Any]] = []
    tbody = table.find("tbody") or table
    for tr in tbody.find_all("tr"):
        tds = tr.find_all(["td", "th"])
        if not tds:
            continue

        # Try to discover title + status regardless of column positions.
        title = ""
        detail_url: Optional[str] = None
        status_raw = ""
        version = ""
        region = ""

        # Title is usually a link.
        a = tr.find("a", href=True)
        if a:
            title = extract_text(a)
            href = a.get("href")
            if href:
                detail_url = href if href.startswith("http") else f"{BASE_URL}{href}"

        # Status often represented as text or an icon alt/title.
        # Look for an <img> with title/alt containing known labels.
        img = tr.find("img")
        if img:
            status_raw = (img.get("title") or img.get("alt") or "").strip()

        # Also try to find a cell containing one of the known labels.
        if not status_raw:
            row_text = extract_text(tr)
            m = re.search(r"\b(Perfect|Playable|Runs|Loads|Intro|Crash|Unplayable)\b", row_text, re.I)
            if m:
                status_raw = m.group(1)

        # Attempt to pull region/version if present
        row_text = extract_text(tr)
        mver = re.search(r"\b(v\d+(?:\.\d+){1,3})\b", row_text, re.I)
        if mver:
            version = mver.group(1)
        mreg = re.search(r"\b(USA|EUR|JPN|JAP|PAL|NTSC)\b", row_text, re.I)
        if mreg:
            region = mreg.group(1).upper().replace("JAP", "JPN")

        if not title:
            continue

        records.append(
            {
                "emulatorId": "cemu",
                "platformId": "wiiu",
                "externalIdType": "name",
                "externalGameId": title,
                "title": title,
                "status": {"raw": status_raw, "normalized": normalize_status(status_raw)},
                "meta": {"region": region or None, "version": version or None},
                "links": {"source": f"{BASE_URL}/", "detail": detail_url},
            }
        )

    return records


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="out/compat")
    ap.add_argument("--cache-dir", default=".cache/http")
    ap.add_argument("--timeout", type=int, default=60)
    args = ap.parse_args()

    ensure_dirs(args.out_dir, args.cache_dir)

    resp = requests_get_cached(f"{BASE_URL}/", cache_dir=args.cache_dir, headers=DEFAULT_HEADERS, timeout=args.timeout)
    html = resp.text

    records = parse_rows(html)

    out = {
        "schemaVersion": "compat-source-v1",
        "source": {
            "id": "cemu",
            "name": "compat.cemu.info",
            "kind": "community",
            "url": f"{BASE_URL}/",
        },
        "generatedAt": now_iso(),
        "records": records,
    }

    json_dump(out, f"{args.out_dir}/cemu.compat-source.json")
    print(f"Wrote {len(records)} records Ã¢â€ â€™ {args.out_dir}/cemu.compat-source.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
