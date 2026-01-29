# ChatGPT Work Package Review

**Version:** 1.0.0  
**Date:** 2026-01-05  
**Reviewer:** Claude  
**Status:** Review Complete - Action Required

---

## Executive Summary

ChatGPT delivered three work packages:
1. **SQLite Schema v1.0.1** - Performance optimizations and cache dedupe
2. **Layout Detection Profiles v0.1.0** - 27 OS layout fingerprints
3. **Tauri Commands v1.0.0** - Full IPC layer definition

Overall quality is **good with corrections needed**, particularly for schema compliance in the layout detection profiles.

---

## Work Package 1: SQLite Schema (v1.0.0 → v1.0.1)

### What Was Delivered

| File | Purpose | Status |
|------|---------|--------|
| `schema_v1_0_1.sql` | Fresh install schema | ✅ Good |
| `schema_v1_0_1.md` | Documentation | ✅ Good |
| `migration_v1_0_0_to_v1_0_1.sql` | Upgrade script | ✅ Good |

### Changes Implemented (v1.0.1)

**A) Cache Dedupe + TTL Support**
- Added `expires_at` column to all three cache tables
- Tightened uniqueness constraints:
  - `game_performance_cache`: `(device_profile_id, platform_id, definition_game_id, COALESCE(emulator_id,''))`
  - `emulator_compat_cache`: `(platform_id, emulator_id, definition_game_id)` - removed `source`
  - `game_settings_cache`: `(platform_id, emulator_id, definition_game_id)` - removed `source`

**B) Hash-Based Lookup Indexes**
- `games(file_md5)`, `games(file_crc32)`
- `bios_files(file_md5)`, `bios_files(file_sha1)`, `bios_files(file_crc32)`
- `games(last_scanned_at)`, `games(is_missing)`

**C) Prune Indexes**
- Added `*_prune` indexes on `(expires_at, cached_at)` for efficient TTL cleanup

### Decision Points Raised by ChatGPT

| Question | My Recommendation |
|----------|-------------------|
| Single "best answer" vs multi-source history in caches? | **Single best answer.** If history needed, create separate `*_observations` tables. |
| ID dictionary tables now? | **Defer.** TEXT IDs are fine until millions of rows. Document for future. |
| FTS5 for search now? | **Defer.** Indexed prefix search is sufficient initially. Add FTS5 when UX demands it. |
| TTL policy? | **7 days default**, configurable per source. Community data may use longer TTL (30 days). |

### Issues Found

1. **Minor:** `schema_version` table initialized with `schema_version = 2` but the file is named `v1.0.1`. Consider aligning the integer version with semantic version (e.g., 101 or use a string).

### Verdict: ✅ APPROVED with minor note

---

## Work Package 2: Layout Detection Profiles (v0.1.0)

### What Was Delivered

| File | Purpose | Status |
|------|---------|--------|
| `layoutDetectionProfiles_v0_1_0.json` | 27 OS profiles | ⚠️ Needs Corrections |
| `layoutDetectionProfiles_research_notes.md` | Research documentation | ✅ Good |

### Profile Count Summary

| Category | Count | Confidence |
|----------|-------|------------|
| Custom Firmware (high confidence) | 14 | High |
| Custom Firmware (medium confidence) | 2 | Medium |
| Stock OS Families (low confidence) | 9 | Low |
| Desktop/SteamOS | 2 | Medium |
| **Total** | **27** | - |

### OSes Covered

**High Confidence:** ArkOS, ROCKNIX, AmberELEC, Batocera, EmuELEC, Recalbox, OnionOS, GarlicOS, MinUI, MuOS, Knulli, spruce, EmuDeck (with variations)

**Medium Confidence:** JELOS, Lakka, SteamOS, RetroidOS

**Low Confidence (Stock Families):** Retroid Stock Android, Anbernic Stock Android (3 families), Anbernic Stock Linux (2 families), MagicX Stock Linux, Miyoo Stock, PowKiddy Stock Linux, TrimUI Stock

### Critical Issues Found

#### Issue A: Missing OS IDs (Blockers)

| Requested | Status in `operating-systems_v2_0_0.json` | Resolution Needed |
|-----------|------------------------------------------|-------------------|
| RetroBat | ❌ NOT PRESENT | Add `retrobat` osId first |
| `generic-linux-stock` | ❌ NOT PRESENT | Not needed - ChatGPT created per-family profiles instead |

**Impact:** Cannot create RetroBat profile until the OS entry exists.

**Action Required:**
```json
// Add to operating-systems_v2_0_0.json (bump to v2_1_0)
{
  "id": "retrobat",
  "name": "RetroBat",
  "osFamily": "windows",
  "category": "emulation-frontend",
  "notes": "Windows-based EmulationStation frontend with portable installation"
}
```

#### Issue B: Schema Mismatch - Detection Block

**Requirements spec (Section 8.4):**
```typescript
detection: {
  markersAny: string[];
  markersAll: string[];
  markersNone: string[];
  minimumConfidence: 'high' | 'medium' | 'low';  // ← Only this
};
```

**ChatGPT generated:**
```json
"detection": {
  "markersAny": [...],
  "markersAll": [...],
  "markersNone": [...],
  "confidence": "high",           // ← EXTRA, remove
  "minimumConfidence": "high"     // ← Correct
}
```

**Fix:** Remove `confidence` from all `detection` blocks. Keep only `minimumConfidence`.

#### Issue C: Schema Mismatch - Layout Duplication

**Requirements spec:**
```typescript
expectedLayout: {
  bios: string;
  roms: string;
  saves?: string;
  states?: string;
  screenshots?: string;
};
```

**ChatGPT generated:**
```json
"layout": { ... },        // ← EXTRA, remove
"expectedLayout": { ... }  // ← Correct
```

**Fix:** Remove `layout` from all profiles. Keep only `expectedLayout`.

#### Issue D: Variations Schema Mismatch (MAJOR)

**Requirements spec (Section 8.4):**
```typescript
interface LayoutVariation {
  name: string;
  condition: string;             // Human-readable condition description
  overrides: Partial<LayoutPaths>;
}
```

**ChatGPT generated:**
```json
"variations": [{
  "name": "ArkOS dual-SD (roms2)",
  "detection": {                  // ← WRONG - should be "condition"
    "markersAny": [],
    "markersAll": ["/roms2"],
    "markersNone": [],
    "confidence": "high",
    "minimumConfidence": "high"
  },
  "layoutOverrides": { ... },     // ← WRONG - should be "overrides"
  "notes": "..."
}]
```

**Required format:**
```json
"variations": [{
  "name": "ArkOS dual-SD (roms2)",
  "condition": "When /roms2 directory exists (dual SD card setup)",
  "overrides": {
    "roms": "/roms2",
    "bios": "/roms2/bios",
    "saves": "/roms2/savestates",
    "states": "/roms2/savestates"
  }
}]
```

**Impact:** All 12+ variations need restructuring to match the spec.

#### Issue E: Extra Fields

The following fields are not in the spec and should be removed:
- `osFamilyId` (use `osId` relationship to OS family)
- `displayName` (redundant with `name`)
- `portmaster` in layout paths (not in LayoutPaths interface)
- `links` object (not in spec - move to `notes` or remove)

### Confidence Assessment

| Profile | ChatGPT Confidence | My Assessment |
|---------|-------------------|---------------|
| ArkOS | High | ✅ Valid |
| ROCKNIX | High | ✅ Valid |
| Batocera | High | ✅ Valid |
| OnionOS | High | ✅ Valid |
| JELOS | Medium | ⚠️ EOL - may need stronger exclusion markers |
| Stock families | Low | ✅ Appropriate - use `__USER_SELECT__` pattern |

### Verdict: ⚠️ CORRECTIONS REQUIRED

---

## Work Package 3: Tauri Commands (v1.0.0)

### What Was Delivered

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `tauri_commands_v1_0_0.rs` | Rust command stubs | 1,496 | ✅ Good |
| `tauri_commands_v1_0_0.ts` | TypeScript wrappers | 919 | ✅ Good |
| `tauri_commands_v1_0_0.md` | API reference | ~400 | ✅ Good |

### Command Inventory

| Module | Commands | Notes |
|--------|----------|-------|
| `library::*` | 12 | scan, getGames, collections CRUD |
| `device::*` | 11 | scan, detect layout, device/profile CRUD |
| `deploy::*` | 7 | plan, validate, start/pause/resume/cancel |
| `bios::*` | 6 | scan, verify, requirements |
| `compat::*` | 6 | performance, compatibility, settings lookup |
| `settings::*` | 12 | app settings, overrides, path overrides |
| `definitions::*` | 12 | load pack, list/search catalogs |
| `fs::*` | 10 | dialogs, file ops, archive handling |
| **Total** | **76** | - |

### Events Inventory

| Event | Payload | Direction |
|-------|---------|-----------|
| `scan_progress` | `ScanProgress` | Backend → Frontend |
| `scan_complete` | `ScanComplete` | Backend → Frontend |
| `deployment_progress` | `DeploymentProgress` | Backend → Frontend |
| `deployment_complete` | `DeploymentComplete` | Backend → Frontend |
| `device_connected` | `DeviceEvent` | Backend → Frontend |
| `device_disconnected` | `DeviceEvent` | Backend → Frontend |

### Validation Checklist

| Check | Status | Notes |
|-------|--------|-------|
| TS invoke args match Rust params | ✅ | snake_case correctly used |
| Command names match | ✅ | All 76 commands aligned |
| Event names match | ✅ | All 6 events aligned |
| Serde rename_all = camelCase | ✅ | Consistent across all structs |
| Error types match | ✅ | `CommandError` enum aligned |

### Types Defined

**Core Types:** 70+ interfaces/structs covering:
- Library: `Game`, `ScannedGame`, `Collection`, `GameFilter`, `Pagination`
- Device: `DetectedDevice`, `UserDevice`, `DeviceProfile`, `LayoutPaths`
- Deploy: `DeploymentPlan`, `DeploymentItem`, `DeploymentConfig`
- BIOS: `BiosFile`, `BiosVerificationResult`, `BiosRequirement`
- Compat: `GamePerformance`, `EmulatorCompat`, `GameSettings`
- Settings: `AppSettings`, `PlatformOverride`, `GameOverride`
- Definitions: `Platform`, `Emulator`, `DeviceCatalog`, `OperatingSystem`
- FS: `DirectoryInfo`, `ArchiveEntry`, `CopyResult`

### Notable Observations

1. **Typo preserved:** `BiasCompletenessReport` alias maintained for prompt compatibility (intentional)

2. **Good patterns:**
   - Async all commands
   - Consistent error handling via `CommandResult<T>`
   - Event-driven for long-running operations
   - Proper Optional handling

3. **Implementation notes in Rust:**
   - All implementations are `todo!()` stubs (as expected)
   - Comments document intended behavior
   - Module structure ready for real implementation

### Minor Issues Found

1. **Missing in TS:** `screenshots` field in `ResolvedPathDetails` (present in Rust)
2. **Potential mismatch:** `device_row_id` vs `device_id` naming between schema and commands - verify during implementation

### Verdict: ✅ APPROVED

---

## Summary: Required Actions

### Immediate (Before Integration)

1. **Fix layoutDetectionProfiles_v0_1_0.json:**
   - [ ] Remove `detection.confidence` (keep only `minimumConfidence`)
   - [ ] Remove `layout` field (keep only `expectedLayout`)
   - [ ] Restructure all `variations` from `detection`/`layoutOverrides` to `condition`/`overrides`
   - [ ] Remove extra fields: `osFamilyId`, `displayName`, `portmaster`, `links`
   - [ ] Bump version to `v0_2_0` after fixes

2. **Add RetroBat OS entry:**
   - [ ] Add `retrobat` to `operating-systems_v2_0_0.json` → bump to `v2_1_0`
   - [ ] Then create RetroBat layout detection profile

### Schema Updates Needed

1. **JSON Schemas (`ROM_Runner_JSON_Schemas_v1_1_0.json`):**
   - [ ] Add `LayoutDetectionProfile` schema definition
   - [ ] Add `LayoutVariation` schema definition
   - [ ] Bump to `v1_2_0`

### Project Files Update Summary

| Action | File | Old Version | New Version |
|--------|------|-------------|-------------|
| **KEEP** | `schema_v1_0_1.sql` | - | v1.0.1 |
| **KEEP** | `schema_v1_0_1.md` | - | v1.0.1 |
| **KEEP** | `migration_v1_0_0_to_v1_0_1.sql` | - | v1.0.0→v1.0.1 |
| **KEEP** | `tauri_commands_v1_0_0.rs` | - | v1.0.0 |
| **KEEP** | `tauri_commands_v1_0_0.ts` | - | v1.0.0 |
| **KEEP** | `tauri_commands_v1_0_0.md` | - | v1.0.0 |
| **REPLACE** | `layoutDetectionProfiles_v0_1_0.json` | v0.1.0 | v0.2.0 (after fixes) |
| **KEEP** | `layoutDetectionProfiles_research_notes.md` | - | Reference doc |
| **KEEP** | `PROMPT_Claude_Schema_Performance_Review.md` | - | Reference doc |

---

## Next Steps

1. I will create the corrected `layoutDetectionProfiles_v0_2_0.json` with all schema fixes
2. You should add `retrobat` to your OS catalog when ready
3. Consider adding `LayoutDetectionProfile` schema to `ROM_Runner_JSON_Schemas_v1_2_0.json`

Would you like me to create the corrected layout detection profiles file now?
