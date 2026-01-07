#!/usr/bin/env python3
"""
RPCS3 Wiki Settings Ingestor
===========================

Extracts per-game recommended settings / non-default configurations from the RPCS3 wiki,
and emits an `emulator-settings-v1` JSON file suitable for ROM Runner ingestion.

Why this approach?
- Most game pages render their configuration from the {{config}} template (Template:Config),
  which produces a consistent set of subsection headings and "Setting / Option / Notes" tables.
- We fetch wiki content via MediaWiki's API (`action=parse`) to reduce breakage from HTML skin changes.

Typical usage:
  python rpcs3_wiki_settings.py --limit 200 --out out/settings.rpcs3-wiki.json

Dependencies:
  pip install requests beautifulsoup4
"""

from __future__ import annotations

import argparse
import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import quote

import requests
from bs4 import BeautifulSoup

SOURCE_ID = "rpcs3-wiki"
WIKI_BASE = "https://wiki.rpcs3.net"
WIKI_API = f"{WIKI_BASE}/api.php"
COMPAT_EXPORT = "https://rpcs3.net/compatibility?api=v1&export"

DEFAULT_STATUS_ORDER = ["Nothing", "Loadable", "Intro", "Ingame", "Playable"]

# PS3 title IDs / serials commonly used on RPCS3:
#  - Disc: BLUS/BLES/BLJM/BCUS/BCES...
#  - PSN:  NPUB/NPEB/NPUA/NPHB/NPJA...
GAME_ID_RE = re.compile(r"\b[A-Z]{4}\d{5}\b")

SECTION_ALIASES = {
    # canonical -> list of possible heading text fragments
    "cpu": ["cpu configuration", "cpu"],
    "gpu": ["gpu configuration", "gpu"],
    "audio": ["audio configuration", "audio"],
    "io": ["i/o configuration", "io configuration", "i/o", "io"],
    "network": ["network configuration", "network"],
    "advanced": ["advanced configuration", "advanced"],
    "debug": ["debug configuration", "debug"],
    "patches": ["recommended patches", "patches"],
}

BOOL_MAP = {
    "on": True,
    "off": False,
    "enabled": True,
    "disabled": "Disabled",  # keep "Disabled" as a string value (often meaningful)
    "true": True,
    "false": False,
    "yes": True,
    "no": False,
}

# A small explicit map for a few frequently used settings.
# Everything else falls back to an auto-normalizer (camelCase).
SETTING_MAP = {
    # CPU
    "spu block size": "spuBlockSize",
    "preferred spu threads": "preferredSpuThreads",
    "enable spu loop detection": "spuLoopDetection",
    "spu decoder": "spuDecoder",
    "ppu decoder": "ppuDecoder",
    "thread scheduler": "threadScheduler",
    "spu xfloat accuracy": "spuXfloatAccuracy",
    # GPU
    "renderer": "renderer",
    "resolution scale": "resolutionScale",
    "write color buffers": "writeColorBuffers",
    "read color buffers": "readColorBuffers",
    "read depth buffers": "readDepthBuffers",
    "write depth buffers": "writeDepthBuffers",
    "anti-aliasing": "antiAliasing",
    "anisotropic filter": "anisotropicFilter",
    "zcull accuracy": "zcullAccuracy",
    "multithreaded rsx": "multithreadedRsx",
    "strict rendering mode": "strictRenderingMode",
    "vsync": "vsync",
    "stretch to display area": "stretchToDisplayArea",
    # Audio
    "audio out windows": "audioOutWindows",
    "audio out linux": "audioOutLinux",
    "audio buffer duration": "audioBufferDuration",
    "enable buffering": "audioEnableBuffering",
    # Network
    "network status": "networkStatus",
    "psn status": "psnStatus",
}


@dataclass
class GameRef:
    serial: str
    title: str
    status: str | None = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slug(title: str) -> str:
    return quote(title.replace(" ", "_"))


def _canonicalize_key(s: str) -> str:
    s = s.strip().lower()
    s = re.sub(r"[â€â€‘â€“â€”-]", "-", s)  # normalize hyphens
    s = s.replace("_", " ")
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s*\(.*?\)\s*", " ", s)  # drop parenthetical
    s = re.sub(r"[^a-z0-9 :/+-]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _to_camel(s: str) -> str:
    parts = re.split(r"[^a-zA-Z0-9]+", s)
    parts = [p for p in parts if p]
    if not parts:
        return "unknown"
    first = parts[0].lower()
    rest = [p[:1].upper() + p[1:] for p in parts[1:]]
    return first + "".join(rest)


def normalize_setting_key(display_key: str) -> str:
    canonical = _canonicalize_key(display_key)
    if canonical in SETTING_MAP:
        return SETTING_MAP[canonical]
    # Heuristic: keep well-known acronyms uppercased where possible
    # (this is cosmetic, safe for consumers).
    camel = _to_camel(canonical)
    camel = camel.replace("spu", "spu").replace("ppu", "ppu").replace("rsx", "rsx").replace("psn", "psn")
    return camel


def parse_option_value(raw: str) -> Any:
    """Parse table "Option" values into reasonable JSON types where safe."""
    if raw is None:
        return None
    s = raw.strip()
    if not s:
        return None

    low = s.lower()

    if low in BOOL_MAP:
        return BOOL_MAP[low]

    # Percentages like "150%" -> 150
    m = re.fullmatch(r"(\d+)\s*%", s)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return s

    # Durations like "100ms" -> 100 (ms is implied)
    m = re.fullmatch(r"(\d+)\s*ms", low)
    if m:
        try:
            return int(m.group(1))
        except ValueError:
            return s

    # Plain integer
    if re.fullmatch(r"\d+", s):
        try:
            return int(s)
        except ValueError:
            return s

    # Float
    if re.fullmatch(r"\d+\.\d+", s):
        try:
            return float(s)
        except ValueError:
            return s

    return s


def _session(user_agent: str) -> requests.Session:
    sess = requests.Session()
    sess.headers.update({"User-Agent": user_agent})
    return sess


def get_game_list_from_compat(sess: requests.Session) -> List[GameRef]:
    """Get list of games from RPCS3 compatibility export (serial -> title/status)."""
    resp = sess.get(COMPAT_EXPORT, timeout=60)
    resp.raise_for_status()
    data = resp.json()

    # The export format has changed a few times; support common shapes.
    results = data.get("results", data)
    games: List[GameRef] = []
    if isinstance(results, dict):
        for serial, info in results.items():
            if isinstance(info, dict):
                title = info.get("title") or info.get("name")
                status = info.get("status") or info.get("compatibility")
                if serial and title:
                    games.append(GameRef(serial=serial, title=title, status=status))
    elif isinstance(results, list):
        for row in results:
            if isinstance(row, dict):
                serial = row.get("serial") or row.get("id")
                title = row.get("title") or row.get("name")
                status = row.get("status")
                if serial and title:
                    games.append(GameRef(serial=serial, title=title, status=status))
    return games


def resolve_wiki_title(sess: requests.Session, title: str) -> Optional[str]:
    """
    Try to resolve a compatibility-export title to an actual wiki page title.
    Returns the resolved title (with spaces), or None if not found.
    """
    # 1) Direct lookup by title
    params = {"action": "query", "titles": title, "format": "json"}
    r = sess.get(WIKI_API, params=params, timeout=30)
    r.raise_for_status()
    q = r.json().get("query", {})
    pages = q.get("pages", {})
    for _, page in pages.items():
        if isinstance(page, dict) and page.get("missing") is None and page.get("title"):
            return page["title"]

    # 2) Search fallback
    params = {
        "action": "query",
        "list": "search",
        "srsearch": f'"{title}"',
        "srlimit": 1,
        "format": "json",
    }
    r = sess.get(WIKI_API, params=params, timeout=30)
    r.raise_for_status()
    hits = r.json().get("query", {}).get("search", [])
    if hits and isinstance(hits, list) and hits[0].get("title"):
        return hits[0]["title"]
    return None


def fetch_wiki_parse(sess: requests.Session, page_title: str) -> Optional[Dict[str, Any]]:
    """Fetch parsed page content via MediaWiki API."""
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "text|sections",
        "format": "json",
        "redirects": 1,
        "disablelimitreport": 1,
        "disableeditsection": 1,
    }
    r = sess.get(WIKI_API, params=params, timeout=60)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        return None
    return data.get("parse")


def extract_game_ids_from_infobox(soup: BeautifulSoup) -> List[str]:
    """
    Extract GameID(s) from the infobox. Many RPCS3 wiki pages include a 'GameID(s)' row
    in the infobox containing one or more serials (BLUS..., NPUB..., etc).
    """
    ids: List[str] = []

    # Try a standard infobox first.
    infobox = soup.find("table", class_=re.compile(r"infobox", re.I))
    if not infobox:
        # Fallback: search in the first few lines of content for "GameID"
        text = soup.get_text(" ", strip=True)
        ids.extend(GAME_ID_RE.findall(text))
        return sorted(set(ids))

    for row in infobox.find_all("tr"):
        th = row.find("th")
        td = row.find("td")
        if not th or not td:
            continue
        label = th.get_text(" ", strip=True).lower()
        if "gameid" in label or "game id" in label:
            # Extract from links and text
            txt = td.get_text(" ", strip=True)
            ids.extend(GAME_ID_RE.findall(txt))
            # Some IDs may appear as link texts
            for a in td.find_all("a"):
                t = a.get_text(strip=True)
                if GAME_ID_RE.fullmatch(t):
                    ids.append(t)
            break

    # Fallback to full page scan if still empty
    if not ids:
        text = soup.get_text(" ", strip=True)
        ids.extend(GAME_ID_RE.findall(text))

    # Prefer unique, stable order
    return sorted(set(ids))


def _section_key_from_heading(text: str) -> Optional[str]:
    t = _canonicalize_key(text)
    for key, aliases in SECTION_ALIASES.items():
        for a in aliases:
            if a in t:
                return key
    return None


def _collect_text(node) -> str:
    # Convert multiple spaces/newlines to a single space.
    txt = node.get_text(" ", strip=True)
    return re.sub(r"\s+", " ", txt).strip()


def extract_configuration(soup: BeautifulSoup) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, str]]]:
    """
    Extract configuration settings.

    Returns:
      settings_by_section: {cpu:{key:value}, gpu:{...}, ...}
      notes_by_section:    {cpu:{key:note},  gpu:{...}, ...}
    """
    settings: Dict[str, Dict[str, Any]] = {}
    notes: Dict[str, Dict[str, str]] = {}

    # Find the "Configuration" header.
    headline = soup.find("span", id="Configuration")
    if not headline:
        # Some pages might use lowercase anchors; be tolerant
        headline = soup.find("span", id=re.compile(r"configuration", re.I))
    if not headline:
        return settings, notes

    h2 = headline.find_parent(["h2", "h3"])
    if not h2:
        return settings, notes

    current_section: Optional[str] = None

    # Walk siblings until next h2 (top-level section)
    sib = h2.find_next_sibling()
    while sib:
        if sib.name == "h2":
            break

        if sib.name in ("h3", "h4"):
            sec = _section_key_from_heading(_collect_text(sib))
            if sec:
                current_section = sec
                settings.setdefault(current_section, {})
                notes.setdefault(current_section, {})
        # Tables (most common)
        if sib.name == "table":
            # only parse if we are inside a recognized section
            if current_section:
                rows = sib.find_all("tr")
                for row in rows:
                    cells = row.find_all(["th", "td"])
                    if len(cells) < 2:
                        continue
                    # Skip header rows that contain "Setting / Option / Notes"
                    header_row = " ".join(c.get_text(" ", strip=True).lower() for c in cells[:3])
                    if "setting" in header_row and "option" in header_row:
                        continue

                    setting_name = cells[0].get_text(" ", strip=True)
                    option = cells[1].get_text(" ", strip=True)
                    note = ""
                    if len(cells) >= 3:
                        note = cells[2].get_text(" ", strip=True)

                    key = normalize_setting_key(setting_name)
                    val = parse_option_value(option)
                    if val is not None:
                        settings[current_section][key] = val
                    if note:
                        notes[current_section][key] = note
        # Lists (fallback)
        if sib.name in ("ul", "ol") and current_section:
            for li in sib.find_all("li", recursive=False):
                text = _collect_text(li)
                if ":" in text:
                    left, right = text.split(":", 1)
                    key = normalize_setting_key(left)
                    val = parse_option_value(right)
                    settings[current_section][key] = val

        sib = sib.find_next_sibling()

    # Remove empty sections
    settings = {k: v for k, v in settings.items() if v}
    notes = {k: v for k, v in notes.items() if v}
    return settings, notes


def extract_section_bullets_and_paras(soup: BeautifulSoup, section_ids: List[str]) -> List[str]:
    """
    Collect bullet items and short paragraphs under a section (until the next h2).
    Useful for Known Issues and Special Notes.
    """
    out: List[str] = []
    headline = None
    for sid in section_ids:
        headline = soup.find("span", id=sid)
        if headline:
            break
    if not headline:
        # fallback: fuzzy match
        for sid in section_ids:
            headline = soup.find("span", id=re.compile(re.escape(sid), re.I))
            if headline:
                break
    if not headline:
        return out

    h2 = headline.find_parent(["h2", "h3"])
    if not h2:
        return out

    def add_text(prefix: str, txt: str):
        txt = re.sub(r"\s+", " ", txt).strip()
        if not txt:
            return
        if prefix:
            out.append(f"{prefix}: {txt}")
        else:
            out.append(txt)

    current_sub: str = ""

    sib = h2.find_next_sibling()
    while sib:
        if sib.name == "h2":
            break
        if sib.name in ("h3", "h4"):
            current_sub = _collect_text(sib)
        elif sib.name in ("ul", "ol"):
            for li in sib.find_all("li"):
                add_text(current_sub, _collect_text(li))
        elif sib.name == "p":
            add_text(current_sub, _collect_text(sib))
        sib = sib.find_next_sibling()

    # de-dup while preserving order
    seen = set()
    dedup = []
    for x in out:
        if x not in seen:
            seen.add(x)
            dedup.append(x)
    return dedup


def build_item(
    page_title: str,
    game_id: str,
    game_title: str,
    settings: Dict[str, Dict[str, Any]],
    setting_notes: Dict[str, Dict[str, str]],
    known_issues: List[str],
    notes: List[str],
) -> Dict[str, Any]:
    item: Dict[str, Any] = {
        "platformId": "ps3",
        "emulatorId": "rpcs3",
        "externalIdType": "ps3-serial",
        "externalGameId": game_id,
        "title": game_title,
        "settings": settings if settings else None,
        "settingsFormat": "rpcs3-config",
        "applyMode": "suggested",
        "knownIssues": known_issues if known_issues else None,
        "notes": " ".join(notes).strip() if notes else None,
        "confidence": "medium",
        "sourceUrl": f"{WIKI_BASE}/index.php?title={_slug(page_title)}",
    }

    # Optional: preserve per-setting notes (kept separate to avoid breaking simple consumers).
    if setting_notes:
        item["settingNotes"] = setting_notes

    # Remove nulls
    return {k: v for k, v in item.items() if v is not None}


def main() -> int:
    ap = argparse.ArgumentParser(description="Extract per-game settings from the RPCS3 wiki")
    ap.add_argument("--out", default="out/settings.rpcs3-wiki.json", help="Output JSON path")
    ap.add_argument("--cache-dir", default=".cache/rpcs3-wiki", help="Cache directory for page parses")
    ap.add_argument("--limit", type=int, help="Limit number of games (post-filter) to process")
    ap.add_argument("--min-status", default="Ingame", help="Minimum compat status (Nothing/Loadable/Intro/Ingame/Playable)")
    ap.add_argument("--sleep", type=float, default=0.35, help="Seconds to sleep between wiki requests")
    ap.add_argument("--include-default", action="store_true", help="Include pages with no extracted config/issues")
    ap.add_argument("--user-agent", default="ROMRunner/0.1 (+https://example.com; contact: you@example.com)",
                    help="User-Agent for HTTP requests (set to a real contact if you run this at scale)")
    ap.add_argument("--source", choices=["compat"], default="compat", help="Game list source (currently: compat export)")
    args = ap.parse_args()

    cache_dir = Path(args.cache_dir)
    cache_dir.mkdir(parents=True, exist_ok=True)

    sess = _session(args.user_agent)

    if args.source == "compat":
        print("Fetching game list from RPCS3 compatibility exportâ€¦")
        games = get_game_list_from_compat(sess)
    else:
        raise ValueError("Unsupported source")

    print(f"Found {len(games)} games from export")

    # Filter by status
    min_status = args.min_status
    if min_status not in DEFAULT_STATUS_ORDER:
        print(f"Warning: unknown --min-status={min_status!r}, not filtering.")
    else:
        min_idx = DEFAULT_STATUS_ORDER.index(min_status)
        before = len(games)
        games = [
            g for g in games
            if (g.status in DEFAULT_STATUS_ORDER and DEFAULT_STATUS_ORDER.index(g.status) >= min_idx)
            or (g.status is None)
        ]
        print(f"Filtered by status â‰¥ {min_status}: {before} â†’ {len(games)} games")

    if args.limit:
        games = games[: args.limit]
        print(f"Limiting to {len(games)} games")

    items: List[Dict[str, Any]] = []
    processed = 0
    matched_pages = 0

    for g in games:
        processed += 1
        if processed % 50 == 0:
            print(f"Progress: {processed}/{len(games)} (items={len(items)})")

        resolved = resolve_wiki_title(sess, g.title)
        if not resolved:
            continue

        matched_pages += 1
        cache_file = cache_dir / f"{re.sub(r'[^A-Za-z0-9_.-]+', '_', resolved)}.parse.json"
        parse_data: Optional[Dict[str, Any]] = None

        if cache_file.exists():
            try:
                parse_data = json.loads(cache_file.read_text(encoding="utf-8"))
            except Exception:
                parse_data = None

        if not parse_data:
            parse_data = fetch_wiki_parse(sess, resolved)
            if not parse_data:
                continue
            cache_file.write_text(json.dumps(parse_data, ensure_ascii=False), encoding="utf-8")
            time.sleep(args.sleep)

        html = (parse_data.get("text", {}) or {}).get("*") if isinstance(parse_data, dict) else None
        if not html:
            continue

        soup = BeautifulSoup(html, "html.parser")

        # Game IDs
        game_ids = extract_game_ids_from_infobox(soup)
        # Fallback to the compat export serial (at least one)
        if not game_ids and g.serial:
            game_ids = [g.serial]

        settings, setting_notes = extract_configuration(soup)
        known_issues = extract_section_bullets_and_paras(soup, ["Known_Issues", "Known_issues", "Known issues"])
        special_notes = extract_section_bullets_and_paras(soup, ["Special_Notes", "Special notes", "Notes"])

        has_meaningful = bool(settings) or bool(known_issues) or bool(special_notes)
        if not has_meaningful and not args.include_default:
            continue

        for game_id in game_ids or [g.serial]:
            items.append(
                build_item(
                    page_title=resolved,
                    game_id=game_id,
                    game_title=parse_data.get("title") or g.title,
                    settings=settings,
                    setting_notes=setting_notes,
                    known_issues=known_issues,
                    notes=special_notes,
                )
            )

    output = {
        "schemaVersion": "emulator-settings-v1",
        "source": SOURCE_ID,
        "sourceUrl": WIKI_BASE,
        "generatedAt": _now_iso(),
        "items": items,
        "stats": {
            "gamesFromCompat": len(games),
            "wikiPagesMatched": matched_pages,
            "itemsEmitted": len(items),
        },
    }

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\nWrote {len(items)} items â†’ {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
