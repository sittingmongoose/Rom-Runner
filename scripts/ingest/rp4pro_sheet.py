#!/usr/bin/env python3
"""
rp4pro_sheet.py â€” Retroid Pocket 4 Pro (Dimensity 1100) compatibility/community sheet ingestor.

Primary sheet (official compatibility sheet):
https://docs.google.com/spreadsheets/d/1pt2LCjE2RBvPlCQBmiPI7ashzGRzEAjx7O50wRfRq7U/

Seed file also references an optional "community tests" sheet (raw submissions):
https://docs.google.com/spreadsheets/d/1BEtjET1HihLtNt1LCN0r44h7y3Lq1rvbeAd2gZ8re3s/

This script supports both via --variant.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional

from layerC_common import (
    SheetTab,
    clean_text,
    discover_sheet_tabs,
    ensure_dirs,
    fetch_sheet_csv,
    fetch_sheet_csv_by_name,
    find_column,
    is_probably_header_row,
    normalize_platform_token,
    normalize_status,
    now_iso_utc,
    read_csv_rows,
)


SHEETS = {
    "official": {
        "sourceId": "rp4pro_official_sheet",
        "sheetId": "1pt2LCjE2RBvPlCQBmiPI7ashzGRzEAjx7O50wRfRq7U",
        "name": "Retroid Pocket 4 Pro Compatibility Sheet",
        "url": "https://docs.google.com/spreadsheets/d/1pt2LCjE2RBvPlCQBmiPI7ashzGRzEAjx7O50wRfRq7U/",
    },
    "community_tests": {
        "sourceId": "rp4pro_community_tests_sheet",
        "sheetId": "1BEtjET1HihLtNt1LCN0r44h7y3Lq1rvbeAd2gZ8re3s",
        "name": "Retroid Pocket 4 Pro Community Tests (raw submissions)",
        "url": "https://docs.google.com/spreadsheets/d/1BEtjET1HihLtNt1LCN0r44h7y3Lq1rvbeAd2gZ8re3s/",
    },
}

DEFAULT_PLATFORMS = ["switch", "ps2", "3ds", "wii", "gamecube", "vita"]

COLUMN_MAP = {
    "game": ["game", "title", "name", "game name", "game title"],
    "status": ["status", "compatibility", "rating", "playability", "playable", "performance"],
    "emulator": ["emulator", "emu", "app", "core"],
    "version": ["version", "emu version", "emulator version", "build", "commit"],
    "notes": ["notes", "comments", "settings", "fix", "tips"],
}


PLATFORM_ALIASES = {
    "switch": ["switch", "nintendo switch", "ns", "yuzu", "ryujinx"],
    "ps2": ["ps2", "playstation2", "playstation 2", "pcsx2", "aethersx2", "nethersx2"],
    "3ds": ["3ds", "nintendo3ds", "nintendo 3ds", "citra", "lime3ds", "panda3ds"],
    "wii": ["wii", "nintendo wii", "dolphin wii"],
    "gamecube": ["gamecube", "gc", "dolphin gamecube"],
    "vita": ["vita", "ps vita", "vita3k"],
}


def _norm(s: str) -> str:
    return normalize_platform_token(s)


def auto_pick_tab(tabs: list[SheetTab], platform_id: str) -> Optional[SheetTab]:
    aliases = PLATFORM_ALIASES.get(platform_id, [platform_id])
    norms = {_norm(a) for a in aliases}
    for t in tabs:
        tn = _norm(t.name)
        if tn in norms or any(a in tn or tn in a for a in norms):
            return t
    p = _norm(platform_id)
    for t in tabs:
        tn = _norm(t.name)
        if tn.startswith(p) or p.startswith(tn):
            return t
    return None


def parse_items(csv_text: str, platform_id: str, base_source_url: str) -> list[dict]:
    headers, rows = read_csv_rows(csv_text)
    if not headers:
        return []

    game_col = find_column(headers, COLUMN_MAP["game"])
    status_col = find_column(headers, COLUMN_MAP["status"])
    emu_col = find_column(headers, COLUMN_MAP["emulator"])
    ver_col = find_column(headers, COLUMN_MAP["version"])
    notes_col = find_column(headers, COLUMN_MAP["notes"])

    if game_col is None or status_col is None:
        for i, r in enumerate(rows[:10]):
            if is_probably_header_row(r):
                headers = r
                rows = rows[i + 1 :]
                game_col = find_column(headers, COLUMN_MAP["game"])
                status_col = find_column(headers, COLUMN_MAP["status"])
                emu_col = find_column(headers, COLUMN_MAP["emulator"])
                ver_col = find_column(headers, COLUMN_MAP["version"])
                notes_col = find_column(headers, COLUMN_MAP["notes"])
                break

    if game_col is None or status_col is None:
        return []

    items: list[dict] = []
    for row in rows:
        if not row or len(row) <= max(game_col, status_col):
            continue

        title = clean_text(row[game_col] if game_col < len(row) else "")
        if not title:
            continue

        raw_status = clean_text(row[status_col] if status_col < len(row) else "")
        normalized, tier = normalize_status(raw_status)

        emulator_id = clean_text(row[emu_col] if (emu_col is not None and emu_col < len(row)) else "")
        emulator_version = clean_text(row[ver_col] if (ver_col is not None and ver_col < len(row)) else "")
        notes = clean_text(row[notes_col] if (notes_col is not None and notes_col < len(row)) else "")

        item = {
            "platformId": platform_id,
            "gameTitle": title,
            "externalGameId": None,
            "performance": {"raw": raw_status, "normalized": normalized, "tier": tier},
            "emulatorId": emulator_id or None,
            "emulatorVersion": emulator_version or None,
            "settings": {},
            "confidence": "layerC",
            "sourceUrl": base_source_url,
        }
        if notes:
            item["settings"]["notes"] = notes
        items.append(item)

    return items


def parse_kv_list(arg_values: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for v in arg_values:
        if "=" not in v:
            continue
        k, val = v.split("=", 1)
        k = k.strip()
        val = val.strip()
        if k and val:
            out[k] = val
    return out


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest RP4 Pro community sheet â†’ layerC-v1 JSON")
    ap.add_argument("--variant", choices=["official", "community_tests"], default="official", help="Which sheet to ingest")
    ap.add_argument("--out", default="out/layerC.rp4pro.json", help="Output path")
    ap.add_argument("--cache-dir", default=".cache/layerC", help="Cache directory (shared across ingestors)")
    ap.add_argument("--platform", action="append", help="Only ingest these platformIds (repeatable). Default: all")
    ap.add_argument("--gid", action="append", default=[], help="Override platform tab gid mapping, e.g. --gid ps2=0")
    ap.add_argument("--sheet-name", action="append", default=[], help="Override platform tab sheet name, e.g. --sheet-name ps2=PS2")
    ap.add_argument("--list-tabs", action="store_true", help="Print discovered tabs (name + gid) and exit")
    args = ap.parse_args()

    meta = SHEETS[args.variant]
    sheet_id = meta["sheetId"]
    base_url = meta["url"]

    ensure_dirs(args.out, args.cache_dir)

    platforms = args.platform or DEFAULT_PLATFORMS
    gid_overrides = parse_kv_list(args.gid)
    sheet_name_overrides = parse_kv_list(args.sheet_name)

    tabs = discover_sheet_tabs(sheet_id, cache_dir=args.cache_dir)

    if args.list_tabs:
        print(f"Discovered {len(tabs)} tabs for sheet {sheet_id}:")
        for t in tabs:
            print(f"- {t.name} (gid={t.gid})")
        return

    all_items: list[dict] = []
    for platform_id in platforms:
        if platform_id in sheet_name_overrides:
            sn = sheet_name_overrides[platform_id]
            print(f"[{platform_id}] Fetching by sheet name: {sn!r}")
            try:
                csv_text = fetch_sheet_csv_by_name(sheet_id, sn, cache_dir=args.cache_dir)
                items = parse_items(csv_text, platform_id, base_url)
                all_items.extend(items)
                print(f"  Found {len(items)} rows")
            except Exception as e:
                print(f"  Error: {e}")
            continue

        if platform_id in gid_overrides:
            gid = gid_overrides[platform_id]
            print(f"[{platform_id}] Fetching by gid override: {gid}")
            try:
                csv_text = fetch_sheet_csv(sheet_id, gid, cache_dir=args.cache_dir)
                items = parse_items(csv_text, platform_id, f"{base_url}edit#gid={gid}")
                all_items.extend(items)
                print(f"  Found {len(items)} rows")
            except Exception as e:
                print(f"  Error: {e}")
            continue

        tab = auto_pick_tab(tabs, platform_id)
        if tab:
            print(f"[{platform_id}] Auto-picked tab: {tab.name!r} (gid={tab.gid})")
            try:
                csv_text = fetch_sheet_csv(sheet_id, tab.gid, cache_dir=args.cache_dir)
                items = parse_items(csv_text, platform_id, f"{base_url}edit#gid={tab.gid}")
                all_items.extend(items)
                print(f"  Found {len(items)} rows")
            except Exception as e:
                print(f"  Error: {e}")
        else:
            print(f"[{platform_id}] Could not map to a tab automatically. Use --list-tabs and set --gid/--sheet-name.")

    output = {
        "schemaVersion": "layerC-v1",
        "source": {
            "id": meta["sourceId"],
            "name": meta["name"],
            "kind": "community",
            "url": base_url,
            "hardwareScope": {"deviceFamily": "Retroid Pocket 4 Pro", "chipset": "Dimensity 1100"},
        },
        "generatedAt": now_iso_utc(),
        "items": all_items,
    }

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {len(all_items)} items â†’ {args.out}")


if __name__ == "__main__":
    main()
