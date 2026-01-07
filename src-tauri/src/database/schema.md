# ROM Runner SQLite Schema v1.0.1

This is the **local, user-facing SQLite DB** used by ROM Runner to store:
- Scanned ROM library state (files, hashes, derived info)
- User collections and overrides
- Device + device profile state
- BIOS scan results
- **Cached external knowledge** (performance tiers, compat statuses, suggested settings)

Definition packs (platforms/emulators/bios hashes) remain in JSON and are referenced by `platform_id`, `emulator_id`, `definition_game_id`, etc.

## What changed vs v1.0.0

### Cache dedupe + TTL support
The three cache tables now include an optional `expires_at` column:
- `game_performance_cache`
- `emulator_compat_cache`
- `game_settings_cache`

And their **uniqueness rules are tightened** to prevent unbounded growth per logical key:
- performance: `(device_profile_id, platform_id, definition_game_id, COALESCE(emulator_id,''))`
- compat: `(platform_id, emulator_id, definition_game_id)`
- settings: `(platform_id, emulator_id, definition_game_id)`

If you truly want **multi-source history**, consider a separate `*_observations` table and keep the cache tables as “best current answer”.

### Hash-based lookup indexes
Added indexes to keep “scan → hash lookup → match” fast at scale:
- `games(file_md5)`, `games(file_crc32)`
- `bios_files(file_md5)`, `bios_files(file_sha1)`, `bios_files(file_crc32)`
Also added small utility indexes for common UI filters:
- `games(last_scanned_at)`
- `games(is_missing)`

## Performance guidance (SQLite runtime)
These are **connection-level PRAGMAs**, not schema, but they matter a lot:
- Use `journal_mode = WAL` for better concurrency and write performance.
- Consider `synchronous = NORMAL` for better throughput (trade-off is acceptable for local cache-like data).
- Use a reasonable `cache_size` and `temp_store = MEMORY` if you do large scans.

## Optional future optimizations (not required for v1.0.1)

### A) ID dictionary tables (size + index win at very large scale)
If your DB grows into the millions of rows, consider storing repeated IDs as INTEGER:
- `platform_dim(platform_row_id INTEGER PRIMARY KEY, platform_id TEXT UNIQUE)`
- `emulator_dim(emulator_row_id INTEGER PRIMARY KEY, emulator_id TEXT UNIQUE)`

Then store `platform_row_id` / `emulator_row_id` in large tables/caches. This reduces DB+index size and speeds joins.

### B) FTS5 search for fast typeahead
For UI search across titles/filenames, add FTS5:
- virtual table over `games.filename`, `games.detected_title`, and/or `game_metadata.title`
- triggers (or rebuild-on-scan) to keep it in sync

This avoids slow `LIKE '%term%'` scans on big libraries.

## Migration
Use `migration_v1_0_0_to_v1_0_1.sql`.

It **drops and recreates only the cache tables** (safe because they are derived and can be repopulated),
and adds the new indexes + bumps the schema version.
