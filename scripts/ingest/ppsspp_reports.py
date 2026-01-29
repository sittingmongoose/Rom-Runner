"""Ingest PPSSPP Reporting database into emulatorCompatibility + emulatorGameSettings.

Source:
- https://report.ppsspp.org/games

Notes:
- This is community-submitted; treat confidence as medium by default.
- Reports may include device-specific notes; store those in notes/tags, but don't overfit to one GPU.
"""

from __future__ import annotations

import argparse
from bs4 import BeautifulSoup

from .common import fetch_cached, write_items

CANON_STATUS_MAP = {
    "Perfect": "perfect",
    "Playable": "playable",
    "Ingame": "ingame",
    "Menu/Intro": "menu_intro",
    "Doesn't Boot": "broken",
    "Broken": "broken",
    "Unknown": "unknown",
}

def parse_games_index(html: bytes):
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        raise RuntimeError("No <table> found on PPSSPP games page; HTML structure may have changed.")

    # Attempt to infer columns from header
    headers = [th.get_text(strip=True) for th in table.find_all("th")]
    # Common columns: Name, Status, etc.
    rows = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if not tds:
            continue
        cols = [td.get_text(" ", strip=True) for td in tds]
        # Heuristic: first column is title; status column contains one of our known labels
        title = cols[0]
        status_raw = None
        game_key = None
        # find a status-like cell
        for c in cols[1:]:
            if c in CANON_STATUS_MAP:
                status_raw = c
                break
        # find link to per-game report
        a = tr.find("a", href=True)
        if a and "/game/" in a["href"]:
            game_key = a["href"].split("/game/")[-1].strip("/")
        if not title or not status_raw:
            continue
        rows.append((title, status_raw, game_key))
    return rows

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache-dir", default=".cache/ppsspp", help="Cache directory for fetched HTML")
    ap.add_argument("--out-compat", default="out/ppsspp.emulatorCompatibility.json")
    ap.add_argument("--out-settings", default="out/ppsspp.emulatorGameSettings.json")
    ap.add_argument("--generated-at", default="2026-01-01")
    args = ap.parse_args()

    idx = fetch_cached("https://report.ppsspp.org/games", args.cache_dir, suffix=".html", max_age_days=3)
    if idx.status_code != 200:
        raise RuntimeError(f"Fetch failed: {idx.status_code}")

    rows = parse_games_index(idx.content)

    compat_items = []
    settings_items = []
    for title, status_raw, game_key in rows:
        compat_items.append({
            "gameId": "UNMAPPED",
            "platformId": "psp",
            "emulatorId": "ppsspp-standalone",
            "externalIdType": "name",
            "externalGameId": title,
            "status": CANON_STATUS_MAP.get(status_raw, "unknown"),
            "source": "ppsspp-reports",
            "sourceUrl": "https://report.ppsspp.org/games",
            "confidence": "medium",
            "notes": "Imported from PPSSPP community reports index; gameId not mapped yet.",
        })
        # Settings extraction: stage 1 only records that a per-game page exists.
        if game_key:
            settings_items.append({
                "gameId": "UNMAPPED",
                "platformId": "psp",
                "emulatorId": "ppsspp-standalone",
                "externalIdType": "name",
                "externalGameId": title,
                "settings": [],
                "source": "ppsspp-report",
                "sourceUrl": f"https://report.ppsspp.org/game/{game_key}",
                "confidence": "low",
                "notes": "Per-game report page exists; add parser for settings snippets later.",
            })

    write_items(args.out_compat, version="0.1", generated_at=args.generated_at, items=compat_items)
    write_items(args.out_settings, version="0.1", generated_at=args.generated_at, items=settings_items)

if __name__ == "__main__":
    main()
