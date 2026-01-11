import { create } from 'zustand';

interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    resolve: ((value: boolean) => void) | null;
    confirm: (message: string, title?: string, confirmLabel?: string, cancelLabel?: string) => Promise<boolean>;
    close: (value: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
    isOpen: false,
    title: '',
    message: '',
    resolve: null,
    confirm: (message, title = '', confirmLabel, cancelLabel) => {
        return new Promise((resolve) => {
            set({
                isOpen: true,
                message,
                title,
                confirmLabel,
                cancelLabel,
                resolve
            });
        });
    },
    close: (value) => {
        const { resolve } = get();
        if (resolve) resolve(value);
        set({ isOpen: false, resolve: null, message: '', title: '' });
    },
}));
