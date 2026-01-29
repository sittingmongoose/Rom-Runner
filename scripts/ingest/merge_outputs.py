"""Merge compat-source-v1 outputs into a single file.

Usage:
  python -m scripts.ingest.merge_outputs --in-dir out --out out/emulatorCompatibility.merged.json

This is intentionally conservative: it deduplicates by
  (platformId, emulatorId, externalIdType, externalGameId)
keeping the first row encountered.

You can later enhance this to:
  - prefer 'high' confidence over 'medium'/'low'
  - reconcile conflicting statuses
  - map external IDs to canonical Game IDs
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Tuple


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in-dir", default="out", help="Directory containing compat.*.json outputs")
    ap.add_argument("--out", default="out/emulatorCompatibility.merged.json", help="Merged output path")
    args = ap.parse_args()

    in_dir = Path(args.in_dir)
    paths = sorted([p for p in in_dir.glob("compat.*.json") if p.is_file()])
    if not paths:
        raise SystemExit(f"No compat.*.json files found in {in_dir}")

    merged: list[dict[str, Any]] = []
    seen: set[Tuple[str, str, str, str]] = set()

    for p in paths:
        data = load_json(p)
        if data.get("version") != "compat-source-v1":
            continue
        for item in data.get("items", []):
            key = (
                str(item.get("platformId")),
                str(item.get("emulatorId")),
                str(item.get("externalIdType")),
                str(item.get("externalGameId")),
            )
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": "emulatorCompatibility-v0.1-merged",
        "generatedAt": now_iso(),
        "sources": [p.name for p in paths],
        "items": merged,
    }
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Merged {len(paths)} files Ã¢â€ â€™ {len(merged)} unique rows Ã¢â€ â€™ {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
