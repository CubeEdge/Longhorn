import { create } from 'zustand';

interface ContextLabel {
    text: string;
    color: string;
    pulsing?: boolean;
}

interface UIState {
    contextLabel: ContextLabel | null;
    setContextLabel: (label: ContextLabel | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
    contextLabel: null,
    setContextLabel: (label) => set({ contextLabel: label }),
}));
