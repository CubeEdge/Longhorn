/**
 * NotificationCenter - 通知中心面板
 * P2 架构升级 - macOS26 风格通知中心
 * 
 * UI 规范：
 * - Kine Yellow (#FFD700) 主题色
 * - Kine Green (#10B981) 成功
 * - Kine Red (#EF4444) 警示
 * - Kine Blue (#3B82F6)
 */
import React, { useEffect, useRef } from 'react';
import { X, Check, CheckCheck, Bell, AlertTriangle, AtSign, UserPlus, Clock, Info } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore';
import type { Notification } from '../../store/useNotificationStore';
import { useLanguage } from '../../i18n/useLanguage';

interface NotificationCenterProps {
  onClose?: () => void;
}

// Icon mapping for notification types
const getNotificationIcon = (type: string, _icon: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    mention: <AtSign size={16} />,
    assignment: <UserPlus size={16} />,
    status_change: <Info size={16} />,
    sla_warning: <AlertTriangle size={16} />,
    sla_breach: <AlertTriangle size={16} />,
    new_comment: <Bell size={16} />,
    participant_added: <UserPlus size={16} />,
    snooze_expired: <Clock size={16} />,
    system_announce: <Info size={16} />
  };
  return iconMap[type] || <Bell size={16} />;
};

// Color for notification type
const getTypeColor = (type: string): string => {
  switch (type) {
    case 'sla_breach':
      return '#EF4444'; // Kine Red
    case 'sla_warning':
      return '#FFD700'; // Kine Yellow
    case 'mention':
    case 'assignment':
      return '#3B82F6'; // Kine Blue
    default:
      return '#10B981'; // Kine Green
  }
};

// Format relative time
const formatRelativeTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString();
};

const NotificationItem: React.FC<{
  notification: Notification;
  onRead: (id: number) => void;
  onClick: (notification: Notification) => void;
}> = ({ notification, onRead, onClick }) => {
  const typeColor = getTypeColor(notification.type);

  return (
    <div
      className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
      onClick={() => onClick(notification)}
    >
      <div className="notification-icon" style={{ color: typeColor }}>
        {getNotificationIcon(notification.type, notification.icon)}
      </div>
      <div className="notification-content">
        <div className="notification-title">{notification.title}</div>
        {notification.content && (
          <div className="notification-body">{notification.content}</div>
        )}
        <div className="notification-time">{formatRelativeTime(notification.created_at)}</div>
      </div>
      {!notification.is_read && (
        <button
          className="notification-read-btn"
          onClick={(e) => {
            e.stopPropagation();
            onRead(notification.id);
          }}
          title="标记已读"
        >
          <Check size={14} />
        </button>
      )}

      <style>{`
        .notification-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          transition: background 0.15s;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .notification-item:hover {
          background: rgba(255,255,255,0.04);
        }

        .notification-item.unread {
          background: rgba(255,215,0,0.03); /* Kine Yellow tint */
        }

        .notification-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .notification-content {
          flex: 1;
          min-width: 0;
        }

        .notification-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-main);
          line-height: 1.4;
        }

        .notification-body {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 2px;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .notification-time {
          font-size: 11px;
          color: var(--text-tertiary);
          margin-top: 4px;
        }

        .notification-read-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.15s;
        }

        .notification-item:hover .notification-read-btn {
          opacity: 1;
        }

        .notification-read-btn:hover {
          background: #10B981;
          color: white;
        }
      `}</style>
    </div>
  );
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({ onClose }) => {
  const { /* t, */ } = useLanguage();
  const {
    notifications,
    unreadCount,
    isLoading,
    isPanelOpen,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    closePanel
  } = useNotificationStore();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPanelOpen) {
      fetchNotifications();
    }
  }, [isPanelOpen, fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closePanel();
        onClose?.();
      }
    };

    if (isPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPanelOpen, closePanel, onClose]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.action_url) {
      // Navigate to the action URL
      window.location.href = notification.action_url;
    }
    closePanel();
  };

  if (!isPanelOpen) return null;

  return (
    <div className="notification-center-overlay">
      <div className="notification-center" ref={panelRef}>
        {/* Header */}
        <div className="notification-header">
          <h3>通知</h3>
          <div className="notification-actions">
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={markAllAsRead}
                title="全部标记已读"
              >
                <CheckCheck size={16} />
                <span>全部已读</span>
              </button>
            )}
            <button
              className="close-btn"
              onClick={() => { closePanel(); onClose?.(); }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="notification-list">
          {isLoading ? (
            <div className="notification-empty">
              <div className="loading-spinner" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">
              <Bell size={32} strokeWidth={1.5} />
              <span>暂无通知</span>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
                onClick={handleNotificationClick}
              />
            ))
          )}
        </div>
      </div>

      <style>{`
        .notification-center-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
        }

        .notification-center {
          position: absolute;
          top: 60px;
          right: 20px;
          width: 380px;
          max-height: calc(100vh - 100px);
          background: rgba(30, 30, 30, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          box-shadow: 0 24px 48px rgba(0,0,0,0.4);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideIn 0.2s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .notification-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .notification-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-main);
        }

        .notification-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .mark-all-read-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 8px;
          border: none;
          background: rgba(16, 185, 129, 0.1); /* Kine Green */
          color: #10B981;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .mark-all-read-btn:hover {
          background: rgba(16, 185, 129, 0.2);
        }

        .close-btn {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }

        .close-btn:hover {
          background: rgba(255,255,255,0.1);
          color: var(--text-main);
        }

        .notification-list {
          flex: 1;
          overflow-y: auto;
          min-height: 200px;
          max-height: 500px;
        }

        .notification-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 48px 20px;
          color: var(--text-tertiary);
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255,255,255,0.1);
          border-top-color: #FFD700; /* Kine Yellow */
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Scrollbar styling */
        .notification-list::-webkit-scrollbar {
          width: 6px;
        }

        .notification-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .notification-list::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 3px;
        }

        .notification-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.25);
        }
      `}</style>
    </div>
  );
};

export default NotificationCenter;
