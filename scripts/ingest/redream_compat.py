"""Fetch Redream (Dreamcast) compatibility list.

Source: https://redream.io/compatibility

The Redream compatibility page lists titles and a coarse status.
We treat this as an *official* first-line signal.

Output schema: compat-source-v1 (see scripts/ingest/README.md)
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup

from .common import fetch_cached, write_items


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


STATUS_MAP = {
    "playable": "playable",
    "starts": "ingame",
    "menus": "menu",
    "broken": "broken",
    "unknown": "unknown",
    "untested": "unknown",
}


def normalize_status(raw: str) -> str:
    s = (raw or "").strip().lower()
    return STATUS_MAP.get(s, "unknown")


def parse_table(html: bytes) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")

    # The page currently has a single main table of games.
    table = soup.find("table")
    if not table:
        raise RuntimeError("Could not find <table> on redream compatibility page")

    items: list[dict[str, Any]] = []
    for tr in table.find_all("tr"):
        tds = tr.find_all(["td", "th"])
        if not tds:
            continue

        # Header row
        if tds[0].name == "th":
            continue

        # Observed columns (subject to change):
        # [flag] [title] [status] [notes/issues]
        raw_cells = [td.get_text(" ", strip=True) for td in tds]
        if len(raw_cells) < 3:
            continue

        flag = raw_cells[0]
        title = raw_cells[1]
        status_raw = raw_cells[2]
        notes = raw_cells[3] if len(raw_cells) >= 4 else None

        if not title:
            continue

        items.append({
            "gameId": "UNMAPPED",
            "platformId": "dreamcast",
            "emulatorId": "redream",
            "externalIdType": "title",
            "externalGameId": title,
            "title": title,
            "status": normalize_status(status_raw),
            "source": "redream",
            "sourceUrl": "https://redream.io/compatibility",
            "confidence": "high",
            "notes": (notes or "").strip() or None,
            "meta": {
                "flag": flag or None,
                "statusRaw": status_raw,
            },
        })

    return items


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/compat.redream.json", help="Output JSON path")
    ap.add_argument("--cache-dir", default=".cache/compat", help="Cache directory for upstream snapshots")
    ap.add_argument("--max-age-days", type=int, default=7, help="Max cache age before refetch")
    args = ap.parse_args()

    url = "https://redream.io/compatibility"
    fetched = fetch_cached(url, args.cache_dir, suffix=".html", max_age_days=args.max_age_days)
    items = parse_table(fetched.content)

    write_items(args.out, version="compat-source-v1", generated_at=now_iso(), items=items)
    print(f"Wrote {len(items)} rows Ã¢â€ â€™ {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
