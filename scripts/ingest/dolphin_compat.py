"""Fetch Dolphin (GC/Wii) compatibility list.

Official source:
  https://dolphin-emu.org/compat/

The Dolphin website organizes the compatibility list by letter index pages.
This script:
  1) discovers index pages from the landing page
  2) collects per-title detail URLs from each index page
  3) fetches each detail page to extract GameID(s), platform, and rating

Output: out/compat/dolphin.compat-source.json
"""

from __future__ import annotations

import argparse
import re
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from bs4 import BeautifulSoup

from .common import DEFAULT_HEADERS, ensure_dirs, json_dump, now_iso, requests_get_cached


BASE = "https://dolphin-emu.org"
LANDING = f"{BASE}/compat/"


STATUS_MAP = {
    "perfect": "perfect",
    "playable": "playable",
    "starts": "ingame",
    "intro": "intro",
    "broken": "broken",
}


def normalize_status(raw: str) -> str:
    s = (raw or "").strip().lower()
    return STATUS_MAP.get(s, "unknown")


def abs_url(href: str) -> str:
    if href.startswith("http"):
        return href
    if not href.startswith("/"):
        href = "/" + href
    return f"{BASE}{href}"


def discover_index_pages(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: Set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Typical pattern: /compat/A/ or /compat/0/
        if re.fullmatch(r"/compat/[A-Z0-9]/", href):
            urls.add(abs_url(href))
    # Fallback: if we couldn't discover any, just use landing.
    return sorted(urls) if urls else [LANDING]


def parse_index_page_for_detail_urls(html: str) -> List[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: Set[str] = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # Detail pages generally look like /compat/<id>/ where <id> is numeric.
        if re.fullmatch(r"/compat/\d+/", href):
            urls.add(abs_url(href))
    return sorted(urls)


GAMEID_RE = re.compile(r"\b[A-Z0-9]{6}\b")


def guess_platform(text: str) -> Optional[str]:
    t = text.lower()
    # The detail page normally contains explicit platform strings.
    if "gamecube" in t:
        return "gamecube"
    if "wii" in t:
        return "wii"
    return None


def extract_detail(html: str, detail_url: str) -> Optional[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text("\n", strip=True)

    # Title: try h1/h2 first.
    title = None
    for tag in ("h1", "h2"):
        h = soup.find(tag)
        if h and h.get_text(strip=True):
            title = h.get_text(" ", strip=True)
            break

    # Rating: often appears as a label string on page.
    rating_raw = None
    m = re.search(r"\b(Perfect|Playable|Starts|Intro|Broken)\b", text)
    if m:
        rating_raw = m.group(1)

    # Game IDs: Dolphin uses 6-char IDs like GZLE01.
    game_ids = sorted(set(GAMEID_RE.findall(text)))
    if not game_ids and not title:
        return None

    platform = guess_platform(text)
    # If platform is unknown, default to "wii"? NoÃ¢â‚¬â€leave null and let mapping decide.

    return {
        "emulatorId": "dolphin",
        "platformId": platform,
        "externalIdType": "dolphin_gameid",
        "externalGameId": game_ids[0] if game_ids else (title or ""),
        "title": title,
        "status": {
            "raw": rating_raw,
            "normalized": normalize_status(rating_raw or ""),
        },
        "meta": {
            "gameIds": game_ids,
        },
        "links": {
            "source": LANDING,
            "detail": detail_url,
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="out/compat")
    ap.add_argument("--cache-dir", default=".cache/http")
    ap.add_argument("--timeout", type=int, default=60)
    ap.add_argument(
        "--max-games",
        type=int,
        default=0,
        help="Limit number of detail pages fetched (0 = no limit).",
    )
    args = ap.parse_args()

    ensure_dirs(args.out_dir, args.cache_dir)

    landing = requests_get_cached(LANDING, cache_dir=args.cache_dir, headers=DEFAULT_HEADERS, timeout=args.timeout)
    index_urls = discover_index_pages(landing.text)

    detail_urls: List[str] = []
    seen: Set[str] = set()
    for idx_url in index_urls:
        idx = requests_get_cached(idx_url, cache_dir=args.cache_dir, headers=DEFAULT_HEADERS, timeout=args.timeout)
        for u in parse_index_page_for_detail_urls(idx.text):
            if u not in seen:
                seen.add(u)
                detail_urls.append(u)

    if args.max_games and len(detail_urls) > args.max_games:
        detail_urls = detail_urls[: args.max_games]

    records: List[Dict[str, Any]] = []
    for u in detail_urls:
        page = requests_get_cached(u, cache_dir=args.cache_dir, headers=DEFAULT_HEADERS, timeout=args.timeout)
        rec = extract_detail(page.text, u)
        if rec:
            records.append(rec)

    out = {
        "schemaVersion": "compat-source-v1",
        "source": {
            "id": "dolphin",
            "name": "Dolphin Compatibility List",
            "kind": "official",
            "url": LANDING,
        },
        "generatedAt": now_iso(),
        "records": records,
    }

    json_dump(out, f"{args.out_dir}/dolphin.compat-source.json")
    print(f"Wrote {len(records)} records Ã¢â€ â€™ {args.out_dir}/dolphin.compat-source.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
