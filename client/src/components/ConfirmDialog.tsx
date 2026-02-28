import React, { useEffect } from 'react';
import { useConfirm } from '../store/useConfirm';
import { useLanguage } from '../i18n/useLanguage';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export const ConfirmDialog: React.FC = () => {
    const { isOpen, title, message, confirmLabel, cancelLabel, countdownSeconds, close } = useConfirm();
    const { t } = useLanguage();
    const [countdown, setCountdown] = React.useState<number>(0);

    useEffect(() => {
        if (isOpen && countdownSeconds) {
            setCountdown(countdownSeconds);
        } else {
            setCountdown(0);
        }
    }, [isOpen, countdownSeconds]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter' && countdown === 0) close(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, close, countdown]);

    const isDangerous = confirmLabel?.includes('删除') || title?.includes('删除');
    const primaryColor = isDangerous ? '#EF4444' : '#FFD700';
    const primaryGlow = isDangerous ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 215, 0, 0.3)';

    if (!isOpen) return null;

    return (
        <div
            className="modal-overlay"
            onClick={() => close(false)}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,  // Must be higher than all modals (WikiEditorModal: 10000, VersionHistory: 10001)
                animation: 'fadeIn 0.2s ease'
            }}
        >
            <div
                className="modal-content"
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'rgba(30, 30, 30, 0.95)',
                    border: `1px solid ${isDangerous ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 215, 0, 0.2)'}`,
                    width: '90%',
                    maxWidth: '420px',
                    borderRadius: '20px',
                    padding: '0',
                    boxShadow: `0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px ${isDangerous ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 215, 0, 0.1)'}`,
                    animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    overflow: 'hidden'
                }}
            >
                {/* Header with icon */}
                <div style={{
                    padding: '24px 28px 20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <div style={{
                        background: isDangerous ? 'rgba(239, 68, 68, 0.15)' : 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 180, 0, 0.1))',
                        padding: '12px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 12px ${isDangerous ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 215, 0, 0.1)'}`
                    }}>
                        <AlertTriangle size={24} color={primaryColor} strokeWidth={2} />
                    </div>
                    <h3 style={{
                        margin: 0,
                        fontSize: '18px',
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        letterSpacing: '-0.3px'
                    }}>
                        {title || t('dialog.confirm_title') || 'Confirm Action'}
                    </h3>
                </div>

                {/* Message */}
                <div style={{
                    padding: '20px 28px 24px'
                }}>
                    <p style={{
                        margin: 0,
                        color: 'rgba(255, 255, 255, 0.7)',
                        lineHeight: 1.6,
                        fontSize: '15px'
                    }}>
                        {message}
                    </p>
                </div>

                {/* Buttons */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    padding: '0 28px 24px',
                    justifyContent: 'flex-end'
                }}>
                    <button
                        onClick={() => close(false)}
                        style={{
                            padding: '12px 24px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            color: 'rgba(255, 255, 255, 0.7)',
                            cursor: 'pointer',
                            fontSize: '15px',
                            fontWeight: 500,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            minWidth: '90px'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }}
                    >
                        {cancelLabel || t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={() => close(true)}
                        disabled={countdown > 0}
                        style={{
                            padding: '12px 24px',
                            background: countdown > 0
                                ? (isDangerous ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 215, 0, 0.4)')
                                : primaryColor,
                            border: 'none',
                            borderRadius: '12px',
                            color: isDangerous ? '#fff' : '#000',
                            cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                            fontSize: '15px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            minWidth: '90px',
                            boxShadow: countdown > 0 ? 'none' : `0 4px 15px ${primaryGlow}`
                        }}
                        onMouseEnter={e => {
                            if (countdown === 0) {
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.background = isDangerous ? '#ff5252' : '#ffe14d';
                                e.currentTarget.style.boxShadow = `0 6px 20px ${isDangerous ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 215, 0, 0.4)'}`;
                            }
                        }}
                        onMouseLeave={e => {
                            if (countdown === 0) {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.background = primaryColor;
                                e.currentTarget.style.boxShadow = `0 4px 15px ${primaryGlow}`;
                            }
                        }}
                    >
                        {countdown === 0 && <CheckCircle size={16} strokeWidth={2.5} />}
                        {countdown > 0 ? `${confirmLabel || t('common.confirm') || 'Confirm'} (${countdown})` : (confirmLabel || t('common.confirm') || 'Confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};
