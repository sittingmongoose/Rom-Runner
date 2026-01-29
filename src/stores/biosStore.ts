/**
 * ROM Runner - BIOS Store
 * @version 1.0.0
 * @description Zustand store slice for BIOS file management and verification
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';

import type {
  BiosFile,
  BiosRequirement,
  BiosVerificationResult,
  BiosVerificationReport,
  PlatformBiosStatus,
} from './types_v1_0_0';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface BiosState {
  // Detected BIOS files
  biosFiles: BiosFile[];
  
  // Requirements database
  requirements: BiosRequirement[];
  
  // Verification
  verificationReport: BiosVerificationReport | null;
  isVerifying: boolean;
  verificationProgress: VerificationProgress | null;
  
  // Scanning
  isScanning: boolean;
  lastScanPath: string | null;
  
  // Loading
  isLoading: boolean;
  
  // Error state
  error: string | null;
}

export interface VerificationProgress {
  currentFile: string;
  filesChecked: number;
  filesTotal: number;
  percentComplete: number;
}

export interface BiosActions {
  // Loading
  loadRequirements: () => Promise<void>;
  loadRequirementsForPlatforms: (platformIds: string[]) => Promise<void>;
  
  // Scanning
  scanBiosDirectory: (path: string) => Promise<void>;
  
  // Verification
  verifyBiosFile: (path: string) => Promise<BiosVerificationResult>;
  verifyAll: (directory: string) => Promise<BiosVerificationReport>;
  verifyForPlatforms: (directory: string, platformIds: string[]) => Promise<BiosVerificationReport>;
  
  // Completeness
  checkCompleteness: (directory: string, platformIds: string[]) => Promise<PlatformBiosStatus[]>;
  
  // Progress handler
  handleVerificationProgress: (progress: VerificationProgress) => void;
  
  // Utilities
  clearVerificationReport: () => void;
  clearError: () => void;
  reset: () => void;
}

export type BiosStore = BiosState & BiosActions;

// ============================================================================
// DEFAULT STATE
// ============================================================================

const initialState: BiosState = {
  biosFiles: [],
  requirements: [],
  verificationReport: null,
  isVerifying: false,
  verificationProgress: null,
  isScanning: false,
  lastScanPath: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useBiosStore = create<BiosStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ========================================================================
      // LOADING
      // ========================================================================

      loadRequirements: async () => {
        set({ isLoading: true, error: null });

        try {
          const requirements = await invoke<BiosRequirement[]>('get_bios_requirements');
          set({ requirements, isLoading: false });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load BIOS requirements';
          set({ isLoading: false, error: message });
        }
      },

      loadRequirementsForPlatforms: async (platformIds: string[]) => {
        set({ isLoading: true, error: null });

        try {
          const requirements = await invoke<BiosRequirement[]>('get_bios_requirements_for_platforms', {
            platformIds,
          });
          set({ requirements, isLoading: false });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to load BIOS requirements';
          set({ isLoading: false, error: message });
        }
      },

      // ========================================================================
      // SCANNING
      // ========================================================================

      scanBiosDirectory: async (path: string) => {
        set({ isScanning: true, error: null });

        try {
          const biosFiles = await invoke<BiosFile[]>('scan_bios_directory', { path });
          set({
            biosFiles,
            isScanning: false,
            lastScanPath: path,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to scan BIOS directory';
          set({ isScanning: false, error: message });
          throw error;
        }
      },

      // ========================================================================
      // VERIFICATION
      // ========================================================================

      verifyBiosFile: async (path: string) => {
        try {
          const result = await invoke<BiosVerificationResult>('verify_bios_file', { path });
          
          // Update the matching file in biosFiles if present
          set((state) => {
            const index = state.biosFiles.findIndex(
              (f) => f.sourcePath === path || f.fileName === result.fileName
            );
            if (index !== -1) {
              state.biosFiles[index].isVerified = result.status === 'verified';
            }
          });
          
          return result;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to verify BIOS file';
          set({ error: message });
          throw error;
        }
      },

      verifyAll: async (directory: string) => {
        set({
          isVerifying: true,
          error: null,
          verificationProgress: {
            currentFile: '',
            filesChecked: 0,
            filesTotal: 0,
            percentComplete: 0,
          },
        });

        try {
          const report = await invoke<BiosVerificationReport>('verify_all_bios', { directory });
          
          set({
            verificationReport: report,
            isVerifying: false,
            verificationProgress: null,
          });
          
          // Update biosFiles with verification results
          set((state) => {
            for (const result of report.results) {
              const file = state.biosFiles.find((f) => f.fileName === result.fileName);
              if (file) {
                file.isVerified = result.status === 'verified';
              }
            }
          });
          
          return report;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'BIOS verification failed';
          set({
            isVerifying: false,
            verificationProgress: null,
            error: message,
          });
          throw error;
        }
      },

      verifyForPlatforms: async (directory: string, platformIds: string[]) => {
        set({
          isVerifying: true,
          error: null,
          verificationProgress: {
            currentFile: '',
            filesChecked: 0,
            filesTotal: 0,
            percentComplete: 0,
          },
        });

        try {
          const report = await invoke<BiosVerificationReport>('verify_bios_for_platforms', {
            directory,
            platformIds,
          });
          
          set({
            verificationReport: report,
            isVerifying: false,
            verificationProgress: null,
          });
          
          return report;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'BIOS verification failed';
          set({
            isVerifying: false,
            verificationProgress: null,
            error: message,
          });
          throw error;
        }
      },

      // ========================================================================
      // COMPLETENESS
      // ========================================================================

      checkCompleteness: async (directory: string, platformIds: string[]) => {
        set({ isLoading: true, error: null });

        try {
          const statuses = await invoke<PlatformBiosStatus[]>('check_bios_completeness', {
            directory,
            platformIds,
          });
          set({ isLoading: false });
          return statuses;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to check BIOS completeness';
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      // ========================================================================
      // PROGRESS HANDLER
      // ========================================================================

      handleVerificationProgress: (progress: VerificationProgress) => {
        set({ verificationProgress: progress });
      },

      // ========================================================================
      // UTILITIES
      // ========================================================================

      clearVerificationReport: () => {
        set({ verificationReport: null, verificationProgress: null });
      },

      clearError: () => set({ error: null }),

      reset: () => set(initialState),
    }))
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Select total BIOS file count */
export const selectBiosFileCount = (state: BiosStore) => state.biosFiles.length;

/** Select verified BIOS file count */
export const selectVerifiedBiosCount = (state: BiosStore) =>
  state.biosFiles.filter((f) => f.isVerified).length;

/** Select unverified BIOS files */
export const selectUnverifiedBiosFiles = (state: BiosStore) =>
  state.biosFiles.filter((f) => !f.isVerified);

/** Select BIOS files by platform */
export const selectBiosFilesByPlatform = (platformId: string) => (state: BiosStore) =>
  state.biosFiles.filter((f) => f.platformId === platformId);

/** Select requirements for a platform */
export const selectRequirementsForPlatform = (platformId: string) => (state: BiosStore) =>
  state.requirements.find((r) => r.platformId === platformId) ?? null;

/** Select required BIOS files for a platform */
export const selectRequiredBiosForPlatform = (platformId: string) => (state: BiosStore) => {
  const req = state.requirements.find((r) => r.platformId === platformId);
  return req?.requiredFiles ?? [];
};

/** Select optional BIOS files for a platform */
export const selectOptionalBiosForPlatform = (platformId: string) => (state: BiosStore) => {
  const req = state.requirements.find((r) => r.platformId === platformId);
  return req?.optionalFiles ?? [];
};

/** Select verification report summary */
export const selectVerificationSummary = (state: BiosStore) => {
  if (!state.verificationReport) return null;
  
  const report = state.verificationReport;
  return {
    totalRequired: report.totalRequired,
    totalOptional: report.totalOptional,
    verifiedRequired: report.verifiedRequired,
    verifiedOptional: report.verifiedOptional,
    missing: report.missing,
    invalid: report.invalid,
    completionPercent: report.totalRequired > 0
      ? Math.round((report.verifiedRequired / report.totalRequired) * 100)
      : 100,
  };
};

/** Select platform completion status from report */
export const selectPlatformBiosStatus = (platformId: string) => (state: BiosStore) => {
  if (!state.verificationReport) return null;
  return state.verificationReport.platformStatus[platformId] ?? null;
};

/** Select platforms with complete BIOS */
export const selectCompletePlatforms = (state: BiosStore) => {
  if (!state.verificationReport) return [];
  
  return Object.entries(state.verificationReport.platformStatus)
    .filter(([, status]) => status.isComplete)
    .map(([platformId]) => platformId);
};

/** Select platforms with missing BIOS */
export const selectIncompletePlatforms = (state: BiosStore) => {
  if (!state.verificationReport) return [];
  
  return Object.entries(state.verificationReport.platformStatus)
    .filter(([, status]) => !status.isComplete)
    .map(([platformId, status]) => ({
      platformId,
      platformName: status.platformName,
      missingFiles: status.missingFiles,
    }));
};

/** Select verification progress percentage */
export const selectVerificationPercent = (state: BiosStore) => {
  return state.verificationProgress?.percentComplete ?? 0;
};

/** Select if BIOS directory has been scanned */
export const selectHasScannedBios = (state: BiosStore) => state.lastScanPath !== null;

/** Select missing required BIOS files */
export const selectMissingRequiredBios = (state: BiosStore) => {
  if (!state.verificationReport) return [];
  
  return state.verificationReport.results.filter(
    (r) => r.status === 'not_found'
  );
};

/** Select invalid BIOS files (wrong hash) */
export const selectInvalidBiosFiles = (state: BiosStore) => {
  if (!state.verificationReport) return [];
  
  return state.verificationReport.results.filter(
    (r) => r.status === 'wrong_hash' || r.status === 'wrong_size'
  );
};

/** Select BIOS file by ID */
export const selectBiosById = (biosId: string) => (state: BiosStore) =>
  state.biosFiles.find((f) => f.id === biosId) ?? null;

/** Select unique platforms from scanned BIOS files */
export const selectScannedBiosPlatforms = (state: BiosStore) =>
  [...new Set(state.biosFiles.map((f) => f.platformId))];

export default useBiosStore;
