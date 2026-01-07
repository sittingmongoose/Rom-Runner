/**
 * ROM Runner - Settings Store
 * @version 1.0.0
 * @description Zustand store slice for application settings and user preferences
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';

import type { AppSettings, ThemeMode, GameOverride } from './types_v1_0_0';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface SettingsState {
  // App settings (persisted to backend)
  settings: AppSettings;
  
  // User overrides (per-game and per-platform)
  platformEmulatorOverrides: Map<string, string>; // platformId -> emulatorId
  gameOverrides: Map<number, GameOverride>; // gameId -> override
  
  // Theme (persisted locally)
  theme: ThemeMode;
  
  // UI preferences (persisted locally)
  sidebarWidth: number;
  gridViewColumns: number;
  showHiddenPlatforms: boolean;
  
  // Loading state
  isLoading: boolean;
  isSaving: boolean;
  
  // Error state
  error: string | null;
}

export interface SettingsActions {
  // Settings management
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  
  // Platform emulator overrides
  setPlatformEmulatorOverride: (platformId: string, emulatorId: string) => Promise<void>;
  removePlatformEmulatorOverride: (platformId: string) => Promise<void>;
  clearAllPlatformOverrides: () => Promise<void>;
  
  // Game overrides
  setGameOverride: (gameId: number, override: GameOverride) => Promise<void>;
  removeGameOverride: (gameId: number) => Promise<void>;
  clearAllGameOverrides: () => Promise<void>;
  
  // Theme
  setTheme: (theme: ThemeMode) => void;
  
  // UI preferences
  setSidebarWidth: (width: number) => void;
  setGridViewColumns: (columns: number) => void;
  setShowHiddenPlatforms: (show: boolean) => void;
  
  // API keys
  setApiKey: (service: 'retrocatalog' | 'igdb', key: string) => Promise<void>;
  removeApiKey: (service: 'retrocatalog' | 'igdb') => Promise<void>;
  
  // Format preferences
  setPreferredFormat: (platformId: string, format: string) => Promise<void>;
  removePreferredFormat: (platformId: string) => Promise<void>;
  
  // Utilities
  clearError: () => void;
}

export type SettingsStore = SettingsState & SettingsActions;

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_SETTINGS: AppSettings = {
  // General
  language: 'en',
  checkForUpdates: true,
  sendAnonymousUsage: false,
  
  // Library
  defaultLibraryPath: '',
  scanSubdirectories: true,
  autoIdentifyRoms: true,
  
  // Compatibility behavior
  includeUnknownCompatibilityForStrictPlatforms: false,
  includeUnknownPerformanceForDemandingPlatforms: false,
  
  // Warning display
  showPerformanceWarnings: true,
  showCompatibilityWarnings: true,
  
  // Auto-apply settings
  autoApplyEmulatorSettings: false,
  
  // Emulator preferences
  preferStandaloneEmulators: false,
  
  // Destination scanning
  scanDestinationBeforeDeployment: true,
  trustDetectedLayoutOverExpected: false,
  rememberScannedLayouts: true,
  
  // Format conversion
  enableFormatConversion: true,
  preferredFormats: {},
  
  // API keys
  hasRetrocatalogApiKey: false,
  hasIgdbApiKey: false,
};

const initialState: SettingsState = {
  settings: DEFAULT_SETTINGS,
  platformEmulatorOverrides: new Map(),
  gameOverrides: new Map(),
  theme: 'system',
  sidebarWidth: 240,
  gridViewColumns: 4,
  showHiddenPlatforms: false,
  isLoading: false,
  isSaving: false,
  error: null,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useSettingsStore = create<SettingsStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ========================================================================
        // SETTINGS MANAGEMENT
        // ========================================================================

        loadSettings: async () => {
          set({ isLoading: true, error: null });

          try {
            const [settings, platformOverrides, gameOverrides] = await Promise.all([
              invoke<AppSettings>('get_settings'),
              invoke<Record<string, string>>('get_platform_emulator_overrides'),
              invoke<GameOverride[]>('get_game_overrides'),
            ]);

            set({
              settings,
              platformEmulatorOverrides: new Map(Object.entries(platformOverrides)),
              gameOverrides: new Map(gameOverrides.map((o) => [o.gameId, o])),
              isLoading: false,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load settings';
            set({ isLoading: false, error: message });
          }
        },

        updateSettings: async (updates: Partial<AppSettings>) => {
          set({ isSaving: true, error: null });

          try {
            await invoke('update_settings', { updates });
            set((state) => {
              state.settings = { ...state.settings, ...updates };
              state.isSaving = false;
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save settings';
            set({ isSaving: false, error: message });
            throw error;
          }
        },

        resetSettings: async () => {
          set({ isSaving: true, error: null });

          try {
            await invoke('reset_settings');
            set({
              settings: DEFAULT_SETTINGS,
              isSaving: false,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reset settings';
            set({ isSaving: false, error: message });
            throw error;
          }
        },

        // ========================================================================
        // PLATFORM EMULATOR OVERRIDES
        // ========================================================================

        setPlatformEmulatorOverride: async (platformId: string, emulatorId: string) => {
          try {
            await invoke('set_platform_emulator_override', { platformId, emulatorId });
            set((state) => {
              state.platformEmulatorOverrides.set(platformId, emulatorId);
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to set platform override';
            set({ error: message });
            throw error;
          }
        },

        removePlatformEmulatorOverride: async (platformId: string) => {
          try {
            await invoke('remove_platform_emulator_override', { platformId });
            set((state) => {
              state.platformEmulatorOverrides.delete(platformId);
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to remove platform override';
            set({ error: message });
            throw error;
          }
        },

        clearAllPlatformOverrides: async () => {
          try {
            await invoke('clear_all_platform_overrides');
            set({ platformEmulatorOverrides: new Map() });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to clear platform overrides';
            set({ error: message });
            throw error;
          }
        },

        // ========================================================================
        // GAME OVERRIDES
        // ========================================================================

        setGameOverride: async (gameId: number, override: GameOverride) => {
          try {
            await invoke('set_game_override', { override });
            set((state) => {
              state.gameOverrides.set(gameId, override);
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to set game override';
            set({ error: message });
            throw error;
          }
        },

        removeGameOverride: async (gameId: number) => {
          try {
            await invoke('remove_game_override', { gameId });
            set((state) => {
              state.gameOverrides.delete(gameId);
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to remove game override';
            set({ error: message });
            throw error;
          }
        },

        clearAllGameOverrides: async () => {
          try {
            await invoke('clear_all_game_overrides');
            set({ gameOverrides: new Map() });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to clear game overrides';
            set({ error: message });
            throw error;
          }
        },

        // ========================================================================
        // THEME
        // ========================================================================

        setTheme: (theme: ThemeMode) => {
          set({ theme });
          
          // Apply theme to document
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          
          if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.add(prefersDark ? 'dark' : 'light');
          } else {
            root.classList.add(theme);
          }
        },

        // ========================================================================
        // UI PREFERENCES
        // ========================================================================

        setSidebarWidth: (width: number) => {
          set({ sidebarWidth: Math.max(180, Math.min(400, width)) });
        },

        setGridViewColumns: (columns: number) => {
          set({ gridViewColumns: Math.max(2, Math.min(8, columns)) });
        },

        setShowHiddenPlatforms: (show: boolean) => {
          set({ showHiddenPlatforms: show });
        },

        // ========================================================================
        // API KEYS
        // ========================================================================

        setApiKey: async (service: 'retrocatalog' | 'igdb', key: string) => {
          try {
            await invoke('set_api_key', { service, key });
            set((state) => {
              if (service === 'retrocatalog') {
                state.settings.hasRetrocatalogApiKey = true;
              } else if (service === 'igdb') {
                state.settings.hasIgdbApiKey = true;
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save API key';
            set({ error: message });
            throw error;
          }
        },

        removeApiKey: async (service: 'retrocatalog' | 'igdb') => {
          try {
            await invoke('remove_api_key', { service });
            set((state) => {
              if (service === 'retrocatalog') {
                state.settings.hasRetrocatalogApiKey = false;
              } else if (service === 'igdb') {
                state.settings.hasIgdbApiKey = false;
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to remove API key';
            set({ error: message });
            throw error;
          }
        },

        // ========================================================================
        // FORMAT PREFERENCES
        // ========================================================================

        setPreferredFormat: async (platformId: string, format: string) => {
          try {
            const newFormats = {
              ...get().settings.preferredFormats,
              [platformId]: format,
            };
            await get().updateSettings({ preferredFormats: newFormats });
          } catch {
            // Error already handled by updateSettings
          }
        },

        removePreferredFormat: async (platformId: string) => {
          try {
            const newFormats = { ...get().settings.preferredFormats };
            delete newFormats[platformId];
            await get().updateSettings({ preferredFormats: newFormats });
          } catch {
            // Error already handled by updateSettings
          }
        },

        // ========================================================================
        // UTILITIES
        // ========================================================================

        clearError: () => set({ error: null }),
      })),
      {
        name: 'rom-runner-settings',
        // Only persist UI preferences locally, actual settings stored in backend
        partialize: (state) => ({
          theme: state.theme,
          sidebarWidth: state.sidebarWidth,
          gridViewColumns: state.gridViewColumns,
          showHiddenPlatforms: state.showHiddenPlatforms,
        }),
        // Custom serialization for Map types (not persisted, but needed for hydration)
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as Partial<SettingsState>),
          // Ensure Maps are properly initialized
          platformEmulatorOverrides: new Map(),
          gameOverrides: new Map(),
        }),
      }
    )
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Select current theme (resolved if 'system') */
export const selectResolvedTheme = (state: SettingsStore): 'light' | 'dark' => {
  if (state.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return state.theme;
};

/** Select if any API keys are configured */
export const selectHasApiKeys = (state: SettingsStore) => {
  return state.settings.hasRetrocatalogApiKey || state.settings.hasIgdbApiKey;
};

/** Select override for a specific platform */
export const selectPlatformEmulatorOverride = (platformId: string) => (state: SettingsStore) => {
  return state.platformEmulatorOverrides.get(platformId) ?? null;
};

/** Select override for a specific game */
export const selectGameOverride = (gameId: number) => (state: SettingsStore) => {
  return state.gameOverrides.get(gameId) ?? null;
};

/** Select if game is force-included */
export const selectIsGameForceIncluded = (gameId: number) => (state: SettingsStore) => {
  const override = state.gameOverrides.get(gameId);
  return override?.action === 'include';
};

/** Select if game is force-excluded */
export const selectIsGameForceExcluded = (gameId: number) => (state: SettingsStore) => {
  const override = state.gameOverrides.get(gameId);
  return override?.action === 'exclude';
};

/** Select preferred format for a platform */
export const selectPreferredFormat = (platformId: string) => (state: SettingsStore) => {
  return state.settings.preferredFormats[platformId] ?? null;
};

/** Select if strict compatibility mode is on */
export const selectIsStrictCompatibilityMode = (state: SettingsStore) => {
  return !state.settings.includeUnknownCompatibilityForStrictPlatforms;
};

/** Select if strict performance mode is on */
export const selectIsStrictPerformanceMode = (state: SettingsStore) => {
  return !state.settings.includeUnknownPerformanceForDemandingPlatforms;
};

/** Select all platform overrides as array */
export const selectAllPlatformOverrides = (state: SettingsStore) => {
  return Array.from(state.platformEmulatorOverrides.entries()).map(([platformId, emulatorId]) => ({
    platformId,
    emulatorId,
  }));
};

/** Select all game overrides as array */
export const selectAllGameOverrides = (state: SettingsStore) => {
  return Array.from(state.gameOverrides.values());
};

/** Select destination scanning settings */
export const selectDestinationScanSettings = (state: SettingsStore) => ({
  scanBeforeDeployment: state.settings.scanDestinationBeforeDeployment,
  trustDetected: state.settings.trustDetectedLayoutOverExpected,
  rememberLayouts: state.settings.rememberScannedLayouts,
});

export default useSettingsStore;
