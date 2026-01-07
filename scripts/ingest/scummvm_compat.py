"""Fetch ScummVM compatibility list (DEV or a stable release).

ScummVM hosts a compatibility page for the DEV branch and many stable releases:
  - DEV: https://scummvm.org/compatibility/
  - Stable releases are linked from that page.

The page is mostly plain-text lines like:
  "<Game Name> <engine:id> <Support Level>"

Output schema: compat-source-v1 (see scripts/ingest/README.md)
"""

from __future__ import annotations

import argparse
import re
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup

from .common import fetch_cached, write_items


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


LEVEL_TO_STATUS = {
    "Excellent": "playable",
    "Good": "playable",
    "Bugged": "ingame",
    "Broken": "broken",
    "Untested": "unknown",
}


LINE_RE = re.compile(
    r"^(?P<title>.+?)\s+(?P<scummid>[A-Za-z0-9_\-]+:[A-Za-z0-9_\-]+)\s+(?P<level>Untested|Broken|Bugged|Good|Excellent)\s*$"
)


def parse_lines(html: bytes) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)

    items: list[dict[str, Any]] = []
    for line in text.splitlines():
        m = LINE_RE.match(line.strip())
        if not m:
            continue

        title = m.group("title").strip()
        scummid = m.group("scummid").strip()
        level = m.group("level").strip()

        items.append({
            "gameId": "UNMAPPED",
            "platformId": "scummvm",
            "emulatorId": "scummvm-standalone",
            "externalIdType": "scummvm-id",
            "externalGameId": scummid,
            "title": title,
            "status": LEVEL_TO_STATUS.get(level, "unknown"),
            "source": "scummvm",
            "sourceUrl": "https://scummvm.org/compatibility/",
            "confidence": "high",
            "notes": f"ScummVM support level: {level}",
            "meta": {
                "supportLevel": level,
            },
        })

    if not items:
        raise RuntimeError("Parsed 0 ScummVM rows; page format may have changed.")
    return items


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/compat.scummvm.json", help="Output JSON path")
    ap.add_argument("--cache-dir", default=".cache/compat", help="Cache directory for upstream snapshots")
    ap.add_argument("--max-age-days", type=int, default=7, help="Max cache age before refetch")
    ap.add_argument("--url", default="https://scummvm.org/compatibility/", help="Compatibility page URL (DEV or stable)")
    args = ap.parse_args()

    fetched = fetch_cached(args.url, args.cache_dir, suffix=".html", max_age_days=args.max_age_days)
    items = parse_lines(fetched.content)

    write_items(args.out, version="compat-source-v1", generated_at=now_iso(), items=items)
    print(f"Wrote {len(items)} rows Ã¢â€ â€™ {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
