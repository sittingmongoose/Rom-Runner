# ROM Runner - Zustand Stores Architecture v1.1.0

**Version:** 1.1.0  
**Created:** January 5, 2026  
**Updated:** January 7, 2026  
**Status:** Ready for Implementation

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Store Slices](#3-store-slices)
4. [File Structure](#4-file-structure)
5. [Tauri Integration](#5-tauri-integration)
6. [Selector Patterns](#6-selector-patterns)
7. [Middleware Configuration](#7-middleware-configuration)
8. [Cross-Store Communication](#8-cross-store-communication)
9. [Performance Considerations](#9-performance-considerations)
10. [Usage Examples](#10-usage-examples)
11. [Version History](#11-version-history)

---

## 1. Overview

ROM Runner uses Zustand for state management, chosen for its:
- **Simplicity**: Minimal boilerplate compared to Redux
- **Performance**: Fine-grained subscriptions prevent unnecessary re-renders
- **TypeScript Support**: Excellent type inference
- **Middleware**: Built-in support for persistence, immer, and devtools
- **Bundle Size**: ~1KB minified

### Design Principles

1. **Slice Pattern**: Each domain has its own store slice file
2. **Colocation**: Selectors live with their store definitions
3. **Immutability**: Using immer middleware for safe mutations
4. **Persistence**: Settings and UI preferences persist to localStorage
5. **Tauri Events**: Centralized event listener setup

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Components                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ Library  │ │ Device   │ │Deployment│ │ Settings │ │   BIOS   │  │
│  │  Views   │ │  Views   │ │  Views   │ │  Views   │ │  Views   │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │            │            │            │            │         │
├───────┼────────────┼────────────┼────────────┼────────────┼─────────┤
│       │            │            │            │            │         │
│  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐   │
│  │ library │  │ device  │  │ deploy- │  │settings │  │  bios   │   │
│  │  Store  │  │  Store  │  │  Store  │  │  Store  │  │  Store  │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘   │
│       │            │            │            │            │         │
│       └────────────┴─────┬──────┴────────────┴────────────┘         │
│                          │                                          │
│                    ┌─────▼─────┐                                    │
│                    │  uiStore  │ (notifications, modals, nav)       │
│                    └─────┬─────┘                                    │
│                          │                                          │
├──────────────────────────┼──────────────────────────────────────────┤
│                          │                                          │
│    ┌─────────────────────▼─────────────────────┐                   │
│    │           Tauri Event Listeners            │                   │
│    │  (scan_progress, deployment_progress, etc) │                   │
│    └─────────────────────┬─────────────────────┘                   │
│                          │                                          │
├──────────────────────────┼──────────────────────────────────────────┤
│                          │                                          │
│    ┌─────────────────────▼─────────────────────┐                   │
│    │              Tauri Commands                │                   │
│    │     (invoke() calls to Rust backend)       │                   │
│    └───────────────────────────────────────────┘                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Store Slices

### 3.1 Library Store (`libraryStore.ts`)

**Purpose:** Manages the ROM library, including games, collections, scanning, and filtering.

| State | Type | Description |
|-------|------|-------------|
| `games` | `Game[]` | Current page of games |
| `collections` | `Collection[]` | User collections |
| `isLoading` | `boolean` | Loading state |
| `scanProgress` | `ScanProgress \| null` | Active scan progress |
| `activeFilters` | `GameFilters` | Current filter state |
| `searchQuery` | `string` | Search text |
| `selectedGameIds` | `Set<number>` | Multi-selection |
| `currentPage` | `number` | Pagination |
| `totalGames` | `number` | Total count for pagination |

**Key Actions:**
- `fetchGames()` - Load games with current filters
- `scanDirectory(path, recursive)` - Start ROM scan
- `setFilters(filters)` - Update filters and refetch
- `createCollection(name, gameIds)` - Create new collection

### 3.2 Device Store (`deviceStore.ts`)

**Purpose:** Manages user devices, profiles, and destination scanning.

| State | Type | Description |
|-------|------|-------------|
| `devices` | `UserDevice[]` | Configured devices |
| `connectedDevices` | `DetectedDevice[]` | Currently connected |
| `activeDeviceId` | `number \| null` | Selected device |
| `activeProfileId` | `number \| null` | Selected profile |
| `lastScanResult` | `DestinationScanResult \| null` | Last scan result |

**Key Actions:**
- `fetchDevices()` - Load saved devices
- `scanForDevices()` - Detect connected devices
- `scanDestination(path, osId)` - Verify destination layout
- `createProfile(deviceId, profile)` - Add device profile

### 3.3 Deployment Store (`deploymentStore.ts`)

**Purpose:** Manages deployment planning, execution, and history.

| State | Type | Description |
|-------|------|-------------|
| `currentPlan` | `DeploymentPlan \| null` | Active plan |
| `progress` | `DeploymentProgress \| null` | Deployment progress |
| `validationResult` | `ValidationResult \| null` | Plan validation |
| `deploymentHistory` | `DeploymentRecord[]` | Past deployments |
| `isDeploying` | `boolean` | Deployment in progress |

**Key Actions:**
- `createPlan(config)` - Generate deployment plan
- `validatePlan(plan)` - Validate before deployment
- `startDeployment(plan)` - Begin deployment
- `pauseDeployment()` / `resumeDeployment()` - Control flow
- `handleProgress(progress)` - Event handler for progress updates

### 3.4 Settings Store (`settingsStore.ts`)

**Purpose:** Manages application settings, user preferences, and theme configuration.

| State | Type | Description |
|-------|------|-------------|
| `settings` | `AppSettings` | Application settings |
| `platformEmulatorOverrides` | `Map<string, string>` | Platform→Emulator |
| `gameOverrides` | `Map<number, GameOverride>` | Per-game overrides |
| `themeFamily` | `ThemeFamily` | Selected theme family *(NEW in v1.1.0)* |
| `themeMode` | `ThemeMode` | Light/dark/system *(UPDATED in v1.1.0)* |
| `customThemes` | `Map<string, CustomTheme>` | User's custom themes *(NEW in v1.1.0)* |

**Theme-Related Types (NEW in v1.1.0):**

```typescript
type ThemeFamily = 'default' | 'neumorphic' | 'retro' | 'terminal';
type ThemeMode = 'light' | 'dark' | 'system';

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
```

**Key Actions:**
- `loadSettings()` - Load from backend
- `updateSettings(updates)` - Save settings
- `setPlatformEmulatorOverride(platformId, emulatorId)` - Set override
- `setThemeFamily(family)` - Change theme family *(NEW in v1.1.0)*
- `setThemeMode(mode)` - Change color mode *(UPDATED in v1.1.0)*
- `importCustomTheme(theme)` - Import custom theme *(NEW in v1.1.0)*
- `exportCustomTheme(themeId)` - Export theme as JSON *(NEW in v1.1.0)*
- `deleteCustomTheme(themeId)` - Remove custom theme *(NEW in v1.1.0)*
- `validateTheme(theme)` - Check theme accessibility *(NEW in v1.1.0)*

**Persistence:** Theme family, theme mode, and UI preferences persist to localStorage.

**Theme Application Logic:**

```typescript
// Called when themeFamily or themeMode changes
const applyTheme = () => {
  const { themeFamily, themeMode } = get();
  const root = document.documentElement;
  
  // Remove all theme classes
  root.classList.remove(
    'theme-default', 'theme-neumorphic', 'theme-retro', 'theme-terminal',
    'light', 'dark'
  );
  
  // Apply theme family
  root.classList.add(`theme-${themeFamily}`);
  
  // Apply color mode (terminal theme is always dark)
  if (themeFamily !== 'terminal') {
    if (themeMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(themeMode);
    }
  }
};
```

### 3.5 BIOS Store (`biosStore.ts`)

**Purpose:** Manages BIOS file verification and completeness checking.

| State | Type | Description |
|-------|------|-------------|
| `biosFiles` | `BiosFile[]` | Detected BIOS files |
| `requirements` | `BiosRequirement[]` | Platform requirements |
| `verificationReport` | `BiosVerificationReport \| null` | Last verification |
| `isVerifying` | `boolean` | Verification in progress |

**Key Actions:**
- `loadRequirements()` - Load BIOS database
- `scanBiosDirectory(path)` - Find BIOS files
- `verifyAll(directory)` - Verify all files
- `checkCompleteness(directory, platformIds)` - Check for platforms

### 3.6 UI Store (`uiStore.ts`)

**Purpose:** Manages UI state including navigation, modals, and notifications.

| State | Type | Description |
|-------|------|-------------|
| `currentView` | `ViewType` | Active view |
| `viewHistory` | `ViewType[]` | Navigation history |
| `activeModal` | `ModalType \| null` | Open modal |
| `modalData` | `unknown` | Modal payload |
| `notifications` | `Notification[]` | Toast queue |
| `detailsPanelOpen` | `boolean` | Details panel state |
| `globalLoading` | `boolean` | Loading overlay |

**Key Actions:**
- `navigate(view, params)` - Change view
- `openModal(modal, data)` - Open modal
- `showNotification(notification)` - Show toast
- `showError(title, message)` - Convenience for errors

**Persistence:** Current view and sidebar state persist to localStorage.

---

## 4. File Structure

```
src/stores/
├── index.ts              # Combined exports, event setup, cross-store hooks
├── types.ts              # Shared TypeScript interfaces (includes theme types)
├── libraryStore.ts       # ROM library state
├── deviceStore.ts        # Device/profile management
├── deploymentStore.ts    # Deployment operations
├── settingsStore.ts      # User settings + theme configuration
├── biosStore.ts          # BIOS management
└── uiStore.ts            # UI state
```

**Import Pattern:**

```typescript
// Import specific stores
import { useLibraryStore, useUIStore, useSettingsStore } from '@/stores';

// Import selectors
import { selectSelectedGames, selectIsModalOpen, selectResolvedTheme } from '@/stores';

// Import types
import type { Game, DeploymentProgress, ThemeFamily, CustomTheme } from '@/stores';
```

---

## 5. Tauri Integration

### 5.1 Command Invocations

All backend communication uses Tauri's `invoke()`:

```typescript
import { invoke } from '@tauri-apps/api/core';

// In store action
const fetchGames = async () => {
  set({ isLoading: true });
  try {
    const result = await invoke<PaginatedResult<Game>>('get_games', { payload });
    set({ games: result.items, totalGames: result.total, isLoading: false });
  } catch (error) {
    set({ isLoading: false, error: error.message });
  }
};
```

### 5.2 Event Listeners

Events from Rust are handled via centralized setup:

```typescript
// In main.tsx or App.tsx
import { setupEventListeners, initializeStores, setupStoreSubscriptions } from '@/stores';

async function bootstrap() {
  // Load initial data
  await initializeStores();
  
  // Set up Tauri event listeners
  setupEventListeners();
  
  // Set up cross-store subscriptions
  setupStoreSubscriptions();
  
  // Apply saved theme
  useSettingsStore.getState().applyTheme();
}
```

### 5.3 Event Types

```typescript
// Events emitted from Rust
type TauriEvent = 
  | { type: 'scan_progress'; payload: ScanProgress }
  | { type: 'deployment_progress'; payload: DeploymentProgress }
  | { type: 'device_connected'; payload: DetectedDevice }
  | { type: 'device_disconnected'; payload: { deviceId: string } }
  | { type: 'verification_progress'; payload: VerificationProgress };
```

---

## 6. Selector Patterns

### 6.1 Simple Selectors

```typescript
// Direct property access
const games = useLibraryStore((state) => state.games);
const isLoading = useLibraryStore((state) => state.isLoading);
```

### 6.2 Computed Selectors

```typescript
// Exported selector function
export const selectSelectedGames = (state: LibraryState) =>
  state.games.filter((g) => state.selectedGameIds.has(g.id));

// Usage
const selectedGames = useLibraryStore(selectSelectedGames);
```

### 6.3 Parameterized Selectors

```typescript
// Factory function for parameterized selectors
export const selectGameById = (gameId: number) => (state: LibraryState) =>
  state.games.find((g) => g.id === gameId);

// Usage
const game = useLibraryStore(selectGameById(123));
```

### 6.4 Theme Selectors (NEW in v1.1.0)

```typescript
// Select resolved theme (handles 'system' mode)
export const selectResolvedTheme = (state: SettingsState): 'light' | 'dark' => {
  if (state.themeMode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return state.themeMode;
};

// Select current theme configuration
export const selectThemeConfig = (state: SettingsState) => ({
  family: state.themeFamily,
  mode: state.themeMode,
  resolvedMode: selectResolvedTheme(state),
});

// Select if custom theme exists
export const selectHasCustomTheme = (themeId: string) => (state: SettingsState) =>
  state.customThemes.has(themeId);

// Select all custom themes as array
export const selectCustomThemesArray = (state: SettingsState) =>
  Array.from(state.customThemes.values());
```

### 6.5 Pagination Selectors

```typescript
export const selectPaginationInfo = (state: LibraryState) => ({
  currentPage: state.currentPage,
  pageSize: state.pageSize,
  totalPages: Math.ceil(state.totalGames / state.pageSize),
});
```

### 6.6 Cross-Store Selectors

```typescript
// In index.ts - uses multiple stores
export function useDeploymentReadiness() {
  const hasActiveDevice = useDeviceStore((s) => s.activeDeviceId !== null);
  const hasSelectedGames = useLibraryStore((s) => s.selectedGameIds.size > 0);
  const isDeploying = useDeploymentStore((s) => s.isDeploying);
  
  return {
    canStart: hasActiveDevice && hasSelectedGames && !isDeploying,
    // ...
  };
}
```

---

## 7. Middleware Configuration

### 7.1 Immer Middleware

Enables mutable-style updates:

```typescript
import { immer } from 'zustand/middleware/immer';

const useStore = create<State>()(
  immer((set) => ({
    items: [],
    addItem: (item) => {
      set((state) => {
        state.items.push(item); // Mutate directly with immer
      });
    },
  }))
);
```

### 7.2 Persist Middleware

For localStorage persistence:

```typescript
import { persist } from 'zustand/middleware';

const useStore = create<State>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'rom-runner-settings',
      partialize: (state) => ({
        themeFamily: state.themeFamily,
        themeMode: state.themeMode,
        sidebarWidth: state.sidebarWidth,
      }),
    }
  )
);
```

### 7.3 SubscribeWithSelector Middleware

Enables fine-grained subscriptions:

```typescript
import { subscribeWithSelector } from 'zustand/middleware';

// Subscribe to specific state changes
useLibraryStore.subscribe(
  (state) => state.error,
  (error) => {
    if (error) showNotification(error);
  }
);

// Subscribe to theme changes (NEW in v1.1.0)
useSettingsStore.subscribe(
  (state) => [state.themeFamily, state.themeMode],
  () => {
    useSettingsStore.getState().applyTheme();
  },
  { equalityFn: shallow }
);
```

---

## 8. Cross-Store Communication

### 8.1 Direct Store Access

```typescript
// Access another store's state/actions from within a store
import { useUIStore } from './uiStore';

// In libraryStore action
fetchGames: async () => {
  try {
    // ...
  } catch (error) {
    // Access UI store to show notification
    useUIStore.getState().showError('Failed to load', error.message);
  }
};
```

### 8.2 Store Subscriptions

```typescript
// In index.ts - setupStoreSubscriptions()
useLibraryStore.subscribe(
  (state) => state.error,
  (error) => {
    if (error) {
      useUIStore.getState().showError('Library Error', error);
    }
  }
);
```

---

## 9. Performance Considerations

### 9.1 Selector Memoization

Use shallow comparison for object/array selectors:

```typescript
import { shallow } from 'zustand/shallow';

// Compare object properties shallowly
const { games, total } = useLibraryStore(
  (state) => ({ games: state.games, total: state.totalGames }),
  shallow
);
```

### 9.2 Avoiding Re-renders

```typescript
// ❌ Bad: New object on every render
const games = useLibraryStore((state) => ({
  items: state.games,
  count: state.games.length,
}));

// ✅ Good: Select primitives separately
const games = useLibraryStore((state) => state.games);
const count = useLibraryStore((state) => state.games.length);
```

### 9.3 Large Collections

For 10,000+ games:
- Pagination at store level (`currentPage`, `pageSize`)
- Backend filtering (don't load all games)
- Virtual list rendering in UI

---

## 10. Usage Examples

### 10.1 Basic Store Usage

```tsx
import { useLibraryStore, selectSelectedGames } from '@/stores';

function GameList() {
  const games = useLibraryStore((s) => s.games);
  const isLoading = useLibraryStore((s) => s.isLoading);
  const fetchGames = useLibraryStore((s) => s.fetchGames);
  
  useEffect(() => {
    fetchGames();
  }, [fetchGames]);
  
  if (isLoading) return <Spinner />;
  
  return (
    <ul>
      {games.map((game) => (
        <GameItem key={game.id} game={game} />
      ))}
    </ul>
  );
}
```

### 10.2 Multi-Store Component

```tsx
import { useLibraryStore, useDeviceStore, useDeploymentStore } from '@/stores';

function DeploymentButton() {
  const selectedCount = useLibraryStore((s) => s.selectedGameIds.size);
  const activeDevice = useDeviceStore((s) => 
    s.devices.find((d) => d.id === s.activeDeviceId)
  );
  const createPlan = useDeploymentStore((s) => s.createPlan);
  const isPlanning = useDeploymentStore((s) => s.isPlanning);
  
  const handleDeploy = async () => {
    if (!activeDevice) return;
    
    await createPlan({
      deviceId: activeDevice.id,
      // ...
    });
  };
  
  return (
    <button 
      onClick={handleDeploy}
      disabled={!activeDevice || selectedCount === 0 || isPlanning}
    >
      Deploy {selectedCount} games to {activeDevice?.name ?? 'No Device'}
    </button>
  );
}
```

### 10.3 Notifications

```tsx
import { useUIStore } from '@/stores';

function SaveButton() {
  const showSuccess = useUIStore((s) => s.showSuccess);
  const showError = useUIStore((s) => s.showError);
  
  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Saved', 'Your changes have been saved.');
    } catch (error) {
      showError('Save Failed', error.message);
    }
  };
  
  return <button onClick={handleSave}>Save</button>;
}
```

### 10.4 Theme Switching (NEW in v1.1.0)

```tsx
import { useSettingsStore, selectThemeConfig } from '@/stores';

function ThemePicker() {
  const themeConfig = useSettingsStore(selectThemeConfig);
  const setThemeFamily = useSettingsStore((s) => s.setThemeFamily);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  
  return (
    <div className="theme-picker">
      <fieldset>
        <legend>Theme</legend>
        {(['default', 'neumorphic', 'retro', 'terminal'] as const).map((family) => (
          <label key={family}>
            <input
              type="radio"
              name="themeFamily"
              value={family}
              checked={themeConfig.family === family}
              onChange={() => setThemeFamily(family)}
            />
            {family.charAt(0).toUpperCase() + family.slice(1)}
          </label>
        ))}
      </fieldset>
      
      {themeConfig.family !== 'terminal' && (
        <fieldset>
          <legend>Color Mode</legend>
          {(['light', 'dark', 'system'] as const).map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name="themeMode"
                value={mode}
                checked={themeConfig.mode === mode}
                onChange={() => setThemeMode(mode)}
              />
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
```

### 10.5 Custom Theme Import (NEW in v1.1.0)

```tsx
import { useSettingsStore } from '@/stores';

function CustomThemeImport() {
  const importCustomTheme = useSettingsStore((s) => s.importCustomTheme);
  const validateTheme = useSettingsStore((s) => s.validateTheme);
  
  const handleImport = async (file: File) => {
    const text = await file.text();
    const themeExport = JSON.parse(text);
    
    // Validate before importing
    const validation = validateTheme(themeExport.theme);
    
    if (!validation.valid) {
      alert('Invalid theme: ' + validation.errors.join(', '));
      return;
    }
    
    if (validation.warnings.length > 0) {
      const proceed = confirm(
        'Theme has warnings:\n' + validation.warnings.join('\n') + '\n\nImport anyway?'
      );
      if (!proceed) return;
    }
    
    await importCustomTheme(themeExport.theme);
  };
  
  return (
    <input
      type="file"
      accept=".json"
      onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
    />
  );
}
```

---

## 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1.0 | Jan 7, 2026 | Added theme system to settingsStore, theme types, theme selectors |
| 1.0.0 | Jan 5, 2026 | Initial architecture - all 6 stores |

---

## Files Created/Updated

| File | Version | Description |
|------|---------|-------------|
| `types.ts` | 1.1.0 | Shared TypeScript interfaces (added theme types) |
| `libraryStore.ts` | 1.0.0 | ROM library state management |
| `deviceStore.ts` | 1.0.0 | Device/profile management |
| `deploymentStore.ts` | 1.0.0 | Deployment operations |
| `settingsStore.ts` | 1.1.0 | Application settings (added theme management) |
| `biosStore.ts` | 1.0.0 | BIOS management |
| `uiStore.ts` | 1.0.0 | UI state management |
| `index.ts` | 1.1.0 | Combined exports and setup (added theme selectors) |
| `STORES_ARCHITECTURE.md` | 1.1.0 | This documentation |

---

**End of Document**
