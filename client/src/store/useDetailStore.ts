import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DetailState {
    // Page states keyed by account ID (to support multiple tabs/accounts)
    expandedSections: Record<string, string | null>;
    showAllContacts: Record<string, boolean>;

    // Actions
    setExpandedSection: (accountId: string, section: string | null) => void;
    setShowAllContacts: (accountId: string, show: boolean) => void;

    // Helper to get state for a specific account
    getExpandedSection: (accountId: string) => string | null;
    getShowAllContacts: (accountId: string) => boolean;
}

export const useDetailStore = create<DetailState>()(
    persist(
        (set, get) => ({
            expandedSections: {},
            showAllContacts: {},

            setExpandedSection: (accountId, section) =>
                set((state) => ({
                    expandedSections: { ...state.expandedSections, [accountId]: section }
                })),

            setShowAllContacts: (accountId, show) =>
                set((state) => ({
                    showAllContacts: { ...state.showAllContacts, [accountId]: show }
                })),

            getExpandedSection: (accountId) => get().expandedSections[accountId] || null,
            getShowAllContacts: (accountId) => get().showAllContacts[accountId] || false,
        }),
        {
            name: 'detail-state-storage',
        }
    )
);
