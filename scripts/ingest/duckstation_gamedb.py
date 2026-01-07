"""Fetch DuckStation per-game settings database (GameDB).

DuckStation maintains a curated per-game database that includes known fixes and recommended
settings for specific titles (often keyed by serials like SLUS-xxxxx).

This is a strong source for ROM Runner's "best settings" integration for PS1.

Upstream locations vary; DuckStation's database is typically shipped as `gamedb.yaml`.
We try a primary URL and a fallback mirror.

Output schema: emulator-settings-v1 (similar to dolphin_gameini_local.py)
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from typing import Any, Iterable

from .common import fetch_cached


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def require_yaml():
    try:
        import yaml  # type: ignore
        return yaml
    except Exception as e:
        raise RuntimeError(
            "PyYAML is required for DuckStation GameDB ingest. Install with: pip install pyyaml"
        ) from e


def iter_games(obj: Any) -> Iterable[dict[str, Any]]:
    if isinstance(obj, list):
        for x in obj:
            if isinstance(x, dict):
                yield x
        return
    if isinstance(obj, dict):
        for key in ("games", "entries", "data"):
            if isinstance(obj.get(key), list):
                for x in obj[key]:
                    if isinstance(x, dict):
                        yield x
                return
        # Some formats may be dict keyed by serial
        for k, v in obj.items():
            if isinstance(v, dict):
                vv = dict(v)
                vv.setdefault("serial", k)
                yield vv
        return


def pick(d: dict[str, Any], keys: list[str]) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None


def normalize_serial(s: str) -> str:
    return s.strip().upper().replace("_", "-").replace(" ", "")


def extract_settings(game: dict[str, Any]) -> dict[str, Any]:
    """Keep only the parts we can safely store without bloating."""
    out: dict[str, Any] = {}
    for key in ("settings", "enhancements", "hacks", "fixes", "traits", "notes"):
        val = game.get(key)
        if val not in (None, "", [], {}):
            out[key] = val
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="out/settings.duckstation.gamedb.json", help="Output JSON path")
    ap.add_argument("--cache-dir", default=".cache/compat", help="Cache directory for upstream snapshots")
    ap.add_argument("--max-age-days", type=int, default=30, help="Max cache age before refetch")
    ap.add_argument(
        "--url",
        default="https://raw.githubusercontent.com/stenzek/duckstation/master/data/resources/gamedb.yaml",
        help="Primary raw gamedb.yaml URL",
    )
    ap.add_argument(
        "--fallback-url",
        default="https://raw.githubusercontent.com/RetroDECK/Duckstation/main/data/resources/gamedb.yaml",
        help="Fallback mirror raw URL",
    )
    args = ap.parse_args()

    yaml = require_yaml()

    # Fetch (with fallback)
    fetched = None
    last_err = None
    for url in [args.url, args.fallback_url]:
        try:
            fetched = fetch_cached(url, args.cache_dir, suffix=".yaml", max_age_days=args.max_age_days)
            source_url = url
            break
        except Exception as e:
            last_err = e
            continue
    if fetched is None:
        raise RuntimeError(f"Failed to fetch DuckStation gamedb.yaml from both URLs: {last_err}")

    data = yaml.safe_load(fetched.content.decode("utf-8", errors="replace"))

    items: list[dict[str, Any]] = []
    for g in iter_games(data):
        # Serial(s) can be in 'serial', 'serials', or nested identifiers.
        serials = []
        s1 = pick(g, ["serial", "serial_id", "serialId"])
        if isinstance(s1, str):
            serials.append(s1)
        s2 = pick(g, ["serials", "ids", "identifiers"])
        if isinstance(s2, list):
            serials.extend([x for x in s2 if isinstance(x, str)])

        serials = [normalize_serial(s) for s in serials if s]
        serials = sorted(set(serials))
        if not serials:
            continue

        title = pick(g, ["title", "name"])
        settings = extract_settings(g)
        if not settings:
            # If there are no settings fields, still record that the title is known.
            settings = {}

        for serial in serials:
            items.append({
                "platformId": "psx",
                "emulatorId": "duckstation",
                "externalIdType": "psx-serial",
                "externalGameId": serial,
                "title": title,
                "settings": settings,
                "source": "duckstation-gamedb",
                "sourceUrl": source_url,
                "confidence": "high",
            })

    if not items:
        raise RuntimeError("Parsed 0 DuckStation settings rows; YAML schema may have changed.")

    payload = {
        "schemaVersion": "emulator-settings-v1",
        "generatedAt": now_iso(),
        "source": "duckstation-gamedb",
        "sourceUrl": source_url,
        "items": items,
    }

    import os
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(items)} rows Ã¢â€ â€™ {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
