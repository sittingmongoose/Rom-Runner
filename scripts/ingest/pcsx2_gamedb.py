#!/usr/bin/env python3
"""
PCSX2 GameIndex Settings Ingestor

Fetches and parses PCSX2's GameIndex.yaml and emits ROM Runner's
`emulator-settings-v1` JSON with per-game settings and patches.

Source of truth:
- PCSX2 repo: https://github.com/PCSX2/pcsx2
- GameIndex.yaml: https://raw.githubusercontent.com/PCSX2/pcsx2/master/bin/resources/GameIndex.yaml

This script implements the requirements described in Prompt_PCSX2_GameDB_v1_0_0.md.
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, Optional, Tuple

import requests
import yaml


SOURCE_ID = "pcsx2-gameindex"
DEFAULT_SOURCE_URL = "https://raw.githubusercontent.com/PCSX2/pcsx2/master/bin/resources/GameIndex.yaml"
DEFAULT_SOURCE_PAGE_URL = "https://github.com/PCSX2/pcsx2/blob/master/bin/resources/GameIndex.yaml"

# PCSX2 uses a 1-5 compatibility scale (0 sometimes used for unknown).
COMPAT_MAP: Dict[int, str] = {
    0: "unknown",
    1: "broken",
    2: "intro",
    3: "ingame",
    4: "playable",
    5: "perfect",
}

# "Top-level" categories we want to preserve under item["settings"].
# (Note: patches are handled separately)
SETTING_CATEGORIES = [
    "gsHWFixes",
    "gsSWFixes",
    "speedHacks",
    "gameFixes",
    "memcardFilters",
    # Some versions of the DB use nested roundModes/clampModes; we flatten these to the keys below
    "eeRoundMode",
    "eeClamping",
    "vuRoundMode",
    "vuClamping",
    # Also capture nested forms verbatim if present
    "roundModes",
    "clampModes",
]

# Alternate naming observed in documentation/examples
ROUND_MODE_KEYS = ("eeRoundMode", "vuRoundMode")
CLAMP_MODE_KEYS = ("eeClamping", "vuClamping", "eeClampMode", "vuClampMode")


@dataclass(frozen=True)
class CacheMeta:
    etag: Optional[str] = None
    last_modified: Optional[str] = None
    fetched_at_unix: Optional[float] = None


def _load_cache_meta(meta_path: Path) -> CacheMeta:
    if not meta_path.exists():
        return CacheMeta()
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        return CacheMeta(
            etag=data.get("etag"),
            last_modified=data.get("last_modified"),
            fetched_at_unix=data.get("fetched_at_unix"),
        )
    except Exception:
        return CacheMeta()


def _save_cache_meta(meta_path: Path, meta: CacheMeta) -> None:
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(
        json.dumps(
            {
                "etag": meta.etag,
                "last_modified": meta.last_modified,
                "fetched_at_unix": meta.fetched_at_unix,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def fetch_gameindex(
    cache_dir: Path,
    source_url: str = DEFAULT_SOURCE_URL,
    *,
    max_age_days: float = 7.0,
    force_refresh: bool = False,
    timeout_s: int = 30,
) -> Dict[str, Any]:
    """
    Fetch and parse GameIndex.yaml with caching.

    Caching strategy:
    - Cache file: <cache_dir>/GameIndex.yaml
    - Metadata:   <cache_dir>/GameIndex.meta.json
    - If cache is "fresh" (age < max_age_days), use it.
    - Otherwise, attempt conditional GET using ETag / Last-Modified.
      If server returns 304, reuse cached content (and bump fetched_at).
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / "GameIndex.yaml"
    meta_file = cache_dir / "GameIndex.meta.json"

    now = time.time()
    max_age_s = max_age_days * 24 * 60 * 60

    if cache_file.exists() and not force_refresh:
        age = now - cache_file.stat().st_mtime
        if age < max_age_s:
            with cache_file.open("r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}

    headers: Dict[str, str] = {"User-Agent": "rom-runner-pcsx2-gamedb-ingestor/1.0"}
    meta = _load_cache_meta(meta_file)
    if meta.etag:
        headers["If-None-Match"] = meta.etag
    if meta.last_modified:
        headers["If-Modified-Since"] = meta.last_modified

    resp = requests.get(source_url, headers=headers, timeout=timeout_s)
    if resp.status_code == 304 and cache_file.exists():
        # Not modified; bump timestamps and reuse cache.
        cache_file.touch()
        _save_cache_meta(meta_file, CacheMeta(meta.etag, meta.last_modified, now))
        with cache_file.open("r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    resp.raise_for_status()

    cache_file.write_text(resp.text, encoding="utf-8")
    _save_cache_meta(
        meta_file,
        CacheMeta(
            etag=resp.headers.get("ETag"),
            last_modified=resp.headers.get("Last-Modified"),
            fetched_at_unix=now,
        ),
    )

    return yaml.safe_load(resp.text) or {}


def load_gameindex_from_file(path: Path) -> Dict[str, Any]:
    """Parse a local GameIndex.yaml file."""
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _flatten_round_clamp_modes(entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    PCSX2's docs/examples mention roundModes/clampModes as nested groups.
    Some variants also use direct keys like eeRoundMode/vuRoundMode.

    We normalize into:
    - eeRoundMode, vuRoundMode
    - eeClamping, vuClamping   (and map eeClampMode/vuClampMode if present)
    """
    out: Dict[str, Any] = {}

    # direct keys
    for k in ROUND_MODE_KEYS:
        if k in entry:
            out[k] = entry[k]

    for k in ("eeClamping", "vuClamping"):
        if k in entry:
            out[k] = entry[k]

    # nested groups
    rm = entry.get("roundModes")
    if isinstance(rm, dict):
        for k in ROUND_MODE_KEYS:
            if k in rm and k not in out:
                out[k] = rm[k]

    cm = entry.get("clampModes")
    if isinstance(cm, dict):
        # PCSX2 docs often use eeClampMode/vuClampMode; map those to eeClamping/vuClamping.
        if "eeClamping" not in out and "eeClampMode" in cm:
            out["eeClamping"] = cm["eeClampMode"]
        if "vuClamping" not in out and "vuClampMode" in cm:
            out["vuClamping"] = cm["vuClampMode"]

        # If the DB already uses eeClamping/vuClamping inside clampModes, honor it too.
        if "eeClamping" not in out and "eeClamping" in cm:
            out["eeClamping"] = cm["eeClamping"]
        if "vuClamping" not in out and "vuClamping" in cm:
            out["vuClamping"] = cm["vuClamping"]

    return out


def extract_settings(entry: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract settings categories from a GameIndex entry.

    Notes:
    - Patches are extracted separately.
    - Round/clamp modes are normalized (flattened) into direct keys.
    """
    settings: Dict[str, Any] = {}

    # First take known categories verbatim (except round/clamp; we normalize)
    for cat in ("gsHWFixes", "gsSWFixes", "speedHacks", "gameFixes", "memcardFilters"):
        if cat in entry:
            settings[cat] = entry[cat]

    settings.update(_flatten_round_clamp_modes(entry))

    # Keep nested groups too if you want to inspect later (optional but harmless)
    if "roundModes" in entry and isinstance(entry["roundModes"], dict):
        settings.setdefault("roundModes", entry["roundModes"])
    if "clampModes" in entry and isinstance(entry["clampModes"], dict):
        settings.setdefault("clampModes", entry["clampModes"])

    return settings


def extract_patches(entry: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """
    Extract patches from a GameIndex entry.

    Observed/Documented forms:
    - patches:
        default:
          content: |-
            patch=...
        crcXXXX:
          content: |-
            patch=...
    - patches:
        default: |-
          patch=...
    """
    patches = entry.get("patches")
    if not patches:
        return None

    if isinstance(patches, str):
        # Extremely unlikely, but be defensive.
        return {"default": patches}

    if not isinstance(patches, dict):
        return None

    out: Dict[str, str] = {}
    for patch_name, patch_data in patches.items():
        if patch_data is None:
            continue
        if isinstance(patch_data, str):
            out[str(patch_name)] = patch_data
        elif isinstance(patch_data, dict):
            # Most common: {"content": "..."} plus potentially other fields.
            if "content" in patch_data and isinstance(patch_data["content"], str):
                out[str(patch_name)] = patch_data["content"]
            else:
                # Fallback: serialize dict as YAML for preservation.
                try:
                    out[str(patch_name)] = yaml.safe_dump(patch_data, sort_keys=False).strip()
                except Exception:
                    out[str(patch_name)] = str(patch_data)
        else:
            out[str(patch_name)] = str(patch_data)

    return out or None


def determine_apply_mode(entry: Dict[str, Any], settings: Dict[str, Any], patches: Optional[Dict[str, str]]) -> str:
    """
    Determine if settings should be required or auto-applied.

    Heuristic from prompt:
    - If gameFixes or patches exist -> required
    - Else -> auto
    """
    if "gameFixes" in settings:
        return "required"
    if patches:
        return "required"
    if "gsHWFixes" in settings or "gsSWFixes" in settings:
        return "auto"
    if "speedHacks" in settings:
        return "auto"
    return "auto"


def build_items(
    data: Dict[str, Any],
    *,
    source_url: str,
    limit: Optional[int] = None,
) -> Tuple[list, dict]:
    """
    Convert parsed YAML dict into output items and return items+stats.
    """
    items = []
    stats = {
        "totalEntriesInYaml": 0,
        "emittedItems": 0,
        "withSettings": 0,
        "withPatches": 0,
        "applyModeCounts": {},
        "compatCounts": {},
        "regionCounts": {},
        "settingsCategoryCounts": {},
    }

    for serial, entry in data.items():
        stats["totalEntriesInYaml"] += 1
        if limit is not None and len(items) >= limit:
            break

        if not isinstance(entry, dict):
            continue

        title = entry.get("name") or entry.get("name-en") or entry.get("name_en")
        region = entry.get("region")
        compat_raw = entry.get("compat", 0)
        try:
            compat_int = int(compat_raw) if compat_raw is not None else 0
        except Exception:
            compat_int = 0

        settings = extract_settings(entry)
        patches = extract_patches(entry)

        if settings:
            stats["withSettings"] += 1
        if patches:
            stats["withPatches"] += 1

        # Skip entries with no settings or patches; these are just "title/region" rows.
        if not settings and not patches:
            continue

        apply_mode = determine_apply_mode(entry, settings, patches)

        # Stats
        stats["emittedItems"] += 1
        stats["applyModeCounts"][apply_mode] = stats["applyModeCounts"].get(apply_mode, 0) + 1
        compat_norm = COMPAT_MAP.get(compat_int, "unknown")
        stats["compatCounts"][compat_norm] = stats["compatCounts"].get(compat_norm, 0) + 1
        if region:
            stats["regionCounts"][region] = stats["regionCounts"].get(region, 0) + 1

        for cat in ("gsHWFixes", "gsSWFixes", "speedHacks", "gameFixes", "memcardFilters", "eeRoundMode", "vuRoundMode", "eeClamping", "vuClamping"):
            if cat in settings:
                stats["settingsCategoryCounts"][cat] = stats["settingsCategoryCounts"].get(cat, 0) + 1

        items.append(
            {
                "platformId": "ps2",
                "emulatorId": "pcsx2",
                "externalIdType": "ps2-serial",
                "externalGameId": str(serial),
                "title": title,
                "region": region,
                "settings": settings or None,
                "patches": patches,
                "settingsFormat": SOURCE_ID,
                "applyMode": apply_mode,
                "compatRating": {
                    "raw": compat_int,
                    "normalized": compat_norm,
                },
                "confidence": "high",
                "sourceUrl": source_url,
                "notes": None,
            }
        )

    return items, stats


def write_output(out_path: Path, items: list, *, source_page_url: str, generated_at: Optional[str] = None) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": "emulator-settings-v1",
        "source": SOURCE_ID,
        "sourceUrl": source_page_url,
        "generatedAt": generated_at or datetime.now(timezone.utc).isoformat(),
        "items": items,
    }
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def write_stats(stats_path: Path, stats: dict, *, generated_at: Optional[str] = None) -> None:
    stats_path.parent.mkdir(parents=True, exist_ok=True)
    stats_payload = {
        "source": SOURCE_ID,
        "generatedAt": generated_at or datetime.now(timezone.utc).isoformat(),
        "stats": stats,
    }
    stats_path.write_text(json.dumps(stats_payload, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser(description="Extract per-game PCSX2 GameIndex settings into emulator-settings-v1 JSON.")
    ap.add_argument("--out", default="out/settings.pcsx2-gameindex.json", help="Output JSON path")
    ap.add_argument("--stats-out", default=None, help="Optional stats JSON path")
    ap.add_argument("--cache-dir", default=".cache/pcsx2", help="Cache directory for GameIndex.yaml")
    ap.add_argument("--source-url", default=DEFAULT_SOURCE_URL, help="Override GameIndex.yaml URL")
    ap.add_argument("--source-file", default=None, help="Use a local GameIndex.yaml instead of fetching")
    ap.add_argument("--max-age-days", type=float, default=7.0, help="Cache max age in days")
    ap.add_argument("--force-refresh", action="store_true", help="Ignore cache and re-download")
    ap.add_argument("--limit", type=int, default=None, help="Process only the first N YAML entries (debug/sampling)")
    args = ap.parse_args()

    if args.source_file:
        data = load_gameindex_from_file(Path(args.source_file))
        source_url = str(Path(args.source_file).resolve())
        source_page_url = source_url
    else:
        data = fetch_gameindex(
            Path(args.cache_dir),
            args.source_url,
            max_age_days=args.max_age_days,
            force_refresh=args.force_refresh,
        )
        source_url = args.source_url
        source_page_url = DEFAULT_SOURCE_PAGE_URL

    items, stats = build_items(data, source_url=source_url, limit=args.limit)

    out_path = Path(args.out)
    write_output(out_path, items, source_page_url=source_page_url)

    if args.stats_out:
        write_stats(Path(args.stats_out), stats)

    print(f"Wrote {len(items)} settings entries â†’ {out_path}")
    if args.stats_out:
        print(f"Wrote stats â†’ {args.stats_out}")


if __name__ == "__main__":
    main()
