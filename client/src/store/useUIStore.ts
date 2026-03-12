import { create } from 'zustand';

interface ContextLabel {
    text: string;
    color: string;
    pulsing?: boolean;
}

interface UIState {
    contextLabel: ContextLabel | null;
    setContextLabel: (label: ContextLabel | null) => void;
    // 用于触发 WorkspacePage 清除选中的工单
    workspaceClearTrigger: number;
    triggerWorkspaceClear: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    contextLabel: null,
    setContextLabel: (label) => set({ contextLabel: label }),
    workspaceClearTrigger: 0,
    triggerWorkspaceClear: () => set((state) => ({ workspaceClearTrigger: state.workspaceClearTrigger + 1 })),
}));
