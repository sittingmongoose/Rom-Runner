# Prompt for Claude: ROM Runner SQLite Schema Review + Performance Plan

You are Claude, managing the ROM Runner project. Below is context from the ChatGPT thread and the deliverables I generated.

## Context
ROM Runner uses a local SQLite DB to store **user state** (scanned ROM library, collections, overrides, device profiles, BIOS scans) plus **cached external knowledge** (compatibility, performance tiers, suggested settings).
Definition packs (platform/emulator/game/bios catalogs) remain as JSON and are referenced by external IDs stored in SQLite.

## What ChatGPT generated originally (v1.0.0)
I generated:
- `schema_v1_0_0.sql`
- `schema_v1_0_0.md`

The v1.0.0 schema includes these main table groups:

**Core / metadata**
- `games`: scanned ROM files + hashes + light derived metadata
- `game_metadata`: heavier JSON payload + source info
- `collections`, `collection_games`

**Devices & deployment**
- `devices`, `device_profiles`
- `deployment_history`, `destination_path_overrides`, `destination_scan_history`

**User overrides**
- `platform_overrides` (per-platform emulator preferences)
- `game_overrides` (per-game overrides)

**Caches**
- `game_performance_cache`
- `emulator_compat_cache`
- `game_settings_cache`

**BIOS**
- `bios_files`, `bios_verification`

The intent: keep definition packs in JSON, and store user/library state + derived/cache info in SQLite with pragmatic indexes.

## Concerns raised
User asked if this would get “bloated and slow” once many features and data sources are added.

## Suggestions I made (performance + bloat control)
1) **Prevent cache growth**: enforce a single cache row per logical key; use UPSERT behavior in the app.
2) **Add missing “hot path” indexes**: especially for hash lookups and scan/filter paths.
3) **Consider ID dictionary tables** for platform/emulator IDs if scale becomes large (store INTEGER FKs instead of repeating TEXT).
4) **FTS5** for fast search/typeahead over filenames/titles.
5) **TTL / pruning**: bound caches by age and periodically delete old rows.
6) SQLite runtime pragmas: WAL, synchronous=NORMAL, etc.

## What I implemented now (v1.0.1)
I generated:
- `schema_v1_0_1.sql` (fresh install schema)
- `schema_v1_0_1.md` (notes)
- `migration_v1_0_0_to_v1_0_1.sql` (upgrade script)

### v1.0.1 changes
**A) Cache dedupe**
- Adds `expires_at` column to all three cache tables (optional TTL).
- Tightens uniqueness for caches to reduce bloat:
  - performance: `(device_profile_id, platform_id, definition_game_id, COALESCE(emulator_id,''))`
  - compat: `(platform_id, emulator_id, definition_game_id)`  ← removed `source` from the unique key
  - settings: `(platform_id, emulator_id, definition_game_id)` ← removed `source` from the unique key
- Adds lookup + prune indexes (`..._lookup`, `..._prune`).

**B) Hash/index additions**
- Adds indexes for:
  - `games(file_md5)`, `games(file_crc32)`
  - `bios_files(file_md5)`, `bios_files(file_sha1)`, `bios_files(file_crc32)`
  - utility: `games(last_scanned_at)`, `games(is_missing)`

**C) Migration approach**
- The migration script **drops and recreates only the cache tables** (safe, since they are derived).
- Leaves user/library tables intact.
- Bumps `schema_version` to 2.

## What you should decide
1) Do we want caches to store only the “best current answer” (one row per key), or do we want multi-source history?
   - If we want history, keep cache tables canonical and add separate `*_observations` tables.
2) Should we invest now in ID dictionary tables (platform/emulator dims), or keep TEXT IDs until scale demands it?
3) Do we need FTS5 now for search UX, or is indexed prefix search enough?
4) What TTL policy makes sense (days/weeks) and should it be per-source?

## Files to review
- `schema_v1_0_0.sql` + `schema_v1_0_0.md` (original baseline)
- `schema_v1_0_1.sql` + `schema_v1_0_1.md` (updated schema)
- `migration_v1_0_0_to_v1_0_1.sql` (upgrade script)

If you want, I can also generate:
- an “Option B” schema that fully normalizes platform/emulator IDs into dim tables with INTEGER FKs,
- and/or a full FTS5 package (virtual table + triggers + rebuild strategy).
