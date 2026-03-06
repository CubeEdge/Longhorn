/**
 * NotificationBell - 通知铃铛组件
 * P2 架构升级 - 导航栏通知入口
 */
import React, { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import axios from 'axios';
import { useNotificationStore } from '../../store/useNotificationStore';

interface NotificationBellProps {
  onClick?: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ onClick }) => {
  const { unreadCount, fetchUnreadCount, togglePanel } = useNotificationStore();
  const [refreshInterval, setRefreshInterval] = useState(30); // Default 30s
  const intervalRef = useRef<number | null>(null);

  // Fetch settings safely
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get('/api/v1/system/public-settings');
        if (res.data.success && res.data.data.notification_refresh_interval) {
          setRefreshInterval(res.data.data.notification_refresh_interval);
        }
      } catch (e) {
        console.error('[NotificationBell] Failed to fetch settings', e);
      }
    };
    
    fetchSettings();
    window.addEventListener('system-settings-updated', fetchSettings);
    return () => window.removeEventListener('system-settings-updated', fetchSettings);
  }, []);

  // Poll for unread count with dynamic interval
  useEffect(() => {
    fetchUnreadCount();
    
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(fetchUnreadCount, refreshInterval * 1000);
    
    return () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    };
  }, [fetchUnreadCount, refreshInterval]);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      togglePanel();
    }
  };

  return (
    <button
      className="notification-bell"
      onClick={handleClick}
      title="通知"
    >
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="notification-badge">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      <style>{`
        .notification-bell {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .notification-bell:hover {
          background: var(--glass-bg-hover);
          color: var(--text-main);
        }

        .notification-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          background: #EF4444; /* Kine Red */
          color: white;
          font-size: 10px;
          font-weight: 600;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: badge-pulse 2s infinite;
        }

        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
      `}</style>
    </button>
  );
};

export default NotificationBell;
