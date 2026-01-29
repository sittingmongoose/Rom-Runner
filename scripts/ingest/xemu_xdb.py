"""Fetch xemu title compatibility metadata from the xemu-project/xdb repo.

The xdb repository is an open metadata archive originally collected to track
xemu compatibility. We download a ZIP of the repo and parse per-title files.

Repo:
  https://github.com/xemu-project/xdb

Output: out/compat/xemu.compat-source.json
"""

from __future__ import annotations

import argparse
import io
import json
import re
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from .common import DEFAULT_HEADERS, ensure_dirs, json_dump, now_iso, requests_get_cached

XDB_ZIP = "https://github.com/xemu-project/xdb/archive/refs/heads/main.zip"


def deep_get(d: Any, path: List[str]) -> Any:
    cur = d
    for p in path:
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def normalize_status(raw: str) -> str:
    s = (raw or "").strip().lower()
    # xemu uses: Perfect / Playable / Ingame / Intro / Broken (and sometimes "Unknown")
    if s in {"perfect"}:
        return "perfect"
    if s in {"playable"}:
        return "playable"
    if s in {"ingame", "in-game", "in game"}:
        return "ingame"
    if s in {"intro", "menu"}:
        return "intro"
    if s in {"broken", "crash", "won't boot", "wont boot", "unplayable"}:
        return "broken"
    return "unknown"


TITLEID_RE = re.compile(r"^[0-9a-fA-F]{8}$")


def parse_title_record(obj: Dict[str, Any], fallback_id: str) -> Dict[str, Any]:
    title = obj.get("title") or obj.get("name") or obj.get("game")

    # Attempt to locate a status field in common locations.
    status_raw = (
        deep_get(obj, ["compatibility", "status"]) 
        or deep_get(obj, ["compatibility", "state"]) 
        or obj.get("status")
        or obj.get("state")
    )

    # The file name is often the xemu Title ID.
    title_id = obj.get("titleId") or obj.get("title_id") or obj.get("id")
    if not title_id and TITLEID_RE.match(fallback_id):
        title_id = fallback_id

    external_game_id = str(title_id or fallback_id)

    return {
        "emulatorId": "xemu",
        "platformId": "xbox",
        "externalIdType": "title_id" if title_id else "file_id",
        "externalGameId": external_game_id,
        "title": title,
        "status": {"raw": status_raw, "normalized": normalize_status(str(status_raw or ""))},
        "meta": {"titleId": title_id},
        "links": {"source": "https://github.com/xemu-project/xdb"},
        "raw": obj,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="out/compat")
    ap.add_argument("--cache-dir", default=".cache/http")
    ap.add_argument("--timeout", type=int, default=120)
    args = ap.parse_args()

    ensure_dirs(args.out_dir, args.cache_dir)

    resp = requests_get_cached(XDB_ZIP, cache_dir=args.cache_dir, headers=DEFAULT_HEADERS, timeout=args.timeout)
    z = zipfile.ZipFile(io.BytesIO(resp.content))

    # Collect JSON files under titles/
    records: List[Dict[str, Any]] = []
    for name in z.namelist():
        # Typical path: xdb-main/titles/4e4d0009.json
        if not name.lower().endswith(".json"):
            continue
        parts = name.split("/")
        if "titles" not in parts:
            continue

        with z.open(name) as f:
            try:
                obj = json.load(f)
            except Exception:
                continue

        fallback_id = Path(name).stem
        if isinstance(obj, dict):
            records.append(parse_title_record(obj, fallback_id=fallback_id))

    out = {
        "schemaVersion": "compat-source-v1",
        "source": {
            "id": "xemu",
            "name": "xemu-project/xdb",
            "kind": "official",
            "url": "https://github.com/xemu-project/xdb",
        },
        "generatedAt": now_iso(),
        "records": records,
    }

    json_dump(out, f"{args.out_dir}/xemu.compat-source.json")
    print(f"Wrote {len(records)} records Ã¢â€ â€™ {args.out_dir}/xemu.compat-source.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
