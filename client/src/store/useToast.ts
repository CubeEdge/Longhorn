import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastStore {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType) => void;
    hideToast: (id: string) => void;
}

export const useToast = create<ToastStore>((set) => ({
    toasts: [],

    showToast: (message: string, type: ToastType = 'info') => {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        set((state) => ({
            toasts: [...state.toasts, { id, message, type }]
        }));

        // 自动移除 (2.5秒)
        setTimeout(() => {
            set((state) => ({
                toasts: state.toasts.filter((t) => t.id !== id)
            }));
        }, 2500);
    },

    hideToast: (id: string) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }));
    }
}));
