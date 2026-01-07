// tauri_commands_v1_0_0.rs
// -----------------------------------------------------------------------------
// ROM Runner - Tauri IPC Command Interface (v1.0.0)
//
// This file defines the full invoke surface between the React/TS frontend and
// the Rust backend for ROM Runner.
// - Commands are grouped by module: library, device, deploy, bios, compat,
//   settings, definitions, fs.
// - Types are serialized with serde using camelCase field names to match TS.
//
// NOTE: These are signatures + type definitions (stubs). Implementations are
// intentionally left as todo!() and should be wired into the app state/services.
// -----------------------------------------------------------------------------

#![allow(dead_code)]
#![allow(unused_variables)]

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

// --------------------------------- Errors ------------------------------------

/// Standard error type returned by all commands.
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "PascalCase")]
pub enum CommandError {
    NotFound { resource: String, id: String },
    InvalidInput { field: String, message: String },
    IoError { path: String, message: String },
    DatabaseError { message: String },
    DeviceNotConnected { device_id: String },
    DeploymentFailed { reason: String },
    Cancelled,
}

pub type CommandResult<T> = Result<T, CommandError>;

// --------------------------------- Events ------------------------------------

pub const EVENT_SCAN_PROGRESS: &str = "scan_progress";
pub const EVENT_SCAN_COMPLETE: &str = "scan_complete";
pub const EVENT_DEPLOYMENT_PROGRESS: &str = "deployment_progress";
pub const EVENT_DEPLOYMENT_COMPLETE: &str = "deployment_complete";
pub const EVENT_DEVICE_CONNECTED: &str = "device_connected";
pub const EVENT_DEVICE_DISCONNECTED: &str = "device_disconnected";

/// Progress event payload for scans (library scan, BIOS scan, destination scan).
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgress {
    pub scan_id: String,
    pub current: u64,
    pub total: u64,
    pub current_file: String,
    pub message: Option<String>,
}

/// Completion event payload for scans.
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScanComplete {
    pub scan_id: String,
    pub kind: ScanKind,
    pub success: bool,
    pub errors: Vec<String>,
}

#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "snake_case")]
pub enum ScanKind {
    Library,
    Bios,
    Destination,
}

/// Progress event payload for deployments.
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentProgress {
    pub handle_id: String,
    pub current: u64,
    pub total: u64,
    pub current_file: String,
    pub bytes_transferred: u64,
    pub speed_bps: u64,
    pub message: Option<String>,
}

/// Completion event payload for deployments.
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentComplete {
    pub handle_id: String,
    pub success: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Device connect/disconnect event payload.
#[derive(Clone, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeviceEvent {
    pub device: DetectedDevice,
}

// ------------------------------- Core Types ----------------------------------

// ---- Library types ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScannedGame {
    pub filepath: String,
    pub filename: String,
    pub file_size: u64,
    pub platform_id: String,
    pub detected_title: String,
    pub format: String,
    pub md5: Option<String>,
    pub crc32: Option<String>,
    pub sha1: Option<String>,
    pub sha256: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub scan_id: String,
    pub status: ScanStatus,
    pub started_at: String, // ISO 8601
    pub finished_at: Option<String>, // ISO 8601
    pub scanned_files: u64,
    pub added_games: u64,
    pub updated_games: u64,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ScanStatus {
    Started,
    Running,
    Completed,
    Cancelled,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameFilter {
    pub platform_ids: Option<Vec<String>>,
    pub collection_id: Option<i64>,
    pub search_query: Option<String>,
    pub has_metadata: Option<bool>,
    pub is_hack: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Pagination {
    pub page: u32,
    pub page_size: u32,
    pub sort_by: String,
    pub sort_order: SortOrder,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum SortOrder {
    Asc,
    Desc,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PaginatedGames {
    pub items: Vec<Game>,
    pub page: u32,
    pub page_size: u32,
    pub total_items: u64,
    pub total_pages: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: i64,
    pub title: String,
    pub platform_id: String,
    pub filepath: String,
    pub filename: String,
    pub file_size: u64,
    pub format: String,
    pub md5: Option<String>,
    pub crc32: Option<String>,
    pub sha1: Option<String>,
    pub sha256: Option<String>,
    pub has_metadata: bool,
    pub is_hack: bool,
    /// Arbitrary metadata (scraper output, tags, etc).
    pub metadata: Option<JsonValue>,
    pub created_at: String, // ISO 8601
    pub updated_at: String, // ISO 8601
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameUpdate {
    pub title: Option<String>,
    pub platform_id: Option<String>,
    pub has_metadata: Option<bool>,
    pub is_hack: Option<bool>,
    pub metadata: Option<JsonValue>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteResult {
    pub deleted_count: u64,
    pub failed_ids: Vec<i64>,
}

// ---- Collections ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: i64,
    pub name: String,
    pub game_ids: Vec<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CollectionUpdate {
    pub name: Option<String>,
}

// ---- Device / Destination types ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DetectedDevice {
    /// Stable-ish identifier (platform-specific), e.g. volume UUID or device path hash.
    pub id: String,
    pub label: Option<String>,
    pub mount_points: Vec<String>,
    pub filesystem: Option<String>,
    pub total_bytes: Option<u64>,
    pub free_bytes: Option<u64>,
    pub is_removable: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DestinationScanResult {
    pub destination_path: String,
    pub destination_id: Option<String>,
    pub found_markers: Vec<String>,
    pub detected_os_ids: Vec<String>,
    pub confidence: Confidence,
    pub detected_paths: Option<LayoutPaths>,
    pub notes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LayoutDetectionResult {
    pub destination_path: String,
    pub detected_os_id: Option<String>,
    pub confidence: Confidence,
    pub evidence: Vec<String>,
    pub detected_paths: Option<LayoutPaths>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum Confidence {
    High,
    Medium,
    Low,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LayoutPaths {
    pub bios: Option<String>,
    pub roms: Option<String>,
    pub saves: Option<String>,
    pub states: Option<String>,
    pub screenshots: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedDeploymentPaths {
    pub bios: String,
    pub roms: String,
    pub saves: String,
    pub states: String,
    pub screenshots: String,
    pub source: ResolvedPathSource,
    pub confidence: Confidence,
    pub resolution: ResolvedPathDetails,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ResolvedPathSource {
    Expected,
    Detected,
    UserOverride,
    Merged,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPathDetails {
    pub bios: PathResolution,
    pub roms: PathResolution,
    pub saves: PathResolution,
    pub states: PathResolution,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PathResolution {
    pub final_path: String,
    pub source: PathResolutionSource,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum PathResolutionSource {
    Profile,
    Detected,
    User,
    Fallback,
}

// ---- User-managed devices/profiles ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserDevice {
    pub id: i64,
    pub name: String,
    pub catalog_device_id: Option<String>,
    pub chipset_id: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NewDevice {
    pub name: String,
    pub catalog_device_id: Option<String>,
    pub chipset_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceUpdate {
    pub name: Option<String>,
    pub catalog_device_id: Option<String>,
    pub chipset_id: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceProfile {
    pub id: i64,
    pub device_id: i64,
    pub name: String,
    pub os_id: String,
    pub frontend_id: Option<String>,
    pub destination_id: Option<String>,
    pub destination_root_hint: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NewProfile {
    pub name: String,
    pub os_id: String,
    pub frontend_id: Option<String>,
    pub destination_id: Option<String>,
    pub destination_root_hint: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProfileUpdate {
    pub name: Option<String>,
    pub os_id: Option<String>,
    pub frontend_id: Option<String>,
    pub destination_id: Option<String>,
    pub destination_root_hint: Option<String>,
}

// ---- Deployment types ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentConfig {
    pub device_profile_id: i64,
    pub destination_path: String,
    pub game_ids: Vec<i64>,
    pub include_bios: bool,
    pub include_saves: bool,
    pub include_states: bool,
    pub overwrite_existing: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentPlan {
    pub plan_id: String,
    pub device_profile_id: i64,
    pub destination_path: String,
    pub resolved_paths: Option<ResolvedDeploymentPaths>,
    pub items: Vec<DeploymentItem>,
    pub total_files: u64,
    pub total_bytes: u64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentItem {
    pub kind: DeploymentItemKind,
    pub source_path: String,
    pub dest_path: String,
    pub bytes: u64,
    pub platform_id: Option<String>,
    pub game_id: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentItemKind {
    Rom,
    Bios,
    Save,
    State,
    Media,
    Metadata,
    Other,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentHandle {
    pub handle_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentStatus {
    Running,
    Paused,
    Cancelled,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentRecord {
    pub id: String,
    pub device_id: i64,
    pub device_profile_id: i64,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: DeploymentStatus,
    pub total_files: u64,
    pub total_bytes: u64,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

// ---- BIOS types (aligned to ROM_Runner_JSON_Schemas_v1_1_0) ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BiosHash {
    pub md5: Option<String>,
    pub sha1: Option<String>,
    pub crc32: Option<String>,
    pub sha256: Option<String>,
    pub source: Option<String>,
    pub source_url: Option<String>,
    pub is_preferred: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum Region {
    #[serde(rename = "USA")]
    USA,
    #[serde(rename = "EUR")]
    EUR,
    #[serde(rename = "JPN")]
    JPN,
    #[serde(rename = "World")]
    World,
    #[serde(rename = "FRA")]
    FRA,
    #[serde(rename = "GER")]
    GER,
    #[serde(rename = "SPA")]
    SPA,
    #[serde(rename = "ITA")]
    ITA,
    #[serde(rename = "NLD")]
    NLD,
    #[serde(rename = "KOR")]
    KOR,
    #[serde(rename = "CHN")]
    CHN,
    #[serde(rename = "TWN")]
    TWN,
    #[serde(rename = "HKG")]
    HKG,
    #[serde(rename = "BRA")]
    BRA,
    #[serde(rename = "AUS")]
    AUS,
    #[serde(rename = "Unknown")]
    Unknown,
    #[serde(rename = "universal")]
    Universal,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BiosFile {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub platform_id: String,
    pub description: Option<String>,
    pub required: Option<bool>,
    pub region: Option<Region>,
    pub known_hashes: Option<Vec<BiosHash>>,
    pub alternate_filenames: Option<Vec<String>>,
    pub required_for_emulators: Option<Vec<String>>,
    pub optional_for_emulators: Option<Vec<String>>,
    pub file_size: Option<u64>,
    pub hle_fallback: Option<bool>,
    pub version: Option<String>,
    pub release_date: Option<String>,
    pub bios_subdirectory: Option<String>,
    pub alternate_subdirectories: Option<Vec<String>>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum BiosVerificationStatus {
    Present,
    Missing,
    Mismatch,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BiosVerificationResult {
    pub path: String,
    pub status: BiosVerificationStatus,
    pub file_md5: Option<String>,
    pub file_sha1: Option<String>,
    pub file_crc32: Option<String>,
    pub file_sha256: Option<String>,
    pub file_size: Option<u64>,
    pub matched_bios_id: Option<String>,
    pub matched_bios_name: Option<String>,
    pub matched_platform: Option<String>,
    pub notes: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BiosVerificationReport {
    pub scan_date: String,
    pub bios_directory: String,
    pub database_version: Option<String>,
    pub summary: BiosVerificationSummary,
    pub results: Vec<BiosVerificationResult>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BiosVerificationSummary {
    pub present: u64,
    pub missing: u64,
    pub mismatch: u64,
    pub unknown: u64,
    pub total: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BiosRequirement {
    pub platform_id: String,
    pub required: Vec<BiosFileRef>,
    pub optional: Vec<BiosFileRef>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BiosFileRef {
    pub bios_id: String,
    pub name: String,
    pub filename: String,
    pub region: Option<Region>,
    pub notes: Option<String>,
}

/// Report describing BIOS completeness for a set of platforms.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BiosCompletenessReport {
    pub directory: String,
    pub platform_ids: Vec<String>,
    pub missing_required: Vec<BiosFileRef>,
    pub missing_optional: Vec<BiosFileRef>,
    pub present: Vec<BiosFileRef>,
    pub notes: Vec<String>,
}

/// Backward/typo compatibility with the original prompt (`BiasCompletenessReport`).
pub type BiasCompletenessReport = BiosCompletenessReport;

// ---- Compatibility types ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum PerformanceTier {
    Unplayable,
    Poor,
    Playable,
    Good,
    Excellent,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GamePerformance {
    pub game_id: String,
    pub platform_id: String,
    pub chipset_id: String,
    pub emulator_id: Option<String>,
    pub performance_tier: PerformanceTier,
    pub requires_settings: Option<bool>,
    pub notes: Option<String>,
    pub exclude_from_auto_lists: Option<bool>,
    pub source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum CompatStatus {
    Perfect,
    Playable,
    Ingame,
    MenuIntro,
    BootsOnly,
    Broken,
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EmulatorCompat {
    pub game_id: String,
    pub platform_id: String,
    pub emulator_id: String,
    pub status: CompatStatus,
    pub notes: Option<String>,
    pub source: Option<String>,
    pub source_url: Option<String>,
    pub last_updated: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameSettings {
    pub game_id: String,
    pub platform_id: String,
    pub emulator_id: String,
    /// Emulator-specific settings payload. This is intentionally flexible.
    pub settings: JsonValue,
    pub explanation: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RefreshResult {
    pub refreshed_at: String,
    pub performance_rows: u64,
    pub compat_rows: u64,
    pub settings_rows: u64,
}

// ---- Settings types ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanSettings {
    pub scan_destination_before_deployment: bool,
    pub trust_detected_layout_over_expected: bool,
    pub remember_scanned_layouts: bool,
    pub remember_user_path_overrides: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub library_roots: Vec<String>,
    pub default_bios_dir: Option<String>,
    pub definition_pack_path: Option<String>,
    pub scan_settings: ScanSettings,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SettingsUpdate {
    pub library_roots: Option<Vec<String>>,
    pub default_bios_dir: Option<String>,
    pub definition_pack_path: Option<String>,
    pub scan_settings: Option<ScanSettings>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlatformOverride {
    pub platform_id: String,
    pub emulator_id: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum OverrideAction {
    Include,
    Exclude,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameOverride {
    pub game_id: i64,
    pub action: OverrideAction,
    pub force_emulator_id: Option<String>,
    pub notes: Option<String>,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserPathOverrideEntry {
    pub destination_id: String,
    pub os_id: String,
    pub last_scanned: String,
    pub path_overrides: LayoutPaths,
    pub notes: Option<String>,
}

// ---- Definition pack types (subset of ROM_Runner_JSON_Schemas_v1_1_0) ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DefinitionPackMeta {
    pub version: String,
    pub schema_version: String,
    pub release_date: String,
    pub min_app_version: String,
    pub loaded_from: Option<String>,
}

// These mirror schema shapes at a high-level for IPC.
// Fields are intentionally optional to allow forward-compatible packs.

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Platform {
    pub id: String,
    pub name: String,
    pub aliases: Option<Vec<String>>,
    pub manufacturer: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Emulator {
    pub id: String,
    pub name: String,
    pub kind: Option<String>,
    pub platforms: Option<Vec<String>>,
    pub website: Option<String>,
    pub repository: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Chipset {
    pub id: String,
    pub name: String,
    pub manufacturer: Option<String>,
    pub cpu_cores: Option<u32>,
    pub cpu_arch: Option<String>,
    pub gpu: Option<String>,
    pub performance_tier: Option<String>,
    pub max_platform_tier: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCatalog {
    pub id: String,
    pub name: String,
    pub manufacturer: Option<String>,
    pub device_type: String,
    pub release_year: Option<u32>,
    pub chipset_id: String,
    pub ram_mb: Option<u32>,
    pub supported_os: Option<Vec<String>>,
    pub default_os: Option<String>,
    pub links: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OperatingSystem {
    pub id: String,
    pub name: String,
    pub family: Option<String>,
    pub category: Option<String>,
    pub supported_devices: Option<Vec<String>>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Frontend {
    pub id: String,
    pub name: String,
    pub kind: Option<String>,
    pub metadata_format: Option<String>,
}

// ---- File System types ----

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileFilter {
    pub name: String,
    pub extensions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum HashAlgorithm {
    Md5,
    Sha1,
    Sha256,
    Crc32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryInfo {
    pub path: String,
    pub exists: bool,
    pub is_dir: bool,
    pub file_count: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CopyResult {
    pub source: String,
    pub dest: String,
    pub bytes: u64,
    pub overwritten: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MoveResult {
    pub source: String,
    pub dest: String,
    pub bytes: u64,
    pub overwritten: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveEntry {
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExtractResult {
    pub source_archive: String,
    pub dest_dir: String,
    pub extracted_files: u64,
    pub errors: Vec<String>,
}

// ------------------------------ Command Modules ------------------------------

// -----------------------------------------------------------------------------
// library::*
// -----------------------------------------------------------------------------
pub mod library {
    use super::*;

    /// Scan an arbitrary directory for games (preview scan). Intended for UI import flows.
    ///
    /// NOTE: For full-library scans, prefer `rescan_library()` which is event-driven.
    #[tauri::command]
    pub async fn scan_directory(path: String, recursive: bool) -> CommandResult<Vec<ScannedGame>> {
        todo!()
    }

    /// Rescan configured library roots and update the app database.
    ///
    /// This command should return quickly with a `ScanResult` in `Started` state.
    /// Progress + completion should be emitted via `scan_progress` / `scan_complete`.
    #[tauri::command]
    pub async fn rescan_library() -> CommandResult<ScanResult> {
        todo!()
    }

    /// Cancel the currently-running scan (if any).
    #[tauri::command]
    pub async fn cancel_scan() -> CommandResult<bool> {
        todo!()
    }

    /// List games with filtering + pagination.
    #[tauri::command]
    pub async fn get_games(filter: GameFilter, pagination: Pagination) -> CommandResult<PaginatedGames> {
        todo!()
    }

    /// Get a single game by internal DB id.
    #[tauri::command]
    pub async fn get_game(id: i64) -> CommandResult<Option<Game>> {
        todo!()
    }

    /// Update a game record.
    #[tauri::command]
    pub async fn update_game(id: i64, updates: GameUpdate) -> CommandResult<Game> {
        todo!()
    }

    /// Batch delete games by id.
    #[tauri::command]
    pub async fn delete_games(ids: Vec<i64>) -> CommandResult<DeleteResult> {
        todo!()
    }

    // Collections -------------------------------------------------------------

    /// List user collections.
    #[tauri::command]
    pub async fn get_collections() -> CommandResult<Vec<Collection>> {
        todo!()
    }

    /// Create a collection.
    #[tauri::command]
    pub async fn create_collection(name: String, game_ids: Vec<i64>) -> CommandResult<Collection> {
        todo!()
    }

    /// Update a collection.
    #[tauri::command]
    pub async fn update_collection(id: i64, updates: CollectionUpdate) -> CommandResult<Collection> {
        todo!()
    }

    /// Delete a collection.
    #[tauri::command]
    pub async fn delete_collection(id: i64) -> CommandResult<bool> {
        todo!()
    }

    /// Add games to a collection (batch).
    #[tauri::command]
    pub async fn add_games_to_collection(collection_id: i64, game_ids: Vec<i64>) -> CommandResult<Collection> {
        todo!()
    }

    /// Remove games from a collection (batch).
    #[tauri::command]
    pub async fn remove_games_from_collection(collection_id: i64, game_ids: Vec<i64>) -> CommandResult<Collection> {
        todo!()
    }
}

// -----------------------------------------------------------------------------
// device::*
// -----------------------------------------------------------------------------
pub mod device {
    use super::*;

    /// Scan for currently connected storage devices / mount points.
    #[tauri::command]
    pub async fn scan_connected_devices() -> CommandResult<Vec<DetectedDevice>> {
        todo!()
    }

    /// Scan a destination path (e.g. SD card root) for markers, known folder structure, etc.
    #[tauri::command]
    pub async fn scan_destination(path: String) -> CommandResult<DestinationScanResult> {
        todo!()
    }

    /// Detect OS layout from a destination (heuristics/markers).
    #[tauri::command]
    pub async fn detect_os_layout(path: String) -> CommandResult<LayoutDetectionResult> {
        todo!()
    }

    /// Resolve final deployment paths using:
    /// - expected profile paths
    /// - detected layout paths
    /// - user overrides (if enabled)
    #[tauri::command]
    pub async fn resolve_deployment_paths(
        destination_path: String,
        os_id: String,
        destination_id: Option<String>,
    ) -> CommandResult<ResolvedDeploymentPaths> {
        todo!()
    }

    // Management --------------------------------------------------------------

    /// List user-saved devices.
    #[tauri::command]
    pub async fn get_devices() -> CommandResult<Vec<UserDevice>> {
        todo!()
    }

    /// Add a user device.
    #[tauri::command]
    pub async fn add_device(device: NewDevice) -> CommandResult<UserDevice> {
        todo!()
    }

    /// Update a user device.
    #[tauri::command]
    pub async fn update_device(id: i64, updates: DeviceUpdate) -> CommandResult<UserDevice> {
        todo!()
    }

    /// Delete a user device.
    #[tauri::command]
    pub async fn delete_device(id: i64) -> CommandResult<bool> {
        todo!()
    }

    // Profiles ---------------------------------------------------------------

    /// List profiles for a device (OS + frontend + destination hints).
    #[tauri::command]
    pub async fn get_device_profiles(device_id: i64) -> CommandResult<Vec<DeviceProfile>> {
        todo!()
    }

    /// Create a profile for a device.
    #[tauri::command]
    pub async fn create_device_profile(device_id: i64, profile: NewProfile) -> CommandResult<DeviceProfile> {
        todo!()
    }

    /// Update a device profile.
    #[tauri::command]
    pub async fn update_device_profile(id: i64, updates: ProfileUpdate) -> CommandResult<DeviceProfile> {
        todo!()
    }

    /// Delete a device profile.
    #[tauri::command]
    pub async fn delete_device_profile(id: i64) -> CommandResult<bool> {
        todo!()
    }
}

// -----------------------------------------------------------------------------
// deploy::*
// -----------------------------------------------------------------------------
pub mod deploy {
    use super::*;

    /// Build a deployment plan from a config.
    ///
    /// The plan should include all copy operations (ROMs, BIOS, saves/states, metadata).
    #[tauri::command]
    pub async fn create_deployment_plan(config: DeploymentConfig) -> CommandResult<DeploymentPlan> {
        todo!()
    }

    /// Validate an existing plan (paths still exist, destination writable, enough space, etc).
    #[tauri::command]
    pub async fn validate_deployment_plan(plan: DeploymentPlan) -> CommandResult<ValidationResult> {
        todo!()
    }

    /// Start deploying a plan.
    ///
    /// Progress + completion must be emitted via `deployment_progress` / `deployment_complete`.
    #[tauri::command]
    pub async fn start_deployment(plan: DeploymentPlan) -> CommandResult<DeploymentHandle> {
        todo!()
    }

    /// Pause a running deployment.
    #[tauri::command]
    pub async fn pause_deployment(handle: DeploymentHandle) -> CommandResult<bool> {
        todo!()
    }

    /// Resume a paused deployment.
    #[tauri::command]
    pub async fn resume_deployment(handle: DeploymentHandle) -> CommandResult<bool> {
        todo!()
    }

    /// Cancel a running deployment.
    #[tauri::command]
    pub async fn cancel_deployment(handle: DeploymentHandle) -> CommandResult<bool> {
        todo!()
    }

    /// Get deployment history (optionally filtered by device id).
    #[tauri::command]
    pub async fn get_deployment_history(device_id: Option<i64>) -> CommandResult<Vec<DeploymentRecord>> {
        todo!()
    }
}

// -----------------------------------------------------------------------------
// bios::*
// -----------------------------------------------------------------------------
pub mod bios {
    use super::*;

    /// Load BIOS database entries in a directory (best-effort, filename-based listing).
    #[tauri::command]
    pub async fn scan_bios_directory(path: String) -> CommandResult<Vec<BiosFile>> {
        todo!()
    }

    /// Verify a BIOS file by hashing + matching against known database entries.
    #[tauri::command]
    pub async fn verify_bios_file(path: String) -> CommandResult<BiosVerificationResult> {
        todo!()
    }

    /// Verify all BIOS files for a directory against the BIOS database.
    ///
    /// For large directories, implementations should emit scan events (kind=bios) and return quickly.
    #[tauri::command]
    pub async fn verify_all_bios(directory: String) -> CommandResult<BiosVerificationReport> {
        todo!()
    }

    /// Get BIOS requirements for a set of platform IDs.
    #[tauri::command]
    pub async fn get_bios_requirements(platform_ids: Vec<String>) -> CommandResult<Vec<BiosRequirement>> {
        todo!()
    }

    /// Get BIOS requirements inferred for a device profile (OS + emulator defaults).
    #[tauri::command]
    pub async fn get_bios_requirements_for_device(device_profile_id: i64) -> CommandResult<Vec<BiosRequirement>> {
        todo!()
    }

    /// Check BIOS completeness for a directory against a set of platforms.
    #[tauri::command]
    pub async fn check_bios_completeness(
        directory: String,
        platform_ids: Vec<String>,
    ) -> CommandResult<BiasCompletenessReport> {
        todo!()
    }
}

// -----------------------------------------------------------------------------
// compat::*
// -----------------------------------------------------------------------------
pub mod compat {
    use super::*;

    /// Lookup performance record for a game + device.
    ///
    /// `device_id` is accepted here for UI ergonomics; implementation should resolve device->chipset.
    #[tauri::command]
    pub async fn get_game_performance(game_id: String, device_id: String) -> CommandResult<Option<GamePerformance>> {
        todo!()
    }

    /// Lookup emulator compatibility status for a game + emulator.
    #[tauri::command]
    pub async fn get_emulator_compatibility(game_id: String, emulator_id: String) -> CommandResult<Option<EmulatorCompat>> {
        todo!()
    }

    /// Lookup recommended settings for a game + emulator.
    #[tauri::command]
    pub async fn get_game_settings(game_id: String, emulator_id: String) -> CommandResult<Option<GameSettings>> {
        todo!()
    }

    /// Batch lookup performance records for multiple games.
    #[tauri::command]
    pub async fn get_performance_batch(
        game_ids: Vec<String>,
        device_id: String,
    ) -> CommandResult<HashMap<String, GamePerformance>> {
        todo!()
    }

    /// Refresh in-memory caches for performance/compat/settings lookups.
    #[tauri::command]
    pub async fn refresh_compatibility_cache() -> CommandResult<RefreshResult> {
        todo!()
    }

    /// Clear in-memory caches (forces lazy reload).
    #[tauri::command]
    pub async fn clear_compatibility_cache() -> CommandResult<bool> {
        todo!()
    }
}

// -----------------------------------------------------------------------------
// settings::*
// -----------------------------------------------------------------------------
pub mod settings {
    use super::*;

    /// Get global app settings.
    #[tauri::command]
    pub async fn get_settings() -> CommandResult<AppSettings> {
        todo!()
    }

    /// Update global app settings.
    #[tauri::command]
    pub async fn update_settings(updates: SettingsUpdate) -> CommandResult<AppSettings> {
        todo!()
    }

    /// List platform overrides (default emulator selection overrides).
    #[tauri::command]
    pub async fn get_platform_overrides() -> CommandResult<Vec<PlatformOverride>> {
        todo!()
    }

    /// Set a platform override.
    #[tauri::command]
    pub async fn set_platform_override(platform_id: String, emulator_id: String) -> CommandResult<PlatformOverride> {
        todo!()
    }

    /// Delete a platform override.
    #[tauri::command]
    pub async fn delete_platform_override(platform_id: String) -> CommandResult<bool> {
        todo!()
    }

    /// Get a per-game override (auto-list include/exclude, force emulator, etc).
    #[tauri::command]
    pub async fn get_game_overrides(game_id: i64) -> CommandResult<Option<GameOverride>> {
        todo!()
    }

    /// Set a per-game override.
    #[tauri::command]
    pub async fn set_game_override(game_id: i64, override_data: GameOverride) -> CommandResult<GameOverride> {
        todo!()
    }

    /// Delete a per-game override.
    #[tauri::command]
    pub async fn delete_game_override(game_id: i64) -> CommandResult<bool> {
        todo!()
    }

    /// Get saved path overrides for a destination.
    #[tauri::command]
    pub async fn get_user_path_override(destination_id: String) -> CommandResult<Option<UserPathOverrideEntry>> {
        todo!()
    }

    /// Save path overrides for a destination.
    #[tauri::command]
    pub async fn set_user_path_override(destination_id: String, entry: UserPathOverrideEntry) -> CommandResult<UserPathOverrideEntry> {
        todo!()
    }

    /// Delete saved path overrides for a destination.
    #[tauri::command]
    pub async fn delete_user_path_override(destination_id: String) -> CommandResult<bool> {
        todo!()
    }
}

// -----------------------------------------------------------------------------
// definitions::*
// -----------------------------------------------------------------------------
pub mod definitions {
    use super::*;

    /// Load a definition pack (optional explicit path). If `None`, load bundled/default.
    #[tauri::command]
    pub async fn load_definition_pack(path: Option<String>) -> CommandResult<DefinitionPackMeta> {
        todo!()
    }

    /// List platforms.
    #[tauri::command]
    pub async fn get_platforms() -> CommandResult<Vec<Platform>> {
        todo!()
    }

    /// Get a single platform by id.
    #[tauri::command]
    pub async fn get_platform(id: String) -> CommandResult<Option<Platform>> {
        todo!()
    }

    /// List emulators.
    #[tauri::command]
    pub async fn get_emulators() -> CommandResult<Vec<Emulator>> {
        todo!()
    }

    /// Get a single emulator by id.
    #[tauri::command]
    pub async fn get_emulator(id: String) -> CommandResult<Option<Emulator>> {
        todo!()
    }

    /// List devices in the catalog (definition pack).
    #[tauri::command]
    pub async fn get_devices_catalog() -> CommandResult<Vec<DeviceCatalog>> {
        todo!()
    }

    /// List operating systems.
    #[tauri::command]
    pub async fn get_operating_systems() -> CommandResult<Vec<OperatingSystem>> {
        todo!()
    }

    /// List frontends.
    #[tauri::command]
    pub async fn get_frontends() -> CommandResult<Vec<Frontend>> {
        todo!()
    }

    /// Search platforms by query (name/alias).
    #[tauri::command]
    pub async fn search_platforms(query: String) -> CommandResult<Vec<Platform>> {
        todo!()
    }

    /// Search emulators by query (name).
    #[tauri::command]
    pub async fn search_emulators(query: String) -> CommandResult<Vec<Emulator>> {
        todo!()
    }

    /// Get emulators that support a specific platform.
    #[tauri::command]
    pub async fn get_emulators_for_platform(platform_id: String) -> CommandResult<Vec<Emulator>> {
        todo!()
    }

    /// List known chipsets.
    #[tauri::command]
    pub async fn get_chipsets() -> CommandResult<Vec<Chipset>> {
        todo!()
    }
}

// -----------------------------------------------------------------------------
// fs::*
// -----------------------------------------------------------------------------
pub mod fs {
    use super::*;

    // Dialogs -----------------------------------------------------------------

    /// Show a directory picker dialog.
    #[tauri::command]
    pub async fn pick_directory() -> CommandResult<Option<String>> {
        todo!()
    }

    /// Show a file picker dialog.
    #[tauri::command]
    pub async fn pick_files(filters: Vec<FileFilter>) -> CommandResult<Vec<String>> {
        todo!()
    }

    /// Show a save-file dialog.
    #[tauri::command]
    pub async fn pick_save_location(default_name: String) -> CommandResult<Option<String>> {
        todo!()
    }

    // Operations --------------------------------------------------------------

    /// Get basic directory stats.
    #[tauri::command]
    pub async fn get_directory_info(path: String) -> CommandResult<DirectoryInfo> {
        todo!()
    }

    /// Calculate a file hash (md5/sha1/sha256/crc32).
    #[tauri::command]
    pub async fn calculate_file_hash(path: String, algorithm: HashAlgorithm) -> CommandResult<String> {
        todo!()
    }

    /// Copy a file.
    #[tauri::command]
    pub async fn copy_file(source: String, dest: String) -> CommandResult<CopyResult> {
        todo!()
    }

    /// Move/rename a file.
    #[tauri::command]
    pub async fn move_file(source: String, dest: String) -> CommandResult<MoveResult> {
        todo!()
    }

    /// Delete a file.
    #[tauri::command]
    pub async fn delete_file(path: String) -> CommandResult<bool> {
        todo!()
    }

    // Archive operations ------------------------------------------------------

    /// List archive contents (zip/7z/rar as supported by backend).
    #[tauri::command]
    pub async fn list_archive_contents(path: String) -> CommandResult<Vec<ArchiveEntry>> {
        todo!()
    }

    /// Extract archive to destination directory.
    #[tauri::command]
    pub async fn extract_archive(path: String, dest: String) -> CommandResult<ExtractResult> {
        todo!()
    }
}
