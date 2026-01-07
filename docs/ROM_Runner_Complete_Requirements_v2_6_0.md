# ROM Runner - Complete Requirements Document v2.6.0

**Version:** 2.6.0  
**Last Updated:** January 7, 2026  
**Status:** Draft - Ready for Development  
**Previous Version:** 2.5.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Concepts](#2-core-concepts)
3. [Data Model Overview](#3-data-model-overview)
4. [DefinitionPack Specification](#4-definitionpack-specification)
5. [Performance & Compatibility Data Model](#5-performance--compatibility-data-model)
6. [Platform Policies & Gating Logic](#6-platform-policies--gating-logic)
7. [OS Emulator Profiles](#7-os-emulator-profiles)
8. [**Destination Device Scanning** *(NEW in v2.5)*](#8-destination-device-scanning)
9. [Compatibility Framework](#9-compatibility-framework)
10. [Auto-List Generation Rules](#10-auto-list-generation-rules)
11. [User Settings & Overrides](#11-user-settings--overrides)
12. [Data Files Reference](#12-data-files-reference)
13. [Migration Notes](#13-migration-notes)
14. [Appendix: Interfaces](#14-appendix-interfaces)
15. [**Theme System & Branding** *(NEW in v2.6)*](#15-theme-system--branding)
16. [Version History](#16-version-history)

---

## 1. Executive Summary

ROM Runner is a cross-platform desktop application for managing retro gaming ROM collections and deploying them to handheld gaming devices. The application provides intelligent, device-aware deployment capabilities that automatically optimize collections based on target hardware performance and compatibility.

### 1.1 Key Capabilities

- **Collection Management**: Scan, organize, and curate ROM collections with rich metadata
- **Device-Aware Deployment**: Optimize collections for specific device/OS combinations
- **Performance Gating**: Exclude games that won't run well on target hardware
- **Compatibility Filtering**: Filter games based on emulator compatibility status
- **Settings Optimization**: Apply recommended emulator settings per-game
- **BIOS Management**: Verify and deploy required BIOS files (hash-based validation only)
- **ROM Hack Support**: Special handling for ROM hacks, fan translations, and Pokemon hacks
- **Destination Scanning**: Verify and auto-detect destination folder layouts *(NEW in v2.5)*

### 1.2 Document Scope

This document defines:
- Data models for the DefinitionPack system
- Performance and compatibility data structures
- Platform policies for missing data handling
- OS emulator profiles for device/OS combinations
- Destination device scanning and layout detection
- Auto-list generation rules and precedence
- Compatibility framework for ingesting external sources

---

## 2. Core Concepts

### 2.1 Three-Tier Data Model

ROM Runner uses three distinct data layers for game/device interactions:

| Layer | Dataset | Question Answered | Example |
|-------|---------|-------------------|---------|
| **Performance** | `gamePerformance` | "Can this device run this platform's games?" | RG35XX Plus can run PSP at 'playable' tier |
| **Compatibility** | `emulatorCompatibility` | "Does this specific game work with this emulator?" | God of War is 'playable' on PPSSPP |
| **Settings** | `emulatorGameSettings` | "What settings optimize this game?" | Use CPU Thread=true for God of War |

### 2.2 Device + OS Selection Model

Because the user selects BOTH the target Device AND the exact OS distribution running on that device, ROM Runner can determine:

1. **Preinstalled Emulators**: What emulators/cores are bundled with that OS
2. **Default Emulator per Platform**: What the OS/frontend uses by default
3. **Folder Layout**: Where ROMs and BIOS files should be placed
4. **Performance Capabilities**: Device-specific performance characteristics

This enables intelligent auto-list generation that accounts for both hardware limitations (performance) and software availability (which emulators are installed).

### 2.3 Big Systems Set

These platforms have high variance by hardware and/or emulator maturity, requiring conservative defaults when data is missing:

```
Big Systems Set (platformIds):
ps3, wiiu, switch, xbox, xbox360, ps2, 3ds, wii, gamecube, saturn
```

### 2.4 Difficulty Tiers

Platforms are classified into difficulty tiers for missing-data handling:

| Tier | Classification | Platforms |
|------|---------------|-----------|
| **Tier 1** | Modern/Hard | `ps3`, `wiiu`, `switch`, `xbox360` |
| **Tier 2** | Demanding | `ps2`, `3ds`, `wii`, `gamecube`, `saturn`, `xbox` |
| **Tier 3** | Moderate | `dreamcast`, `psp`, `n64` |
| **Tier 4** | Easy | `nds`, `ps1`, `up_to_snes` |

---

## 3. Data Model Overview

### 3.1 DefinitionPack Structure

The DefinitionPack contains all static data needed for ROM Runner operation:

```typescript
interface DefinitionPack {
  version: string;
  releaseDate: Date;
  minAppVersion: string;
  schemaVersion: number;  // v2.5: schemaVersion = 5
  
  // Catalog data
  platforms: Platform[];
  emulators: Emulator[];
  frontends: Frontend[];
  devices: Device[];
  chipsets: Chipset[];
  operatingSystems: OperatingSystem[];
  biosFiles: BIOSRequirement[];
  
  // Performance & Compatibility data
  gamePerformance: GamePerformance[];           // Device performance gating
  emulatorCompatibility: EmulatorCompatibility[]; // Game/emulator status
  emulatorGameSettings: EmulatorGameSettings[];   // Per-game settings
  
  // OS Emulator Profiles (v2.4+)
  osEmulatorProfiles: OSEmulatorProfile[];        // OS-specific emulator/layout info
  
  // Layout Detection Profiles (NEW v2.5)
  layoutDetectionProfiles: LayoutDetectionProfile[]; // Fingerprints for known layouts
  
  // Policy data
  platformPolicies: PlatformPolicies;             // Missing-data handling rules
  
  // External source registry
  compatibilitySources: CompatibilitySourcesRegistry;
  communityPerformanceSources: CommunityPerformanceSource[];
  
  // Curated content
  curatedLists: CuratedList[];
  
  // Metadata
  changelog: ChangelogEntry[];
  signature: string;
}
```

### 3.2 Key Relationships

```
Device + OS Selection
       â”‚
       â”œâ”€â”€â–º OSEmulatorProfile (layout, installed emulators, defaults)
       â”‚          â”‚
       â”‚          â–¼
       â”‚   platformToEmulator map (default emulator per platform)
       â”‚
       â”œâ”€â”€â–º DestinationScan (NEW v2.5)
       â”‚          â”‚
       â”‚          â–¼
       â”‚   Layout verification & auto-detection
       â”‚
       â”œâ”€â”€â–º gamePerformance lookup (device/chipset â†’ performance tier)
       â”‚          â”‚
       â”‚          â–¼
       â”‚   excludeFromAutoLists decision
       â”‚
       â””â”€â”€â–º emulatorCompatibility lookup (game + emulator â†’ status)
                  â”‚
                  â–¼
          Auto-list inclusion/exclusion
```

---

## 4. DefinitionPack Specification

### 4.1 Platform Interface

```typescript
interface Platform {
  id: string;                    // e.g., "snes", "psx", "n64"
  name: string;                  // Full display name
  shortName: string;             // Abbreviated name for UI
  manufacturer: string;
  generation?: number;
  releaseYear?: number;
  type: 'console' | 'handheld' | 'computer' | 'arcade';
  supportedFormats: string[];    // e.g., ["sfc", "smc", "zip"]
  preferredFormat?: string;
  requiresBios: boolean;
  commonFolderNames: string[];   // Used by frontends
  fileExtensions: string[];
}
```

### 4.2 Device Interface

```typescript
interface Device {
  // Identification
  id: string;                    // Slug (e.g., "rg35xx-plus")
  name: string;                  // Display name
  manufacturer: string;
  
  // Hardware
  type: 'handheld' | 'console' | 'pc' | 'phone' | 'tablet' | 'sbc' | 'arcade';
  releaseYear: number | null;
  chipset: string;               // SoC name (e.g., "Allwinner H700")
  chipsetClass: string;          // Family (e.g., "h700")
  cpu: string;
  gpu: string;
  ram: number;                   // In MB
  
  // Display
  screenWidth: number;
  screenHeight: number;
  screenAspectRatio: string;
  screenType: 'lcd' | 'oled' | 'ips' | null;
  
  // Storage
  storageType: string;
  internalStorage: number | null;
  sdCardSlots: number;
  maxSdCardSize: number | null;
  
  // Connectivity
  wifi: boolean;
  bluetooth: boolean;
  usb: string[];
  hdmiOut: boolean;
  
  // Battery
  batteryMah: number | null;
  batteryLife: string | null;
  
  // OS Support
  defaultOs: string | null;
  supportedOsIds: string[];
  
  // RetroCatalog data
  inheritsScoresFrom?: string;   // Device ID to inherit platform scores from
  retrocatalogSlug?: string;
  
  // Metadata
  tags?: string[];
  notes?: string;
}
```

### 4.3 Operating System Interface

```typescript
interface OperatingSystem {
  id: string;                    // e.g., "arkos", "gammaos", "batocera"
  name: string;
  osType: 'cfw' | 'stock' | 'android' | 'linux' | 'windows';
  baseOs?: string;               // e.g., "linux", "android"
  version?: string;
  supportedDeviceTypes: string[];
  defaultFrontend?: string;
  features: string[];
  website?: string;
  downloadUrl?: string;
}
```

### 4.4 Emulator Interface

```typescript
interface Emulator {
  id: string;                    // e.g., "ppsspp-standalone", "mgba-libretro"
  name: string;
  type: 'standalone' | 'libretro-core';
  supportedPlatformIds: string[];
  performance: {
    demandTier: 'low' | 'medium' | 'high' | 'very-high';
    notes?: string;
  };
  features: string[];
  website?: string;
  settingsFormat?: 'ini' | 'json' | 'xml' | 'custom';
}
```

---

## 5. Performance & Compatibility Data Model

### 5.1 GamePerformance Interface

**Purpose:** Device/platform performance gating. Determines whether a game or platform should be included in auto-generated lists for a specific device.

```typescript
interface GamePerformance {
  // Target identifiers
  gameId: string;              // Specific game ID or "*" for platform-wide default
  platformId: string;          // ROM Runner platform ID (e.g., "psp", "ps2")
  
  // Device targeting (at least one required)
  deviceId?: string;           // Specific device (e.g., "rg35xx-plus")
  chipsetClass?: string;       // Chipset family (e.g., "rk3566", "h700")
  
  // Performance data
  emulatorId?: string;         // Specific emulator or "*" for any
  performanceTier: PerformanceTier;
  rawScore?: number;           // Original 0-100 score if available
  
  // Gating behavior
  excludeFromAutoLists: boolean;
  
  // Metadata
  source: string;              // Data source (e.g., "retrocatalog", "community")
  sourceUrl?: string;
  lastUpdated?: string;        // ISO date
  notes?: string;
}

type PerformanceTier = 
  | 'excellent'   // 80-100: Perfect or near-perfect
  | 'good'        // 60-79: Fully playable with minor issues
  | 'playable'    // 40-59: Completable but noticeable issues
  | 'poor'        // 1-39: Significant issues, not recommended
  | 'unplayable'; // 0: Does not work
```

**Score to Tier Mapping:**

| Tier | Score Range | Auto-List Behavior |
|------|-------------|-------------------|
| `excellent` | 80-100 | Include |
| `good` | 60-79 | Include |
| `playable` | 40-59 | Include |
| `poor` | 1-39 | **Exclude** |
| `unplayable` | 0 | **Exclude** |

**Platform-Wide Defaults (`gameId="*"`):**

When `gameId="*"`, the record represents platform-wide defaults for a device:

```typescript
// Example: Platform defaults for RG35XX Plus
{ gameId: '*', platformId: 'gb',  deviceId: 'rg35xx-plus', performanceTier: 'excellent', excludeFromAutoLists: false }
{ gameId: '*', platformId: 'psx', deviceId: 'rg35xx-plus', performanceTier: 'good',      excludeFromAutoLists: false }
{ gameId: '*', platformId: 'ps2', deviceId: 'rg35xx-plus', performanceTier: 'poor',      excludeFromAutoLists: true  }
```

The file `gamePerformance_baseline.json` contains RetroCatalog-derived platform-wide defaults. This is a packaging slice of the `gamePerformance` dataset, not a separate schema concept.

### 5.2 EmulatorCompatibility Interface

**Purpose:** Per-game emulator compatibility status. Indicates whether a specific game works with a specific emulator, independent of device performance.

```typescript
interface EmulatorCompatibility {
  // Target identifiers
  gameId: string;              // ROM Runner game ID or "UNMAPPED"
  platformId: string;          // ROM Runner platform ID
  emulatorId: string;          // ROM Runner emulator ID
  
  // External ID mapping (for unmapped games)
  externalIdType?: string;     // e.g., "ps3TitleId", "serial"
  externalGameId?: string;     // e.g., "BLES12345"
  
  // Compatibility status
  status: CompatibilityStatus;
  
  // Provenance
  source: string;              // Source ID (e.g., "rpcs3-compat")
  sourceUrl?: string;
  confidence: 'high' | 'medium' | 'low';
  
  // Optional metadata
  testedVersion?: string;      // Emulator version tested
  lastUpdated?: string;        // ISO date
  notes?: string;
}

type CompatibilityStatus =
  | 'perfect'      // Runs flawlessly
  | 'playable'     // Completable with minor issues
  | 'ingame'       // Gets past menus, may have issues
  | 'menu_intro'   // Reaches menus/intros only
  | 'boots_only'   // Shows something but unplayable
  | 'broken'       // Doesn't boot
  | 'unknown';     // No data
```

**Auto-List Behavior by Status:**

| Status | Behavior |
|--------|----------|
| `perfect`, `playable` | Include |
| `ingame`, `menu_intro`, `unknown` | Include with warning |
| `boots_only`, `broken` | **Exclude** |

### 5.3 EmulatorGameSettings Interface

**Purpose:** Per-game emulator settings and fixes. Provides optimal configuration for specific games.

```typescript
interface EmulatorGameSettings {
  // Target identifiers
  gameId: string;              // ROM Runner game ID or "UNMAPPED"
  platformId: string;
  emulatorId: string;
  
  // External ID mapping
  externalIdType?: string;
  externalGameId?: string;
  
  // Settings data
  settings: Record<string, Record<string, string | number | boolean>>;
  // Example: { "Core": { "CPUThread": true }, "Video": { "SafeTexture": 512 } }
  
  settingsFormat: 'ini' | 'json' | 'xml' | 'custom';
  
  // Application behavior
  applyMode: 'suggested' | 'auto' | 'required';
  // - 'suggested': Show to user, they choose to apply
  // - 'auto': Apply automatically if user enables auto-apply
  // - 'required': Must apply for game to work
  
  // Provenance
  source: string;
  sourceUrl?: string;
  confidence: 'high' | 'medium' | 'low';
  
  // Metadata
  notes?: string;              // What this fixes/improves
  testedVersion?: string;
}
```

### 5.4 Performance Precedence Resolution

When determining performance for a game on a device:

```typescript
function resolvePerformance(
  gameId: string,
  platformId: string,
  deviceId: string,
  emulatorId: string,
  records: GamePerformance[]
): GamePerformance | null {
  const device = getDevice(deviceId);
  const chipsetClass = device?.chipsetClass;
  
  // Priority order (highest first):
  const priorities = [
    // 1. Exact match: gameId + deviceId + emulatorId
    (r) => r.gameId === gameId && r.deviceId === deviceId && r.emulatorId === emulatorId,
    // 2. Game + device: gameId + deviceId + any emulator
    (r) => r.gameId === gameId && r.deviceId === deviceId && (!r.emulatorId || r.emulatorId === '*'),
    // 3. Game + chipset: gameId + chipsetClass + emulatorId
    (r) => r.gameId === gameId && r.chipsetClass === chipsetClass && r.emulatorId === emulatorId,
    // 4. Game + chipset any emu: gameId + chipsetClass
    (r) => r.gameId === gameId && r.chipsetClass === chipsetClass,
    // 5. Platform + device: "*" + deviceId + emulatorId
    (r) => r.gameId === '*' && r.platformId === platformId && r.deviceId === deviceId && r.emulatorId === emulatorId,
    // 6. Platform + device any emu: "*" + deviceId
    (r) => r.gameId === '*' && r.platformId === platformId && r.deviceId === deviceId,
    // 7. Platform + chipset: "*" + chipsetClass
    (r) => r.gameId === '*' && r.platformId === platformId && r.chipsetClass === chipsetClass,
    // 8. No data: return null (apply missing-data rules)
  ];
  
  for (const matcher of priorities) {
    const match = records.find(matcher);
    if (match) return match;
  }
  
  return null; // Apply platformPolicies missing-data rules
}
```

### 5.5 Compatibility Precedence Resolution

When determining compatibility for a game:

1. **User per-ROM override** (highest priority)
2. **Game-specific record** (`emulatorCompatibility` with specific `gameId`)
3. **Platform-wide default** (`emulatorCompatibility` with `gameId="*"`)
4. **Apply platformPolicies missing-data rules**

---

## 6. Platform Policies & Gating Logic

### 6.1 Platform Policies Configuration

Platform policies define how ROM Runner handles missing performance and compatibility data:

```typescript
interface PlatformPolicies {
  version: string;
  
  // Platforms covered by RetroCatalog performance data
  retroCatalogPlatformCoverage: string[];
  
  // Platforms requiring conservative handling
  bigSystemsSet: string[];
  
  // Difficulty classification for missing-data rules
  difficultyTiers: {
    tier1_modern_hard: string[];
    tier2_demanding: string[];
    tier3_moderate: string[];
    tier4_easy: string[];
  };
  
  // Default behaviors
  defaults: {
    performanceMissing: PerformanceMissingPolicy;
    compatibilityMissing: CompatibilityMissingPolicy;
  };
}
```

### 6.2 Performance Missing Rules

**Rule A â€” Platform NOT in RetroCatalog coverage:**

If a platform is not covered by RetroCatalog and no `gamePerformance` row exists:
- Treat as **Unknown but allowed** (optimistic)
- Include in auto lists
- Show warning with reason code: `PERF_NO_RETROCAT_DATA_ASSUME_OK`

**Rule B â€” Platform IS in RetroCatalog coverage:**

If RetroCatalog covers the platform but the selected device has no platform score:

| Tier | Behavior | Reason Code |
|------|----------|-------------|
| Tier 1-2 (modern/demanding) | **Exclude** from auto lists | `PERF_MISSING_STRICT` |
| Tier 3-4 (moderate/easy) | Include (optimistic) | `PERF_MISSING_OPTIMISTIC` |

### 6.3 Compatibility Missing Rules

If no per-game `emulatorCompatibility` record exists:

**For Strict Modern Platforms:**
`ps3, wiiu, saturn, xbox, xbox360, switch`

- **Exclude** from auto lists by default
- Allow user per-game override
- Reason code: `COMPAT_MISSING_STRICT`

**For Mature/Easy Platforms:**
(All other platforms)

- **Include** (assume compatible)
- Mark as Unknown with warning
- Reason code: `COMPAT_MISSING_ASSUME_OK`

### 6.4 Reason Codes Reference

| Code | Meaning |
|------|---------|
| `PERF_NO_RETROCAT_DATA_ASSUME_OK` | Platform not in RetroCatalog; assumed OK |
| `PERF_MISSING_STRICT` | No performance data for demanding platform; excluded |
| `PERF_MISSING_OPTIMISTIC` | No performance data for easy platform; included |
| `COMPAT_MISSING_STRICT` | No compatibility data for strict platform; excluded |
| `COMPAT_MISSING_ASSUME_OK` | No compatibility data for mature platform; assumed OK |
| `COMPAT_STATUS_EXCLUDED` | Game has broken/boots_only status |
| `PERF_TIER_EXCLUDED` | Performance tier is poor/unplayable |
| `USER_OVERRIDE_INCLUDE` | User forced inclusion |
| `USER_OVERRIDE_EXCLUDE` | User forced exclusion |

---

## 7. OS Emulator Profiles

### 7.1 Overview

Because the user selects (Device + OS), ROM Runner must know:
- What emulators/cores are bundled/preinstalled for that OS
- What default emulator/core the OS/frontend uses per platform
- What folder layout is required for ROMs/BIOS

### 7.2 OSEmulatorProfile Interface

```typescript
interface OSEmulatorProfile {
  // Required identification
  osId: string;                  // e.g., "arkos", "batocera"
  
  // Optional device-specific scope
  deviceId?: string;             // For device-specific variants
  
  // OS metadata
  name: string;
  osFamily: 'cfw' | 'stock' | 'android' | 'linux';
  defaultFrontend: string | null;
  
  // Installed emulators
  installed: {
    standaloneEmulators: string[];    // Emulator IDs
    retroarchCores: string[];         // Core IDs
    notes?: string;
  };
  
  // Default emulator per platform
  defaults: {
    platformToEmulator: Record<string, string>;  // platformId â†’ emulatorId
    notes?: string;
  };
  
  // Folder layout
  layout: {
    paths: {
      bios: string;
      roms: string;
      saves?: string;
      states?: string;
      screenshots?: string;
      portmaster?: string;
    };
    notes?: string;
    requiresUserPathSelection: boolean;
  };
  
  // Detection markers (optional)
  detection?: {
    fileMarkersAny: string[];     // Any of these present â†’ match
    fileMarkersAll: string[];     // All of these present â†’ match
    notes?: string;
  };
  
  // Alternative layouts (NEW v2.5)
  alternativeLayouts?: AlternativeLayout[];
  
  // Documentation sources
  sources?: {
    docsUrls: string[];
    notes?: string;
  };
}
```

### 7.3 Selection Hierarchy

When user chooses Device + OS:

1. **deviceOsProfile** â€” Check for device-specific OS profile override
2. **osProfile** â€” Use OS-level profile if no device override
3. **autoDetectOnDestination** â€” Validate by scanning destination for known markers
4. **fallbackDefaults** â€” Use generic defaults and **warn user**

```typescript
function resolveOSProfile(
  deviceId: string,
  osId: string,
  profiles: OSEmulatorProfile[],
  fallbacks: FallbackDefaults
): OSEmulatorProfile {
  // 1. Device-specific override
  const deviceOverride = profiles.find(p => p.osId === osId && p.deviceId === deviceId);
  if (deviceOverride) return deviceOverride;
  
  // 2. OS-level profile
  const osProfile = profiles.find(p => p.osId === osId && !p.deviceId);
  if (osProfile) return osProfile;
  
  // 3. Fallback with warning
  console.warn(`No profile found for ${osId} on ${deviceId}, using fallback`);
  return createFallbackProfile(osId, fallbacks);
}
```

### 7.4 User Overrides

Users can override the default emulator per platform or per game:

```typescript
interface UserEmulatorOverride {
  scope: 'platform' | 'game';
  platformId: string;
  gameId?: string;               // Required if scope='game'
  emulatorId: string;            // User's chosen emulator
}
```

**Important:** Even with user overrides, ROM Runner must still:
- Place ROMs/BIOS in the OS's expected folders
- Record overrides in the transfer manifest/config

### 7.5 Layout Examples

**KNULLI:**
```json
{
  "osId": "knulli",
  "layout": {
    "paths": {
      "bios": "/userdata/bios",
      "roms": "/userdata/roms",
      "saves": "/userdata/saves",
      "states": "/userdata/states"
    }
  }
}
```

**ArkOS:**
```json
{
  "osId": "arkos",
  "layout": {
    "paths": {
      "bios": "/roms/bios",
      "roms": "/roms",
      "saves": "/roms/savestates",
      "states": "/roms/savestates"
    }
  }
}
```

**Android EmulationStation (Standard):**
```json
{
  "osId": "android-emulationstation",
  "name": "Android + EmulationStation (Standard)",
  "osFamily": "android",
  "layout": {
    "paths": {
      "bios": "/storage/emulated/0/RetroArch/system",
      "roms": "/storage/emulated/0/ROMs",
      "saves": "/storage/emulated/0/RetroArch/saves",
      "states": "/storage/emulated/0/RetroArch/states"
    },
    "requiresUserPathSelection": false
  }
}
```

---

## 8. Destination Device Scanning

*NEW in v2.5*

### 8.1 Overview

Destination Device Scanning addresses a critical problem: the folder layout and OS configuration on target devices can vary significantly from our assumptions. This feature provides:

1. **Layout Verification**: Confirm the destination matches our expected folder structure
2. **Layout Detection**: Auto-detect which OS/firmware is installed by scanning for known markers
3. **Layout Adaptation**: Support alternative layouts when detected structure differs from expected
4. **Conflict Resolution**: Handle mismatches between user-selected OS and actual device state

### 8.2 Why Scanning Matters

| Scenario | Problem Without Scanning | Solution With Scanning |
|----------|-------------------------|------------------------|
| User selects "ArkOS" but device has "ROCKNIX" | ROMs copied to wrong paths, games don't appear | Detect actual OS, warn user, use correct paths |
| CFW updated with new folder structure | Deployment fails or games don't load | Detect new structure, adapt automatically |
| Stock firmware varies by production batch | Assumed paths don't exist | Scan reveals actual layout, prompt user if needed |
| SD card formatted for different device | Cross-contamination of files | Detect foreign layout, warn before overwriting |
| Custom folder structure | User's preferred organization ignored | Detect and remember user's custom structure |

### 8.3 DestinationScanResult Interface

```typescript
interface DestinationScanResult {
  // Scan metadata
  scanTimestamp: string;         // ISO 8601
  scanDuration: number;          // milliseconds
  destinationPath: string;       // Root path scanned

  // Detected information
  detected: {
    osId: string | null;         // Detected OS (null if unknown)
    osConfidence: 'high' | 'medium' | 'low' | 'none';
    layoutId: string | null;     // Matched layout profile ID
    layoutConfidence: 'high' | 'medium' | 'low' | 'none';

    // What we found
    foundMarkers: string[];      // Files/folders that matched detection rules
    missingMarkers: string[];    // Expected files/folders that weren't found
  };

  // Existing content discovery
  existingContent: {
    romFolders: DiscoveredFolder[];
    biosFolders: DiscoveredFolder[];
    saveFolders: DiscoveredFolder[];
    configFiles: DiscoveredFile[];
    emulatorBinaries: DiscoveredFile[];
  };

  // Verification against expected
  verification: {
    expectedOsId: string;        // What user selected
    expectedLayout: LayoutPaths;
    matches: boolean;            // Does detected match expected?
    discrepancies: LayoutDiscrepancy[];
  };

  // Recommendations
  recommendations: ScanRecommendation[];
}

interface DiscoveredFolder {
  path: string;
  type: 'roms' | 'bios' | 'saves' | 'states' | 'config' | 'unknown';
  platformId?: string;           // If platform-specific folder
  fileCount: number;
  totalSizeMB: number;
}

interface DiscoveredFile {
  path: string;
  type: 'config' | 'emulator' | 'bios' | 'marker' | 'unknown';
  name: string;
  sizeMB: number;
}

interface LayoutDiscrepancy {
  type: 'missing_folder' | 'extra_folder' | 'wrong_path' | 'different_os';
  expected: string;
  actual: string | null;
  severity: 'error' | 'warning' | 'info';
  suggestion: string;
}

interface ScanRecommendation {
  type: 'use_detected' | 'confirm_layout' | 'create_folders' | 'manual_config';
  message: string;
  action?: RecommendedAction;
}
```

### 8.4 LayoutDetectionProfile Interface

```typescript
interface LayoutDetectionProfile {
  id: string;                    // e.g., "arkos-standard", "batocera-default"
  osId: string;                  // Associated OS
  name: string;
  
  // Detection rules
  detection: {
    // Any of these files/folders present â†’ possible match
    markersAny: string[];
    // All of these must be present â†’ confident match
    markersAll: string[];
    // If these exist, definitely NOT this OS
    markersNone: string[];
    // Minimum confidence to declare match
    minimumConfidence: 'high' | 'medium' | 'low';
  };
  
  // Expected folder structure
  expectedLayout: {
    bios: string;
    roms: string;
    saves?: string;
    states?: string;
    screenshots?: string;
  };
  
  // Known variations
  variations?: LayoutVariation[];
  
  // Metadata
  notes?: string;
  lastUpdated: string;
}

interface LayoutVariation {
  name: string;
  condition: string;             // When this variation applies
  overrides: Partial<LayoutPaths>;
}
```

### 8.5 Example Detection Profiles

**ArkOS:**
```json
{
  "id": "arkos-standard",
  "osId": "arkos",
  "name": "ArkOS Standard Layout",
  "detection": {
    "markersAny": [
      "/opt/system/Advanced/Switch to main SD for Roms.sh",
      "/.ArkOS"
    ],
    "markersAll": [
      "/roms",
      "/roms/bios"
    ],
    "markersNone": [
      "/userdata",
      "/.rocknix"
    ],
    "minimumConfidence": "medium"
  },
  "expectedLayout": {
    "bios": "/roms/bios",
    "roms": "/roms",
    "saves": "/roms/savestates",
    "states": "/roms/savestates"
  }
}
```

**ROCKNIX:**
```json
{
  "id": "rocknix-standard",
  "osId": "rocknix",
  "name": "ROCKNIX Standard Layout",
  "detection": {
    "markersAny": [
      "/.rocknix",
      "/storage/.config/rocknix"
    ],
    "markersAll": [
      "/roms"
    ],
    "markersNone": [
      "/.ArkOS",
      "/userdata"
    ],
    "minimumConfidence": "medium"
  },
  "expectedLayout": {
    "bios": "/roms/bios",
    "roms": "/roms",
    "saves": "/roms/savestates"
  }
}
```

**Batocera:**
```json
{
  "id": "batocera-standard",
  "osId": "batocera",
  "name": "Batocera Standard Layout",
  "detection": {
    "markersAny": [
      "/userdata/system/batocera.conf",
      "/boot/batocera"
    ],
    "markersAll": [
      "/userdata/roms",
      "/userdata/bios"
    ],
    "markersNone": [
      "/.ArkOS",
      "/.rocknix"
    ],
    "minimumConfidence": "high"
  },
  "expectedLayout": {
    "bios": "/userdata/bios",
    "roms": "/userdata/roms",
    "saves": "/userdata/saves",
    "states": "/userdata/saves"
  }
}
```

### 8.6 Scanning Algorithm

```typescript
async function scanDestination(
  destinationPath: string,
  expectedOsId: string,
  profiles: LayoutDetectionProfile[]
): Promise<DestinationScanResult> {
  const startTime = Date.now();
  
  // 1. Quick marker scan (first 2 levels only for speed)
  const foundMarkers = await scanForMarkers(destinationPath);
  
  // 2. Match against known profiles
  const matches = profiles.map(profile => ({
    profile,
    confidence: calculateConfidence(profile, foundMarkers)
  })).filter(m => m.confidence !== 'none')
    .sort((a, b) => confidenceScore(b.confidence) - confidenceScore(a.confidence));
  
  // 3. Discover existing content
  const existingContent = await discoverContent(destinationPath);
  
  // 4. Verify against expected
  const expectedProfile = profiles.find(p => p.osId === expectedOsId);
  const verification = verifyLayout(expectedProfile, foundMarkers, existingContent);
  
  // 5. Generate recommendations
  const recommendations = generateRecommendations(
    matches[0] || null,
    expectedProfile,
    verification
  );
  
  return {
    scanTimestamp: new Date().toISOString(),
    scanDuration: Date.now() - startTime,
    destinationPath,
    detected: {
      osId: matches[0]?.profile.osId || null,
      osConfidence: matches[0]?.confidence || 'none',
      layoutId: matches[0]?.profile.id || null,
      layoutConfidence: matches[0]?.confidence || 'none',
      foundMarkers,
      missingMarkers: expectedProfile?.detection.markersAll.filter(
        m => !foundMarkers.includes(m)
      ) || []
    },
    existingContent,
    verification,
    recommendations
  };
}
```

### 8.7 User Interaction Flow

**Scenario 1: Perfect Match**
```
User selects: Device=RG35XX+ OS=ArkOS
Scan finds: ArkOS markers, expected folder structure
â†’ "âœ“ Destination confirmed as ArkOS. Ready to deploy."
â†’ Proceed with deployment
```

**Scenario 2: OS Mismatch**
```
User selects: Device=RG35XX+ OS=ArkOS
Scan finds: ROCKNIX markers instead
â†’ "âš ï¸ Destination appears to be ROCKNIX, not ArkOS."
â†’ Options:
   1. "Switch to ROCKNIX profile" (recommended)
   2. "Proceed with ArkOS paths anyway" (warn: may not work)
   3. "Cancel and verify device"
```

**Scenario 3: Empty/Blank SD Card**
```
User selects: Device=RG35XX+ OS=ArkOS
Scan finds: No markers, empty card
â†’ "â„¹ï¸ Destination appears empty. ROM Runner will create the ArkOS folder structure."
â†’ Options:
   1. "Create folders and proceed" (recommended)
   2. "Cancel - I need to flash ArkOS first"
```

**Scenario 4: Unknown/Custom Layout**
```
User selects: Device=RG35XX+ OS=ArkOS
Scan finds: ROMs exist but in custom locations
â†’ "âš ï¸ Found existing ROMs in non-standard locations."
â†’ Show discovered structure
â†’ Options:
   1. "Use standard ArkOS paths" (will create new folders)
   2. "Use detected paths" (remember for this destination)
   3. "Let me configure paths manually"
```

### 8.8 Path Resolution

```typescript
interface ResolvedDeploymentPaths {
  // Final paths to use for deployment
  bios: string;
  roms: string;
  saves: string;
  states: string;
  screenshots: string;
  
  // Resolution metadata
  source: 'expected' | 'detected' | 'user_override' | 'merged';
  confidence: 'high' | 'medium' | 'low';
  
  // Per-path resolution details
  resolution: {
    bios: PathResolution;
    roms: PathResolution;
    saves: PathResolution;
    states: PathResolution;
  };
}

interface PathResolution {
  finalPath: string;
  source: 'profile' | 'detected' | 'user' | 'fallback';
  reason: string;
}
```

### 8.9 User Path Overrides

Users can save path customizations per destination:

```typescript
interface UserPathOverrides {
  // Keyed by destination identifier (e.g., volume UUID or path hash)
  [destinationId: string]: {
    osId: string;                // OS these overrides apply to
    lastScanned: string;         // ISO date
    pathOverrides: Partial<LayoutPaths>;
    notes?: string;
  };
}
```

### 8.10 Scanning Settings

```typescript
interface ScanSettings {
  // When to scan
  scanDestinationBeforeDeployment: boolean;  // default: true
  
  // How to handle results
  trustDetectedLayoutOverExpected: boolean;  // default: false
  
  // What to remember
  rememberScannedLayouts: boolean;           // default: true
  rememberUserPathOverrides: boolean;        // default: true
}
```

---

## 9. Compatibility Framework

### 9.1 Overview

The compatibility framework provides tools and data structures for ingesting emulator compatibility information from external sources.

**Key Principle:** Compatibility is separate from performance gating.

| Concern | Dataset | Question |
|---------|---------|----------|
| Performance | `gamePerformance` | Can this device run this platform? |
| Compatibility | `emulatorCompatibility` | Does this game work with this emulator? |
| Settings | `emulatorGameSettings` | What settings optimize this game? |

### 9.2 Data Source Layers

ROM Runner uses a tiered approach to compatibility data:

| Layer | Source Type | Confidence | Examples |
|-------|------------|------------|----------|
| **Layer A** | Official emulator DBs | High | RPCS3 compat list, Dolphin wiki |
| **Layer B** | Structured community DBs | Medium | xemu xdb, Vita3K GitHub DB |
| **Layer C** | Community sheets/lists | Low | Device-specific compatibility sheets |

### 9.3 Layer C: Community Performance Sources

Community spreadsheets and compatibility lists provide per-game performance and settings data for specific devices:

```typescript
interface CommunityPerformanceSource {
  sourceId: string;
  displayName: string;
  type: 'community-sheet' | 'community-site';
  url: string;
  
  hardwareScope: {
    deviceFamily: string;
    chipset: string;
  };
  
  coversPlatforms: string[];
  
  dataKinds: ('performance' | 'settings' | 'emulatorVersion' | 'compatibility' | 'notes')[];
  
  primaryKeys: string[];         // e.g., ["gameTitle", "platform"]
  
  confidence: 'layerC';          // Always layerC for community sources
}
```

**Usage Guidelines:**
- Treat as lower confidence than official emulator DBs
- Store with evidence/confidence metadata
- Use to create `gamePerformance` rows with `source: "community"`
- Use to generate `emulatorGameSettings` suggestions

**Example Sources:**

| Source | Device | Chipset | Platforms |
|--------|--------|---------|-----------|
| Odin 2 Sheet | Odin 2 | Snapdragon 8 Gen 2 | Switch, Wii U, PS2, 3DS, Wii, GC |
| RP4 Pro Sheet | Retroid Pocket 4 Pro | Dimensity 1100 | Switch, PS2, 3DS, Wii, GC |
| EmuDeck Site | Steam Deck | AMD Van Gogh | PS3, Wii U, Switch, PS2, 3DS |

### 9.4 Compatibility Sources Registry

The `compatibilitySources.json` file registers all external data sources:

```typescript
interface CompatibilitySourcesRegistry {
  version: string;
  generatedAt: string;
  
  sourceCatalog: Record<string, CompatibilitySource>;
  emulatorCompatibility: Record<string, EmulatorCompatConfig>;
  
  statusNormalization: {
    maps: Record<string, Record<string, CompatibilityStatus>>;
  };
}

interface CompatibilitySource {
  type: 'compat-db' | 'settings-wiki' | 'docs' | 'issue-db' | 'community-sheet';
  displayName: string;
  url: string;
  format: 'html-table' | 'html' | 'json' | 'mediawiki' | 'github-issues' | 'repo';
  primaryKey: string;
  platformId: string | string[];
  supportsPerGameStatus: boolean;
  supportsPerGameSettings?: boolean;
  notes?: string;
}
```

### 9.5 Supported Ingestors (17+)

| Script | Platform | Emulator | Data Type |
|--------|----------|----------|-----------|
| `rpcs3_compat.py` | PS3 | rpcs3 | status |
| `dolphin_compat.py` | GC/Wii | dolphin | status |
| `cemu_compat.py` | Wii U | cemu | status |
| `pcsx2_compat.py` | PS2 | pcsx2 | status |
| `vita3k_compat.py` | PS Vita | vita3k | status |
| `xemu_xdb.py` | Xbox | xemu | status |
| `xenia_compat.py` | Xbox 360 | xenia | status |
| `ppsspp_reports.py` | PSP | ppsspp | status |
| `redream_compat.py` | Dreamcast | redream | status |
| `scummvm_compat.py` | ScummVM | scummvm | status |
| `azahar_compat.py` | 3DS | azahar | status |
| `duckstation_gamedb.py` | PS1 | duckstation | settings |
| `portmaster_info.py` | Ports | n/a | metadata |
| `fbneo_dat_arcade.py` | Arcade | fbneo | metadata |
| `mame2003plus_xml.py` | Arcade | mame2003plus | metadata |
| `mame2003_xml.py` | Arcade | mame2003 | metadata |
| `cdi_emulator_theworldofcdi.py` | CD-i | cdiemu | status |

### 9.6 Data Flow

```
External Sources (wikis, compat lists, GitHub)
    â†“
Ingest Scripts (offline, cached)
    â†“
compat-source-v1 JSON files
    â†“
merge_outputs.py
    â†“
emulatorCompatibility.merged.json
    â†“
ROM Runner Build Step (map external IDs â†’ gameId)
    â†“
DefinitionPack (emulatorCompatibility[], emulatorGameSettings[])
    â†“
ROM Runner App (runtime precedence resolution)
```

---

## 10. Auto-List Generation Rules

### 10.1 Overview

Auto-generated lists filter games based on the intersection of:
1. **Device + OS selection** (determines available emulators)
2. **gamePerformance** (device/chipset/platform gating)
3. **emulatorCompatibility** (per-game/emulator status)
4. **User overrides** (force include/exclude)

### 10.2 Cross-Reference Logic

```typescript
function shouldIncludeInAutoList(
  game: Game,
  device: Device,
  os: OperatingSystem,
  osProfile: OSEmulatorProfile,
  policies: PlatformPolicies
): { include: boolean; warnings: string[]; reasonCode: string } {
  const warnings: string[] = [];
  
  // 1. Check user override first
  const userOverride = getUserOverride(game.id);
  if (userOverride) {
    return {
      include: userOverride.action === 'include',
      warnings: [],
      reasonCode: userOverride.action === 'include' 
        ? 'USER_OVERRIDE_INCLUDE' 
        : 'USER_OVERRIDE_EXCLUDE'
    };
  }
  
  // 2. Determine which emulator will be used
  const emulatorId = osProfile.defaults.platformToEmulator[game.platformId];
  if (!emulatorId) {
    warnings.push(`No default emulator for ${game.platformId} on ${os.name}`);
  }
  
  // 3. Check performance gating
  const perfResult = checkPerformance(game, device, policies);
  if (!perfResult.include) {
    return perfResult;
  }
  warnings.push(...perfResult.warnings);
  
  // 4. Check compatibility gating
  const compatResult = checkCompatibility(game, emulatorId, policies);
  if (!compatResult.include) {
    return compatResult;
  }
  warnings.push(...compatResult.warnings);
  
  return { include: true, warnings, reasonCode: 'INCLUDED' };
}
```

### 10.3 Performance Check

```typescript
function checkPerformance(
  game: Game,
  device: Device,
  policies: PlatformPolicies
): { include: boolean; warnings: string[]; reasonCode: string } {
  const perfRecord = resolvePerformance(game.id, game.platformId, device.id, '*', gamePerformanceData);
  
  if (perfRecord) {
    // Have data â†’ use it
    if (perfRecord.excludeFromAutoLists) {
      return { include: false, warnings: [], reasonCode: 'PERF_TIER_EXCLUDED' };
    }
    return { include: true, warnings: [], reasonCode: 'PERF_OK' };
  }
  
  // No data â†’ apply policies
  const platformId = game.platformId;
  
  if (!policies.retroCatalogPlatformCoverage.includes(platformId)) {
    // Platform not covered by RetroCatalog â†’ optimistic
    return {
      include: true,
      warnings: [`Performance unknown for ${platformId} (not in RetroCatalog)`],
      reasonCode: 'PERF_NO_RETROCAT_DATA_ASSUME_OK'
    };
  }
  
  // Platform IS covered but no device score
  const tier = getDifficultyTier(platformId, policies);
  
  if (tier === 'tier1_modern_hard' || tier === 'tier2_demanding') {
    return {
      include: false,
      warnings: [],
      reasonCode: 'PERF_MISSING_STRICT'
    };
  }
  
  // Tier 3-4: optimistic
  return {
    include: true,
    warnings: [`Performance unknown for ${platformId} on ${device.name}`],
    reasonCode: 'PERF_MISSING_OPTIMISTIC'
  };
}
```

### 10.4 Compatibility Check

```typescript
function checkCompatibility(
  game: Game,
  emulatorId: string | undefined,
  policies: PlatformPolicies,
  settings: UserSettings
): { include: boolean; warnings: string[]; reasonCode: string } {
  if (!emulatorId) {
    // No emulator available â†’ exclude
    return { include: false, warnings: [], reasonCode: 'NO_EMULATOR_AVAILABLE' };
  }
  
  const compatRecord = resolveCompatibility(game.id, game.platformId, emulatorId);
  
  if (compatRecord) {
    // Have data â†’ use status
    if (compatRecord.status === 'broken' || compatRecord.status === 'boots_only') {
      return { include: false, warnings: [], reasonCode: 'COMPAT_STATUS_EXCLUDED' };
    }
    
    const warnings = [];
    if (['ingame', 'menu_intro', 'unknown'].includes(compatRecord.status)) {
      warnings.push(`Compatibility: ${compatRecord.status}`);
    }
    
    return { include: true, warnings, reasonCode: 'COMPAT_OK' };
  }
  
  // No data â†’ apply policies
  const isStrict = policies.defaults.compatibilityMissing
    .strictPlatformsDefaultExclude.includes(game.platformId);
  
  if (isStrict) {
    // Check global override setting
    if (settings.includeUnknownCompatibilityForStrictPlatforms) {
      return {
        include: true,
        warnings: [`Compatibility unknown for strict platform ${game.platformId}`],
        reasonCode: 'COMPAT_MISSING_STRICT_OVERRIDE'
      };
    }
    return { include: false, warnings: [], reasonCode: 'COMPAT_MISSING_STRICT' };
  }
  
  // Mature platform â†’ assume compatible
  return {
    include: true,
    warnings: [`Compatibility assumed for ${game.platformId}`],
    reasonCode: 'COMPAT_MISSING_ASSUME_OK'
  };
}
```

---

## 11. User Settings & Overrides

### 11.1 Global Settings

```typescript
interface UserSettings {
  // Compatibility behavior
  includeUnknownCompatibilityForStrictPlatforms: boolean;  // default: false
  
  // Performance behavior
  includeUnknownPerformanceForDemandingPlatforms: boolean; // default: false
  
  // Warning display
  showPerformanceWarnings: boolean;                        // default: true
  showCompatibilityWarnings: boolean;                      // default: true
  
  // Auto-apply settings
  autoApplyEmulatorSettings: boolean;                      // default: false
  
  // Emulator preferences
  preferStandaloneEmulators: boolean;                      // default: false
  
  // Destination scanning (NEW v2.5)
  scanDestinationBeforeDeployment: boolean;                // default: true
  trustDetectedLayoutOverExpected: boolean;                // default: false
  rememberScannedLayouts: boolean;                         // default: true
}
```

### 11.2 Per-Game Overrides

Users can force include/exclude specific games regardless of performance or compatibility data:

```typescript
interface UserGameOverride {
  gameId: string;
  action: 'include' | 'exclude';
  reason?: string;
}
```

Per-game overrides always win in precedence resolution.

### 11.3 Per-Platform Emulator Overrides

Users can override the default emulator for a platform:

```typescript
interface UserPlatformEmulatorOverride {
  platformId: string;
  emulatorId: string;
}
```

---

## 12. Data Files Reference

### 12.1 Core Data Files

| File | Size | Records | Description |
|------|------|---------|-------------|
| `platforms_v2_0_0.json` | 53KB | 69 | Platform definitions |
| `devices.json` | 198KB | 622 | Device catalog with specs |
| `emulators_v2_1_0.json` | 178KB | 279 | Emulator definitions |
| `operating-systems_v2_0_0.json` | 55KB | 64 | OS catalog (includes android-emulationstation) |
| `frontends.json` | 35KB | 33 | Frontend catalog |
| `bios-hashes_v2_0_1.json` | 351KB | 319 | BIOS file requirements with hashes |

### 12.2 Performance & Compatibility Files

| File | Size | Records | Description |
|------|------|---------|-------------|
| `gamePerformance_baseline.json` | 1.1MB | 4,461 | Platform-wide defaults (`gameId="*"`) |
| `retrocatalogPlatformScores.json` | 140KB | 253 | Per-device platform scores (0-100) |
| `emulatorCompatibility_seed.json` | 1KB | 0 | Schema template |
| `emulatorGameSettings_seed.json` | 1KB | 0 | Schema template |

### 12.3 Policy & Profile Files

| File | Version | Description |
|------|---------|-------------|
| `platformPolicies_v0_2_0.json` | 0.2.0 | Big Systems Set + missing-data rules |
| `osEmulatorProfiles_v0_3_0.json` | 0.3.0 | OS emulator + layout profiles |
| `deviceOsMatrix_v2_0_0.json` | 2.0.0 | Device/OS mapping |
| `communityPerformanceSources_layerC_seed_v0_2_0.json` | 0.2.0 | Layer C source registry |
| `layoutDetectionProfiles_v0_1_0.json` | 0.1.0 | Layout fingerprints (NEW v2.5) |

### 12.4 Compatibility Framework Files

| File | Description |
|------|-------------|
| `compatibilitySources.json` | Registry of 39+ external sources |
| `README_compatibility_framework.md` | Framework documentation |

### 12.5 Supporting Files

| File | Description |
|------|-------------|
| `platformNormalizationMap.json` | RetroCatalog â†’ ROM Runner platform ID mappings |
| `needsMapping_report.json` | Items needing manual review |
| `curated-lists.json` | Pre-curated game lists |

---

## 13. Migration Notes

### 13.1 Schema Version History

| Version | Changes |
|---------|---------|
| 5 | Added `layoutDetectionProfiles`, enhanced `detection` in OSEmulatorProfile, destination scanning |
| 4 | Added `osEmulatorProfiles`, `platformPolicies`, `communityPerformanceSources` |
| 3 | Renamed `compatibility` â†’ `gamePerformance`, added `emulatorCompatibility` |
| 2 | Added `emulatorGameSettings` (replaced `recommendedSettings`) |
| 1 | Initial schema |

### 13.2 v2.4 â†’ v2.5 Changes

| Change | Description |
|--------|-------------|
| New section 8 | Destination Device Scanning |
| `DefinitionPack.layoutDetectionProfiles` | New array for layout fingerprints |
| `OSEmulatorProfile.detection` | Enhanced with more detection fields |
| `OSEmulatorProfile.alternativeLayouts` | New optional array |
| `UserSettings` scanning options | Three new settings for scan behavior |
| `UserPathOverrides` | New interface for per-destination overrides |
| Android EmulationStation OS | New `android-emulationstation` OS for standardized Android paths |

### 13.3 Backward Compatibility

v2.5 is backward compatible with v2.4. Systems not implementing scanning will continue to work using expected layouts from OSEmulatorProfiles.

### 13.4 For Definition Pack Authors

1. Migrate existing `compatibility` arrays to `gamePerformance`
2. Convert `recommendedSettings` to `emulatorGameSettings` format
3. Add `source` field to all performance/compatibility records
4. Set `excludeFromAutoLists` based on tier (auto for poor/unplayable)
5. Add OS emulator profiles for supported OS distributions
6. Create layout detection profiles for supported OSes

---

## 14. Appendix: Interfaces

### 14.1 Complete TypeScript Interfaces

See `ROM_Runner_JSON_Schemas_v1_2_0.json` for complete JSON Schema definitions of all interfaces.

### 14.2 Platform ID Normalization Map

```typescript
const PLATFORM_NORMALIZATION: Record<string, string> = {
  // RetroCatalog key â†’ ROM Runner platformId
  'gb': 'gb',
  'nes': 'nes',
  'genesis': 'genesis',
  'gba': 'gba',
  'snes': 'snes',
  'ps': 'psx',           // RetroCatalog uses 'ps', we use 'psx'
  'ds': 'nds',           // RetroCatalog uses 'ds', we use 'nds'
  'n64': 'n64',
  'dreamcast': 'dreamcast',
  'psp': 'psp',
  'saturn': 'saturn',
  'gamecube': 'gamecube',
  'wii': 'wii',
  '3ds': '3ds',
  'ps2': 'ps2',
  'wiiu': 'wiiu',
  'switch': 'switch',
  'ps3': 'ps3',
};
```

### 14.3 Normalized Status Values

| Status | Meaning | Auto-list behavior |
|--------|---------|-------------------|
| `perfect` | Runs flawlessly | Include |
| `playable` | Completable with minor issues | Include |
| `ingame` | Gets past menus, may have issues | Warn |
| `menu_intro` | Reaches menus/intros only | Warn |
| `boots_only` | Shows something but unplayable | Exclude |
| `broken` | Doesn't work | Exclude |
| `unknown` | No data | Warn (strict: exclude) |

---

## 15. Theme System & Branding *(NEW in v2.6)*

### 15.1 Overview

ROM Runner supports multiple visual themes beyond basic light/dark mode, allowing users to customize the application's appearance while maintaining consistent functionality and accessibility.

**Reference Document:** `ROM_Runner_Theme_System_Specification_v1_0_0.md` contains complete theme definitions, CSS implementations, and technical specifications.

### 15.2 Theme Architecture

ROM Runner uses a two-part theme selection model:

1. **Theme Family**: The overall visual style (Default, Neumorphism, Retro, Terminal)
2. **Color Mode**: Light, Dark, or System (follows OS preference)

```typescript
type ThemeFamily = 'default' | 'neumorphic' | 'retro' | 'terminal';
type ThemeMode = 'light' | 'dark' | 'system';
```

**Special Case:** The Terminal theme always uses dark mode and ignores the color mode setting.

### 15.3 Built-in Theme Families

| Theme Family | Description | Light | Dark |
|--------------|-------------|:-----:|:----:|
| **Default** | Clean, modern, professional look | ✓ | ✓ |
| **Neumorphism** | Soft shadows, extruded UI elements | ✓ | ✓ |
| **Retro** | Vintage gaming aesthetic with hard shadows | ✓ | ✓ |
| **Terminal** | Green phosphor on black CRT style | — | Fixed |

### 15.4 Theme CSS Implementation

Themes are applied via CSS classes on the document root:

```html
<!-- Default Light -->
<html class="theme-default light">

<!-- Neumorphism Dark -->
<html class="theme-neumorphic dark">

<!-- Retro Light -->
<html class="theme-retro light">

<!-- Terminal (always dark) -->
<html class="theme-terminal">
```

### 15.5 Custom Theme Support

Users can import, export, and create custom themes. Custom themes are validated before import for:

- Color contrast ratios (WCAG 2.1 AA compliance)
- Required color properties
- Font availability
- CSS safety (no external resources)

```typescript
interface CustomTheme {
  id: string;
  name: string;
  author: string;
  version: string;
  description?: string;
  type: 'flat' | 'neumorphic' | 'retro' | 'custom';
  supportsDarkMode: boolean;
  colors: {
    light: ThemeColors;
    dark?: ThemeColors;
  };
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  shadows: ThemeShadows;
  borders: ThemeBorders;
  customCSS?: string;
  assets?: ThemeAssets;
  createdAt: string;
  updatedAt: string;
}

interface CustomThemeExport {
  schemaVersion: string;
  exportedAt: string;
  theme: CustomTheme;
}
```

### 15.6 Branding Assets

ROM Runner includes official logo assets that must be used consistently throughout the application.

**Logo Files Location:** `resources/branding/`

| File | Usage | Format |
|------|-------|--------|
| `Rom_Runner_-_Full_1.svg` | Title bar, About screen, splash | SVG |
| `Rom_Runner_-_Full_1_2x.png` | High-DPI fallback | PNG @2x |
| `Rom_Runner_-_Badge_1.svg` | System tray, small icons | SVG |
| `Rom_Runner_-_Badge_1_2x.png` | High-DPI fallback | PNG @2x |

**Brand Colors (extracted from logo):**

| Color | Hex | Usage |
|-------|-----|-------|
| Brand Blue | `#1f6cb2` | Logo circle background |
| Brand Navy | `#02375e` | Logo wordmark text |
| Brand Gray | `#dbddda` | Logo pixel character |

### 15.7 Logo Usage Guidelines

- **Full Logo**: Application title bar (if custom), About screen, splash screen, promotional materials
- **Badge Logo**: System tray icon, taskbar/dock icon, notification icons, small UI elements
- Never distort or stretch logos
- Maintain aspect ratio at all times
- Use appropriate variant based on available space
- Ensure sufficient contrast with backgrounds
- Reserve minimum clear space around logos (equal to 10% of logo height)

### 15.8 Theme Accessibility Requirements

All themes (built-in and custom) must meet accessibility standards:

| Requirement | Standard |
|-------------|----------|
| Text contrast (normal) | 4.5:1 minimum |
| Text contrast (large) | 3:1 minimum |
| Focus indicators | 2px visible ring |
| State indication | Not color-only |
| Motion | Respect `prefers-reduced-motion` |
| Error states | Clear with icons + text |

### 15.9 Theme State Management

Theme settings are managed in the `settingsStore`:

```typescript
// State
themeFamily: ThemeFamily;
themeMode: ThemeMode;
customThemes: Map<string, CustomTheme>;

// Actions
setThemeFamily(family: ThemeFamily): void;
setThemeMode(mode: ThemeMode): void;
importCustomTheme(theme: CustomTheme): Promise<void>;
exportCustomTheme(themeId: string): CustomThemeExport;
deleteCustomTheme(themeId: string): void;
validateTheme(theme: CustomTheme): ThemeValidationResult;
applyTheme(): void;
```

### 15.10 Theme Files Reference

| File | Version | Description |
|------|---------|-------------|
| `ROM_Runner_Theme_System_Specification_v1_0_0.md` | 1.0.0 | Complete theme specification |
| `tokens.css` | 1.1.0 | CSS custom properties for all themes |
| `Rom_Runner_-_Full_1.svg` | — | Full logo (SVG) |
| `Rom_Runner_-_Full_1_2x.png` | — | Full logo (PNG @2x) |
| `Rom_Runner_-_Badge_1.svg` | — | Badge logo (SVG) |
| `Rom_Runner_-_Badge_1_2x.png` | — | Badge logo (PNG @2x) |

---

## 16. Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.6.0 | Jan 7, 2026 | Theme system & branding (Section 15), custom themes, logo assets |
| 2.5.0 | Jan 4, 2026 | Destination device scanning, layout detection profiles, android-emulationstation OS |
| 2.4 | Jan 2026 | OS emulator profiles, platform policies, Layer C sources, cross-reference requirements |
| 2.3 | Jan 2026 | RetroCatalog integration, three-tier data model, compatibility framework |
| 2.2 | Jan 2025 | Added branding assets, format conversion pipeline |
| 2.1 | Dec 2024 | Initial device/OS catalog structure |
| 2.0 | Nov 2024 | Complete rewrite with Tauri architecture |

---

**End of Document**
