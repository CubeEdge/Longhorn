import React, { useEffect } from 'react';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useNavigate } from 'react-router-dom';
import { Bell, FileText, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useUserSettingsStore } from '../../store/useUserSettingsStore';

const NotificationPopupManager: React.FC = () => {
    const { popups, dismissPopup, markAsRead } = useNotificationStore();
    const navigate = useNavigate();

    const { notificationDuration } = useUserSettingsStore();

    // Auto dismiss popups based on user setting
    useEffect(() => {
        if (popups.length === 0 || notificationDuration === 0) return;
        
        const latestPopup = popups[popups.length - 1];
        const timer = setTimeout(() => {
            dismissPopup(latestPopup.id);
        }, notificationDuration * 1000); 
        
        return () => clearTimeout(timer);
    }, [popups, dismissPopup, notificationDuration]);

    if (popups.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 60,
            right: 24,
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            pointerEvents: 'none'
        }}>
            {popups.map((popup) => {
                const getIcon = () => {
                    switch (popup.icon) {
                        case 'ticket': return <FileText size={20} color="#3b82f6" />;
                        case 'success': return <CheckCircle size={20} color="#10b981" />;
                        case 'warning': return <AlertTriangle size={20} color="#f59e0b" />;
                        case 'error': return <AlertTriangle size={20} color="#ef4444" />;
                        default: return <Bell size={20} color="var(--text-main)" />;
                    }
                };

                return (
                    <div
                        key={popup.id}
                        onClick={(e) => {
                            // Don't navigate if clicking close button
                            if ((e.target as HTMLElement).closest('.popup-dismiss-btn')) return;
                            
                            markAsRead(popup.id);
                            dismissPopup(popup.id);
                            if (popup.action_url) {
                                navigate(popup.action_url);
                            }
                        }}
                        style={{
                            pointerEvents: 'auto',
                            width: 340,
                            padding: '16px 20px',
                            background: 'rgba(28, 28, 30, 0.75)',
                            backdropFilter: 'blur(30px)',
                            WebkitBackdropFilter: 'blur(30px)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: 16,
                            boxShadow: '0 16px 32px rgba(0, 0, 0, 0.3)',
                            display: 'flex',
                            gap: 16,
                            alignItems: 'flex-start',
                            cursor: popup.action_url ? 'pointer' : 'default',
                            animation: 'notification-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(28, 28, 30, 0.85)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(28, 28, 30, 0.75)';
                        }}
                    >
                        <div style={{
                            width: 36, height: 36,
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {getIcon()}
                        </div>

                        <div style={{ flex: 1, minWidth: 0, paddingRight: 16 }}>
                            <div style={{ 
                                fontWeight: 600, 
                                fontSize: '0.95rem',
                                color: 'var(--text-main)',
                                marginBottom: 4,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {popup.title}
                            </div>
                            <div style={{ 
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)',
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}>
                                {popup.content}
                            </div>
                        </div>

                        <button
                            className="popup-dismiss-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                dismissPopup(popup.id);
                            }}
                            style={{
                                position: 'absolute',
                                top: 12,
                                right: 12,
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.6,
                                transition: 'opacity 0.2s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                        >
                            <X size={14} />
                        </button>
                    </div>
                );
            })}

            <style>{`
                @keyframes notification-slide-in {
                    0% {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>
        </div>
    );
};

export default NotificationPopupManager;
