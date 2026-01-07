/**
 * ROM Runner - Library Store
 * @version 1.0.0
 * @description Zustand store slice for ROM library management
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { invoke } from '@tauri-apps/api/core';

import type {
  Game,
  Collection,
  GameFilters,
  SortField,
  ScanProgress,
  PaginatedResult,
  GetGamesPayload,
  ScanDirectoryPayload,
} from './types_v1_0_0';

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface LibraryState {
  // Data
  games: Game[];
  collections: Collection[];
  
  // Loading states
  isLoading: boolean;
  isSyncing: boolean;
  scanProgress: ScanProgress | null;
  
  // Filters & search
  activeFilters: GameFilters;
  searchQuery: string;
  sortBy: SortField;
  sortOrder: 'asc' | 'desc';
  
  // Selection
  selectedGameIds: Set<number>;
  
  // Pagination
  currentPage: number;
  pageSize: number;
  totalGames: number;
  
  // Error state
  error: string | null;
}

export interface LibraryActions {
  // Data fetching
  fetchGames: () => Promise<void>;
  fetchCollections: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  
  // Scanning
  scanDirectory: (path: string, recursive: boolean) => Promise<void>;
  cancelScan: () => void;
  handleScanProgress: (progress: ScanProgress) => void;
  
  // Filters
  setFilters: (filters: Partial<GameFilters>) => void;
  clearFilters: () => void;
  setSearch: (query: string) => void;
  setSort: (field: SortField, order?: 'asc' | 'desc') => void;
  
  // Selection
  selectGame: (id: number) => void;
  deselectGame: (id: number) => void;
  toggleGameSelection: (id: number) => void;
  selectAll: () => void;
  deselectAll: () => void;
  selectByFilter: (filter: Partial<GameFilters>) => void;
  
  // Pagination
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  
  // Game operations
  updateGame: (id: number, updates: Partial<Game>) => Promise<void>;
  deleteGames: (ids: number[]) => Promise<void>;
  toggleFavorite: (id: number) => Promise<void>;
  
  // Collection management
  createCollection: (name: string, gameIds?: number[]) => Promise<Collection>;
  updateCollection: (id: number, updates: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;
  addToCollection: (collectionId: number, gameIds: number[]) => Promise<void>;
  removeFromCollection: (collectionId: number, gameIds: number[]) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

export type LibraryStore = LibraryState & LibraryActions;

// ============================================================================
// DEFAULT STATE
// ============================================================================

const DEFAULT_FILTERS: GameFilters = {
  platforms: [],
  regions: [],
  genres: [],
  favorites: null,
  romHacks: null,
  fanTranslations: null,
  verified: null,
  collectionId: null,
};

const initialState: LibraryState = {
  games: [],
  collections: [],
  isLoading: false,
  isSyncing: false,
  scanProgress: null,
  activeFilters: DEFAULT_FILTERS,
  searchQuery: '',
  sortBy: 'title',
  sortOrder: 'asc',
  selectedGameIds: new Set(),
  currentPage: 1,
  pageSize: 50,
  totalGames: 0,
  error: null,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useLibraryStore = create<LibraryStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      // ========================================================================
      // DATA FETCHING
      // ========================================================================

      fetchGames: async () => {
        const state = get();
        set({ isLoading: true, error: null });

        try {
          const payload: GetGamesPayload = {
            filters: state.activeFilters,
            search: state.searchQuery || undefined,
            sortBy: state.sortBy,
            sortOrder: state.sortOrder,
            page: state.currentPage,
            pageSize: state.pageSize,
          };

          const result = await invoke<PaginatedResult<Game>>('get_games', { payload });

          set({
            games: result.items,
            totalGames: result.total,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch games';
          set({ isLoading: false, error: message });
          // Note: Error notifications handled by UI layer via subscription
        }
      },

      fetchCollections: async () => {
        try {
          const collections = await invoke<Collection[]>('get_collections');
          set({ collections });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to fetch collections';
          set({ error: message });
        }
      },

      refreshLibrary: async () => {
        set({ isSyncing: true });
        try {
          await get().fetchGames();
          await get().fetchCollections();
        } finally {
          set({ isSyncing: false });
        }
      },

      // ========================================================================
      // SCANNING
      // ========================================================================

      scanDirectory: async (path: string, recursive: boolean) => {
        set({
          scanProgress: {
            status: 'scanning',
            currentPath: path,
            filesScanned: 0,
            filesTotal: 0,
            gamesFound: 0,
            gamesImported: 0,
            duplicatesSkipped: 0,
            errorsCount: 0,
          },
          error: null,
        });

        try {
          const payload: ScanDirectoryPayload = { path, recursive };
          await invoke('scan_directory', { payload });
          // Progress updates come via Tauri events -> handleScanProgress
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Scan failed';
          set((state) => {
            if (state.scanProgress) {
              state.scanProgress.status = 'error';
            }
            state.error = message;
          });
        }
      },

      cancelScan: () => {
        invoke('cancel_scan').catch(console.error);
        set((state) => {
          if (state.scanProgress) {
            state.scanProgress.status = 'cancelled';
          }
        });
      },

      handleScanProgress: (progress: ScanProgress) => {
        set({ scanProgress: progress });

        // Auto-refresh library when scan completes
        if (progress.status === 'complete') {
          get().refreshLibrary();
        }
      },

      // ========================================================================
      // FILTERS
      // ========================================================================

      setFilters: (filters: Partial<GameFilters>) => {
        set((state) => {
          state.activeFilters = { ...state.activeFilters, ...filters };
          state.currentPage = 1; // Reset to first page on filter change
        });
        get().fetchGames();
      },

      clearFilters: () => {
        set({
          activeFilters: DEFAULT_FILTERS,
          searchQuery: '',
          currentPage: 1,
        });
        get().fetchGames();
      },

      setSearch: (query: string) => {
        set({ searchQuery: query, currentPage: 1 });
        // Debounce handled by UI layer
        get().fetchGames();
      },

      setSort: (field: SortField, order?: 'asc' | 'desc') => {
        set((state) => {
          // Toggle order if same field, otherwise use provided or default to 'asc'
          if (state.sortBy === field && !order) {
            state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
          } else {
            state.sortBy = field;
            state.sortOrder = order ?? 'asc';
          }
        });
        get().fetchGames();
      },

      // ========================================================================
      // SELECTION
      // ========================================================================

      selectGame: (id: number) => {
        set((state) => {
          state.selectedGameIds.add(id);
        });
      },

      deselectGame: (id: number) => {
        set((state) => {
          state.selectedGameIds.delete(id);
        });
      },

      toggleGameSelection: (id: number) => {
        set((state) => {
          if (state.selectedGameIds.has(id)) {
            state.selectedGameIds.delete(id);
          } else {
            state.selectedGameIds.add(id);
          }
        });
      },

      selectAll: () => {
        set((state) => {
          state.selectedGameIds = new Set(state.games.map((g) => g.id));
        });
      },

      deselectAll: () => {
        set({ selectedGameIds: new Set() });
      },

      selectByFilter: async (filter: Partial<GameFilters>) => {
        try {
          // Get all game IDs matching filter (without pagination)
          const result = await invoke<PaginatedResult<Game>>('get_games', {
            payload: {
              filters: { ...get().activeFilters, ...filter },
              pageSize: 10000, // Get all matching
              page: 1,
            },
          });
          set({ selectedGameIds: new Set(result.items.map((g) => g.id)) });
        } catch (error) {
          console.error('Failed to select by filter:', error);
        }
      },

      // ========================================================================
      // PAGINATION
      // ========================================================================

      setPage: (page: number) => {
        set({ currentPage: page });
        get().fetchGames();
      },

      setPageSize: (size: number) => {
        set({ pageSize: size, currentPage: 1 });
        get().fetchGames();
      },

      // ========================================================================
      // GAME OPERATIONS
      // ========================================================================

      updateGame: async (id: number, updates: Partial<Game>) => {
        try {
          await invoke('update_game', { id, updates });
          set((state) => {
            const index = state.games.findIndex((g) => g.id === id);
            if (index !== -1) {
              state.games[index] = { ...state.games[index], ...updates };
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update game';
          set({ error: message });
          throw error;
        }
      },

      deleteGames: async (ids: number[]) => {
        try {
          await invoke('delete_games', { ids });
          set((state) => {
            state.games = state.games.filter((g) => !ids.includes(g.id));
            ids.forEach((id) => state.selectedGameIds.delete(id));
            state.totalGames -= ids.length;
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete games';
          set({ error: message });
          throw error;
        }
      },

      toggleFavorite: async (id: number) => {
        const game = get().games.find((g) => g.id === id);
        if (!game) return;

        try {
          await get().updateGame(id, { favorite: !game.favorite });
        } catch {
          // Error already set by updateGame
        }
      },

      // ========================================================================
      // COLLECTION MANAGEMENT
      // ========================================================================

      createCollection: async (name: string, gameIds?: number[]) => {
        try {
          const collection = await invoke<Collection>('create_collection', {
            name,
            gameIds: gameIds ?? [],
          });
          set((state) => {
            state.collections.push(collection);
          });
          return collection;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create collection';
          set({ error: message });
          throw error;
        }
      },

      updateCollection: async (id: number, updates: Partial<Collection>) => {
        try {
          await invoke('update_collection', { id, updates });
          set((state) => {
            const index = state.collections.findIndex((c) => c.id === id);
            if (index !== -1) {
              state.collections[index] = { ...state.collections[index], ...updates };
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to update collection';
          set({ error: message });
          throw error;
        }
      },

      deleteCollection: async (id: number) => {
        try {
          await invoke('delete_collection', { id });
          set((state) => {
            state.collections = state.collections.filter((c) => c.id !== id);
            // Clear filter if deleted collection was active
            if (state.activeFilters.collectionId === id) {
              state.activeFilters.collectionId = null;
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to delete collection';
          set({ error: message });
          throw error;
        }
      },

      addToCollection: async (collectionId: number, gameIds: number[]) => {
        try {
          await invoke('add_to_collection', { collectionId, gameIds });
          set((state) => {
            const collection = state.collections.find((c) => c.id === collectionId);
            if (collection) {
              const existingIds = new Set(collection.gameIds);
              gameIds.forEach((id) => existingIds.add(id));
              collection.gameIds = Array.from(existingIds);
            }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to add to collection';
          set({ error: message });
          throw error;
        }
      },

      removeFromCollection: async (collectionId: number, gameIds: number[]) => {
        try {
          await invoke('remove_from_collection', { collectionId, gameIds });
          set((state) => {
            const collection = state.collections.find((c) => c.id === collectionId);
            if (collection) {
              const idsToRemove = new Set(gameIds);
              collection.gameIds = collection.gameIds.filter((id) => !idsToRemove.has(id));
            }
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to remove from collection';
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

/** Select games with pagination info */
export const selectPaginatedGames = (state: LibraryStore) => ({
  games: state.games,
  total: state.totalGames,
  page: state.currentPage,
  pageSize: state.pageSize,
  totalPages: Math.ceil(state.totalGames / state.pageSize),
});

/** Select currently selected games */
export const selectSelectedGames = (state: LibraryStore) =>
  state.games.filter((g) => state.selectedGameIds.has(g.id));

/** Select selection count */
export const selectSelectionCount = (state: LibraryStore) => state.selectedGameIds.size;

/** Check if a game is selected */
export const selectIsGameSelected = (id: number) => (state: LibraryStore) =>
  state.selectedGameIds.has(id);

/** Select games grouped by platform */
export const selectGamesByPlatform = (state: LibraryStore) => {
  const grouped = new Map<string, Game[]>();
  for (const game of state.games) {
    const existing = grouped.get(game.platformId) ?? [];
    existing.push(game);
    grouped.set(game.platformId, existing);
  }
  return grouped;
};

/** Select unique platforms in current results */
export const selectUniquePlatforms = (state: LibraryStore) =>
  [...new Set(state.games.map((g) => g.platformId))];

/** Select if any filters are active */
export const selectHasActiveFilters = (state: LibraryStore) => {
  const f = state.activeFilters;
  return (
    f.platforms.length > 0 ||
    f.regions.length > 0 ||
    f.genres.length > 0 ||
    f.favorites !== null ||
    f.romHacks !== null ||
    f.fanTranslations !== null ||
    f.verified !== null ||
    f.collectionId !== null ||
    state.searchQuery.length > 0
  );
};

/** Select scan progress percentage */
export const selectScanPercentage = (state: LibraryStore) => {
  if (!state.scanProgress || state.scanProgress.filesTotal === 0) return 0;
  return Math.round((state.scanProgress.filesScanned / state.scanProgress.filesTotal) * 100);
};

/** Select collection by ID */
export const selectCollectionById = (id: number) => (state: LibraryStore) =>
  state.collections.find((c) => c.id === id);

export default useLibraryStore;
