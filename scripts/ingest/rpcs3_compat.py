"""Fetch RPCS3 compatibility data.

RPCS3 provides an export endpoint:
  https://rpcs3.net/compatibility?api=v1&export

That export is keyed by *game serial* (e.g., BLUS12345) and may omit game titles.
In ROM Runner we preserve the serial in `externalGameId` and leave `title` optional.

Output schema: compat-source-v1 (see scripts/ingest/README.md)
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

from .common import (
    DEFAULT_HEADERS,
    ensure_dirs,
    json_dump,
    now_iso,
    requests_get_cached,
    slugify,
)


EXPORT_URL = "https://rpcs3.net/compatibility?api=v1&export"


def normalize_status(raw: str) -> str:
    """Map RPCS3 status labels to ROM Runner's coarse buckets."""
    s = (raw or "").strip().lower()
    # RPCS3 commonly uses: "Playable", "Ingame", "Intro", "Loadable", "Nothing".
    if s in {"playable"}:
        return "playable"
    if s in {"ingame", "in-game", "in game"}:
        return "ingame"
    if s in {"intro"}:
        return "intro"
    if s in {"loadable"}:
        return "boot"
    if s in {"nothing"}:
        return "broken"
    return "unknown"


def parse_date(value: Any) -> Optional[str]:
    """Best-effort parse various date formats into YYYY-MM-DD."""
    if not value:
        return None
    if isinstance(value, (int, float)):
        try:
            # UNIX seconds
            return datetime.utcfromtimestamp(int(value)).date().isoformat()
        except Exception:
            return None
    if isinstance(value, str):
        v = value.strip()
        # Common formats observed: "2024-01-02" or "2024-01-02 12:34:56"
        for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d"):
            try:
                return datetime.strptime(v, fmt).date().isoformat()
            except Exception:
                pass
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="out/compat")
    ap.add_argument("--cache-dir", default=".cache/http")
    ap.add_argument("--timeout", type=int, default=60)
    args = ap.parse_args()

    ensure_dirs(args.out_dir, args.cache_dir)

    # Fetch export JSON (cached)
    payload = requests_get_cached(
        EXPORT_URL,
        cache_dir=args.cache_dir,
        headers=DEFAULT_HEADERS,
        timeout=args.timeout,
    )
    data = payload.json()

    # The export format can vary. We try common shapes.
    # Shape A: {"return": "success", "results": {...}}
    # Shape B: {...} directly.
    results = None
    if isinstance(data, dict):
        if "results" in data and isinstance(data["results"], dict):
            results = data["results"]
        else:
            results = data
    if not isinstance(results, dict):
        raise SystemExit(f"Unexpected RPCS3 export format: {type(data)}")

    records: List[Dict[str, Any]] = []
    for serial, row in results.items():
        if not isinstance(row, dict):
            continue
        raw_status = row.get("status") or row.get("state") or row.get("compatibility")
        last_tested = parse_date(row.get("date") or row.get("last_tested") or row.get("lastTested"))
        last_updated = parse_date(row.get("updated") or row.get("update") or row.get("last_updated"))

        records.append(
            {
                "emulatorId": "rpcs3",
                "platformId": "ps3",
                "externalIdType": "serial",
                "externalGameId": serial,
                "title": row.get("title") or row.get("name"),
                "status": {
                    "raw": raw_status,
                    "normalized": normalize_status(str(raw_status or "")),
                },
                "lastTested": last_tested,
                "lastUpdated": last_updated,
                "links": {
                    "source": EXPORT_URL,
                },
                "raw": row,
            }
        )

    out = {
        "schemaVersion": "compat-source-v1",
        "source": {
            "id": "rpcs3",
            "name": "RPCS3 Compatibility List",
            "kind": "official",
            "url": "https://rpcs3.net/compatibility",
        },
        "generatedAt": now_iso(),
        "records": records,
    }

    json_dump(out, f"{args.out_dir}/rpcs3.compat-source.json")
    print(f"Wrote {len(records)} records Ã¢â€ â€™ {args.out_dir}/rpcs3.compat-source.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
