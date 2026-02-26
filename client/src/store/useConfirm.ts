import { create } from 'zustand';

interface ConfirmState {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    countdownSeconds?: number;
    resolve: ((value: boolean) => void) | null;
    confirm: (message: string, title?: string, confirmLabel?: string, cancelLabel?: string, countdownSeconds?: number) => Promise<boolean>;
    close: (value: boolean) => void;
}

export const useConfirm = create<ConfirmState>((set, get) => ({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: undefined,
    cancelLabel: undefined,
    countdownSeconds: 0,
    resolve: null,
    confirm: (message, title = '', confirmLabel, cancelLabel, countdownSeconds = 0) => {
        return new Promise((resolve) => {
            set({
                isOpen: true,
                message,
                title,
                confirmLabel,
                cancelLabel,
                countdownSeconds,
                resolve
            });
        });
    },
    close: (value) => {
        const { resolve } = get();
        if (resolve) resolve(value);
        set({ isOpen: false, resolve: null, message: '', title: '', countdownSeconds: 0 });
    },
}));
