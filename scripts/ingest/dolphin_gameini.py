#!/usr/bin/env python3
"""
Dolphin GameINI Settings Ingestor (ROM Runner)
============================================

Extracts per-game settings from Dolphin's official per-title INI files located at:

  https://github.com/dolphin-emu/dolphin/tree/master/Data/Sys/GameSettings

This produces an "emulator-settings-v1" JSON artifact that ROM Runner can consume to
auto-apply optimal per-game Dolphin settings.

Key design choices
------------------
- Preserves section names and key casing (Dolphin is case-sensitive in places).
- Handles duplicate keys and "raw" lines (common in [Gecko]/[Patch]/[ActionReplay]).
- Supports either:
  * GitHub fetch mode (default): lists INI files via GitHub API and downloads raw INI.
  * Local mode: reads INI files from a local Dolphin repo checkout.

Usage
-----
Generate a 100-game sample JSON:

  python dolphin_gameini.py --out settings.dolphin-gameini.json --limit 100

Recommended for full coverage (fast + reliable):
- Clone dolphin-emu/dolphin locally (shallow + sparse is fine) and run:

  python dolphin_gameini.py --mode local --local-dir /path/to/dolphin \
    --out settings.dolphin-gameini.json

Environment
-----------
Optionally set a GitHub token to increase API rate limits:

  export GITHUB_TOKEN="..."

"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None  # type: ignore


SOURCE_ID = "dolphin-gameini"
SOURCE_URL = "https://github.com/dolphin-emu/dolphin/tree/master/Data/Sys/GameSettings"
RAW_BASE_DEFAULT = "https://raw.githubusercontent.com/dolphin-emu/dolphin/master/Data/Sys/GameSettings"
CONTENTS_API_DEFAULT = "https://api.github.com/repos/dolphin-emu/dolphin/contents/Data/Sys/GameSettings"
REPO_API_DEFAULT = "https://api.github.com/repos/dolphin-emu/dolphin"


# ---------------------------
# Utilities
# ---------------------------

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def sha1_text(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="replace")).hexdigest()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", errors="replace")


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def eprint(*args: Any) -> None:
    print(*args, file=sys.stderr)


@dataclass
class GitHubEndpoints:
    repo_api: str = REPO_API_DEFAULT
    contents_api: str = CONTENTS_API_DEFAULT
    raw_base: str = RAW_BASE_DEFAULT


def _requests_session() -> "requests.Session":
    if requests is None:
        raise RuntimeError("requests is required (pip install requests)")
    sess = requests.Session()
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        sess.headers.update({"Authorization": f"Bearer {token}"})
    sess.headers.update({
        "Accept": "application/vnd.github+json",
        "User-Agent": "rom-runner-dolphin-gameini/1.0",
    })
    return sess


def _sleep_backoff(attempt: int) -> None:
    # simple exponential backoff with cap
    time.sleep(min(10.0, 0.5 * (2 ** attempt)))


# ---------------------------
# Dolphin-ish INI parsing
# ---------------------------

_SECTION_RE = re.compile(r"^\s*\[(?P<name>[^\]]+)\]\s*$")
_KV_RE = re.compile(r"^(?P<k>[^=]+?)\s*=\s*(?P<v>.*)$")

def parse_dolphin_gameini(content: str) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    Parses Dolphin GameINI with a tolerant parser.

    Returns:
      (title, settings_dict)

    settings_dict structure:
      {
        "Core": {"CPUThread": "True", ...},
        "Patch": {"$Some Patch": ["...raw lines...", ...], "__lines__": [...]},
        ...
      }

    Rules:
    - Comments (leading # or ;) are ignored for settings, but we try to extract a title from
      the first header comment: "# GALE01 - Title".
    - Key casing is preserved.
    - Duplicate keys become lists.
    - Non key/value lines inside a section are stored under "__lines__".
    """
    title: Optional[str] = None
    settings: Dict[str, Any] = {}
    current: Optional[str] = None

    lines = content.splitlines()

    # Header title extraction (best effort)
    for line in lines[:10]:
        s = line.strip()
        if s.startswith("#"):
            # common pattern: "# GALE01 - Super Smash Bros. Melee"
            # we don't enforce the game id here; we just capture the RHS.
            m = re.match(r"^#\s*[A-Z0-9]{4,6}\s*-\s*(.+?)\s*$", s)
            if m:
                title = m.group(1).strip() or None
                break

    def ensure_section(name: str) -> Dict[str, Any]:
        if name not in settings or not isinstance(settings[name], dict):
            settings[name] = {}
        return settings[name]

    for raw in lines:
        line = raw.rstrip("\n")

        # Strip BOM in first line if present
        if current is None and line.startswith("\ufeff"):
            line = line.lstrip("\ufeff")

        stripped = line.strip()
        if not stripped:
            continue

        # Section header
        msec = _SECTION_RE.match(stripped)
        if msec:
            current = msec.group("name").strip()
            ensure_section(current)
            continue

        # Outside sections, ignore
        if current is None:
            continue

        # Skip full-line comments
        if stripped.startswith("#") or stripped.startswith(";"):
            continue

        mkv = _KV_RE.match(stripped)
        sec = ensure_section(current)

        if mkv:
            k = mkv.group("k").strip()
            v = mkv.group("v").strip()

            # Preserve empty values too
            if k in sec:
                # Convert existing -> list
                if isinstance(sec[k], list):
                    sec[k].append(v)
                else:
                    sec[k] = [sec[k], v]
            else:
                sec[k] = v
        else:
            # Raw line: store it (useful for some patch/code sections)
            sec.setdefault("__lines__", [])
            if isinstance(sec["__lines__"], list):
                sec["__lines__"].append(stripped)

    # Remove truly empty sections
    settings = {k: v for k, v in settings.items() if isinstance(v, dict) and len(v) > 0}

    return title, settings


# ---------------------------
# Platform + apply mode heuristics
# ---------------------------

def get_platform_from_game_id(game_id: str) -> str:
    """
    Dolphin IDs:
      - GameCube discs: commonly start with G, D, P, U
      - Wii discs: commonly start with R, S, W, H
    (Best-effort; ROM Runner can refine later if needed.)
    """
    if not game_id:
        return "gamecube"
    first = game_id[0].upper()
    if first in {"R", "S", "W", "H"}:
        return "wii"
    return "gamecube"


_REQUIRED_CORE_KEYS = {
    "CPUThread",
    "SyncOnSkipIdle",
    "GPUDeterminismMode",
    "FastDiscSpeed",
    "MMU",
    "DSPHLE",
    "DSPThread",
}
_AUTO_SECTIONS = {
    "Video_Hacks",
    "Video_Settings",
    "Video_Enhancements",
    "Video_Stereoscopy",
    "Video",
}
_REQUIRED_SECTIONS = {
    # If these exist with content, they are usually compatibility-critical.
    "Patch",
    "Gecko",
    "ActionReplay",
    "Wii",
    "Wii_SIDevice",
}


def determine_apply_mode(settings: Dict[str, Any]) -> str:
    """
    Determine if settings are required, auto, or suggested.

    Heuristic aligned with the prompt:
      - required: likely stability / correctness / compatibility fixes
      - auto: performance/compatibility tweaks, apply by default
      - suggested: cosmetic/enhancement-only

    This is best-effort and can be revisited once ROM Runner has end-user telemetry.
    """
    # required if core has stability-like keys
    core = settings.get("Core")
    if isinstance(core, dict) and any(k in core for k in _REQUIRED_CORE_KEYS):
        return "required"

    # required if explicit patch/code sections exist and are non-empty
    for s in _REQUIRED_SECTIONS:
        sec = settings.get(s)
        if isinstance(sec, dict) and len(sec) > 0:
            return "required"

    # suggested if ONLY enhancements exist (and maybe metadata like EmuState)
    non_meta_sections = [k for k in settings.keys() if k not in {"EmuState"}]
    if non_meta_sections and all(k == "Video_Enhancements" for k in non_meta_sections):
        return "suggested"

    # auto if any "hackish" sections exist
    for s in _AUTO_SECTIONS:
        if s in settings:
            return "auto"

    return "auto"


# ---------------------------
# Fetch / enumerate INI files
# ---------------------------

def _cache_path(cache_dir: Path, key: str, suffix: str) -> Path:
    return cache_dir / f"{sha1_text(key)}{suffix}"


def fetch_default_branch(sess: "requests.Session", endpoints: GitHubEndpoints, cache_dir: Path) -> str:
    cache_file = cache_dir / "repo_default_branch.json"
    if cache_file.exists() and (time.time() - cache_file.stat().st_mtime) < 86400:
        try:
            return json.loads(read_text(cache_file))["default_branch"]
        except Exception:
            pass

    resp = sess.get(endpoints.repo_api, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    write_json(cache_file, {"default_branch": data.get("default_branch", "master")})
    return data.get("default_branch", "master")


def list_ini_files_github(
    sess: "requests.Session",
    endpoints: GitHubEndpoints,
    cache_dir: Path,
    prefer_tree: bool = False,
) -> List[str]:
    """
    List INI filenames in Data/Sys/GameSettings.

    Notes:
    - GitHub "contents" API returns a directory listing (fast, usually enough).
    - Some very large directories may be truncated or capped. If you suspect missing files,
      set prefer_tree=True or use --mode local with a repo checkout.
    """
    cache_file = cache_dir / "gameini_file_list.json"
    if cache_file.exists() and (time.time() - cache_file.stat().st_mtime) < 86400:
        try:
            return json.loads(read_text(cache_file))["files"]
        except Exception:
            pass

    # Preferred approach: Contents API (simple)
    def contents_list() -> List[str]:
        resp = sess.get(endpoints.contents_api, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        files: List[str] = []
        if isinstance(data, list):
            for item in data:
                name = item.get("name", "")
                if isinstance(name, str) and name.lower().endswith(".ini"):
                    files.append(name)
        return sorted(set(files))

    # Optional: tree API (more complete, but may be huge and/or truncated).
    def tree_list() -> List[str]:
        branch = fetch_default_branch(sess, endpoints, cache_dir)
        tree_url = f"{endpoints.repo_api}/git/trees/{branch}?recursive=1"
        resp = sess.get(tree_url, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        if data.get("truncated") is True:
            eprint("WARNING: Git tree listing is truncated by GitHub API. Consider --mode local.")
        files: List[str] = []
        for node in data.get("tree", []):
            p = node.get("path", "")
            if isinstance(p, str) and p.startswith("Data/Sys/GameSettings/") and p.lower().endswith(".ini"):
                files.append(p.split("/")[-1])
        return sorted(set(files))

    files = tree_list() if prefer_tree else contents_list()

    # If we got nothing, fallback to the other method.
    if not files:
        files = tree_list() if not prefer_tree else contents_list()

    write_json(cache_file, {"files": files, "generatedAt": utc_now_iso()})
    return files


def fetch_ini_content_github(
    sess: "requests.Session",
    endpoints: GitHubEndpoints,
    cache_dir: Path,
    filename: str,
    sleep_s: float = 0.05,
) -> Optional[str]:
    """
    Fetch raw INI content (cached on disk).
    """
    cache_file = cache_dir / "ini" / filename
    if cache_file.exists():
        return read_text(cache_file)

    url = f"{endpoints.raw_base}/{filename}"
    for attempt in range(5):
        try:
            resp = sess.get(url, timeout=30)
            if resp.status_code in (403, 429):
                _sleep_backoff(attempt)
                continue
            resp.raise_for_status()
            text = resp.text
            cache_file.parent.mkdir(parents=True, exist_ok=True)
            write_text(cache_file, text)
            if sleep_s:
                time.sleep(sleep_s)
            return text
        except Exception as e:
            if attempt == 4:
                eprint(f"ERROR fetching {filename}: {e}")
                return None
            _sleep_backoff(attempt)
    return None


def list_ini_files_local(local_dir: Path) -> List[Path]:
    """
    Enumerate INI files from a local Dolphin repo checkout (or a mirror containing Data/Sys/GameSettings).
    """
    root = local_dir / "Data" / "Sys" / "GameSettings"
    if not root.exists():
        raise FileNotFoundError(f"Local GameSettings directory not found: {root}")
    return sorted(root.glob("*.ini"))


# ---------------------------
# Build output items
# ---------------------------

def build_item(game_id: str, title: Optional[str], settings: Dict[str, Any], source_url: str) -> Dict[str, Any]:
    return {
        "platformId": get_platform_from_game_id(game_id),
        "emulatorId": "dolphin",
        "externalIdType": "dolphin-game-id",
        "externalGameId": game_id,
        "title": title,
        "settings": settings,
        "settingsFormat": "dolphin-ini",
        "applyMode": determine_apply_mode(settings),
        "confidence": "high",
        "sourceUrl": source_url,
        "notes": None,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract Dolphin GameINI settings into emulator-settings-v1 JSON.")
    ap.add_argument("--out", default="out/settings.dolphin-gameini.json", help="Output JSON path.")
    ap.add_argument("--cache-dir", default=".cache/dolphin-gameini", help="Cache directory (GitHub mode).")
    ap.add_argument("--limit", type=int, default=0, help="Limit number of games processed (0 = no limit).")

    ap.add_argument("--mode", choices=["github", "local"], default="github", help="Fetch from GitHub or local checkout.")
    ap.add_argument("--local-dir", default="", help="Path to local dolphin repo (required for --mode local).")

    ap.add_argument("--prefer-tree", action="store_true", help="Prefer Git tree API for listing files (GitHub mode).")
    ap.add_argument("--raw-base", default=RAW_BASE_DEFAULT, help="Override RAW base URL (GitHub mode).")
    ap.add_argument("--contents-api", default=CONTENTS_API_DEFAULT, help="Override GitHub contents API URL (GitHub mode).")
    ap.add_argument("--repo-api", default=REPO_API_DEFAULT, help="Override repo API URL (GitHub mode).")

    ap.add_argument("--exclude-section", action="append", default=[], help="Section name to exclude (repeatable).")
    ap.add_argument("--drop-empty", action="store_true", help="Drop items with no parsed settings (default behavior anyway).")

    args = ap.parse_args()

    out_path = Path(args.out)
    cache_dir = Path(args.cache_dir)
    exclude_sections = set(args.exclude_section or [])

    endpoints = GitHubEndpoints(
        repo_api=args.repo_api,
        contents_api=args.contents_api,
        raw_base=args.raw_base,
    )

    items: List[Dict[str, Any]] = []

    if args.mode == "github":
        if requests is None:
            raise RuntimeError("GitHub mode requires requests (pip install requests)")
        sess = _requests_session()
        cache_dir.mkdir(parents=True, exist_ok=True)

        eprint("Listing INI files (GitHub)...")
        files = list_ini_files_github(sess, endpoints, cache_dir, prefer_tree=args.prefer_tree)
        if args.limit and args.limit > 0:
            files = files[: args.limit]
        eprint(f"Found {len(files)} INI files to process.")

        for idx, filename in enumerate(files, start=1):
            if idx % 200 == 0:
                eprint(f"Processed {idx}/{len(files)}...")
            content = fetch_ini_content_github(sess, endpoints, cache_dir, filename)
            if not content:
                continue
            game_id = filename[:-4] if filename.lower().endswith(".ini") else filename
            title, settings = parse_dolphin_gameini(content)
            if exclude_sections:
                for s in list(settings.keys()):
                    if s in exclude_sections:
                        settings.pop(s, None)
            if not settings and args.drop_empty:
                continue
            items.append(build_item(
                game_id=game_id,
                title=title,
                settings=settings,
                source_url=f"{endpoints.raw_base}/{filename}",
            ))

    else:  # local
        local_dir = Path(args.local_dir) if args.local_dir else None
        if not local_dir:
            raise ValueError("--local-dir is required for --mode local")
        eprint(f"Listing INI files (local): {local_dir}")
        ini_paths = list_ini_files_local(local_dir)
        if args.limit and args.limit > 0:
            ini_paths = ini_paths[: args.limit]
        eprint(f"Found {len(ini_paths)} INI files to process.")

        for idx, ini_path in enumerate(ini_paths, start=1):
            if idx % 200 == 0:
                eprint(f"Processed {idx}/{len(ini_paths)}...")
            content = read_text(ini_path)
            game_id = ini_path.stem
            title, settings = parse_dolphin_gameini(content)
            if exclude_sections:
                for s in list(settings.keys()):
                    if s in exclude_sections:
                        settings.pop(s, None)
            if not settings and args.drop_empty:
                continue
            # best-effort sourceUrl for local mode
            items.append(build_item(
                game_id=game_id,
                title=title,
                settings=settings,
                source_url=f"{RAW_BASE_DEFAULT}/{ini_path.name}",
            ))

    output = {
        "schemaVersion": "emulator-settings-v1",
        "source": SOURCE_ID,
        "sourceUrl": SOURCE_URL,
        "generatedAt": utc_now_iso(),
        "items": items,
    }

    write_json(out_path, output)
    eprint(f"Wrote {len(items)} entries -> {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
