/**
 * Notification Store (通知状态管理)
 * P2 架构升级 - 通知中心
 */
import { create } from 'zustand';

export interface Notification {
  id: number;
  type: string;
  title: string;
  content: string | null;
  icon: string;
  related_type: string | null;
  related_id: number | null;
  action_url: string | null;
  metadata: Record<string, any> | null;
  is_read: boolean;
  read_at: string | null;
  is_archived: boolean;
  created_at: string;
}

interface NotificationStore {
  // State
  notifications: Notification[];
  unreadCount: number;
  unreadByType: Record<string, number>;
  isLoading: boolean;
  isPanelOpen: boolean;
  
  // Actions
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  setUnreadCount: (count: number, byType?: Record<string, number>) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  
  // API actions
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
}

const API_BASE = '/api/v1';

export const useNotificationStore = create<NotificationStore>((set, _get) => ({
  notifications: [],
  unreadCount: 0,
  unreadByType: {},
  isLoading: false,
  isPanelOpen: false,
  
  setNotifications: (notifications) => set({ notifications }),
  
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
    unreadCount: state.unreadCount + 1
  })),
  
  markAsRead: async (id) => {
    try {
      await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  },
  
  markAllAsRead: async () => {
    try {
      await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'PATCH',
        credentials: 'include'
      });
      
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString()
        })),
        unreadCount: 0,
        unreadByType: {}
      }));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  },
  
  setUnreadCount: (count, byType = {}) => set({ unreadCount: count, unreadByType: byType }),
  
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  openPanel: () => set({ isPanelOpen: true }),
  closePanel: () => set({ isPanelOpen: false }),
  
  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE}/notifications?page_size=50`, {
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        set({ notifications: result.data });
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchUnreadCount: async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications/unread-count`, {
        credentials: 'include'
      });
      const result = await response.json();
      
      if (result.success) {
        set({
          unreadCount: result.data.total,
          unreadByType: result.data.by_type || {}
        });
      }
    } catch (err) {
      console.error('Failed to fetch unread count:', err);
    }
  }
}));
