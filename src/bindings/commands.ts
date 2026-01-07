// tauri_commands_v1_0_0.ts
// -----------------------------------------------------------------------------
// ROM Runner - Tauri IPC Command Interface (v1.0.0)
//
// TypeScript types + invoke wrappers + event helper subscriptions.
// Naming:
// - Rust commands are snake_case; TS wrapper functions are camelCase.
// - Types match the Rust structs in tauri_commands_v1_0_0.rs.
// -----------------------------------------------------------------------------

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// --------------------------------- Errors ------------------------------------

export type CommandError =
  | { type: 'NotFound'; resource: string; id: string }
  | { type: 'InvalidInput'; field: string; message: string }
  | { type: 'IoError'; path: string; message: string }
  | { type: 'DatabaseError'; message: string }
  | { type: 'DeviceNotConnected'; device_id: string }
  | { type: 'DeploymentFailed'; reason: string }
  | { type: 'Cancelled' };

export function isCommandError(err: unknown): err is CommandError {
  return !!err && typeof err === 'object' && 'type' in (err as any);
}

async function invokeCommand<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  try {
    return await invoke<T>(cmd, args ?? {});
  } catch (err: any) {
    // If backend returns serialized CommandError, rethrow as-is.
    if (isCommandError(err)) throw err;
    // Some Tauri errors wrap the payload.
    if (err?.type && typeof err.type === 'string') throw err as CommandError;

    // Best-effort normalization.
    const message = typeof err === 'string' ? err : (err?.message ?? 'Unknown error');
    throw { type: 'DatabaseError', message } satisfies CommandError;
  }
}

// --------------------------------- Events ------------------------------------

export const EVENTS = {
  scanProgress: 'scan_progress',
  scanComplete: 'scan_complete',
  deploymentProgress: 'deployment_progress',
  deploymentComplete: 'deployment_complete',
  deviceConnected: 'device_connected',
  deviceDisconnected: 'device_disconnected',
} as const;

// Event payloads
export type ScanKind = 'library' | 'bios' | 'destination';

export interface ScanProgress {
  scanId: string;
  current: number;
  total: number;
  currentFile: string;
  message?: string | null;
}

export interface ScanComplete {
  scanId: string;
  kind: ScanKind;
  success: boolean;
  errors: string[];
}

export interface DeploymentProgress {
  handleId: string;
  current: number;
  total: number;
  currentFile: string;
  bytesTransferred: number;
  speedBps: number;
  message?: string | null;
}

export interface DeploymentComplete {
  handleId: string;
  success: boolean;
  errors: string[];
  warnings: string[];
}

export interface DeviceEvent {
  device: DetectedDevice;
}

// Listener helpers
export async function onScanProgress(handler: (payload: ScanProgress) => void): Promise<UnlistenFn> {
  return listen<ScanProgress>(EVENTS.scanProgress, (e) => handler(e.payload));
}

export async function onScanComplete(handler: (payload: ScanComplete) => void): Promise<UnlistenFn> {
  return listen<ScanComplete>(EVENTS.scanComplete, (e) => handler(e.payload));
}

export async function onDeploymentProgress(handler: (payload: DeploymentProgress) => void): Promise<UnlistenFn> {
  return listen<DeploymentProgress>(EVENTS.deploymentProgress, (e) => handler(e.payload));
}

export async function onDeploymentComplete(handler: (payload: DeploymentComplete) => void): Promise<UnlistenFn> {
  return listen<DeploymentComplete>(EVENTS.deploymentComplete, (e) => handler(e.payload));
}

export async function onDeviceConnected(handler: (payload: DeviceEvent) => void): Promise<UnlistenFn> {
  return listen<DeviceEvent>(EVENTS.deviceConnected, (e) => handler(e.payload));
}

export async function onDeviceDisconnected(handler: (payload: DeviceEvent) => void): Promise<UnlistenFn> {
  return listen<DeviceEvent>(EVENTS.deviceDisconnected, (e) => handler(e.payload));
}

// ------------------------------- Core Types ----------------------------------

// ---- Library ----

export interface ScannedGame {
  filepath: string;
  filename: string;
  fileSize: number;
  platformId: string;
  detectedTitle: string;
  format: string;
  md5?: string | null;
  crc32?: string | null;
  sha1?: string | null;
  sha256?: string | null;
}

export type ScanStatus = 'started' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface ScanResult {
  scanId: string;
  status: ScanStatus;
  startedAt: string;
  finishedAt?: string | null;
  scannedFiles: number;
  addedGames: number;
  updatedGames: number;
  errors: string[];
  warnings: string[];
}

export interface GameFilter {
  platformIds?: string[];
  collectionId?: number;
  searchQuery?: string;
  hasMetadata?: boolean;
  isHack?: boolean;
}

export type SortOrder = 'asc' | 'desc';

export interface Pagination {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: SortOrder;
}

export interface PaginatedGames {
  items: Game[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface Game {
  id: number;
  title: string;
  platformId: string;
  filepath: string;
  filename: string;
  fileSize: number;
  format: string;
  md5?: string | null;
  crc32?: string | null;
  sha1?: string | null;
  sha256?: string | null;
  hasMetadata: boolean;
  isHack: boolean;
  metadata?: any | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameUpdate {
  title?: string | null;
  platformId?: string | null;
  hasMetadata?: boolean | null;
  isHack?: boolean | null;
  metadata?: any | null;
}

export interface DeleteResult {
  deletedCount: number;
  failedIds: number[];
}

// ---- Collections ----

export interface Collection {
  id: number;
  name: string;
  gameIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionUpdate {
  name?: string | null;
}

// ---- Devices / Destinations ----

export interface DetectedDevice {
  id: string;
  label?: string | null;
  mountPoints: string[];
  filesystem?: string | null;
  totalBytes?: number | null;
  freeBytes?: number | null;
  isRemovable?: boolean | null;
}

export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

export interface LayoutPaths {
  bios?: string | null;
  roms?: string | null;
  saves?: string | null;
  states?: string | null;
  screenshots?: string | null;
}

export interface DestinationScanResult {
  destinationPath: string;
  destinationId?: string | null;
  foundMarkers: string[];
  detectedOsIds: string[];
  confidence: Confidence;
  detectedPaths?: LayoutPaths | null;
  notes: string[];
}

export interface LayoutDetectionResult {
  destinationPath: string;
  detectedOsId?: string | null;
  confidence: Confidence;
  evidence: string[];
  detectedPaths?: LayoutPaths | null;
}

export type ResolvedPathSource = 'expected' | 'detected' | 'user_override' | 'merged';
export type PathResolutionSource = 'profile' | 'detected' | 'user' | 'fallback';

export interface PathResolution {
  finalPath: string;
  source: PathResolutionSource;
  reason: string;
}

export interface ResolvedPathDetails {
  bios: PathResolution;
  roms: PathResolution;
  saves: PathResolution;
  states: PathResolution;
}

export interface ResolvedDeploymentPaths {
  bios: string;
  roms: string;
  saves: string;
  states: string;
  screenshots: string;
  source: ResolvedPathSource;
  confidence: Confidence;
  resolution: ResolvedPathDetails;
}

// ---- User managed devices ----

export interface UserDevice {
  id: number;
  name: string;
  catalogDeviceId?: string | null;
  chipsetId?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewDevice {
  name: string;
  catalogDeviceId?: string | null;
  chipsetId?: string | null;
  notes?: string | null;
}

export interface DeviceUpdate {
  name?: string | null;
  catalogDeviceId?: string | null;
  chipsetId?: string | null;
  notes?: string | null;
}

export interface DeviceProfile {
  id: number;
  deviceId: number;
  name: string;
  osId: string;
  frontendId?: string | null;
  destinationId?: string | null;
  destinationRootHint?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewProfile {
  name: string;
  osId: string;
  frontendId?: string | null;
  destinationId?: string | null;
  destinationRootHint?: string | null;
}

export interface ProfileUpdate {
  name?: string | null;
  osId?: string | null;
  frontendId?: string | null;
  destinationId?: string | null;
  destinationRootHint?: string | null;
}

// ---- Deploy ----

export type DeploymentItemKind = 'rom' | 'bios' | 'save' | 'state' | 'media' | 'metadata' | 'other';

export interface DeploymentConfig {
  deviceProfileId: number;
  destinationPath: string;
  gameIds: number[];
  includeBios: boolean;
  includeSaves: boolean;
  includeStates: boolean;
  overwriteExisting: boolean;
}

export interface DeploymentItem {
  kind: DeploymentItemKind;
  sourcePath: string;
  destPath: string;
  bytes: number;
  platformId?: string | null;
  gameId?: number | null;
}

export interface DeploymentPlan {
  planId: string;
  deviceProfileId: number;
  destinationPath: string;
  resolvedPaths?: ResolvedDeploymentPaths | null;
  items: DeploymentItem[];
  totalFiles: number;
  totalBytes: number;
  warnings: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export type DeploymentStatus = 'running' | 'paused' | 'cancelled' | 'completed' | 'failed';

export interface DeploymentHandle {
  handleId: string;
}

export interface DeploymentRecord {
  id: string;
  deviceId: number;
  deviceProfileId: number;
  startedAt: string;
  finishedAt?: string | null;
  status: DeploymentStatus;
  totalFiles: number;
  totalBytes: number;
  errors: string[];
  warnings: string[];
}

// ---- BIOS ----

export interface BiosHash {
  md5?: string | null;
  sha1?: string | null;
  crc32?: string | null;
  sha256?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  isPreferred?: boolean | null;
}

// Exact enum values from JSON schema (Region)
export type Region =
  | 'USA'
  | 'EUR'
  | 'JPN'
  | 'World'
  | 'FRA'
  | 'GER'
  | 'SPA'
  | 'ITA'
  | 'NLD'
  | 'KOR'
  | 'CHN'
  | 'TWN'
  | 'HKG'
  | 'BRA'
  | 'AUS'
  | 'Unknown'
  | 'universal';

export interface BiosFile {
  id: string;
  name: string;
  filename: string;
  platformId: string;
  description?: string | null;
  required?: boolean | null;
  region?: Region | null;
  knownHashes?: BiosHash[] | null;
  alternateFilenames?: string[] | null;
  requiredForEmulators?: string[] | null;
  optionalForEmulators?: string[] | null;
  fileSize?: number | null;
  hleFallback?: boolean | null;
  version?: string | null;
  releaseDate?: string | null;
  biosSubdirectory?: string | null;
  alternateSubdirectories?: string[] | null;
  notes?: string | null;
}

export type BiosVerificationStatus = 'present' | 'missing' | 'mismatch' | 'unknown';

export interface BiosVerificationResult {
  path: string;
  status: BiosVerificationStatus;
  fileMd5?: string | null;
  fileSha1?: string | null;
  fileCrc32?: string | null;
  fileSha256?: string | null;
  fileSize?: number | null;
  matchedBiosId?: string | null;
  matchedBiosName?: string | null;
  matchedPlatform?: string | null;
  notes: string;
}

export interface BiosVerificationSummary {
  present: number;
  missing: number;
  mismatch: number;
  unknown: number;
  total: number;
}

export interface BiosVerificationReport {
  scanDate: string;
  biosDirectory: string;
  databaseVersion?: string | null;
  summary: BiosVerificationSummary;
  results: BiosVerificationResult[];
}

export interface BiosFileRef {
  biosId: string;
  name: string;
  filename: string;
  region?: Region | null;
  notes?: string | null;
}

export interface BiosRequirement {
  platformId: string;
  required: BiosFileRef[];
  optional: BiosFileRef[];
}

export interface BiosCompletenessReport {
  directory: string;
  platformIds: string[];
  missingRequired: BiosFileRef[];
  missingOptional: BiosFileRef[];
  present: BiosFileRef[];
  notes: string[];
}

// Typo compatibility with prompt
export type BiasCompletenessReport = BiosCompletenessReport;

// ---- Compatibility ----

export type PerformanceTier = 'unplayable' | 'poor' | 'playable' | 'good' | 'excellent';

export interface GamePerformance {
  gameId: string;
  platformId: string;
  chipsetId: string;
  emulatorId?: string | null;
  performanceTier: PerformanceTier;
  requiresSettings?: boolean | null;
  notes?: string | null;
  excludeFromAutoLists?: boolean | null;
  source?: string | null;
}

export type CompatStatus = 'perfect' | 'playable' | 'ingame' | 'menu_intro' | 'boots_only' | 'broken' | 'unknown';

export interface EmulatorCompat {
  gameId: string;
  platformId: string;
  emulatorId: string;
  status: CompatStatus;
  notes?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  lastUpdated?: string | null;
}

export interface GameSettings {
  gameId: string;
  platformId: string;
  emulatorId: string;
  settings: Record<string, any>;
  explanation?: string | null;
  source?: string | null;
}

export interface RefreshResult {
  refreshedAt: string;
  performanceRows: number;
  compatRows: number;
  settingsRows: number;
}

// ---- Settings ----

export interface ScanSettings {
  scanDestinationBeforeDeployment: boolean;
  trustDetectedLayoutOverExpected: boolean;
  rememberScannedLayouts: boolean;
  rememberUserPathOverrides: boolean;
}

export interface AppSettings {
  libraryRoots: string[];
  defaultBiosDir?: string | null;
  definitionPackPath?: string | null;
  scanSettings: ScanSettings;
}

export interface SettingsUpdate {
  libraryRoots?: string[] | null;
  defaultBiosDir?: string | null;
  definitionPackPath?: string | null;
  scanSettings?: ScanSettings | null;
}

export interface PlatformOverride {
  platformId: string;
  emulatorId: string;
  updatedAt: string;
}

export type OverrideAction = 'include' | 'exclude';

export interface GameOverride {
  gameId: number;
  action: OverrideAction;
  forceEmulatorId?: string | null;
  notes?: string | null;
  updatedAt: string;
}

export interface UserPathOverrideEntry {
  destinationId: string;
  osId: string;
  lastScanned: string;
  pathOverrides: LayoutPaths;
  notes?: string | null;
}

// ---- Definitions ----

export interface DefinitionPackMeta {
  version: string;
  schemaVersion: string;
  releaseDate: string;
  minAppVersion: string;
  loadedFrom?: string | null;
}

export interface Platform {
  id: string;
  name: string;
  aliases?: string[] | null;
  manufacturer?: string | null;
  category?: string | null;
}

export interface Emulator {
  id: string;
  name: string;
  kind?: string | null;
  platforms?: string[] | null;
  website?: string | null;
  repository?: string | null;
  status?: string | null;
}

export interface Chipset {
  id: string;
  name: string;
  manufacturer?: string | null;
  cpuCores?: number | null;
  cpuArch?: string | null;
  gpu?: string | null;
  performanceTier?: string | null;
  maxPlatformTier?: string | null;
}

export interface DeviceCatalog {
  id: string;
  name: string;
  manufacturer?: string | null;
  deviceType: string;
  releaseYear?: number | null;
  chipsetId: string;
  ramMB?: number | null;
  supportedOS?: string[] | null;
  defaultOS?: string | null;
  links?: string[] | null;
}

export interface OperatingSystem {
  id: string;
  name: string;
  family?: string | null;
  category?: string | null;
  supportedDevices?: string[] | null;
  notes?: string | null;
}

export interface Frontend {
  id: string;
  name: string;
  kind?: string | null;
  metadataFormat?: string | null;
}

// ---- FS ----

export interface FileFilter {
  name: string;
  extensions: string[];
}

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'crc32';

export interface DirectoryInfo {
  path: string;
  exists: boolean;
  isDir: boolean;
  fileCount: number;
  totalBytes: number;
}

export interface CopyResult {
  source: string;
  dest: string;
  bytes: number;
  overwritten: boolean;
}

export interface MoveResult {
  source: string;
  dest: string;
  bytes: number;
  overwritten: boolean;
}

export interface ArchiveEntry {
  path: string;
  isDir: boolean;
  size?: number | null;
}

export interface ExtractResult {
  sourceArchive: string;
  destDir: string;
  extractedFiles: number;
  errors: string[];
}

// --------------------------- Invoke Wrapper Modules ---------------------------

// library::*
export const library = {
  scanDirectory: (path: string, recursive: boolean) =>
    invokeCommand<ScannedGame[]>('scan_directory', { path, recursive }),

  rescanLibrary: () => invokeCommand<ScanResult>('rescan_library'),

  cancelScan: () => invokeCommand<boolean>('cancel_scan'),

  getGames: (filter: GameFilter, pagination: Pagination) =>
    invokeCommand<PaginatedGames>('get_games', { filter, pagination }),

  getGame: (id: number) => invokeCommand<Game | null>('get_game', { id }),

  updateGame: (id: number, updates: GameUpdate) => invokeCommand<Game>('update_game', { id, updates }),

  deleteGames: (ids: number[]) => invokeCommand<DeleteResult>('delete_games', { ids }),

  getCollections: () => invokeCommand<Collection[]>('get_collections'),

  createCollection: (name: string, gameIds: number[]) =>
    invokeCommand<Collection>('create_collection', { name, game_ids: gameIds }),

  updateCollection: (id: number, updates: CollectionUpdate) =>
    invokeCommand<Collection>('update_collection', { id, updates }),

  deleteCollection: (id: number) => invokeCommand<boolean>('delete_collection', { id }),

  addGamesToCollection: (collectionId: number, gameIds: number[]) =>
    invokeCommand<Collection>('add_games_to_collection', { collection_id: collectionId, game_ids: gameIds }),

  removeGamesFromCollection: (collectionId: number, gameIds: number[]) =>
    invokeCommand<Collection>('remove_games_from_collection', { collection_id: collectionId, game_ids: gameIds }),
} as const;

// device::*
export const device = {
  scanConnectedDevices: () => invokeCommand<DetectedDevice[]>('scan_connected_devices'),

  scanDestination: (path: string) => invokeCommand<DestinationScanResult>('scan_destination', { path }),

  detectOsLayout: (path: string) => invokeCommand<LayoutDetectionResult>('detect_os_layout', { path }),

  resolveDeploymentPaths: (destinationPath: string, osId: string, destinationId?: string | null) =>
    invokeCommand<ResolvedDeploymentPaths>('resolve_deployment_paths', {
      destination_path: destinationPath,
      os_id: osId,
      destination_id: destinationId ?? null,
    }),

  getDevices: () => invokeCommand<UserDevice[]>('get_devices'),

  addDevice: (newDevice: NewDevice) => invokeCommand<UserDevice>('add_device', { device: newDevice }),

  updateDevice: (id: number, updates: DeviceUpdate) => invokeCommand<UserDevice>('update_device', { id, updates }),

  deleteDevice: (id: number) => invokeCommand<boolean>('delete_device', { id }),

  getDeviceProfiles: (deviceId: number) => invokeCommand<DeviceProfile[]>('get_device_profiles', { device_id: deviceId }),

  createDeviceProfile: (deviceId: number, profile: NewProfile) =>
    invokeCommand<DeviceProfile>('create_device_profile', { device_id: deviceId, profile }),

  updateDeviceProfile: (id: number, updates: ProfileUpdate) =>
    invokeCommand<DeviceProfile>('update_device_profile', { id, updates }),

  deleteDeviceProfile: (id: number) => invokeCommand<boolean>('delete_device_profile', { id }),
} as const;

// deploy::*
export const deploy = {
  createDeploymentPlan: (config: DeploymentConfig) => invokeCommand<DeploymentPlan>('create_deployment_plan', { config }),

  validateDeploymentPlan: (plan: DeploymentPlan) => invokeCommand<ValidationResult>('validate_deployment_plan', { plan }),

  startDeployment: (plan: DeploymentPlan) => invokeCommand<DeploymentHandle>('start_deployment', { plan }),

  pauseDeployment: (handle: DeploymentHandle) => invokeCommand<boolean>('pause_deployment', { handle }),

  resumeDeployment: (handle: DeploymentHandle) => invokeCommand<boolean>('resume_deployment', { handle }),

  cancelDeployment: (handle: DeploymentHandle) => invokeCommand<boolean>('cancel_deployment', { handle }),

  getDeploymentHistory: (deviceId?: number | null) =>
    invokeCommand<DeploymentRecord[]>('get_deployment_history', { device_id: deviceId ?? null }),
} as const;

// bios::*
export const bios = {
  scanBiosDirectory: (path: string) => invokeCommand<BiosFile[]>('scan_bios_directory', { path }),

  verifyBiosFile: (path: string) => invokeCommand<BiosVerificationResult>('verify_bios_file', { path }),

  verifyAllBios: (directory: string) => invokeCommand<BiosVerificationReport>('verify_all_bios', { directory }),

  getBiosRequirements: (platformIds: string[]) => invokeCommand<BiosRequirement[]>('get_bios_requirements', { platform_ids: platformIds }),

  getBiosRequirementsForDevice: (deviceProfileId: number) =>
    invokeCommand<BiosRequirement[]>('get_bios_requirements_for_device', { device_profile_id: deviceProfileId }),

  checkBiosCompleteness: (directory: string, platformIds: string[]) =>
    invokeCommand<BiasCompletenessReport>('check_bios_completeness', { directory, platform_ids: platformIds }),
} as const;

// compat::*
export const compat = {
  getGamePerformance: (gameId: string, deviceId: string) =>
    invokeCommand<GamePerformance | null>('get_game_performance', { game_id: gameId, device_id: deviceId }),

  getEmulatorCompatibility: (gameId: string, emulatorId: string) =>
    invokeCommand<EmulatorCompat | null>('get_emulator_compatibility', { game_id: gameId, emulator_id: emulatorId }),

  getGameSettings: (gameId: string, emulatorId: string) =>
    invokeCommand<GameSettings | null>('get_game_settings', { game_id: gameId, emulator_id: emulatorId }),

  getPerformanceBatch: (gameIds: string[], deviceId: string) =>
    invokeCommand<Record<string, GamePerformance>>('get_performance_batch', { game_ids: gameIds, device_id: deviceId }),

  refreshCompatibilityCache: () => invokeCommand<RefreshResult>('refresh_compatibility_cache'),

  clearCompatibilityCache: () => invokeCommand<boolean>('clear_compatibility_cache'),
} as const;

// settings::*
export const settings = {
  getSettings: () => invokeCommand<AppSettings>('get_settings'),

  updateSettings: (updates: SettingsUpdate) => invokeCommand<AppSettings>('update_settings', { updates }),

  getPlatformOverrides: () => invokeCommand<PlatformOverride[]>('get_platform_overrides'),

  setPlatformOverride: (platformId: string, emulatorId: string) =>
    invokeCommand<PlatformOverride>('set_platform_override', { platform_id: platformId, emulator_id: emulatorId }),

  deletePlatformOverride: (platformId: string) => invokeCommand<boolean>('delete_platform_override', { platform_id: platformId }),

  getGameOverrides: (gameId: number) => invokeCommand<GameOverride | null>('get_game_overrides', { game_id: gameId }),

  setGameOverride: (gameId: number, overrideData: GameOverride) =>
    invokeCommand<GameOverride>('set_game_override', { game_id: gameId, override_data: overrideData }),

  deleteGameOverride: (gameId: number) => invokeCommand<boolean>('delete_game_override', { game_id: gameId }),

  getUserPathOverride: (destinationId: string) => invokeCommand<UserPathOverrideEntry | null>('get_user_path_override', { destination_id: destinationId }),

  setUserPathOverride: (destinationId: string, entry: UserPathOverrideEntry) =>
    invokeCommand<UserPathOverrideEntry>('set_user_path_override', { destination_id: destinationId, entry }),

  deleteUserPathOverride: (destinationId: string) => invokeCommand<boolean>('delete_user_path_override', { destination_id: destinationId }),
} as const;

// definitions::*
export const definitions = {
  loadDefinitionPack: (path?: string | null) => invokeCommand<DefinitionPackMeta>('load_definition_pack', { path: path ?? null }),

  getPlatforms: () => invokeCommand<Platform[]>('get_platforms'),

  getPlatform: (id: string) => invokeCommand<Platform | null>('get_platform', { id }),

  getEmulators: () => invokeCommand<Emulator[]>('get_emulators'),

  getEmulator: (id: string) => invokeCommand<Emulator | null>('get_emulator', { id }),

  getDevicesCatalog: () => invokeCommand<DeviceCatalog[]>('get_devices_catalog'),

  getOperatingSystems: () => invokeCommand<OperatingSystem[]>('get_operating_systems'),

  getFrontends: () => invokeCommand<Frontend[]>('get_frontends'),

  searchPlatforms: (query: string) => invokeCommand<Platform[]>('search_platforms', { query }),

  searchEmulators: (query: string) => invokeCommand<Emulator[]>('search_emulators', { query }),

  getEmulatorsForPlatform: (platformId: string) => invokeCommand<Emulator[]>('get_emulators_for_platform', { platform_id: platformId }),

  getChipsets: () => invokeCommand<Chipset[]>('get_chipsets'),
} as const;

// fs::*
export const fs = {
  pickDirectory: () => invokeCommand<string | null>('pick_directory'),

  pickFiles: (filters: FileFilter[]) => invokeCommand<string[]>('pick_files', { filters }),

  pickSaveLocation: (defaultName: string) => invokeCommand<string | null>('pick_save_location', { default_name: defaultName }),

  getDirectoryInfo: (path: string) => invokeCommand<DirectoryInfo>('get_directory_info', { path }),

  calculateFileHash: (path: string, algorithm: HashAlgorithm) =>
    invokeCommand<string>('calculate_file_hash', { path, algorithm }),

  copyFile: (source: string, dest: string) => invokeCommand<CopyResult>('copy_file', { source, dest }),

  moveFile: (source: string, dest: string) => invokeCommand<MoveResult>('move_file', { source, dest }),

  deleteFile: (path: string) => invokeCommand<boolean>('delete_file', { path }),

  listArchiveContents: (path: string) => invokeCommand<ArchiveEntry[]>('list_archive_contents', { path }),

  extractArchive: (path: string, dest: string) => invokeCommand<ExtractResult>('extract_archive', { path, dest }),
} as const;
