import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, AlertTriangle, Trash2, Power } from 'lucide-react';

interface DeleteAccountModalProps {
    isOpen: boolean;
    account: { id: number; name: string; account_type: string } | null;
    onClose: () => void;
    onConfirmDelete: () => void;
    onConfirmDeactivate: () => void;
    loading?: boolean;
    // 关联数据信息（当有关联数据时传入）
    hasRelatedData?: boolean;
    counts?: {
        tickets: number;
        inquiry_tickets?: number;
        rma_tickets?: number;
        dealer_repairs?: number;
        devices: number;
    };
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
    isOpen,
    account,
    onClose,
    onConfirmDelete,
    onConfirmDeactivate,
    loading = false,
    hasRelatedData = false,
    counts
}) => {
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(3);
    const [canDelete, setCanDelete] = useState(false);
    
    // 弹窗打开时启动倒计时
    useEffect(() => {
        if (isOpen && !hasRelatedData) {
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
    }, [isOpen, hasRelatedData]);
    
    if (!isOpen || !account) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget && !loading) {
            onClose();
        }
    };

    // 点击关联数据链接
    const handleTicketsClick = () => {
        onClose();
        navigate(`/service/customers/${account.id}?tab=tickets`);
    };

    const handleDevicesClick = () => {
        onClose();
        navigate(`/service/customers/${account.id}?tab=devices`);
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
                    background: 'linear-gradient(145deg, rgba(35, 35, 40, 0.95), rgba(25, 25, 30, 0.95))',
                    borderRadius: 16,
                    border: '1px solid var(--glass-border)',
                    padding: 0,
                    width: '100%',
                    maxWidth: 480,
                    boxShadow: '0 20px 60px var(--glass-shadow)'
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--glass-border)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {hasRelatedData ? (
                            <AlertTriangle size={24} color="#f59e0b" />
                        ) : (
                            <Trash2 size={24} color="#ef4444" />
                        )}
                        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
                            {hasRelatedData ? `无法删除该${entityName}` : `确认删除${entityName}？`}
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
                    {hasRelatedData && counts ? (
                        // Case B: 有关联数据，不能删除
                        <>
                            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {entityName} <strong style={{ color: 'var(--text-main)' }}>[{account.name}]</strong> 关联了{' '}
                                <span 
                                    onClick={handleTicketsClick}
                                    style={{ 
                                        color: '#60A5FA', 
                                        cursor: 'pointer',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    {counts.tickets} 个历史工单
                                </span>
                                {' '}和{' '}
                                <span 
                                    onClick={handleDevicesClick}
                                    style={{ 
                                        color: '#60A5FA', 
                                        cursor: 'pointer',
                                        textDecoration: 'underline'
                                    }}
                                >
                                    {counts.devices} 台设备资产
                                </span>
                                。
                            </p>
                                            
                            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                为保护财务与维修记录，无法删除该{entityName}。
                            </p>
                
                            <div style={{
                                background: 'rgba(245, 158, 11, 0.1)',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                borderRadius: 8,
                                padding: '12px 16px',
                                marginBottom: 8
                            }}>
                                <p style={{ 
                                    margin: 0, 
                                    color: '#f59e0b', 
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8
                                }}>
                                    <Power size={16} />
                                    建议将其 <strong>停用</strong>
                                </p>
                                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    停用后，该{entityName}将不会出现在新建工单的选择列表中，但历史记录会被保留。
                                </p>
                            </div>
                        </>
                    ) : (
                        // Case A: 无关联数据，可以软删除
                        <>
                            <p style={{ margin: '0 0 16px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                您确定要删除{entityName} <strong style={{ color: 'var(--text-main)' }}>[{account.name}]</strong> 吗？
                            </p>
                            <p style={{ 
                                margin: 0, 
                                color: '#f59e0b', 
                                fontSize: '0.9rem',
                                background: 'rgba(245, 158, 11, 0.1)',
                                padding: '12px 16px',
                                borderRadius: 8,
                                border: '1px solid rgba(245, 158, 11, 0.2)'
                            }}>
                                删除后将移至“已删除”列表，可在该列表中恢复或彻底删除。
                            </p>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 12,
                        padding: '16px 24px',
                        borderTop: '1px solid var(--glass-border)'
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
                    
                    {hasRelatedData ? (
                        // 有关联数据：显示停用按钮
                        <button
                            onClick={onConfirmDeactivate}
                            disabled={loading}
                            style={{
                                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                                border: 'none',
                                color: '#1a1a1a',
                                padding: '10px 20px',
                                borderRadius: 8,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                opacity: loading ? 0.7 : 1
                            }}
                        >
                            <Power size={16} />
                            {loading ? '处理中...' : '停用'}
                        </button>
                    ) : (
                        // 无关联数据：显示删除按钮（软删除）+ 3秒倒计时
                        <button
                            onClick={onConfirmDelete}
                            disabled={loading || !canDelete}
                            style={{
                                background: canDelete 
                                    ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
                                    : 'rgba(245, 158, 11, 0.3)',
                                border: 'none',
                                color: canDelete ? '#1a1a1a' : 'rgba(255,255,255,0.5)',
                                padding: '10px 20px',
                                borderRadius: 8,
                                cursor: (loading || !canDelete) ? 'not-allowed' : 'pointer',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                opacity: loading ? 0.7 : 1,
                                minWidth: 120
                            }}
                        >
                            <Trash2 size={16} />
                            {loading ? '删除中...' : (canDelete ? '确认删除' : `请等待 ${countdown}s`)}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeleteAccountModal;
