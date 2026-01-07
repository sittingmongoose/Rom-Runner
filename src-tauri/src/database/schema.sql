-- ROM Runner Local SQLite Schema v1.0.1
-- Generated: 2026-01-04
-- Target: SQLite 3.x
--
-- Notes:
-- * Some columns reference IDs from the ROM Runner Definition Pack JSON files (platforms/devices/OS/emulators/bios).
--   These are stored as TEXT identifiers and are NOT enforced with SQLite foreign-key constraints.
-- * JSON columns are stored as TEXT; parse/validate in the application layer.

PRAGMA foreign_keys = ON;

BEGIN;

-- ---------------------------------------------------------------------------
--  Schema versioning
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_version (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    schema_version  INTEGER NOT NULL,
    applied_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    app_version     TEXT,
    notes           TEXT
);

-- Optional: history of applied migrations (one row per migration script)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     INTEGER PRIMARY KEY,
    name        TEXT    NOT NULL,
    applied_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
--  Definition pack metadata (used to invalidate caches when definitions change)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS definition_pack_meta (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    pack_version         TEXT,          -- e.g. "2.5.0" (Definition Pack bundle version)
    schema_version       INTEGER,       -- Definition pack schemaVersion (integer)
    platforms_version    TEXT,          -- platforms_vX_Y_Z.json version
    emulators_version    TEXT,          -- emulators_vX_Y_Z.json version
    devices_version      TEXT,          -- devices.json or devices_vX_Y_Z.json version (if present)
    bios_hashes_version  TEXT,          -- bios-hashes_vX_Y_Z.json version
    loaded_at            TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    pack_hash            TEXT,          -- optional checksum of the pack contents for quick comparisons
    notes                TEXT
);

-- ---------------------------------------------------------------------------
--  Library management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,

    -- File info
    filepath          TEXT    NOT NULL UNIQUE,     -- full path to the ROM file
    filename          TEXT    NOT NULL,            -- basename of file
    file_size         INTEGER NOT NULL,            -- bytes
    file_md5          TEXT,                        -- hex
    file_crc32        TEXT,                        -- hex

    -- Identification (Definition Pack IDs)
    platform_id       TEXT    NOT NULL,            -- references platforms.json id (external)
    detected_title    TEXT,                        -- from filename parsing
    matched_game_id   TEXT,                        -- matched external/definition id (string; may be null)

    -- Status
    format            TEXT,                        -- zip, 7z, chd, iso, etc.
    is_archive        INTEGER NOT NULL DEFAULT 0 CHECK (is_archive IN (0,1)),
    archive_contents  TEXT,                        -- JSON array of files in archive (if is_archive=1)
    needs_conversion  INTEGER NOT NULL DEFAULT 0 CHECK (needs_conversion IN (0,1)),
    is_missing        INTEGER NOT NULL DEFAULT 0 CHECK (is_missing IN (0,1)), -- file missing from disk but record retained

    -- Metadata (lightweight parsing)
    region            TEXT,                        -- e.g. USA/EUR/JPN/World/Unknown
    languages         TEXT,                        -- JSON array
    revision          TEXT,
    is_hack           INTEGER NOT NULL DEFAULT 0 CHECK (is_hack IN (0,1)),
    hack_type         TEXT,                        -- translation, improvement, etc.

    -- Timestamps
    added_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at   TEXT,
    last_played_at    TEXT
);

CREATE TABLE IF NOT EXISTS game_metadata (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id           INTEGER NOT NULL UNIQUE,

    -- Canonical metadata
    title             TEXT,
    sort_title        TEXT,
    description       TEXT,
    release_date      TEXT,                        -- ISO date (YYYY-MM-DD) if known
    developers        TEXT,                        -- JSON array
    publishers        TEXT,                        -- JSON array
    genres            TEXT,                        -- JSON array
    players_min       INTEGER,
    players_max       INTEGER,
    rating            TEXT,                        -- e.g. ESRB/PEGI rating string
    cover_url         TEXT,
    screenshot_urls   TEXT,                        -- JSON array

    -- Provenance
    metadata_source   TEXT,                        -- e.g. "igdb", "screenscraper", "custom"
    metadata_payload  TEXT,                        -- JSON blob of raw source payload (optional)

    updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS collections (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT    NOT NULL,
    description       TEXT,
    collection_type   TEXT    NOT NULL DEFAULT 'manual' CHECK (collection_type IN ('manual','auto','system')),
    rules_json        TEXT,                        -- JSON rules for auto lists (filters, tiers, etc.)
    is_pinned         INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0,1)),
    created_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TEXT
);

CREATE TABLE IF NOT EXISTS collection_games (
    collection_id     INTEGER NOT NULL,
    game_id           INTEGER NOT NULL,
    sort_order        INTEGER,                     -- optional manual ordering
    added_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (collection_id, game_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
) WITHOUT ROWID;

-- ---------------------------------------------------------------------------
--  Device management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS devices (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Definition Pack ID (external)
    device_id            TEXT    NOT NULL,         -- references devices.json id (external)
    nickname             TEXT,                     -- user's custom display name

    -- Connection
    connection_type      TEXT    NOT NULL CHECK (connection_type IN ('usb','network','sd_card','folder')),
    last_connected_path  TEXT,                     -- last known mount point / network path

    -- State
    is_favorite          INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0,1)),
    last_connected_at    TEXT,
    created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_connected_at ON devices(last_connected_at);

CREATE TABLE IF NOT EXISTS device_profiles (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    device_row_id          INTEGER NOT NULL,

    -- Definition Pack IDs (external)
    os_id                  TEXT    NOT NULL,       -- references operating-systems.json id (external)

    profile_name           TEXT,                   -- e.g. "RG35XX Plus - MuOS"
    detected_layout_profile TEXT,                  -- references layoutDetectionProfiles id (external)
    notes                  TEXT,

    -- Path overrides
    custom_roms_path       TEXT,
    custom_bios_path       TEXT,
    custom_saves_path      TEXT,
    custom_states_path     TEXT,
    custom_config_path     TEXT,

    created_at             TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TEXT,

    FOREIGN KEY (device_row_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_device_profiles_device_row_id ON device_profiles(device_row_id);
CREATE INDEX IF NOT EXISTS idx_device_profiles_os_id ON device_profiles(os_id);

CREATE TABLE IF NOT EXISTS deployment_history (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    device_profile_id   INTEGER NOT NULL,

    deployment_name     TEXT,                      -- optional label (e.g. "Weekend build")
    destination_path    TEXT    NOT NULL,          -- mount point / path used
    destination_id      TEXT,                      -- stable id if known (e.g. volume UUID)

    totals_json         TEXT,                      -- JSON: counts/sizes by platform, etc.
    options_json        TEXT,                      -- JSON: user-selected deployment options
    manifest_json       TEXT,                      -- JSON: transfer manifest (files + hashes)

    status              TEXT NOT NULL DEFAULT 'completed'
                         CHECK (status IN ('started','completed','failed','cancelled')),
    started_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        TEXT,
    error_message       TEXT,

    FOREIGN KEY (device_profile_id) REFERENCES device_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deployments_device_profile ON deployment_history(device_profile_id);
CREATE INDEX IF NOT EXISTS idx_deployments_started_at ON deployment_history(started_at);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployment_history(status);

-- Destination scanning / per-destination overrides (v2.5 requirements support)
CREATE TABLE IF NOT EXISTS destination_path_overrides (
    destination_id      TEXT PRIMARY KEY,          -- stable destination identifier (volume UUID or user-defined)
    os_id               TEXT,                      -- detected OS id (external)
    overrides_json      TEXT NOT NULL,             -- JSON: path overrides & detected layout info
    last_scanned_at     TEXT,
    created_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS destination_scan_history (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    destination_id      TEXT NOT NULL,
    os_id               TEXT,                      -- detected OS id (external)
    detected_layout_profile TEXT,                  -- detected layout profile id (external)
    scan_result_json    TEXT NOT NULL,             -- JSON: full scan report
    scanned_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_dest_scan_destination ON destination_scan_history(destination_id);
CREATE INDEX IF NOT EXISTS idx_dest_scan_scanned_at ON destination_scan_history(scanned_at);

-- ---------------------------------------------------------------------------
--  User settings and overrides
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
    key               TEXT PRIMARY KEY,
    value             TEXT,                        -- stringified value; use value_type to decode
    value_type        TEXT NOT NULL DEFAULT 'string' CHECK (value_type IN ('string','number','boolean','json')),
    updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Per-platform emulator preference. device_profile_id NULL => global override.
CREATE TABLE IF NOT EXISTS platform_overrides (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    device_profile_id INTEGER,                     -- nullable (global override)
    platform_id       TEXT    NOT NULL,            -- external platform id
    emulator_id       TEXT    NOT NULL,            -- external emulator id
    notes             TEXT,
    updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Uniqueness: one override per (device_profile_id, platform_id)
CREATE UNIQUE INDEX IF NOT EXISTS uidx_platform_overrides_scoped
    ON platform_overrides(device_profile_id, platform_id)
    WHERE device_profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_platform_overrides_global
    ON platform_overrides(platform_id)
    WHERE device_profile_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_overrides_platform ON platform_overrides(platform_id);

-- Per-game override (emulator choice + settings). device_profile_id NULL => global override.
CREATE TABLE IF NOT EXISTS game_overrides (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    device_profile_id INTEGER,                     -- nullable (global)
    game_id           INTEGER NOT NULL,
    emulator_id       TEXT,                        -- nullable; if null, only settings apply
    custom_settings   TEXT,                        -- JSON of override settings
    apply_mode        TEXT NOT NULL DEFAULT 'suggested' CHECK (apply_mode IN ('suggested','auto','required')),
    is_enabled        INTEGER NOT NULL DEFAULT 1 CHECK (is_enabled IN (0,1)),
    notes             TEXT,
    updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_game_overrides_scoped
    ON game_overrides(device_profile_id, game_id)
    WHERE device_profile_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_game_overrides_global
    ON game_overrides(game_id)
    WHERE device_profile_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_game_overrides_game_id ON game_overrides(game_id);

-- ---------------------------------------------------------------------------
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



--  BIOS management
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bios_files (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,

    filepath          TEXT    NOT NULL UNIQUE,
    filename          TEXT    NOT NULL,
    file_size         INTEGER NOT NULL,
    file_md5          TEXT,
    file_sha1         TEXT,
    file_crc32        TEXT,

    -- Optional association (Definition Pack IDs)
    platform_id       TEXT,                        -- if known; external platform id
    detected_name     TEXT,                        -- if known (e.g. "SCPH-5501.bin")

    added_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_scanned_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_bios_files_filename ON bios_files(filename);
CREATE INDEX IF NOT EXISTS idx_bios_files_platform ON bios_files(platform_id);

CREATE TABLE IF NOT EXISTS bios_verification (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    bios_file_id         INTEGER NOT NULL,

    bios_definition_id   TEXT    NOT NULL,         -- references bios-hashes.json id (external)
    is_match             INTEGER NOT NULL CHECK (is_match IN (0,1)),
    matched_hash_type    TEXT,                      -- md5/sha1/crc32/sha256
    expected_hashes_json TEXT,                      -- JSON: list of known hashes for the bios definition
    file_hashes_json     TEXT,                      -- JSON: computed hashes
    required             INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0,1)), -- per definition pack
    emulator_id_context  TEXT,                      -- optional: emulator id that triggered the check

    verified_at          TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes                TEXT,

    FOREIGN KEY (bios_file_id) REFERENCES bios_files(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_bios_verify_key
    ON bios_verification(bios_file_id, bios_definition_id);

CREATE INDEX IF NOT EXISTS idx_bios_verify_definition
    ON bios_verification(bios_definition_id);

-- ---------------------------------------------------------------------------
--  Indexes for library search/sort
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_games_platform_id ON games(platform_id);
CREATE INDEX IF NOT EXISTS idx_games_filepath ON games(filepath);
CREATE INDEX IF NOT EXISTS idx_games_detected_title ON games(detected_title);
CREATE INDEX IF NOT EXISTS idx_games_matched_game_id ON games(matched_game_id);
CREATE INDEX IF NOT EXISTS idx_games_added_at ON games(added_at);
CREATE INDEX IF NOT EXISTS idx_games_last_played_at ON games(last_played_at);

-- ---------------------------------------------------------------------------
--  v1.0.1 additional indexes for common lookup paths (hash based matching, scans)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_games_file_md5      ON games(file_md5);
CREATE INDEX IF NOT EXISTS idx_games_file_crc32    ON games(file_crc32);
CREATE INDEX IF NOT EXISTS idx_games_last_scanned  ON games(last_scanned_at);
CREATE INDEX IF NOT EXISTS idx_games_is_missing    ON games(is_missing);

CREATE INDEX IF NOT EXISTS idx_bios_files_md5      ON bios_files(file_md5);
CREATE INDEX IF NOT EXISTS idx_bios_files_sha1     ON bios_files(file_sha1);
CREATE INDEX IF NOT EXISTS idx_bios_files_crc32    ON bios_files(file_crc32);


-- ---------------------------------------------------------------------------
--  Initialize schema_version row (id=1) if absent
-- ---------------------------------------------------------------------------
INSERT INTO schema_version (id, schema_version, app_version, notes)
SELECT 1, 2, NULL, 'Initial SQLite schema v1.0.1 (cache dedupe + hash indexes + optional TTL)'
WHERE NOT EXISTS (SELECT 1 FROM schema_version WHERE id = 1);

COMMIT;
