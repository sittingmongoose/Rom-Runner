/**
 * ROM Runner - UI Store
 * @version 1.0.0
 * @description Zustand store slice for UI state management
 */

import { create } from 'zustand';
import { subscribeWithSelector, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';

import type { ViewType, ModalType, Notification, NotificationAction } from './types_v1_0_0';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface UIState {
  // Navigation
  currentView: ViewType;
  viewHistory: ViewType[];
  sidebarCollapsed: boolean;
  
  // Modals
  activeModal: ModalType | null;
  modalData: unknown;
  modalStack: Array<{ type: ModalType; data: unknown }>;
  
  // Toasts/notifications
  notifications: Notification[];
  
  // Panels
  detailsPanelOpen: boolean;
  detailsPanelGameId: number | null;
  
  // Context menu
  contextMenuOpen: boolean;
  contextMenuPosition: { x: number; y: number };
  contextMenuData: unknown;
  
  // Loading overlays
  globalLoading: boolean;
  globalLoadingMessage: string | null;
  
  // View params (for detail views)
  viewParams: Record<string, unknown>;
}

export interface UIActions {
  // Navigation
  navigate: (view: ViewType, params?: Record<string, unknown>) => void;
  navigateBack: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  
  // Modals
  openModal: (modal: ModalType, data?: unknown) => void;
  closeModal: () => void;
  pushModal: (modal: ModalType, data?: unknown) => void;
  popModal: () => void;
  updateModalData: (data: unknown) => void;
  
  // Notifications
  showNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  dismissNotification: (id: string) => void;
  dismissAllNotifications: () => void;
  
  // Convenience notification methods
  showSuccess: (title: string, message?: string) => string;
  showError: (title: string, message?: string) => string;
  showWarning: (title: string, message?: string) => string;
  showInfo: (title: string, message?: string) => string;
  
  // Panels
  openDetailsPanel: (gameId: number) => void;
  closeDetailsPanel: () => void;
  toggleDetailsPanel: () => void;
  
  // Context menu
  openContextMenu: (x: number, y: number, data: unknown) => void;
  closeContextMenu: () => void;
  
  // Loading overlay
  showGlobalLoading: (message?: string) => void;
  hideGlobalLoading: () => void;
  
  // Utilities
  reset: () => void;
}

export type UIStore = UIState & UIActions;

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_NOTIFICATION_DURATION = 5000;
const MAX_NOTIFICATIONS = 5;
const MAX_VIEW_HISTORY = 10;

// ============================================================================
// DEFAULT STATE
// ============================================================================

const initialState: UIState = {
  currentView: 'library',
  viewHistory: [],
  sidebarCollapsed: false,
  activeModal: null,
  modalData: null,
  modalStack: [],
  notifications: [],
  detailsPanelOpen: false,
  detailsPanelGameId: null,
  contextMenuOpen: false,
  contextMenuPosition: { x: 0, y: 0 },
  contextMenuData: null,
  globalLoading: false,
  globalLoadingMessage: null,
  viewParams: {},
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useUIStore = create<UIStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ========================================================================
        // NAVIGATION
        // ========================================================================

        navigate: (view: ViewType, params?: Record<string, unknown>) => {
          set((state) => {
            // Add current view to history (avoid duplicates)
            if (state.currentView !== view) {
              state.viewHistory.push(state.currentView);
              // Keep history limited
              if (state.viewHistory.length > MAX_VIEW_HISTORY) {
                state.viewHistory.shift();
              }
            }
            
            state.currentView = view;
            state.viewParams = params ?? {};
            
            // Close details panel on navigation
            state.detailsPanelOpen = false;
            state.detailsPanelGameId = null;
          });
        },

        navigateBack: () => {
          set((state) => {
            const previousView = state.viewHistory.pop();
            if (previousView) {
              state.currentView = previousView;
              state.viewParams = {};
            }
          });
        },

        toggleSidebar: () => {
          set((state) => {
            state.sidebarCollapsed = !state.sidebarCollapsed;
          });
        },

        setSidebarCollapsed: (collapsed: boolean) => {
          set({ sidebarCollapsed: collapsed });
        },

        // ========================================================================
        // MODALS
        // ========================================================================

        openModal: (modal: ModalType, data?: unknown) => {
          set({
            activeModal: modal,
            modalData: data ?? null,
            modalStack: [],
          });
        },

        closeModal: () => {
          set({
            activeModal: null,
            modalData: null,
            modalStack: [],
          });
        },

        pushModal: (modal: ModalType, data?: unknown) => {
          set((state) => {
            // Save current modal to stack
            if (state.activeModal) {
              state.modalStack.push({
                type: state.activeModal,
                data: state.modalData,
              });
            }
            state.activeModal = modal;
            state.modalData = data ?? null;
          });
        },

        popModal: () => {
          set((state) => {
            const previous = state.modalStack.pop();
            if (previous) {
              state.activeModal = previous.type;
              state.modalData = previous.data;
            } else {
              state.activeModal = null;
              state.modalData = null;
            }
          });
        },

        updateModalData: (data: unknown) => {
          set({ modalData: data });
        },

        // ========================================================================
        // NOTIFICATIONS
        // ========================================================================

        showNotification: (notification) => {
          const id = nanoid();
          const fullNotification: Notification = {
            ...notification,
            id,
            timestamp: new Date().toISOString(),
            duration: notification.duration ?? DEFAULT_NOTIFICATION_DURATION,
          };

          set((state) => {
            // Add to front
            state.notifications.unshift(fullNotification);
            
            // Limit notifications
            if (state.notifications.length > MAX_NOTIFICATIONS) {
              state.notifications = state.notifications.slice(0, MAX_NOTIFICATIONS);
            }
          });

          // Auto-dismiss if not persistent
          if (!notification.persistent && fullNotification.duration) {
            setTimeout(() => {
              get().dismissNotification(id);
            }, fullNotification.duration);
          }

          return id;
        },

        dismissNotification: (id: string) => {
          set((state) => {
            state.notifications = state.notifications.filter((n) => n.id !== id);
          });
        },

        dismissAllNotifications: () => {
          set({ notifications: [] });
        },

        // Convenience methods
        showSuccess: (title: string, message?: string) => {
          return get().showNotification({
            type: 'success',
            title,
            message: message ?? '',
          });
        },

        showError: (title: string, message?: string) => {
          return get().showNotification({
            type: 'error',
            title,
            message: message ?? '',
            persistent: true, // Errors stay until dismissed
          });
        },

        showWarning: (title: string, message?: string) => {
          return get().showNotification({
            type: 'warning',
            title,
            message: message ?? '',
            duration: 8000, // Warnings stay a bit longer
          });
        },

        showInfo: (title: string, message?: string) => {
          return get().showNotification({
            type: 'info',
            title,
            message: message ?? '',
          });
        },

        // ========================================================================
        // PANELS
        // ========================================================================

        openDetailsPanel: (gameId: number) => {
          set({
            detailsPanelOpen: true,
            detailsPanelGameId: gameId,
          });
        },

        closeDetailsPanel: () => {
          set({
            detailsPanelOpen: false,
            detailsPanelGameId: null,
          });
        },

        toggleDetailsPanel: () => {
          set((state) => {
            state.detailsPanelOpen = !state.detailsPanelOpen;
            if (!state.detailsPanelOpen) {
              state.detailsPanelGameId = null;
            }
          });
        },

        // ========================================================================
        // CONTEXT MENU
        // ========================================================================

        openContextMenu: (x: number, y: number, data: unknown) => {
          set({
            contextMenuOpen: true,
            contextMenuPosition: { x, y },
            contextMenuData: data,
          });
        },

        closeContextMenu: () => {
          set({
            contextMenuOpen: false,
            contextMenuData: null,
          });
        },

        // ========================================================================
        // LOADING OVERLAY
        // ========================================================================

        showGlobalLoading: (message?: string) => {
          set({
            globalLoading: true,
            globalLoadingMessage: message ?? null,
          });
        },

        hideGlobalLoading: () => {
          set({
            globalLoading: false,
            globalLoadingMessage: null,
          });
        },

        // ========================================================================
        // UTILITIES
        // ========================================================================

        reset: () => set(initialState),
      })),
      {
        name: 'rom-runner-ui',
        // Only persist navigation and sidebar state
        partialize: (state) => ({
          currentView: state.currentView,
          sidebarCollapsed: state.sidebarCollapsed,
        }),
      }
    )
  )
);

// ============================================================================
// SELECTORS
// ============================================================================

/** Select if a modal is open */
export const selectIsModalOpen = (state: UIStore) => state.activeModal !== null;

/** Select if a specific modal is open */
export const selectIsSpecificModalOpen = (modal: ModalType) => (state: UIStore) =>
  state.activeModal === modal;

/** Select modal data typed */
export const selectModalData = <T>() => (state: UIStore) => state.modalData as T | null;

/** Select if there are stacked modals */
export const selectHasStackedModals = (state: UIStore) => state.modalStack.length > 0;

/** Select notification count */
export const selectNotificationCount = (state: UIStore) => state.notifications.length;

/** Select if there are error notifications */
export const selectHasErrorNotifications = (state: UIStore) =>
  state.notifications.some((n) => n.type === 'error');

/** Select error notifications */
export const selectErrorNotifications = (state: UIStore) =>
  state.notifications.filter((n) => n.type === 'error');

/** Select if can navigate back */
export const selectCanNavigateBack = (state: UIStore) => state.viewHistory.length > 0;

/** Select view params */
export const selectViewParam = <T>(key: string) => (state: UIStore) =>
  state.viewParams[key] as T | undefined;

/** Select if details panel is open for a specific game */
export const selectIsDetailsPanelOpenForGame = (gameId: number) => (state: UIStore) =>
  state.detailsPanelOpen && state.detailsPanelGameId === gameId;

/** Select context menu state */
export const selectContextMenu = (state: UIStore) => ({
  isOpen: state.contextMenuOpen,
  position: state.contextMenuPosition,
  data: state.contextMenuData,
});

/** Select if global loading is shown */
export const selectIsGlobalLoading = (state: UIStore) => state.globalLoading;

/** Select current view with params */
export const selectCurrentViewWithParams = (state: UIStore) => ({
  view: state.currentView,
  params: state.viewParams,
});

export default useUIStore;
