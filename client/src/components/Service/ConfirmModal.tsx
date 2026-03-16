import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    loading?: boolean;
    countdown?: number; // 倒计时秒数，设置后确认按钮需等待倒计时完成
    showCancel?: boolean; // 是否显示取消按钮，默认 true
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    message,
    confirmText = '确认',
    cancelText = '取消',
    isDanger = false,
    onConfirm,
    onCancel,
    loading = false,
    countdown = 0,
    showCancel = true
}) => {
    const [remainingSeconds, setRemainingSeconds] = useState(countdown);

    useEffect(() => {
        if (countdown <= 0) return;
        setRemainingSeconds(countdown);
        const timer = setInterval(() => {
            setRemainingSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const isCountdownActive = countdown > 0 && remainingSeconds > 0;
    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
            <div style={{
                background: 'var(--bg-secondary)', width: 400, borderRadius: 12,
                boxShadow: '0 20px 40px var(--glass-shadow-lg)',
                border: '1px solid var(--glass-border)'
            }}>
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: isDanger ? '#EF4444' : 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isDanger && <AlertTriangle size={18} />}
                        {title}
                    </h3>
                    <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '24px 20px', color: 'var(--text-main)', fontSize: 14, lineHeight: 1.6 }}>
                    {message}
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    {showCancel && (
                        <button type="button" onClick={onCancel} style={{
                            padding: '8px 16px', background: 'transparent',
                            border: '1px solid var(--glass-border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer'
                        }}>
                            {cancelText}
                        </button>
                    )}
                    <button 
                        type="button" 
                        onClick={onConfirm} 
                        disabled={loading || isCountdownActive} 
                        style={{
                            padding: '8px 16px',
                            background: isDanger ? 'var(--accent-red, #EF4444)' : 'var(--accent-blue)',
                            border: 'none', borderRadius: 6, color: '#000',
                            cursor: (loading || isCountdownActive) ? 'not-allowed' : 'pointer', 
                            fontWeight: 600,
                            opacity: isCountdownActive ? 0.6 : 1,
                            minWidth: 100
                        }}
                    >
                        {loading ? '处理中...' : isCountdownActive ? `${confirmText} (${remainingSeconds})` : confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfirmModal;
