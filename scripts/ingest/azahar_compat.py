"""Fetch Azahar (Nintendo 3DS) compatibility list.

Source repository: https://github.com/azahar-emu/compatibility-list

The repo publishes a JSON file (compatibility_list.json) with per-title reports.
The README describes the scoring scale (0..5; 99 = untested).

Output schema: compat-source-v1 (see scripts/ingest/README.md)
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from typing import Any, Iterable

from .common import fetch_cached, write_items


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def score_to_status(score: int | None) -> str:
    """Map Azahar score (lower is better) to coarse buckets."""
    if score is None:
        return "unknown"
    if score == 99:
        return "unknown"
    # 0..5 where lower is better per repo README
    if score <= 1:
        return "playable"
    if score == 2:
        return "ingame"
    if score == 3:
        return "intro"
    if score == 4:
        return "boot"
    if score >= 5:
        return "broken"
    return "unknown"


def iter_entries(obj: Any) -> Iterable[dict[str, Any]]:
    """Try to locate the list of report dicts in a variety of JSON shapes."""
    if isinstance(obj, list):
        for x in obj:
            if isinstance(x, dict):
                yield x
        return

    if isinstance(obj, dict):
        # common wrappers
        for key in ("entries", "games", "titles", "data", "compatibility", "reports"):
            val = obj.get(key)
            if isinstance(val, list):
                for x in val:
                    if isinstance(x, dict):
                        yield x
                return

        # dict keyed by titleId
        if all(isinstance(k, str) for k in obj.keys()):
            for k, v in obj.items():
                if isinstance(v, dict):
                    v = dict(v)
                    v.setdefault("titleId", k)
                    yield v
            return

    return


def pick(d: dict[str, Any], keys: list[str]) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None


def normalize_title_id(raw: str | None) -> str | None:
    if not raw:
        return None
    s = str(raw).strip()
    # Title IDs are typically 16 hex chars, sometimes prefixed with 0x
    s = s.lower().replace("0x", "").strip()
    if len(s) == 16 and all(c in "0123456789abcdef" for c in s):
        return s
    return s  # keep as-is if it doesn't match the ideal form


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/compat.azahar.json", help="Output JSON path")
    ap.add_argument("--cache-dir", default=".cache/compat", help="Cache directory for upstream snapshots")
    ap.add_argument("--max-age-days", type=int, default=7, help="Max cache age before refetch")
    ap.add_argument("--url", default="https://raw.githubusercontent.com/azahar-emu/compatibility-list/master/compatibility_list.json",
                    help="Raw JSON URL (may change if repo layout changes)")
    args = ap.parse_args()

    fetched = fetch_cached(args.url, args.cache_dir, suffix=".json", max_age_days=args.max_age_days)
    data = json.loads(fetched.content.decode("utf-8", errors="replace"))

    items: list[dict[str, Any]] = []
    for entry in iter_entries(data):
        title_id = normalize_title_id(pick(entry, ["titleId", "title_id", "tid", "id", "titleid"]))
        if not title_id:
            continue

        name = pick(entry, ["name", "title", "game", "game_name"])
        score = pick(entry, ["compatibility", "rating", "score", "status"])
        try:
            score_i = int(score) if score is not None else None
        except Exception:
            score_i = None

        notes = pick(entry, ["notes", "note", "comment", "comments", "details"])

        items.append({
            "gameId": "UNMAPPED",
            "platformId": "3ds",
            "emulatorId": "azahar",
            "externalIdType": "3ds-titleid",
            "externalGameId": title_id,
            "title": name,
            "status": score_to_status(score_i),
            "source": "azahar-compatibility-list",
            "sourceUrl": "https://github.com/azahar-emu/compatibility-list",
            "confidence": "medium",
            "notes": notes,
            "meta": {
                "score": score_i,
            },
        })

    if not items:
        raise RuntimeError("Parsed 0 Azahar rows; JSON schema may have changed or URL failed.")

    write_items(args.out, version="compat-source-v1", generated_at=now_iso(), items=items)
    print(f"Wrote {len(items)} rows Ã¢â€ â€™ {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
