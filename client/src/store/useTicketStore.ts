import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TicketType = 'Inquiry' | 'RMA' | 'DealerRepair';

interface TicketDraft {
    customer_name?: string;
    customer_contact?: string;
    product_id?: number | string;
    serial_number?: string;
    problem_summary?: string;
    problem_description?: string;
    service_type?: string;
    channel?: string;
    dealer_id?: number | string;
    issue_category?: string;
    issue_subcategory?: string;
    parts_used?: any[];
    [key: string]: any;
}

interface TicketStore {
    isOpen: boolean;
    ticketType: TicketType;
    drafts: Record<TicketType, TicketDraft>;

    // Actions
    openModal: (type: TicketType) => void;
    closeModal: () => void;
    updateDraft: (type: TicketType, data: Partial<TicketDraft>) => void;
    clearDraft: (type: TicketType) => void;
}

const initialDrafts: Record<TicketType, TicketDraft> = {
    Inquiry: {},
    RMA: {},
    DealerRepair: {}
};

export const useTicketStore = create<TicketStore>()(
    persist(
        (set) => ({
            isOpen: false,
            ticketType: 'Inquiry',
            drafts: initialDrafts,

            openModal: (type) => set({ isOpen: true, ticketType: type }),
            closeModal: () => set({ isOpen: false }),
            updateDraft: (type, data) => set((state) => ({
                drafts: {
                    ...state.drafts,
                    [type]: { ...state.drafts[type], ...data }
                }
            })),
            clearDraft: (type) => set((state) => ({
                drafts: {
                    ...state.drafts,
                    [type]: {}
                }
            }))
        }),
        {
            name: 'longhorn-ticket-drafts',
            partialize: (state) => ({ drafts: state.drafts }),
        }
    )
);
