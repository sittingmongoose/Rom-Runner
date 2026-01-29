# RPCS3 Wiki Settings Ingestor – Parser Notes

This document explains the RPCS3 wiki page patterns that the ingestor targets and the main parsing decisions.

## 1) Where settings live on the wiki

Most game pages include a `== Configuration ==` section that is rendered via the `{{config}}` template.

In practice that section typically appears as:

- `## Configuration`
- `### CPU configuration` / `### GPU configuration` / `### Audio configuration` / etc.
- A table with columns: **Setting**, **Option**, **Notes**

Example pages:
- *Skate 2* shows multiple GPU settings and a CPU setting, with notes per-row.
- *Call of Duty: Black Ops 2* shows CPU + GPU settings with row notes.

The template documentation (Template:Config) also clarifies that game pages should list only settings that deviate from defaults, and that per-setting notes may be added. (The ingestor preserves row-notes separately as `settingNotes`.)

## 2) How game IDs (serials) are represented

Game pages usually have an infobox near the top with a **GameID(s)** row. This row contains one or more PS3 serials such as:

- Disc IDs: `BLUSxxxxx`, `BLESxxxxx`, `BLJMxxxxx`, etc.
- PSN IDs: `NPUBxxxxx`, `NPEBxxxxx`, `NPUAxxxxx`, etc.

The ingestor extracts these IDs with a regex and emits one output item per serial.

## 3) Known Issues and Special Notes

Many pages also include:

- `## Known Issues` (with subheadings and/or bullet lists)
- `## Special Notes` (often includes netplay notes, patches, etc.)

The ingestor collects short paragraphs and bullet items under these sections until the next top-level section.

## 4) Normalization & typing

**Setting names** are normalized to stable keys using:

- A small explicit map for common settings (e.g., “SPU block size” → `spuBlockSize`)
- A fallback “auto camelCase” normalizer for unfamiliar keys

**Option values** are lightly typed:
- `On` / `Off` → booleans (except `Disabled`, which is kept as a string because it’s frequently meaningful)
- `150%` → `150`
- `100ms` → `100`
- integers / floats are parsed when unambiguous

## 5) Patches section caveat

Some pages include a `Patches` section with large YAML blocks. The current ingestor does not attempt to parse YAML patches; it focuses on config tables and note/issue text.

If you later want patch support, consider a second pass that:
- detects code blocks under `Patches`
- extracts patch names and any “Notes” fields

## 6) Fetch method (API vs raw HTML)

The ingestor uses the MediaWiki API (`action=parse`) rather than scraping full page HTML. This tends to be more stable across skin/layout changes.

Some wiki endpoints can return 403 depending on URL/namespace; the `action=parse` method generally avoids those problems for normal game pages.

## 7) Output compatibility

Output follows the `emulator-settings-v1` envelope:
- `items[].settings` is grouped by section (`cpu`, `gpu`, etc)
- per-setting notes are kept in `items[].settingNotes` to avoid losing detail while keeping `settings` simple

If you need a strict schema with no extra keys, you can drop `settingNotes` during post-processing.
