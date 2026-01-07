-- ROM Runner SQLite Migration: v1.0.0 -> v1.0.1
-- Generated: 2026-01-04
--
-- NOTE: This migration intentionally DROPS and RECREATES the three cache tables:
--   - game_performance_cache
--   - emulator_compat_cache
--   - game_settings_cache
-- These are derived/cached data and can be re-fetched/recomputed.
--
-- What it does:
--   1) Drops cache tables (clearing cache)
--   2) Recreates them with dedupe-friendly unique keys + optional TTL columns (expires_at)
--   3) Adds additional indexes for hash-based lookups
--   4) Bumps schema_version to 2

BEGIN IMMEDIATE;

PRAGMA foreign_keys = ON;

-- 1) Drop cache tables (and their indexes)
DROP TABLE IF EXISTS game_performance_cache;
DROP TABLE IF EXISTS emulator_compat_cache;
DROP TABLE IF EXISTS game_settings_cache;

-- 2) Recreate cache tables + indexes (v1.0.1)
-- ---------------------------------------------------------------------------
--  Compatibility cache (derived from definition pack + external sources)
--  v1.0.1 updates:
--   - Adds expires_at for optional TTL pruning.
--   - Tightens uniqueness so caches do not grow unbounded per key.
--   - Adds additional lookup/prune indexes.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS game_performance_cache (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    device_profile_id   INTEGER NOT NULL,
    platform_id         TEXT    NOT NULL,          -- external platform id
    definition_game_id  TEXT    NOT NULL,          -- ROM Runner gameId or "*" for platform default (string)
    game_id             INTEGER,                   -- local games.id if applicable
    emulator_id         TEXT,                      -- external emulator id (nullable)
    performance_tier    TEXT    NOT NULL
                        CHECK (performance_tier IN ('excellent','good','playable','poor','unplayable','unknown')),
    raw_score           INTEGER,                   -- 0-100 if available
    requires_settings   INTEGER NOT NULL DEFAULT 0 CHECK (requires_settings IN (0,1)),
    exclude_from_auto   INTEGER NOT NULL DEFAULT 0 CHECK (exclude_from_auto IN (0,1)),

    source              TEXT,                      -- e.g. "retrocatalog", "emuready"
    source_url          TEXT,
    last_updated        TEXT,                      -- ISO date
    notes               TEXT,

    cached_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at          TEXT,                      -- optional TTL timestamp

    FOREIGN KEY (device_profile_id) REFERENCES device_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
);

-- One row per (device_profile, platform, definition_game_id, emulator_id-or-null)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_perf_cache_key
    ON game_performance_cache(device_profile_id, platform_id, definition_game_id, COALESCE(emulator_id,''));

CREATE INDEX IF NOT EXISTS idx_perf_cache_lookup
    ON game_performance_cache(device_profile_id, platform_id, definition_game_id);

CREATE INDEX IF NOT EXISTS idx_perf_cache_prune
    ON game_performance_cache(expires_at, cached_at);


CREATE TABLE IF NOT EXISTS emulator_compat_cache (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_id         TEXT    NOT NULL,
    emulator_id         TEXT    NOT NULL,
    definition_game_id  TEXT    NOT NULL,
    game_id             INTEGER,

    status              TEXT    NOT NULL
                        CHECK (status IN ('perfect','playable','ingame','menu_intro','boots_only','broken','unknown')),
    source              TEXT    NOT NULL,
    source_url          TEXT,
    confidence          TEXT    NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
    tested_version      TEXT,
    last_updated        TEXT,
    notes               TEXT,

    cached_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at          TEXT,

    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
);

-- One row per (platform, emulator, definition_game_id)
-- Note: If you want multi-source history, store it in a separate observations table.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_compat_cache_key
    ON emulator_compat_cache(platform_id, emulator_id, definition_game_id);

CREATE INDEX IF NOT EXISTS idx_compat_cache_lookup
    ON emulator_compat_cache(platform_id, emulator_id, status);

CREATE INDEX IF NOT EXISTS idx_compat_cache_prune
    ON emulator_compat_cache(expires_at, cached_at);


CREATE TABLE IF NOT EXISTS game_settings_cache (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    platform_id         TEXT    NOT NULL,
    emulator_id         TEXT    NOT NULL,
    definition_game_id  TEXT    NOT NULL,
    game_id             INTEGER,

    settings_json       TEXT    NOT NULL,          -- JSON: emulator settings object
    settings_format     TEXT    NOT NULL DEFAULT 'json' CHECK (settings_format IN ('ini','json','xml','custom')),
    apply_mode          TEXT    NOT NULL DEFAULT 'suggested' CHECK (apply_mode IN ('suggested','auto','required')),

    source              TEXT    NOT NULL,
    source_url          TEXT,
    confidence          TEXT    NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
    tested_version      TEXT,
    notes               TEXT,

    cached_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at          TEXT,

    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
);

-- One row per (platform, emulator, definition_game_id)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_settings_cache_key
    ON game_settings_cache(platform_id, emulator_id, definition_game_id);

CREATE INDEX IF NOT EXISTS idx_settings_cache_lookup
    ON game_settings_cache(platform_id, emulator_id);

CREATE INDEX IF NOT EXISTS idx_settings_cache_prune
    ON game_settings_cache(expires_at, cached_at);



-- 3) Additional indexes (safe/idempotent)
CREATE INDEX IF NOT EXISTS idx_games_file_md5      ON games(file_md5);
CREATE INDEX IF NOT EXISTS idx_games_file_crc32    ON games(file_crc32);
CREATE INDEX IF NOT EXISTS idx_games_last_scanned  ON games(last_scanned_at);
CREATE INDEX IF NOT EXISTS idx_games_is_missing    ON games(is_missing);

CREATE INDEX IF NOT EXISTS idx_bios_files_md5      ON bios_files(file_md5);
CREATE INDEX IF NOT EXISTS idx_bios_files_sha1     ON bios_files(file_sha1);
CREATE INDEX IF NOT EXISTS idx_bios_files_crc32    ON bios_files(file_crc32);

-- 4) Update schema_version
INSERT INTO schema_version (id, schema_version, app_version, notes)
SELECT 1, 2, NULL, 'Migrated to schema v1.0.1 (cache dedupe + hash indexes + optional TTL)'
WHERE NOT EXISTS (SELECT 1 FROM schema_version WHERE id = 1);

UPDATE schema_version
SET schema_version = 2,
    applied_at = CURRENT_TIMESTAMP,
    notes = 'Migrated to schema v1.0.1 (cache dedupe + hash indexes + optional TTL)'
WHERE id = 1 AND schema_version < 2;

-- Optionally record migration (if you use schema_migrations)
INSERT OR IGNORE INTO schema_migrations(version, name)
VALUES (2, 'v1_0_1_cache_dedupe_and_hash_indexes');

COMMIT;
