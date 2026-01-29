/**
 * ROM Runner - Zustand Store Types
 * @version 1.0.0
 * @description Shared TypeScript interfaces for all Zustand store slices
 */

// ============================================================================
// COMMON TYPES
// ============================================================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: LoadingState;
  error: string | null;
}

// ============================================================================
// LIBRARY TYPES
// ============================================================================

export interface Game {
  id: number;
  title: string;
  platformId: string;
  platformName: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileHash?: string;
  format: string;
  
  // Metadata
  region?: Region;
  languages?: string[];
  releaseYear?: number;
  developer?: string;
  publisher?: string;
  genre?: string[];
  
  // ROM identification
  serial?: string;
  externalIds?: Record<string, string>;
  
  // ROM Runner specific
  isRomHack: boolean;
  isFanTranslation: boolean;
  parentGameId?: number;
  
  // Status
  verified: boolean;
  lastPlayed?: string;
  playCount: number;
  favorite: boolean;
  
  // Timestamps
  dateAdded: string;
  dateModified: string;
}

export type Region = 
  | 'USA' | 'EUR' | 'JPN' | 'World' 
  | 'FRA' | 'GER' | 'SPA' | 'ITA' | 'NLD'
  | 'KOR' | 'CHN' | 'TWN' | 'HKG'
  | 'BRA' | 'AUS' | 'Unknown';

export interface Collection {
  id: number;
  name: string;
  description?: string;
  gameIds: number[];
  icon?: string;
  color?: string;
  isSmartCollection: boolean;
  smartCriteria?: SmartCollectionCriteria;
  createdAt: string;
  updatedAt: string;
}

export interface SmartCollectionCriteria {
  platforms?: string[];
  regions?: Region[];
  genres?: string[];
  yearRange?: [number, number];
  favorites?: boolean;
  romHacks?: boolean;
  fanTranslations?: boolean;
}

export interface GameFilters {
  platforms: string[];
  regions: Region[];
  genres: string[];
  favorites: boolean | null;
  romHacks: boolean | null;
  fanTranslations: boolean | null;
  verified: boolean | null;
  collectionId: number | null;
}

export type SortField = 
  | 'title' 
  | 'platform' 
  | 'dateAdded' 
  | 'dateModified' 
  | 'fileSize' 
  | 'lastPlayed';

export interface ScanProgress {
  status: 'scanning' | 'identifying' | 'importing' | 'complete' | 'cancelled' | 'error';
  currentPath: string;
  filesScanned: number;
  filesTotal: number;
  gamesFound: number;
  gamesImported: number;
  duplicatesSkipped: number;
  errorsCount: number;
  currentPlatform?: string;
  estimatedTimeRemaining?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// DEVICE TYPES
// ============================================================================

export interface UserDevice {
  id: number;
  name: string;
  deviceDefinitionId: string;
  osId: string;
  
  // Connection
  connectionType: 'usb' | 'network' | 'sd_card' | 'ftp';
  connectionPath?: string;
  networkAddress?: string;
  ftpCredentials?: FtpCredentials;
  
  // Profiles
  profiles: DeviceProfile[];
  activeProfileId: number | null;
  
  // Scan data
  lastScanned?: string;
  scannedLayout?: ScannedLayoutInfo;
  
  // Metadata
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FtpCredentials {
  host: string;
  port: number;
  username: string;
  // Password stored securely, not in state
}

export interface DeviceProfile {
  id: number;
  deviceId: number;
  name: string;
  
  // Performance settings
  performanceMode: 'strict' | 'balanced' | 'permissive';
  excludePlatforms: string[];
  includePlatforms: string[];
  
  // Emulator overrides
  platformEmulatorOverrides: Record<string, string>;
  gameEmulatorOverrides: Record<number, string>;
  
  // Game overrides
  gameOverrides: GameOverride[];
  
  // Deployment settings
  includeCollections: number[];
  excludeCollections: number[];
  maxGamesPerPlatform?: number;
  
  // Metadata
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GameOverride {
  gameId: number;
  action: 'include' | 'exclude';
  reason?: string;
}

export interface ScannedLayoutInfo {
  detectedOsId: string | null;
  osConfidence: 'high' | 'medium' | 'low' | 'none';
  layoutId: string | null;
  pathOverrides: Partial<LayoutPaths>;
  scanTimestamp: string;
}

export interface LayoutPaths {
  bios: string;
  roms: string;
  saves: string;
  states: string;
  screenshots: string;
}

export interface DetectedDevice {
  path: string;
  volumeName: string;
  volumeUuid?: string;
  totalSpace: number;
  freeSpace: number;
  filesystem: string;
  isRemovable: boolean;
  
  // Detection hints
  possibleOs?: string;
  hasRomFolders: boolean;
  hasBiosFolders: boolean;
}

export interface DestinationScanResult {
  scanTimestamp: string;
  scanDuration: number;
  destinationPath: string;
  
  detected: {
    osId: string | null;
    osConfidence: 'high' | 'medium' | 'low' | 'none';
    layoutId: string | null;
    layoutConfidence: 'high' | 'medium' | 'low' | 'none';
    foundMarkers: string[];
    missingMarkers: string[];
  };
  
  existingContent: {
    romFolders: DiscoveredFolder[];
    biosFolders: DiscoveredFolder[];
    saveFolders: DiscoveredFolder[];
    configFiles: DiscoveredFile[];
  };
  
  verification: {
    expectedOsId: string;
    expectedLayout: LayoutPaths;
    matches: boolean;
    discrepancies: LayoutDiscrepancy[];
  };
  
  recommendations: ScanRecommendation[];
}

export interface DiscoveredFolder {
  path: string;
  type: 'roms' | 'bios' | 'saves' | 'states' | 'config' | 'unknown';
  platformId?: string;
  fileCount: number;
  totalSizeMB: number;
}

export interface DiscoveredFile {
  path: string;
  type: 'config' | 'emulator' | 'bios' | 'marker' | 'unknown';
  name: string;
  sizeMB: number;
}

export interface LayoutDiscrepancy {
  type: 'missing_folder' | 'extra_folder' | 'wrong_path' | 'different_os';
  expected: string;
  actual: string | null;
  severity: 'error' | 'warning' | 'info';
  suggestion: string;
}

export interface ScanRecommendation {
  type: 'use_detected' | 'confirm_layout' | 'create_folders' | 'manual_config';
  message: string;
  actionId?: string;
}

export interface NewDevice {
  name: string;
  deviceDefinitionId: string;
  osId: string;
  connectionType: 'usb' | 'network' | 'sd_card' | 'ftp';
  connectionPath?: string;
  networkAddress?: string;
}

export interface NewProfile {
  name: string;
  performanceMode: 'strict' | 'balanced' | 'permissive';
  isDefault?: boolean;
}

// ============================================================================
// DEPLOYMENT TYPES
// ============================================================================

export interface DeploymentConfig {
  deviceId: number;
  profileId: number;
  destinationPath: string;
  
  // What to deploy
  gameIds?: number[];
  collectionIds?: number[];
  platformIds?: string[];
  deployAll: boolean;
  
  // Options
  includeBios: boolean;
  includeCovers: boolean;
  includeManuals: boolean;
  convertFormats: boolean;
  verifyAfterCopy: boolean;
  
  // Conflict handling
  overwriteExisting: boolean;
  skipExisting: boolean;
  
  // Limits
  maxTotalSizeMB?: number;
}

export interface DeploymentPlan {
  id: string;
  config: DeploymentConfig;
  createdAt: string;
  
  // Resolved games
  games: DeploymentGameEntry[];
  totalGames: number;
  
  // Size estimates
  totalSizeMB: number;
  convertedSizeMB: number;
  
  // BIOS
  biosFiles: DeploymentBiosEntry[];
  
  // Warnings
  warnings: DeploymentWarning[];
  
  // Validation
  isValid: boolean;
  validationErrors: string[];
}

export interface DeploymentGameEntry {
  gameId: number;
  game: Game;
  sourcePath: string;
  destinationPath: string;
  
  // Conversion
  needsConversion: boolean;
  sourceFormat: string;
  targetFormat: string;
  
  // Status
  performanceTier?: PerformanceTier;
  compatibilityStatus?: CompatibilityStatus;
  warnings: string[];
}

export interface DeploymentBiosEntry {
  biosId: string;
  name: string;
  platformId: string;
  sourcePath: string;
  destinationPath: string;
  verified: boolean;
  required: boolean;
}

export interface DeploymentWarning {
  type: 'performance' | 'compatibility' | 'size' | 'format' | 'missing_bios';
  gameId?: number;
  platformId?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export type PerformanceTier = 'excellent' | 'good' | 'playable' | 'poor' | 'unplayable';

export type CompatibilityStatus = 
  | 'perfect' 
  | 'playable' 
  | 'ingame' 
  | 'menu_intro' 
  | 'boots_only' 
  | 'broken' 
  | 'unknown';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  
  // Space check
  requiredSpaceMB: number;
  availableSpaceMB: number;
  hasEnoughSpace: boolean;
  
  // BIOS check
  missingBios: string[];
  
  // Compatibility check
  incompatibleGames: number[];
  lowPerformanceGames: number[];
}

export interface ValidationError {
  code: string;
  message: string;
  gameId?: number;
  field?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  gameId?: number;
  suggestion?: string;
}

export interface DeploymentProgress {
  status: DeploymentStatus;
  phase: DeploymentPhase;
  
  // Current operation
  currentOperation: string;
  currentFile?: string;
  
  // Progress
  filesCompleted: number;
  filesTotal: number;
  bytesCompleted: number;
  bytesTotal: number;
  percentComplete: number;
  
  // Timing
  startedAt: string;
  estimatedTimeRemaining?: number;
  currentSpeed?: number;
  
  // Errors
  errors: DeploymentError[];
  
  // Conversion progress (if applicable)
  conversionProgress?: ConversionProgress;
}

export type DeploymentStatus = 
  | 'pending' 
  | 'running' 
  | 'paused' 
  | 'completing' 
  | 'completed' 
  | 'cancelled' 
  | 'failed';

export type DeploymentPhase = 
  | 'preparing' 
  | 'scanning_destination' 
  | 'copying_bios' 
  | 'converting_roms' 
  | 'copying_roms' 
  | 'copying_assets' 
  | 'verifying' 
  | 'cleaning_up' 
  | 'complete';

export interface DeploymentError {
  timestamp: string;
  phase: DeploymentPhase;
  gameId?: number;
  filePath?: string;
  errorCode: string;
  message: string;
  recoverable: boolean;
}

export interface ConversionProgress {
  gameId: number;
  gameName: string;
  tool: string;
  percentComplete: number;
  stage: string;
}

export interface DeploymentResult {
  success: boolean;
  planId: string;
  
  // Summary
  gamesDeployed: number;
  gamesFailed: number;
  gamesSkipped: number;
  biosDeployed: number;
  
  // Size
  totalBytesCopied: number;
  totalBytesConverted: number;
  
  // Timing
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  
  // Errors
  errors: DeploymentError[];
  
  // Manifest (for future syncs)
  manifestPath?: string;
}

export interface DeploymentRecord {
  id: string;
  deviceId: number;
  profileId: number;
  result: DeploymentResult;
  config: DeploymentConfig;
  timestamp: string;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

export interface AppSettings {
  // General
  language: string;
  checkForUpdates: boolean;
  sendAnonymousUsage: boolean;
  
  // Library
  defaultLibraryPath: string;
  scanSubdirectories: boolean;
  autoIdentifyRoms: boolean;
  
  // Compatibility behavior
  includeUnknownCompatibilityForStrictPlatforms: boolean;
  includeUnknownPerformanceForDemandingPlatforms: boolean;
  
  // Warning display
  showPerformanceWarnings: boolean;
  showCompatibilityWarnings: boolean;
  
  // Auto-apply settings
  autoApplyEmulatorSettings: boolean;
  
  // Emulator preferences
  preferStandaloneEmulators: boolean;
  
  // Destination scanning
  scanDestinationBeforeDeployment: boolean;
  trustDetectedLayoutOverExpected: boolean;
  rememberScannedLayouts: boolean;
  
  // Format conversion
  enableFormatConversion: boolean;
  preferredFormats: Record<string, string>;
  
  // API keys (stored securely, only flags here)
  hasRetrocatalogApiKey: boolean;
  hasIgdbApiKey: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

// ============================================================================
// BIOS TYPES
// ============================================================================

export interface BiosFile {
  id: string;
  name: string;
  fileName: string;
  platformId: string;
  platformName: string;
  
  // Identification
  md5?: string;
  sha1?: string;
  sha256?: string;
  size: number;
  
  // Status
  isVerified: boolean;
  isRequired: boolean;
  isOptional: boolean;
  
  // Location
  sourcePath?: string;
  destinationFolder: string;
  
  // Region
  region: Region | 'universal';
  
  // Description
  description?: string;
  notes?: string;
}

export interface BiosRequirement {
  platformId: string;
  platformName: string;
  emulatorId?: string;
  
  requiredFiles: BiosFileRequirement[];
  optionalFiles: BiosFileRequirement[];
  
  notes?: string;
}

export interface BiosFileRequirement {
  biosId: string;
  name: string;
  fileName: string;
  md5?: string;
  sha1?: string;
  sha256?: string;
  size: number;
  region: Region | 'universal';
  description?: string;
  alternatives?: string[];
}

export interface BiosVerificationResult {
  biosId: string;
  fileName: string;
  status: 'verified' | 'wrong_hash' | 'wrong_size' | 'not_found';
  expectedHash?: string;
  actualHash?: string;
  matchedAlternative?: string;
}

export interface BiosVerificationReport {
  scanPath: string;
  scanTimestamp: string;
  
  // Summary
  totalRequired: number;
  totalOptional: number;
  verifiedRequired: number;
  verifiedOptional: number;
  missing: number;
  invalid: number;
  
  // Details
  results: BiosVerificationResult[];
  
  // By platform
  platformStatus: Record<string, PlatformBiosStatus>;
}

export interface PlatformBiosStatus {
  platformId: string;
  platformName: string;
  requiredCount: number;
  requiredVerified: number;
  optionalCount: number;
  optionalVerified: number;
  isComplete: boolean;
  missingFiles: string[];
}

// ============================================================================
// UI TYPES
// ============================================================================

export type ViewType = 
  | 'library' 
  | 'collections' 
  | 'devices' 
  | 'deployment' 
  | 'bios' 
  | 'settings'
  | 'device-detail'
  | 'collection-detail';

export type ModalType = 
  | 'add-device'
  | 'edit-device'
  | 'add-profile'
  | 'edit-profile'
  | 'create-collection'
  | 'edit-collection'
  | 'scan-directory'
  | 'deployment-config'
  | 'deployment-progress'
  | 'game-details'
  | 'bios-scanner'
  | 'settings-api-keys'
  | 'confirm-delete'
  | 'destination-scan-result'
  | 'layout-mismatch';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  duration?: number;
  action?: NotificationAction;
  persistent?: boolean;
}

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

// ============================================================================
// TAURI INVOKE PAYLOADS
// ============================================================================

export interface GetGamesPayload {
  filters?: Partial<GameFilters>;
  search?: string;
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ScanDirectoryPayload {
  path: string;
  recursive: boolean;
  platformHints?: string[];
}
