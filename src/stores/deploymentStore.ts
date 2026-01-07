/**
 * ROM Runner - Deployment Store
 * @version 1.0.0
 * @description Zustand store slice for deployment operations and progress tracking
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';

import type {
  DeploymentConfig,
  DeploymentPlan,
  DeploymentProgress,
  DeploymentResult,
  DeploymentRecord,
  DeploymentStatus,
  ValidationResult,
} from './types_v1_0_0';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface DeploymentState {
  // Current deployment
  isDeploying: boolean;
  currentPlan: DeploymentPlan | null;
  progress: DeploymentProgress | null;
  
  // Planning
  isPlanning: boolean;
  isValidating: boolean;
  validationResult: ValidationResult | null;
  
  // History
  deploymentHistory: DeploymentRecord[];
  isLoadingHistory: boolean;
  
  // Error state
  error: string | null;
}

export interface DeploymentActions {
  // Planning
  createPlan: (config: DeploymentConfig) => Promise<DeploymentPlan>;
  clearPlan: () => void;
  
  // Validation
  validatePlan: (plan: DeploymentPlan) => Promise<ValidationResult>;
  clearValidation: () => void;
  
  // Execution
  startDeployment: (plan: DeploymentPlan) => Promise<void>;
  pauseDeployment: () => Promise<void>;
  resumeDeployment: () => Promise<void>;
  cancelDeployment: () => Promise<void>;
  
  // Event handlers (called from Tauri event listeners)
  handleProgress: (progress: DeploymentProgress) => void;
  handleComplete: (result: DeploymentResult) => void;
  handleError: (error: string) => void;
  
  // History
  fetchHistory: (deviceId?: number) => Promise<void>;
  clearHistory: (olderThanDays?: number) => Promise<void>;
  deleteHistoryRecord: (id: string) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

export type DeploymentStore = DeploymentState & DeploymentActions;

// ============================================================================
// DEFAULT STATE
// ============================================================================

const initialState: DeploymentState = {
  isDeploying: false,
  currentPlan: null,
  progress: null,
  isPlanning: false,
  isValidating: false,
  validationResult: null,
  deploymentHistory: [],
  isLoadingHistory: false,
  error: null,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useDeploymentStore = create<DeploymentStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ========================================================================
      // PLANNING
      // ========================================================================

      createPlan: async (config: DeploymentConfig) => {
        set({ isPlanning: true, error: null, currentPlan: null, validationResult: null });

        try {
          const plan = await invoke<DeploymentPlan>('create_deployment_plan', { config });
          set({ currentPlan: plan, isPlanning: false });
          return plan;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create deployment plan';
          set({ isPlanning: false, error: message });
          throw error;
        }
      },

      clearPlan: () => {
        set({
          currentPlan: null,
          validationResult: null,
          progress: null,
        });
      },

      // ========================================================================
      // VALIDATION
      // ========================================================================

      validatePlan: async (plan: DeploymentPlan) => {
        set({ isValidating: true, error: null });

        try {
          const result = await invoke<ValidationResult>('validate_deployment_plan', {
            planId: plan.id,
          });
          set({ validationResult: result, isValidating: false });
          return result;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Validation failed';
          set({ isValidating: false, error: message });
          throw error;
        }
      },

      clearValidation: () => {
        set({ validationResult: null });
      },

      // ========================================================================
      // EXECUTION
      // ========================================================================

      startDeployment: async (plan: DeploymentPlan) => {
        // Ensure plan is validated
        const state = get();
        if (!state.validationResult?.isValid) {
          throw new Error('Plan must be validated before deployment');
        }

        set({
          isDeploying: true,
          error: null,
          progress: {
            status: 'pending',
            phase: 'preparing',
            currentOperation: 'Initializing deployment...',
            filesCompleted: 0,
            filesTotal: plan.totalGames + plan.biosFiles.length,
            bytesCompleted: 0,
            bytesTotal: plan.totalSizeMB * 1024 * 1024,
            percentComplete: 0,
            startedAt: new Date().toISOString(),
            errors: [],
          },
        });

        try {
          // This starts the deployment - progress comes via events
          await invoke('start_deployment', { planId: plan.id });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Deployment failed to start';
          set({
            isDeploying: false,
            error: message,
            progress: null,
          });
          throw error;
        }
      },

      pauseDeployment: async () => {
        try {
          await invoke('pause_deployment');
          set((state) => {
            if (state.progress) {
              state.progress.status = 'paused';
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to pause deployment';
          set({ error: message });
          throw error;
        }
      },

      resumeDeployment: async () => {
        try {
          await invoke('resume_deployment');
          set((state) => {
            if (state.progress) {
              state.progress.status = 'running';
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to resume deployment';
          set({ error: message });
          throw error;
        }
      },

      cancelDeployment: async () => {
        try {
          await invoke('cancel_deployment');
          set((state) => {
            if (state.progress) {
              state.progress.status = 'cancelled';
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to cancel deployment';
          set({ error: message });
          throw error;
        }
      },

      // ========================================================================
      // EVENT HANDLERS
      // ========================================================================

      handleProgress: (progress: DeploymentProgress) => {
        set({ progress });
      },

      handleComplete: (result: DeploymentResult) => {
        set((state) => {
          state.isDeploying = false;
          if (state.progress) {
            state.progress.status = result.success ? 'completed' : 'failed';
            state.progress.percentComplete = 100;
          }

          // Add to history
          if (state.currentPlan) {
            const record: DeploymentRecord = {
              id: result.planId,
              deviceId: state.currentPlan.config.deviceId,
              profileId: state.currentPlan.config.profileId,
              result,
              config: state.currentPlan.config,
              timestamp: result.completedAt,
            };
            state.deploymentHistory.unshift(record);
          }
        });
      },

      handleError: (errorMessage: string) => {
        set((state) => {
          state.error = errorMessage;
          if (state.progress) {
            state.progress.status = 'failed';
            state.progress.errors.push({
              timestamp: new Date().toISOString(),
              phase: state.progress.phase,
              errorCode: 'DEPLOYMENT_ERROR',
              message: errorMessage,
              recoverable: false,
            });
          }
        });
      },

      // ========================================================================
      // HISTORY
      // ========================================================================

      fetchHistory: async (deviceId?: number) => {
        set({ isLoadingHistory: true });

        try {
          const history = await invoke<DeploymentRecord[]>('get_deployment_history', {
            deviceId,
            limit: 50,
          });
          set({ deploymentHistory: history, isLoadingHistory: false });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch history';
          set({ isLoadingHistory: false, error: message });
        }
      },

      clearHistory: async (olderThanDays?: number) => {
        try {
          await invoke('clear_deployment_history', { olderThanDays });
          
          if (olderThanDays) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
            
            set((state) => {
              state.deploymentHistory = state.deploymentHistory.filter(
                (r) => new Date(r.timestamp) > cutoffDate
              );
            });
          } else {
            set({ deploymentHistory: [] });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to clear history';
          set({ error: message });
          throw error;
        }
      },

      deleteHistoryRecord: async (id: string) => {
        try {
          await invoke('delete_deployment_record', { id });
          set((state) => {
            state.deploymentHistory = state.deploymentHistory.filter((r) => r.id !== id);
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete record';
          set({ error: message });
          throw error;
        }
      },

      // ========================================================================
      // UTILITIES
      // ========================================================================

      clearError: () => set({ error: null }),

      reset: () => set(initialState),
    }))
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Select deployment status */
export const selectDeploymentStatus = (state: DeploymentStore): DeploymentStatus => {
  if (!state.progress) return 'pending';
  return state.progress.status;
};

/** Select if deployment can be started */
export const selectCanStartDeployment = (state: DeploymentStore) => {
  return (
    state.currentPlan !== null &&
    state.validationResult?.isValid === true &&
    !state.isDeploying
  );
};

/** Select if deployment can be paused */
export const selectCanPauseDeployment = (state: DeploymentStore) => {
  return state.isDeploying && state.progress?.status === 'running';
};

/** Select if deployment can be resumed */
export const selectCanResumeDeployment = (state: DeploymentStore) => {
  return state.isDeploying && state.progress?.status === 'paused';
};

/** Select if deployment can be cancelled */
export const selectCanCancelDeployment = (state: DeploymentStore) => {
  return state.isDeploying && ['running', 'paused', 'pending'].includes(state.progress?.status ?? '');
};

/** Select overall progress percentage */
export const selectProgressPercent = (state: DeploymentStore) => {
  return state.progress?.percentComplete ?? 0;
};

/** Select estimated time remaining in seconds */
export const selectTimeRemaining = (state: DeploymentStore) => {
  return state.progress?.estimatedTimeRemaining ?? null;
};

/** Select current operation description */
export const selectCurrentOperation = (state: DeploymentStore) => {
  return state.progress?.currentOperation ?? '';
};

/** Select deployment errors */
export const selectDeploymentErrors = (state: DeploymentStore) => {
  return state.progress?.errors ?? [];
};

/** Select if there are recoverable errors */
export const selectHasRecoverableErrors = (state: DeploymentStore) => {
  return state.progress?.errors.some((e) => e.recoverable) ?? false;
};

/** Select validation errors */
export const selectValidationErrors = (state: DeploymentStore) => {
  return state.validationResult?.errors ?? [];
};

/** Select validation warnings */
export const selectValidationWarnings = (state: DeploymentStore) => {
  return state.validationResult?.warnings ?? [];
};

/** Select space requirements */
export const selectSpaceRequirements = (state: DeploymentStore) => {
  if (!state.validationResult) return null;
  return {
    required: state.validationResult.requiredSpaceMB,
    available: state.validationResult.availableSpaceMB,
    sufficient: state.validationResult.hasEnoughSpace,
  };
};

/** Select plan warnings */
export const selectPlanWarnings = (state: DeploymentStore) => {
  return state.currentPlan?.warnings ?? [];
};

/** Select history for a specific device */
export const selectHistoryForDevice = (deviceId: number) => (state: DeploymentStore) => {
  return state.deploymentHistory.filter((r) => r.deviceId === deviceId);
};

/** Select most recent deployment for a device */
export const selectLastDeploymentForDevice = (deviceId: number) => (state: DeploymentStore) => {
  return state.deploymentHistory.find((r) => r.deviceId === deviceId) ?? null;
};

/** Select games included in current plan */
export const selectPlannedGames = (state: DeploymentStore) => {
  return state.currentPlan?.games ?? [];
};

/** Select games with warnings in current plan */
export const selectGamesWithWarnings = (state: DeploymentStore) => {
  if (!state.currentPlan) return [];
  return state.currentPlan.games.filter((g) => g.warnings.length > 0);
};

/** Select BIOS files in current plan */
export const selectPlannedBios = (state: DeploymentStore) => {
  return state.currentPlan?.biosFiles ?? [];
};

/** Select conversion progress */
export const selectConversionProgress = (state: DeploymentStore) => {
  return state.progress?.conversionProgress ?? null;
};

export default useDeploymentStore;
