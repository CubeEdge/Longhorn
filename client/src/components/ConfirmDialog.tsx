import React, { useEffect } from 'react';
import { useConfirm } from '../store/useConfirm';
import { useLanguage } from '../i18n/useLanguage';
import { AlertCircle, X, Check } from 'lucide-react';

export const ConfirmDialog: React.FC = () => {
    const { isOpen, title, message, confirmLabel, cancelLabel, close } = useConfirm();
    const { t } = useLanguage();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') close(false);
            if (e.key === 'Enter') close(true);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, close]);

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
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                animation: 'fadeIn 0.2s ease'
            }}
        >
            <div
                className="modal-content"
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--bg-secondary)', // Assuming these css vars exist from other components
                    border: '1px solid var(--border-color)', // Fallback required if not global? Let's use hardcoded backup
                    width: '90%',
                    maxWidth: '400px',
                    borderRadius: '16px',
                    padding: '24px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    color: 'white' // Force text color for safety
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '8px' }}>
                    <div style={{
                        background: 'rgba(255, 210, 0, 0.1)',
                        padding: '10px',
                        borderRadius: '12px',
                        display: 'flex'
                    }}>
                        <AlertCircle size={24} color="var(--accent-blue)" />
                    </div>
                    <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 600 }}>
                            {title || t('dialog.confirm_title') || 'Confirm Action'}
                        </h3>
                        <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {message}
                        </p>
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                    justifyContent: 'flex-end',
                    marginTop: '24px'
                }}>
                    <button
                        onClick={() => close(false)}
                        style={{
                            padding: '10px 16px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        {cancelLabel || t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={() => close(true)}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--accent-blue)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#000',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                        {/* <Check size={16} /> */}
                        {confirmLabel || t('common.confirm') || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
};
