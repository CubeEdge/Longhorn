import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationDuration = 5 | 15 | 0; // 0 means 'until clicked' (infinite)

interface UserSettingsState {
    showDailyWord: boolean;
    notificationDuration: NotificationDuration;
    setShowDailyWord: (show: boolean) => void;
    setNotificationDuration: (duration: NotificationDuration) => void;
}

export const useUserSettingsStore = create<UserSettingsState>()(
    persist(
        (set) => ({
            showDailyWord: false, // Default off as per existing desc
            notificationDuration: 0, // Default to 'until clicked' as per user request

            setShowDailyWord: (show: boolean) => set({ showDailyWord: show }),
            setNotificationDuration: (duration: NotificationDuration) => set({ notificationDuration: duration }),
        }),
        {
            name: 'longhorn-user-settings',
        }
    )
);
