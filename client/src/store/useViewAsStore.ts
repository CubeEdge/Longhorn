import { create } from 'zustand';

interface ViewAsState {
    isSelectorOpen: boolean;
    setSelectorOpen: (open: boolean) => void;
}

export const useViewAsStore = create<ViewAsState>((set) => ({
    isSelectorOpen: false,
    setSelectorOpen: (open) => set({ isSelectorOpen: open }),
}));
