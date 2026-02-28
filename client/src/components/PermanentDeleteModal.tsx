import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';

interface PermanentDeleteModalProps {
    isOpen: boolean;
    account: { id: number; name: string; account_type: string } | null;
    onClose: () => void;
    onConfirmDelete: () => void;
    loading?: boolean;
}

/**
 * 彻底删除确认弹窗
 * Kine Red 基调 - 用于永久删除操作
 */
const PermanentDeleteModal: React.FC<PermanentDeleteModalProps> = ({
    isOpen,
    account,
    onClose,
    onConfirmDelete,
    loading = false
}) => {
    const [countdown, setCountdown] = useState(3);
    const [canDelete, setCanDelete] = useState(false);
    
    // 弹窗打开时启动倒计时
    useEffect(() => {
        if (isOpen) {
            setCountdown(3);
            setCanDelete(false);
            
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer);
                        setCanDelete(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            
            return () => clearInterval(timer);
        }
    }, [isOpen]);
    
    if (!isOpen || !account) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !loading) {
            onClose();
        }
    };

    // 判断是客户还是经销商
    const isDealer = account.account_type === 'DEALER';
    const entityName = isDealer ? '经销商' : '客户';

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'var(--glass-shadow-lg)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
            }}
            onClick={handleBackdropClick}
        >
            <div
                style={{
                    background: 'linear-gradient(145deg, rgba(45, 25, 25, 0.98), rgba(35, 20, 20, 0.98))',
                    borderRadius: 16,
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: 0,
                    width: '100%',
                    maxWidth: 480,
                    boxShadow: '0 20px 60px rgba(239, 68, 68, 0.2)'
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '20px 24px',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <AlertTriangle size={24} color="#ef4444" />
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#ef4444' }}>
                            彻底删除{entityName}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            padding: 8,
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>
                
                {/* Body */}
                <div style={{ padding: '24px' }}>
                    <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        您确定要<strong style={{ color: '#ef4444' }}>永久删除</strong>{entityName}{' '}
                        <strong style={{ color: 'var(--text-main)' }}>[{account.name}]</strong> 吗？
                    </p>
                    
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: 8,
                        padding: '16px'
                    }}>
                        <p style={{ 
                            margin: 0, 
                            color: '#ef4444', 
                            fontSize: '0.95rem',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}>
                            <AlertTriangle size={18} />
                            此操作无法撤销！
                        </p>
                        <p style={{ 
                            margin: '8px 0 0', 
                            color: 'var(--text-secondary)', 
                            fontSize: '0.85rem',
                            lineHeight: 1.5
                        }}>
                            该{entityName}及其所有联系人信息将从数据库中永久删除，无法恢复。
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 12,
                        padding: '16px 24px',
                        borderTop: '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                >
                    <button
                        onClick={onClose}
                        disabled={loading}
                        style={{
                            background: 'var(--glass-bg-light)',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-main)',
                            padding: '10px 20px',
                            borderRadius: 8,
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontSize: '0.95rem'
                        }}
                    >
                        取消
                    </button>
                    
                    <button
                        onClick={onConfirmDelete}
                        disabled={loading || !canDelete}
                        style={{
                            background: canDelete 
                                ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                                : 'rgba(239, 68, 68, 0.3)',
                            border: 'none',
                            color: canDelete ? 'white' : 'rgba(255,255,255,0.5)',
                            padding: '10px 20px',
                            borderRadius: 8,
                            cursor: (loading || !canDelete) ? 'not-allowed' : 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            opacity: loading ? 0.7 : 1,
                            minWidth: 140
                        }}
                    >
                        <Trash2 size={16} />
                        {loading ? '删除中...' : (canDelete ? '彻底删除' : `请等待 ${countdown}s`)}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PermanentDeleteModal;
