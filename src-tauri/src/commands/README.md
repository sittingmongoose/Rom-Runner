# ROM Runner Tauri Commands (v1.0.0)

This document describes the **Tauri IPC layer** between the ROM Runner React/TypeScript frontend and the Rust backend.

**Artifacts**
- `tauri_commands_v1_0_0.rs` — Rust command signatures + IPC types (stubs)
- `tauri_commands_v1_0_0.ts` — TypeScript types + `invoke()` wrappers + event helpers
- `tauri_commands_v1_0_0.md` — this reference

## Conventions

- **Rust command names**: `snake_case`
- **TS wrapper names**: `camelCase`, grouped by module (`library`, `device`, …)
- **Struct field names**: serialized as **camelCase** (via `#[serde(rename_all="camelCase")]`)
- **Errors**: all commands return `Result<T, CommandError>` in Rust; in TS, `invokeCommand` throws a `CommandError` (union).

## Standard errors

`CommandError` (TS) is a tagged union:

- `NotFound { resource, id }`
- `InvalidInput { field, message }`
- `IoError { path, message }`
- `DatabaseError { message }`
- `DeviceNotConnected { device_id }`
- `DeploymentFailed { reason }`
- `Cancelled`

### TS usage

```ts
import { library, isCommandError } from './tauri_commands_v1_0_0';

try {
  const page = await library.getGames({ platformIds: ['ps2'] }, { page: 1, pageSize: 50, sortBy: 'title', sortOrder: 'asc' });
  console.log(page.items);
} catch (err) {
  if (isCommandError(err)) {
    console.error('ROM Runner command failed:', err.type, err);
  } else {
    console.error('Unexpected error:', err);
  }
}
```

## Events

Long-running operations should stream progress via events rather than blocking IPC calls.

### Event names

- `scan_progress` → `ScanProgress`
- `scan_complete` → `ScanComplete`
- `deployment_progress` → `DeploymentProgress`
- `deployment_complete` → `DeploymentComplete`
- `device_connected` → `DeviceEvent`
- `device_disconnected` → `DeviceEvent`

### TS subscription example

```ts
import { onScanProgress, onScanComplete, EVENTS, library } from './tauri_commands_v1_0_0';

const unlistenProgress = await onScanProgress((p) => {
  console.log(`[scan ${p.scanId}] ${p.current}/${p.total} ${p.currentFile}`);
});

const unlistenComplete = await onScanComplete((c) => {
  console.log(`[scan ${c.scanId}] done success=${c.success}`, c.errors);
});

// Kick off a rescan (implementation should return quickly + emit events)
await library.rescanLibrary();

// later…
await unlistenProgress();
await unlistenComplete();
```

---

## Module reference

Below, each command is listed with the **invoke name** (Rust) and the **TS wrapper**.

### library::*

- `scan_directory(path, recursive) -> ScannedGame[]`  
  TS: `library.scanDirectory(path, recursive)`  
  Preview-scan a folder for ROMs.

- `rescan_library() -> ScanResult`  
  TS: `library.rescanLibrary()`  
  Full-library rescan. Should emit scan events.

- `cancel_scan() -> boolean`  
  TS: `library.cancelScan()`

- `get_games(filter, pagination) -> PaginatedGames`  
  TS: `library.getGames(filter, pagination)`

- `get_game(id) -> Game | null`  
  TS: `library.getGame(id)`

- `update_game(id, updates) -> Game`  
  TS: `library.updateGame(id, updates)`

- `delete_games(ids) -> DeleteResult`  
  TS: `library.deleteGames(ids)`

Collections:

- `get_collections() -> Collection[]`  
  TS: `library.getCollections()`

- `create_collection(name, game_ids) -> Collection`  
  TS: `library.createCollection(name, gameIds)`

- `update_collection(id, updates) -> Collection`  
  TS: `library.updateCollection(id, updates)`

- `delete_collection(id) -> boolean`  
  TS: `library.deleteCollection(id)`

- `add_games_to_collection(collection_id, game_ids) -> Collection`  
  TS: `library.addGamesToCollection(collectionId, gameIds)`

- `remove_games_from_collection(collection_id, game_ids) -> Collection`  
  TS: `library.removeGamesFromCollection(collectionId, gameIds)`

### device::*

- `scan_connected_devices() -> DetectedDevice[]`  
  TS: `device.scanConnectedDevices()`

- `scan_destination(path) -> DestinationScanResult`  
  TS: `device.scanDestination(path)`

- `detect_os_layout(path) -> LayoutDetectionResult`  
  TS: `device.detectOsLayout(path)`

- `resolve_deployment_paths(destination_path, os_id, destination_id) -> ResolvedDeploymentPaths`  
  TS: `device.resolveDeploymentPaths(destinationPath, osId, destinationId?)`  
  Combines expected paths, detected paths, and saved user overrides.

Device management:

- `get_devices() -> UserDevice[]`  
  TS: `device.getDevices()`

- `add_device(device) -> UserDevice`  
  TS: `device.addDevice(newDevice)`

- `update_device(id, updates) -> UserDevice`  
  TS: `device.updateDevice(id, updates)`

- `delete_device(id) -> boolean`  
  TS: `device.deleteDevice(id)`

Profiles:

- `get_device_profiles(device_id) -> DeviceProfile[]`  
  TS: `device.getDeviceProfiles(deviceId)`

- `create_device_profile(device_id, profile) -> DeviceProfile`  
  TS: `device.createDeviceProfile(deviceId, profile)`

- `update_device_profile(id, updates) -> DeviceProfile`  
  TS: `device.updateDeviceProfile(id, updates)`

- `delete_device_profile(id) -> boolean`  
  TS: `device.deleteDeviceProfile(id)`

### deploy::*

- `create_deployment_plan(config) -> DeploymentPlan`  
  TS: `deploy.createDeploymentPlan(config)`

- `validate_deployment_plan(plan) -> ValidationResult`  
  TS: `deploy.validateDeploymentPlan(plan)`

- `start_deployment(plan) -> DeploymentHandle`  
  TS: `deploy.startDeployment(plan)`  
  Must emit deployment progress/completion events.

- `pause_deployment(handle) -> boolean`  
  TS: `deploy.pauseDeployment(handle)`

- `resume_deployment(handle) -> boolean`  
  TS: `deploy.resumeDeployment(handle)`

- `cancel_deployment(handle) -> boolean`  
  TS: `deploy.cancelDeployment(handle)`

- `get_deployment_history(device_id?) -> DeploymentRecord[]`  
  TS: `deploy.getDeploymentHistory(deviceId?)`

### bios::*

- `scan_bios_directory(path) -> BiosFile[]`  
  TS: `bios.scanBiosDirectory(path)`

- `verify_bios_file(path) -> BiosVerificationResult`  
  TS: `bios.verifyBiosFile(path)`

- `verify_all_bios(directory) -> BiosVerificationReport`  
  TS: `bios.verifyAllBios(directory)`  
  For large directories, consider emitting scan events (`kind=bios`).

- `get_bios_requirements(platform_ids) -> BiosRequirement[]`  
  TS: `bios.getBiosRequirements(platformIds)`

- `get_bios_requirements_for_device(device_profile_id) -> BiosRequirement[]`  
  TS: `bios.getBiosRequirementsForDevice(deviceProfileId)`

- `check_bios_completeness(directory, platform_ids) -> BiasCompletenessReport`  
  TS: `bios.checkBiosCompleteness(directory, platformIds)`

### compat::*

- `get_game_performance(game_id, device_id) -> GamePerformance | null`  
  TS: `compat.getGamePerformance(gameId, deviceId)`

- `get_emulator_compatibility(game_id, emulator_id) -> EmulatorCompat | null`  
  TS: `compat.getEmulatorCompatibility(gameId, emulatorId)`

- `get_game_settings(game_id, emulator_id) -> GameSettings | null`  
  TS: `compat.getGameSettings(gameId, emulatorId)`

- `get_performance_batch(game_ids, device_id) -> Record<string, GamePerformance>`  
  TS: `compat.getPerformanceBatch(gameIds, deviceId)`

- `refresh_compatibility_cache() -> RefreshResult`  
  TS: `compat.refreshCompatibilityCache()`

- `clear_compatibility_cache() -> boolean`  
  TS: `compat.clearCompatibilityCache()`

### settings::*

- `get_settings() -> AppSettings`  
  TS: `settings.getSettings()`

- `update_settings(updates) -> AppSettings`  
  TS: `settings.updateSettings(updates)`

- `get_platform_overrides() -> PlatformOverride[]`  
  TS: `settings.getPlatformOverrides()`

- `set_platform_override(platform_id, emulator_id) -> PlatformOverride`  
  TS: `settings.setPlatformOverride(platformId, emulatorId)`

- `delete_platform_override(platform_id) -> boolean`  
  TS: `settings.deletePlatformOverride(platformId)`

- `get_game_overrides(game_id) -> GameOverride | null`  
  TS: `settings.getGameOverrides(gameId)`

- `set_game_override(game_id, override_data) -> GameOverride`  
  TS: `settings.setGameOverride(gameId, overrideData)`

- `delete_game_override(game_id) -> boolean`  
  TS: `settings.deleteGameOverride(gameId)`

Destination path overrides (for remembering layout scans):

- `get_user_path_override(destination_id) -> UserPathOverrideEntry | null`
- `set_user_path_override(destination_id, entry) -> UserPathOverrideEntry`
- `delete_user_path_override(destination_id) -> boolean`

### definitions::*

- `load_definition_pack(path?) -> DefinitionPackMeta`  
  TS: `definitions.loadDefinitionPack(path?)`

- `get_platforms() -> Platform[]`  
  TS: `definitions.getPlatforms()`

- `get_platform(id) -> Platform | null`  
  TS: `definitions.getPlatform(id)`

- `get_emulators() -> Emulator[]`  
  TS: `definitions.getEmulators()`

- `get_emulator(id) -> Emulator | null`  
  TS: `definitions.getEmulator(id)`

- `get_devices_catalog() -> DeviceCatalog[]`  
  TS: `definitions.getDevicesCatalog()`

- `get_operating_systems() -> OperatingSystem[]`  
  TS: `definitions.getOperatingSystems()`

- `get_frontends() -> Frontend[]`  
  TS: `definitions.getFrontends()`

- `search_platforms(query) -> Platform[]`  
  TS: `definitions.searchPlatforms(query)`

- `search_emulators(query) -> Emulator[]`  
  TS: `definitions.searchEmulators(query)`

- `get_emulators_for_platform(platform_id) -> Emulator[]`  
  TS: `definitions.getEmulatorsForPlatform(platformId)`

- `get_chipsets() -> Chipset[]`  
  TS: `definitions.getChipsets()`

### fs::*

Dialogs:

- `pick_directory() -> string | null`  
  TS: `fs.pickDirectory()`

- `pick_files(filters) -> string[]`  
  TS: `fs.pickFiles(filters)`

- `pick_save_location(default_name) -> string | null`  
  TS: `fs.pickSaveLocation(defaultName)`

Operations:

- `get_directory_info(path) -> DirectoryInfo`  
  TS: `fs.getDirectoryInfo(path)`

- `calculate_file_hash(path, algorithm) -> string`  
  TS: `fs.calculateFileHash(path, algorithm)`

- `copy_file(source, dest) -> CopyResult`  
  TS: `fs.copyFile(source, dest)`

- `move_file(source, dest) -> MoveResult`  
  TS: `fs.moveFile(source, dest)`

- `delete_file(path) -> boolean`  
  TS: `fs.deleteFile(path)`

Archive:

- `list_archive_contents(path) -> ArchiveEntry[]`  
  TS: `fs.listArchiveContents(path)`

- `extract_archive(path, dest) -> ExtractResult`  
  TS: `fs.extractArchive(path, dest)`

---

## Implementation notes (backend)

- **Non-blocking work**: `rescan_library()` and `start_deployment()` should spawn tasks and stream progress via events.
- **Cancellation**: store active scan/deployment handles in state so `cancel_*` commands can signal cancellation.
- **Path safety**: validate destination paths, prevent path traversal, and ensure you only write within the destination root.
- **Consistency**: keep command names stable and versioned; if breaking changes occur, bump the interface version.
