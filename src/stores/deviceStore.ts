/**
 * ROM Runner - Device Store
 * @version 1.0.0
 * @description Zustand store slice for device and profile management
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';

import type {
  UserDevice,
  DeviceProfile,
  DetectedDevice,
  DestinationScanResult,
  NewDevice,
  NewProfile,
  GameOverride,
  LayoutPaths,
} from './types_v1_0_0';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface DeviceState {
  // Data
  devices: UserDevice[];
  connectedDevices: DetectedDevice[];
  
  // Active selection
  activeDeviceId: number | null;
  activeProfileId: number | null;
  
  // Scanning
  isScanning: boolean;
  isScanningDestination: boolean;
  lastScanResult: DestinationScanResult | null;
  
  // Loading
  isLoading: boolean;
  
  // Error state
  error: string | null;
}

export interface DeviceActions {
  // Data fetching
  fetchDevices: () => Promise<void>;
  scanForDevices: () => Promise<void>;
  
  // Destination scanning
  scanDestination: (path: string, expectedOsId: string) => Promise<DestinationScanResult>;
  clearScanResult: () => void;
  
  // Device CRUD
  addDevice: (device: NewDevice) => Promise<UserDevice>;
  updateDevice: (id: number, updates: Partial<UserDevice>) => Promise<void>;
  deleteDevice: (id: number) => Promise<void>;
  
  // Active selection
  setActiveDevice: (id: number | null) => void;
  setActiveProfile: (id: number | null) => void;
  
  // Profile CRUD
  createProfile: (deviceId: number, profile: NewProfile) => Promise<DeviceProfile>;
  updateProfile: (id: number, updates: Partial<DeviceProfile>) => Promise<void>;
  deleteProfile: (id: number) => Promise<void>;
  setDefaultProfile: (deviceId: number, profileId: number) => Promise<void>;
  
  // Profile settings
  addGameOverride: (profileId: number, override: GameOverride) => Promise<void>;
  removeGameOverride: (profileId: number, gameId: number) => Promise<void>;
  setPlatformEmulator: (profileId: number, platformId: string, emulatorId: string) => Promise<void>;
  removePlatformEmulator: (profileId: number, platformId: string) => Promise<void>;
  
  // Path overrides
  savePathOverrides: (deviceId: number, paths: Partial<LayoutPaths>) => Promise<void>;
  clearPathOverrides: (deviceId: number) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

export type DeviceStore = DeviceState & DeviceActions;

// ============================================================================
// DEFAULT STATE
// ============================================================================

const initialState: DeviceState = {
  devices: [],
  connectedDevices: [],
  activeDeviceId: null,
  activeProfileId: null,
  isScanning: false,
  isScanningDestination: false,
  lastScanResult: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useDeviceStore = create<DeviceStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ========================================================================
        // DATA FETCHING
        // ========================================================================

        fetchDevices: async () => {
          set({ isLoading: true, error: null });

          try {
            const devices = await invoke<UserDevice[]>('get_devices');
            set({ devices, isLoading: false });
            
            // Restore active selection if valid
            const state = get();
            if (state.activeDeviceId) {
              const deviceExists = devices.some((d) => d.id === state.activeDeviceId);
              if (!deviceExists) {
                set({ activeDeviceId: null, activeProfileId: null });
              }
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to fetch devices';
            set({ isLoading: false, error: message });
          }
        },

        scanForDevices: async () => {
          set({ isScanning: true, error: null });

          try {
            const connectedDevices = await invoke<DetectedDevice[]>('scan_connected_devices');
            set({ connectedDevices, isScanning: false });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to scan for devices';
            set({ isScanning: false, error: message });
          }
        },

        // ========================================================================
        // DESTINATION SCANNING
        // ========================================================================

        scanDestination: async (path: string, expectedOsId: string) => {
          set({ isScanningDestination: true, error: null });

          try {
            const result = await invoke<DestinationScanResult>('scan_destination', {
              path,
              expectedOsId,
            });
            set({ lastScanResult: result, isScanningDestination: false });
            return result;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Destination scan failed';
            set({ isScanningDestination: false, error: message });
            throw error;
          }
        },

        clearScanResult: () => {
          set({ lastScanResult: null });
        },

        // ========================================================================
        // DEVICE CRUD
        // ========================================================================

        addDevice: async (newDevice: NewDevice) => {
          try {
            const device = await invoke<UserDevice>('add_device', { device: newDevice });
            set((state) => {
              state.devices.push(device);
            });
            return device;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add device';
            set({ error: message });
            throw error;
          }
        },

        updateDevice: async (id: number, updates: Partial<UserDevice>) => {
          try {
            await invoke('update_device', { id, updates });
            set((state) => {
              const index = state.devices.findIndex((d) => d.id === id);
              if (index !== -1) {
                state.devices[index] = { ...state.devices[index], ...updates };
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update device';
            set({ error: message });
            throw error;
          }
        },

        deleteDevice: async (id: number) => {
          try {
            await invoke('delete_device', { id });
            set((state) => {
              state.devices = state.devices.filter((d) => d.id !== id);
              if (state.activeDeviceId === id) {
                state.activeDeviceId = null;
                state.activeProfileId = null;
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete device';
            set({ error: message });
            throw error;
          }
        },

        // ========================================================================
        // ACTIVE SELECTION
        // ========================================================================

        setActiveDevice: (id: number | null) => {
          set((state) => {
            state.activeDeviceId = id;
            
            // Auto-select default profile when device changes
            if (id !== null) {
              const device = state.devices.find((d) => d.id === id);
              if (device) {
                const defaultProfile = device.profiles.find((p) => p.isDefault);
                state.activeProfileId = defaultProfile?.id ?? device.profiles[0]?.id ?? null;
              } else {
                state.activeProfileId = null;
              }
            } else {
              state.activeProfileId = null;
            }
          });
        },

        setActiveProfile: (id: number | null) => {
          set({ activeProfileId: id });
        },

        // ========================================================================
        // PROFILE CRUD
        // ========================================================================

        createProfile: async (deviceId: number, profile: NewProfile) => {
          try {
            const newProfile = await invoke<DeviceProfile>('create_profile', {
              deviceId,
              profile,
            });
            
            set((state) => {
              const device = state.devices.find((d) => d.id === deviceId);
              if (device) {
                // If this is the new default, unset others
                if (newProfile.isDefault) {
                  device.profiles.forEach((p) => (p.isDefault = false));
                }
                device.profiles.push(newProfile);
              }
            });
            
            return newProfile;
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create profile';
            set({ error: message });
            throw error;
          }
        },

        updateProfile: async (id: number, updates: Partial<DeviceProfile>) => {
          try {
            await invoke('update_profile', { id, updates });
            
            set((state) => {
              for (const device of state.devices) {
                const profileIndex = device.profiles.findIndex((p) => p.id === id);
                if (profileIndex !== -1) {
                  device.profiles[profileIndex] = {
                    ...device.profiles[profileIndex],
                    ...updates,
                  };
                  break;
                }
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update profile';
            set({ error: message });
            throw error;
          }
        },

        deleteProfile: async (id: number) => {
          try {
            await invoke('delete_profile', { id });
            
            set((state) => {
              for (const device of state.devices) {
                const profileIndex = device.profiles.findIndex((p) => p.id === id);
                if (profileIndex !== -1) {
                  device.profiles.splice(profileIndex, 1);
                  
                  // Clear active if deleted
                  if (state.activeProfileId === id) {
                    state.activeProfileId = device.profiles[0]?.id ?? null;
                  }
                  break;
                }
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete profile';
            set({ error: message });
            throw error;
          }
        },

        setDefaultProfile: async (deviceId: number, profileId: number) => {
          try {
            await invoke('set_default_profile', { deviceId, profileId });
            
            set((state) => {
              const device = state.devices.find((d) => d.id === deviceId);
              if (device) {
                device.profiles.forEach((p) => {
                  p.isDefault = p.id === profileId;
                });
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to set default profile';
            set({ error: message });
            throw error;
          }
        },

        // ========================================================================
        // PROFILE SETTINGS
        // ========================================================================

        addGameOverride: async (profileId: number, override: GameOverride) => {
          try {
            await invoke('add_game_override', { profileId, override });
            
            set((state) => {
              for (const device of state.devices) {
                const profile = device.profiles.find((p) => p.id === profileId);
                if (profile) {
                  // Remove existing override for this game if present
                  profile.gameOverrides = profile.gameOverrides.filter(
                    (o) => o.gameId !== override.gameId
                  );
                  profile.gameOverrides.push(override);
                  break;
                }
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add game override';
            set({ error: message });
            throw error;
          }
        },

        removeGameOverride: async (profileId: number, gameId: number) => {
          try {
            await invoke('remove_game_override', { profileId, gameId });
            
            set((state) => {
              for (const device of state.devices) {
                const profile = device.profiles.find((p) => p.id === profileId);
                if (profile) {
                  profile.gameOverrides = profile.gameOverrides.filter(
                    (o) => o.gameId !== gameId
                  );
                  break;
                }
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to remove game override';
            set({ error: message });
            throw error;
          }
        },

        setPlatformEmulator: async (profileId: number, platformId: string, emulatorId: string) => {
          try {
            await invoke('set_platform_emulator', { profileId, platformId, emulatorId });
            
            set((state) => {
              for (const device of state.devices) {
                const profile = device.profiles.find((p) => p.id === profileId);
                if (profile) {
                  profile.platformEmulatorOverrides[platformId] = emulatorId;
                  break;
                }
              }
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to set platform emulator';
            set({ error: message });
            throw error;
          }
        },

        removePlatformEmulator: async (profileId: number, platformId: string) => {
          try {
            await invoke('remove_platform_emulator', { profileId, platformId });
            
            set((state) => {
              for (const device of state.devices) {
                const profile = device.profiles.find((p) => p.id === profileId);
                if (profile) {
                  delete profile.platformEmulatorOverrides[platformId];
                  break;
                }
              }
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to remove platform emulator';
            set({ error: message });
            throw error;
          }
        },

        // ========================================================================
        // PATH OVERRIDES
        // ========================================================================

        savePathOverrides: async (deviceId: number, paths: Partial<LayoutPaths>) => {
          try {
            await invoke('save_path_overrides', { deviceId, paths });
            
            set((state) => {
              const device = state.devices.find((d) => d.id === deviceId);
              if (device) {
                device.scannedLayout = {
                  ...device.scannedLayout,
                  pathOverrides: paths,
                  scanTimestamp: new Date().toISOString(),
                } as typeof device.scannedLayout;
              }
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save path overrides';
            set({ error: message });
            throw error;
          }
        },

        clearPathOverrides: async (deviceId: number) => {
          try {
            await invoke('clear_path_overrides', { deviceId });
            
            set((state) => {
              const device = state.devices.find((d) => d.id === deviceId);
              if (device && device.scannedLayout) {
                device.scannedLayout.pathOverrides = {};
              }
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Failed to clear path overrides';
            set({ error: message });
            throw error;
          }
        },

        // ========================================================================
        // UTILITIES
        // ========================================================================

        clearError: () => set({ error: null }),

        reset: () => set(initialState),
      })),
      {
        name: 'rom-runner-device-store',
        // Only persist selection state, not full device data
        partialize: (state) => ({
          activeDeviceId: state.activeDeviceId,
          activeProfileId: state.activeProfileId,
        }),
      }
    )
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Select the active device */
export const selectActiveDevice = (state: DeviceStore) =>
  state.devices.find((d) => d.id === state.activeDeviceId) ?? null;

/** Select the active profile */
export const selectActiveProfile = (state: DeviceStore) => {
  const device = state.devices.find((d) => d.id === state.activeDeviceId);
  if (!device) return null;
  return device.profiles.find((p) => p.id === state.activeProfileId) ?? null;
};

/** Select device by ID */
export const selectDeviceById = (id: number) => (state: DeviceStore) =>
  state.devices.find((d) => d.id === id) ?? null;

/** Select profiles for a device */
export const selectDeviceProfiles = (deviceId: number) => (state: DeviceStore) => {
  const device = state.devices.find((d) => d.id === deviceId);
  return device?.profiles ?? [];
};

/** Select if destination scan has issues */
export const selectHasScanDiscrepancies = (state: DeviceStore) => {
  if (!state.lastScanResult) return false;
  return state.lastScanResult.verification.discrepancies.length > 0;
};

/** Select scan recommendations */
export const selectScanRecommendations = (state: DeviceStore) =>
  state.lastScanResult?.recommendations ?? [];

/** Select connected removable devices */
export const selectRemovableDevices = (state: DeviceStore) =>
  state.connectedDevices.filter((d) => d.isRemovable);

/** Select device connection status */
export const selectDeviceConnectionStatus = (deviceId: number) => (state: DeviceStore) => {
  const device = state.devices.find((d) => d.id === deviceId);
  if (!device) return 'unknown';
  
  // Check if device path matches any connected device
  const isConnected = state.connectedDevices.some(
    (cd) =>
      cd.path === device.connectionPath ||
      cd.volumeUuid === device.connectionPath
  );
  
  return isConnected ? 'connected' : 'disconnected';
};

export default useDeviceStore;
