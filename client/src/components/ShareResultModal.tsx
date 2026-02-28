import React from 'react';
import { CheckCircle, X, Copy } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { useToast } from '../store/useToast';

interface ShareResultModalProps {
    result: {
        url: string;
        password?: string;
        expires: string;
    };
    onClose: () => void;
}

const ShareResultModal: React.FC<ShareResultModalProps> = ({ result, onClose }) => {
    const { t } = useLanguage();
    const { showToast } = useToast();
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0, color: 'var(--accent-blue)' }}>
                        <CheckCircle size={28} />
                        {t('share.link_created_title')}
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <X size={24} />
                    </button>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-main)' }}>
                        {t('share.share_link_label')}
                    </label>
                    <div style={{
                        padding: '12px',
                        background: 'var(--glass-bg-light)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        color: 'var(--accent-blue)',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace'
                    }}>
                        {result.url}
                    </div>
                </div>

                {result.password && (
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-main)' }}>
                            {t('share.access_password')}
                        </label>
                        <div style={{
                            padding: '12px',
                            background: 'rgba(255, 210, 0, 0.1)',
                            border: '1px solid rgba(255, 210, 0, 0.3)',
                            borderRadius: '8px',
                            fontSize: '1rem',
                            color: 'var(--accent-blue)',
                            fontFamily: 'monospace',
                            fontWeight: 700
                        }}>
                            {result.password}
                        </div>
                    </div>
                )}

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block', color: 'var(--text-main)' }}>
                        {t('share.expiry_label')}
                    </label>
                    <div style={{
                        padding: '12px',
                        background: 'var(--glass-bg-light)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        color: 'var(--text-secondary)'
                    }}>
                        {typeof result.expires === 'number'
                            ? t('time.days_count', { days: result.expires })
                            : result.expires}
                    </div>
                </div>

                <button
                    onClick={() => {
                        const textArea = document.createElement('textarea');
                        textArea.value = result.url;
                        textArea.style.position = 'fixed';
                        textArea.style.top = '0';
                        textArea.style.left = '0';
                        textArea.style.opacity = '0';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();

                        let success = false;
                        try {
                            success = document.execCommand('copy');
                        } catch (e) {
                            console.error('Copy failed:', e);
                        }

                        document.body.removeChild(textArea);

                        if (success) {
                            showToast(t('share.copy_success'), 'success');
                            onClose();
                        } else {
                            showToast(t('share.copy_failed'), 'warning');
                        }
                    }}
                    className="btn-primary"
                    style={{
                        width: '100%',
                        padding: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '1rem'
                    }}
                >
                    <Copy size={20} />
                    {t('share.copy_link_btn')}
                </button>
            </div>
        </div>
    );
};

export default ShareResultModal;
