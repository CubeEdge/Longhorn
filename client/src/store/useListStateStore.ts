/**
 * List State Store
 * 
 * Persists list page view preferences (view mode, collapsed sections, filters) for ticket lists.
 * This ensures users return to the same view state when navigating back from detail pages.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'grouped' | 'flat';

// Filter params interface
interface FilterParams {
    time_scope: string;
    product_family: string;
    status: string;
    keyword: string;
}

interface ListState {
    // View mode for each list type
    inquiryViewMode: ViewMode;
    rmaViewMode: ViewMode;
    dealerViewMode: ViewMode;

    // Collapsed section states (status -> boolean)
    inquiryCollapsedSections: Record<string, boolean>;
    rmaCollapsedSections: Record<string, boolean>;
    dealerCollapsedSections: Record<string, boolean>;

    // Scroll positions
    inquiryScrollPosition: number;
    rmaScrollPosition: number;
    dealerScrollPosition: number;

    // Filter params for each list type (preserved when navigating to detail)
    inquiryFilters: FilterParams;
    rmaFilters: FilterParams;
    dealerFilters: FilterParams;

    // Actions
    setInquiryViewMode: (mode: ViewMode) => void;
    setRmaViewMode: (mode: ViewMode) => void;
    setDealerViewMode: (mode: ViewMode) => void;

    setInquirySectionCollapsed: (status: string, collapsed: boolean) => void;
    setRmaSectionCollapsed: (status: string, collapsed: boolean) => void;
    setDealerSectionCollapsed: (status: string, collapsed: boolean) => void;

    setInquiryScrollPosition: (position: number) => void;
    setRmaScrollPosition: (position: number) => void;
    setDealerScrollPosition: (position: number) => void;

    // Filter actions
    setInquiryFilters: (filters: Partial<FilterParams>) => void;
    setRmaFilters: (filters: Partial<FilterParams>) => void;
    setDealerFilters: (filters: Partial<FilterParams>) => void;

    // Getters for collapsed state (returns true if section should be collapsed)
    isInquirySectionCollapsed: (status: string, defaultOpen: boolean) => boolean;
    isRmaSectionCollapsed: (status: string, defaultOpen: boolean) => boolean;
    isDealerSectionCollapsed: (status: string, defaultOpen: boolean) => boolean;
}

export const useListStateStore = create<ListState>()(
    persist(
        (set, get) => ({
            // Default view modes
            inquiryViewMode: 'grouped',
            rmaViewMode: 'grouped',
            dealerViewMode: 'grouped',

            // Default: no sections collapsed (all expanded)
            inquiryCollapsedSections: {},
            rmaCollapsedSections: {},
            dealerCollapsedSections: {},

            // Default scroll positions
            inquiryScrollPosition: 0,
            rmaScrollPosition: 0,
            dealerScrollPosition: 0,

            // Default filter params
            inquiryFilters: { time_scope: '7d', product_family: 'all', status: 'all', keyword: '' },
            rmaFilters: { time_scope: '7d', product_family: 'all', status: 'all', keyword: '' },
            dealerFilters: { time_scope: '7d', product_family: 'all', status: 'all', keyword: '' },

            setInquiryViewMode: (mode) => set({ inquiryViewMode: mode }),
            setRmaViewMode: (mode) => set({ rmaViewMode: mode }),
            setDealerViewMode: (mode) => set({ dealerViewMode: mode }),

            setInquirySectionCollapsed: (status, collapsed) =>
                set((state) => ({
                    inquiryCollapsedSections: {
                        ...state.inquiryCollapsedSections,
                        [status]: collapsed
                    }
                })),

            setRmaSectionCollapsed: (status, collapsed) =>
                set((state) => ({
                    rmaCollapsedSections: {
                        ...state.rmaCollapsedSections,
                        [status]: collapsed
                    }
                })),

            setDealerSectionCollapsed: (status, collapsed) =>
                set((state) => ({
                    dealerCollapsedSections: {
                        ...state.dealerCollapsedSections,
                        [status]: collapsed
                    }
                })),

            setInquiryScrollPosition: (position) => set({ inquiryScrollPosition: position }),
            setRmaScrollPosition: (position) => set({ rmaScrollPosition: position }),
            setDealerScrollPosition: (position) => set({ dealerScrollPosition: position }),

            // Filter setters
            setInquiryFilters: (filters) =>
                set((state) => ({
                    inquiryFilters: { ...state.inquiryFilters, ...filters }
                })),
            setRmaFilters: (filters) =>
                set((state) => ({
                    rmaFilters: { ...state.rmaFilters, ...filters }
                })),
            setDealerFilters: (filters) =>
                set((state) => ({
                    dealerFilters: { ...state.dealerFilters, ...filters }
                })),

            isInquirySectionCollapsed: (status, defaultOpen) => {
                const saved = get().inquiryCollapsedSections[status];
                // If saved state exists, use it; otherwise use default
                return saved !== undefined ? saved : !defaultOpen;
            },

            isRmaSectionCollapsed: (status, defaultOpen) => {
                const saved = get().rmaCollapsedSections[status];
                return saved !== undefined ? saved : !defaultOpen;
            },

            isDealerSectionCollapsed: (status, defaultOpen) => {
                const saved = get().dealerCollapsedSections[status];
                return saved !== undefined ? saved : !defaultOpen;
            }
        }),
        {
            name: 'ticket-list-state-storage',
        }
    )
);
