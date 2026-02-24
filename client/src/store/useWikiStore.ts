import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WikiState {
    // Current active search context
    activeSearchQuery: string | null;
    searchQuery: string;
    pendingSearchQuery: string;

    // UI presentation states for search & navigation
    isSearchMode: boolean;
    showSearchResults: boolean;

    // Current selected product tab (e.g. 'A', 'B', 'C', 'D' or null for search)
    selectedProductLine: string | null;

    // Actions to update state
    setActiveSearchQuery: (query: string | null) => void;
    setSearchQuery: (query: string) => void;
    setPendingSearchQuery: (query: string) => void;
    setIsSearchMode: (mode: boolean) => void;
    setShowSearchResults: (show: boolean) => void;
    setSelectedProductLine: (line: string | null) => void;
}

export const useWikiStore = create<WikiState>()(
    persist(
        (set) => ({
            activeSearchQuery: null,
            searchQuery: '',
            pendingSearchQuery: '',

            isSearchMode: false,
            showSearchResults: false,

            selectedProductLine: 'A', // Default open tab

            setActiveSearchQuery: (query) => set({ activeSearchQuery: query }),
            setSearchQuery: (query) => set({ searchQuery: query }),
            setPendingSearchQuery: (query) => set({ pendingSearchQuery: query }),
            setIsSearchMode: (mode) => set({ isSearchMode: mode }),
            setShowSearchResults: (show) => set({ showSearchResults: show }),
            setSelectedProductLine: (line) => set({ selectedProductLine: line }),
        }),
        {
            name: 'wiki-state-storage',
        }
    )
);
