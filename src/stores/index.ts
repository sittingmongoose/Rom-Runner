/**
 * ROM Runner - Zustand Stores Index
 * @version 1.0.0
 * @description Combined exports for all Zustand stores, event listener setup, and cross-store selectors
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ============================================================================
// STORE EXPORTS
// ============================================================================

// Re-export all stores
export { useLibraryStore, default as libraryStore } from './libraryStore_v1_0_0';
export { useDeviceStore, default as deviceStore } from './deviceStore_v1_0_0';
export { useDeploymentStore, default as deploymentStore } from './deploymentStore_v1_0_0';
export { useSettingsStore, default as settingsStore } from './settingsStore_v1_0_0';
export { useBiosStore, default as biosStore } from './biosStore_v1_0_0';
export { useUIStore, default as uiStore } from './uiStore_v1_0_0';

// Re-export all selectors
export * from './libraryStore_v1_0_0';
export * from './deviceStore_v1_0_0';
export * from './deploymentStore_v1_0_0';
export * from './settingsStore_v1_0_0';
export * from './biosStore_v1_0_0';
export * from './uiStore_v1_0_0';

// Re-export all types
export * from './types_v1_0_0';

// ============================================================================
// STORE INSTANCES (for cross-store access)
// ============================================================================

import { useLibraryStore } from './libraryStore_v1_0_0';
import { useDeviceStore } from './deviceStore_v1_0_0';
import { useDeploymentStore } from './deploymentStore_v1_0_0';
import { useSettingsStore } from './settingsStore_v1_0_0';
import { useBiosStore } from './biosStore_v1_0_0';
import { useUIStore } from './uiStore_v1_0_0';

import type {
  ScanProgress,
  DeploymentProgress,
  DeploymentResult,
  VerificationProgress,
  DetectedDevice,
} from './types_v1_0_0';

// ============================================================================
// TAURI EVENT LISTENERS
// ============================================================================

/** Event payload types */
interface TauriEvents {
  scan_progress: ScanProgress;
  scan_complete: { gamesImported: number };
  scan_error: { message: string };
  deployment_progress: DeploymentProgress;
  deployment_complete: DeploymentResult;
  deployment_error: { message: string };
  bios_verification_progress: VerificationProgress;
  device_connected: DetectedDevice;
  device_disconnected: { path: string };
}

/** Active event listener cleanup functions */
let eventUnlisteners: UnlistenFn[] = [];

/**
 * Set up all Tauri event listeners.
 * Call this once when the app initializes.
 * Returns a cleanup function to remove all listeners.
 */
export async function setupEventListeners(): Promise<() => void> {
  // Clean up any existing listeners
  await cleanupEventListeners();

  const listeners: Promise<UnlistenFn>[] = [];

  // ========================================================================
  // SCAN EVENTS
  // ========================================================================

  listeners.push(
    listen<ScanProgress>('scan_progress', (event) => {
      useLibraryStore.getState().handleScanProgress(event.payload);
    })
  );

  listeners.push(
    listen<{ gamesImported: number }>('scan_complete', (event) => {
      const { gamesImported } = event.payload;
      useLibraryStore.getState().handleScanProgress({
        status: 'complete',
        currentPath: '',
        filesScanned: 0,
        filesTotal: 0,
        gamesFound: gamesImported,
        gamesImported,
        duplicatesSkipped: 0,
        errorsCount: 0,
      });
      
      useUIStore.getState().showSuccess(
        'Scan Complete',
        `Imported ${gamesImported} games`
      );
    })
  );

  listeners.push(
    listen<{ message: string }>('scan_error', (event) => {
      useLibraryStore.getState().handleScanProgress({
        status: 'error',
        currentPath: '',
        filesScanned: 0,
        filesTotal: 0,
        gamesFound: 0,
        gamesImported: 0,
        duplicatesSkipped: 0,
        errorsCount: 1,
      });
      
      useUIStore.getState().showError('Scan Failed', event.payload.message);
    })
  );

  // ========================================================================
  // DEPLOYMENT EVENTS
  // ========================================================================

  listeners.push(
    listen<DeploymentProgress>('deployment_progress', (event) => {
      useDeploymentStore.getState().handleProgress(event.payload);
    })
  );

  listeners.push(
    listen<DeploymentResult>('deployment_complete', (event) => {
      useDeploymentStore.getState().handleComplete(event.payload);
      
      if (event.payload.success) {
        useUIStore.getState().showSuccess(
          'Deployment Complete',
          `Deployed ${event.payload.gamesDeployed} games`
        );
      } else {
        useUIStore.getState().showError(
          'Deployment Failed',
          `${event.payload.gamesFailed} games failed to deploy`
        );
      }
    })
  );

  listeners.push(
    listen<{ message: string }>('deployment_error', (event) => {
      useDeploymentStore.getState().handleError(event.payload.message);
      useUIStore.getState().showError('Deployment Error', event.payload.message);
    })
  );

  // ========================================================================
  // BIOS VERIFICATION EVENTS
  // ========================================================================

  listeners.push(
    listen<VerificationProgress>('bios_verification_progress', (event) => {
      useBiosStore.getState().handleVerificationProgress(event.payload);
    })
  );

  // ========================================================================
  // DEVICE EVENTS
  // ========================================================================

  listeners.push(
    listen<DetectedDevice>('device_connected', (event) => {
      // Refresh connected devices list
      useDeviceStore.getState().scanForDevices();
      
      useUIStore.getState().showInfo(
        'Device Connected',
        `${event.payload.volumeName || 'Removable device'} detected`
      );
    })
  );

  listeners.push(
    listen<{ path: string }>('device_disconnected', (event) => {
      // Refresh connected devices list
      useDeviceStore.getState().scanForDevices();
      
      useUIStore.getState().showInfo(
        'Device Disconnected',
        'A device was removed'
      );
    })
  );

  // Wait for all listeners to be set up
  eventUnlisteners = await Promise.all(listeners);

  // Return cleanup function
  return cleanupEventListeners;
}

/**
 * Remove all active event listeners.
 */
export async function cleanupEventListeners(): Promise<void> {
  for (const unlisten of eventUnlisteners) {
    unlisten();
  }
  eventUnlisteners = [];
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize all stores with data from the backend.
 * Call this once when the app starts.
 */
export async function initializeStores(): Promise<void> {
  const ui = useUIStore.getState();
  
  try {
    ui.showGlobalLoading('Loading ROM Runner...');

    // Load settings first (needed for other operations)
    await useSettingsStore.getState().loadSettings();

    // Apply theme
    useSettingsStore.getState().setTheme(useSettingsStore.getState().theme);

    // Load other data in parallel
    await Promise.all([
      useLibraryStore.getState().fetchGames(),
      useLibraryStore.getState().fetchCollections(),
      useDeviceStore.getState().fetchDevices(),
      useBiosStore.getState().loadRequirements(),
    ]);

    ui.hideGlobalLoading();
  } catch (error) {
    ui.hideGlobalLoading();
    ui.showError('Initialization Failed', 'Failed to load application data');
    throw error;
  }
}

// ============================================================================
// CROSS-STORE SELECTORS
// ============================================================================

/**
 * Get the active device with its full profile.
 * Combines device and settings stores.
 */
export function useActiveDeviceWithProfile() {
  const device = useDeviceStore((s) => {
    if (!s.activeDeviceId) return null;
    return s.devices.find((d) => d.id === s.activeDeviceId) ?? null;
  });
  
  const profile = useDeviceStore((s) => {
    if (!device || !s.activeProfileId) return null;
    return device.profiles.find((p) => p.id === s.activeProfileId) ?? null;
  });
  
  return { device, profile };
}

/**
 * Check if deployment is ready.
 * Combines deployment, device, and settings stores.
 */
export function useDeploymentReadiness() {
  const hasActiveDevice = useDeviceStore((s) => s.activeDeviceId !== null);
  const hasActiveProfile = useDeviceStore((s) => s.activeProfileId !== null);
  const hasSelectedGames = useLibraryStore((s) => s.selectedGameIds.size > 0);
  const isDeploying = useDeploymentStore((s) => s.isDeploying);
  
  return {
    canStartDeployment: hasActiveDevice && hasActiveProfile && hasSelectedGames && !isDeploying,
    hasActiveDevice,
    hasActiveProfile,
    hasSelectedGames,
    isDeploying,
  };
}

/**
 * Get BIOS completeness for the active device's platforms.
 */
export function useBiosCompletenessForDevice() {
  const report = useBiosStore((s) => s.verificationReport);
  const games = useLibraryStore((s) => s.games);
  
  if (!report) return null;
  
  // Get unique platforms from selected games
  const platforms = [...new Set(games.map((g) => g.platformId))];
  
  // Check status for each platform
  const statuses = platforms.map((platformId) => ({
    platformId,
    status: report.platformStatus[platformId] ?? null,
  }));
  
  return {
    platforms: statuses,
    allComplete: statuses.every((s) => s.status?.isComplete ?? false),
    missingCount: statuses.filter((s) => !s.status?.isComplete).length,
  };
}

/**
 * Combined loading state across stores.
 */
export function useIsAnyLoading() {
  const libraryLoading = useLibraryStore((s) => s.isLoading);
  const deviceLoading = useDeviceStore((s) => s.isLoading);
  const deploymentPlanning = useDeploymentStore((s) => s.isPlanning);
  const settingsLoading = useSettingsStore((s) => s.isLoading);
  const biosLoading = useBiosStore((s) => s.isLoading);
  const globalLoading = useUIStore((s) => s.globalLoading);
  
  return (
    libraryLoading ||
    deviceLoading ||
    deploymentPlanning ||
    settingsLoading ||
    biosLoading ||
    globalLoading
  );
}

/**
 * Combined error state across stores.
 */
export function useAnyError() {
  const libraryError = useLibraryStore((s) => s.error);
  const deviceError = useDeviceStore((s) => s.error);
  const deploymentError = useDeploymentStore((s) => s.error);
  const settingsError = useSettingsStore((s) => s.error);
  const biosError = useBiosStore((s) => s.error);
  
  return libraryError || deviceError || deploymentError || settingsError || biosError;
}

/**
 * Clear all errors across stores.
 */
export function clearAllErrors() {
  useLibraryStore.getState().clearError();
  useDeviceStore.getState().clearError();
  useDeploymentStore.getState().clearError();
  useSettingsStore.getState().clearError();
  useBiosStore.getState().clearError();
}

/**
 * Reset all stores to initial state.
 */
export function resetAllStores() {
  useLibraryStore.getState().reset();
  useDeviceStore.getState().reset();
  useDeploymentStore.getState().reset();
  // Don't reset settings - user preferences should persist
  useBiosStore.getState().reset();
  useUIStore.getState().reset();
}

// ============================================================================
// STORE SUBSCRIPTIONS FOR SIDE EFFECTS
// ============================================================================

/**
 * Set up cross-store subscriptions for side effects.
 * Call this once during app initialization.
 */
export function setupStoreSubscriptions(): () => void {
  const unsubscribers: Array<() => void> = [];

  // When library error occurs, show notification
  unsubscribers.push(
    useLibraryStore.subscribe(
      (state) => state.error,
      (error) => {
        if (error) {
          useUIStore.getState().showError('Library Error', error);
        }
      }
    )
  );

  // When device error occurs, show notification
  unsubscribers.push(
    useDeviceStore.subscribe(
      (state) => state.error,
      (error) => {
        if (error) {
          useUIStore.getState().showError('Device Error', error);
        }
      }
    )
  );

  // When settings error occurs, show notification
  unsubscribers.push(
    useSettingsStore.subscribe(
      (state) => state.error,
      (error) => {
        if (error) {
          useUIStore.getState().showError('Settings Error', error);
        }
      }
    )
  );

  // When BIOS error occurs, show notification
  unsubscribers.push(
    useBiosStore.subscribe(
      (state) => state.error,
      (error) => {
        if (error) {
          useUIStore.getState().showError('BIOS Error', error);
        }
      }
    )
  );

  // Return cleanup function
  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  library: useLibraryStore,
  device: useDeviceStore,
  deployment: useDeploymentStore,
  settings: useSettingsStore,
  bios: useBiosStore,
  ui: useUIStore,
  setupEventListeners,
  cleanupEventListeners,
  initializeStores,
  setupStoreSubscriptions,
  clearAllErrors,
  resetAllStores,
};
