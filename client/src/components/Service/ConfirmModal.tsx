import React from 'react';
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
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    title,
    message,
    confirmText = '确认',
    cancelText = '取消',
    isDanger = false,
    onConfirm,
    onCancel,
    loading = false
}) => {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{
                background: '#1E1E1E', width: 400, borderRadius: 12,
                boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <div style={{
                    padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <h3 style={{ margin: 0, fontSize: 16, color: isDanger ? '#EF4444' : '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isDanger && <AlertTriangle size={18} />}
                        {title}
                    </h3>
                    <button onClick={onCancel} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '24px 20px', color: '#ddd', fontSize: 14, lineHeight: 1.6 }}>
                    {message}
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button type="button" onClick={onCancel} style={{
                        padding: '8px 16px', background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, color: '#ccc', cursor: 'pointer'
                    }}>
                        {cancelText}
                    </button>
                    <button type="button" onClick={onConfirm} disabled={loading} style={{
                        padding: '8px 16px',
                        background: isDanger ? 'var(--accent-red, #EF4444)' : 'var(--accent-blue)',
                        border: 'none', borderRadius: 6, color: '#fff',
                        cursor: loading ? 'wait' : 'pointer', fontWeight: 600
                    }}>
                        {loading ? '处理中...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
