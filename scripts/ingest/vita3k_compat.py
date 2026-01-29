"""Fetch Vita3K compatibility database.

Vita3K maintains a compatibility database in a GitHub repo with a generated release.
We use the GitHub Releases API to download the latest compat DB asset (tag: compat_db)
from:
  https://github.com/Vita3K/compatibility

Output: out/compat/vita3k.compat-source.json
"""

from __future__ import annotations

import argparse
import io
import json
import zipfile
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests

from .common import DEFAULT_HEADERS, ensure_dirs, json_dump, now_iso, requests_get_cached


GITHUB_RELEASE_API = "https://api.github.com/repos/Vita3K/compatibility/releases/tags/compat_db"


def normalize_status(raw: str) -> str:
    s = (raw or "").strip().lower()
    # Common buckets across emulators
    if s in {"perfect"}:
        return "perfect"
    if s in {"playable", "ingame", "in game", "in-game"}:
        return "playable" if s == "playable" else "ingame"
    if s in {"intro", "menu", "menus"}:
        return "intro"
    if s in {"boots", "boot", "loadable", "loads"}:
        return "boot"
    if s in {"nothing", "broken", "crash", "unplayable"}:
        return "broken"
    return "unknown"


def pick_asset(assets: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    # Prefer a JSON asset, otherwise a ZIP.
    for ext in (".json", ".zip"):
        for a in assets:
            name = (a.get("name") or "").lower()
            if name.endswith(ext):
                return a
    return assets[0] if assets else None


def load_db_from_asset(asset: Dict[str, Any], cache_dir: str, timeout: int) -> Any:
    url = asset.get("browser_download_url")
    if not url:
        raise RuntimeError("No browser_download_url on release asset")

    resp = requests_get_cached(url, cache_dir=cache_dir, headers=DEFAULT_HEADERS, timeout=timeout)

    name = (asset.get("name") or "").lower()
    if name.endswith(".json"):
        return resp.json()

    if name.endswith(".zip"):
        z = zipfile.ZipFile(io.BytesIO(resp.content))
        # Find first json-like file.
        json_name = None
        for n in z.namelist():
            if n.lower().endswith(".json"):
                json_name = n
                break
        if not json_name:
            raise RuntimeError("No .json file found inside Vita3K compat zip")
        with z.open(json_name) as f:
            return json.load(f)

    # Fallback
    return resp.json()


def parse_records(db: Any) -> List[Dict[str, Any]]:
    records: List[Dict[str, Any]] = []

    # The database format can evolve. Support common shapes:
    # - list[ { title_id, name, status, ... } ]
    # - dict with a key like "titles" or "entries" holding list
    entries = None
    if isinstance(db, list):
        entries = db
    elif isinstance(db, dict):
        for k in ("titles", "entries", "db", "games"):
            if k in db and isinstance(db[k], list):
                entries = db[k]
                break
        if entries is None:
            # Some DBs store dict keyed by title_id
            if all(isinstance(v, dict) for v in db.values()):
                entries = [dict(v, title_id=key) for key, v in db.items()]

    if not isinstance(entries, list):
        return records

    for row in entries:
        if not isinstance(row, dict):
            continue

        title_id = row.get("title_id") or row.get("titleId") or row.get("tid") or row.get("id")
        name = row.get("name") or row.get("title") or row.get("game")
        status_raw = row.get("status") or row.get("state") or row.get("compat")

        if not title_id and not name:
            continue

        records.append(
            {
                "emulatorId": "vita3k",
                "platformId": "psvita",
                "externalIdType": "title_id" if title_id else "name",
                "externalGameId": str(title_id or name),
                "title": name,
                "status": {"raw": status_raw, "normalized": normalize_status(str(status_raw or ""))},
                "meta": {
                    "titleId": title_id,
                },
                "links": {
                    "source": "https://github.com/Vita3K/compatibility/releases/tag/compat_db",
                },
                "raw": row,
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

    # Release metadata (not cached by requests_get_cached to keep logic simple)
    meta = requests.get(GITHUB_RELEASE_API, headers=DEFAULT_HEADERS, timeout=args.timeout)
    meta.raise_for_status()
    release = meta.json()

    asset = pick_asset(release.get("assets", []))
    if not asset:
        raise SystemExit("No assets found on Vita3K compat_db release")

    db = load_db_from_asset(asset, cache_dir=args.cache_dir, timeout=args.timeout)
    records = parse_records(db)

    out = {
        "schemaVersion": "compat-source-v1",
        "source": {
            "id": "vita3k",
            "name": "Vita3K Compatibility DB",
            "kind": "official",
            "url": "https://github.com/Vita3K/compatibility",
        },
        "generatedAt": now_iso(),
        "records": records,
    }

    json_dump(out, f"{args.out_dir}/vita3k.compat-source.json")
    print(f"Wrote {len(records)} records Ã¢â€ â€™ {args.out_dir}/vita3k.compat-source.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
