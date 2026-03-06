/**
 * Delete Ticket Modal (删除工单确认弹窗)
 * PRD §7.2 - 墓碑化软删除，强制填写删除理由
 * 
 * UI 规范: macOS26 风格, Kine Red 危险色
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';

interface DeleteTicketModalProps {
    /** 工单号 */
    ticketNumber: string;
    /** 工单状态节点 */
    currentNode: string;
    /** 是否为管理员 */
    isAdmin?: boolean;
    /** 确认删除回调 */
    onConfirm: (reason: string) => void;
    /** 取消回调 */
    onCancel: () => void;
    /** 加载状态 */
    loading?: boolean;
}

const DeleteTicketModal: React.FC<DeleteTicketModalProps> = ({
    ticketNumber,
    currentNode,
    isAdmin = false,
    onConfirm,
    onCancel,
    loading = false
}) => {
    const { t } = useLanguage();
    const [reason, setReason] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // 需要输入工单号确认
    const requireTypeConfirm = !['draft', 'submitted'].includes(currentNode);
    const canSubmit = reason.trim().length > 0 && (!requireTypeConfirm || confirmText === ticketNumber);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (canSubmit) {
            onConfirm(reason.trim());
        }
    };

    const getStatusLabel = (node: string): string => {
        const labels: Record<string, string> = {
            draft: '草稿',
            submitted: '已提交',
            ms_review: '市场审核中',
            op_receiving: '运营接收中',
            op_diagnosing: '诊断中',
            op_repairing: '维修中',
            op_shipping: '待发货',
            op_qa: '待发货',
            ms_closing: '待关闭',
            resolved: '已解决',
            closed: '已关闭',
            auto_closed: '自动关闭',
            converted: '已升级',
            cancelled: '已取消'
        };
        return labels[node] || node;
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'var(--bg-overlay, rgba(0,0,0,0.7))',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.15s ease-out'
        }}>
            <div style={{
                background: 'var(--modal-bg)',
                width: 440,
                borderRadius: 16,
                boxShadow: 'var(--glass-shadow-lg)',
                border: '1px solid rgba(239,68,68,0.2)',
                overflow: 'hidden'
            }}>
                {/* Header - 危险红色主题 */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid rgba(239,68,68,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(239,68,68,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 36, height: 36,
                            borderRadius: 10,
                            background: 'rgba(239,68,68,0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Trash2 size={18} color="#EF4444" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#EF4444' }}>
                                {t('delete.modal.title') || '删除工单'}
                            </h3>
                            <div style={{
                                fontSize: 12,
                                color: 'var(--text-tertiary)',
                                marginTop: 2
                            }}>
                                {ticketNumber}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-tertiary)',
                            cursor: 'pointer',
                            padding: 6,
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Warning Message */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--glass-border)'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '14px 16px',
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.15)',
                        borderRadius: 10
                    }}>
                        <AlertTriangle size={20} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
                        <div>
                            <div style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: '#EF4444',
                                marginBottom: 6
                            }}>
                                {t('delete.modal.warning_title') || '此操作不可撤销'}
                            </div>
                            <div style={{
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                                lineHeight: 1.5
                            }}>
                                {t('delete.modal.warning_text') || '工单将从系统中移除（数据仍保留在数据库中）。请确认是否继续删除。'}
                            </div>
                        </div>
                    </div>

                    {/* Status Badge */}
                    <div style={{
                        marginTop: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10
                    }}>
                        <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                            {t('delete.modal.current_status') || '当前状态'}:
                        </span>
                        <span style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            background: 'var(--glass-bg-light)',
                            border: '1px solid var(--glass-border)',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-secondary)'
                        }}>
                            {getStatusLabel(currentNode)}
                        </span>
                        {isAdmin && (
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 10px',
                                borderRadius: 6,
                                background: 'rgba(139,92,246,0.15)',
                                border: '1px solid rgba(139,92,246,0.3)',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#8B5CF6'
                            }}>
                                <ShieldAlert size={10} />
                                {t('delete.modal.admin_mode') || '管理员权限'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit}>
                    <div style={{ padding: '20px 24px' }}>
                        {/* Reason Input */}
                        <div style={{ marginBottom: requireTypeConfirm ? 20 : 0 }}>
                            <label style={{
                                display: 'block',
                                fontSize: 12,
                                fontWeight: 600,
                                color: 'var(--text-tertiary)',
                                marginBottom: 10,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>
                                {t('delete.modal.reason_label') || '删除理由'} *
                            </label>
                            <textarea
                                ref={inputRef}
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder={t('delete.modal.reason_placeholder') || '请说明删除此工单的原因...'}
                                rows={3}
                                required
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: 10,
                                    border: '1px solid var(--glass-border)',
                                    background: 'var(--input-bg)',
                                    color: 'var(--text-main)',
                                    fontSize: 14,
                                    lineHeight: 1.5,
                                    resize: 'vertical',
                                    outline: 'none',
                                    transition: 'border-color 0.15s',
                                    boxSizing: 'border-box'
                                }}
                                onFocus={e => e.target.style.borderColor = 'rgba(239,68,68,0.4)'}
                                onBlur={e => e.target.style.borderColor = 'var(--glass-border)'}
                            />
                        </div>

                        {/* Confirm by typing ticket number (for non-draft/submitted) */}
                        {requireTypeConfirm && (
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--text-tertiary)',
                                    marginBottom: 10
                                }}>
                                    {t('delete.modal.confirm_label') || '请输入工单号确认删除'}
                                    <span style={{
                                        marginLeft: 6,
                                        fontFamily: 'monospace',
                                        color: '#EF4444',
                                        fontWeight: 700,
                                        letterSpacing: '0.5px'
                                    }}>
                                        {ticketNumber}
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={e => setConfirmText(e.target.value)}
                                    placeholder={ticketNumber}
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px',
                                        borderRadius: 10,
                                        border: confirmText === ticketNumber
                                            ? '1px solid rgba(16,185,129,0.4)'
                                            : '1px solid var(--glass-border)',
                                        background: confirmText === ticketNumber
                                            ? 'rgba(16,185,129,0.05)'
                                            : 'var(--input-bg)',
                                        color: 'var(--text-main)',
                                        fontSize: 14,
                                        fontFamily: 'monospace',
                                        outline: 'none',
                                        transition: 'all 0.15s',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--glass-border)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 12,
                        background: 'var(--glass-bg-light)'
                    }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{
                                padding: '10px 20px',
                                background: 'transparent',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                color: 'var(--text-secondary)',
                                fontSize: 14,
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                        >
                            {t('common.cancel') || '取消'}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !canSubmit}
                            style={{
                                padding: '10px 24px',
                                background: 'var(--accent-red)',
                                border: 'none',
                                borderRadius: 8,
                                color: '#fff',
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: loading || !canSubmit ? 'not-allowed' : 'pointer',
                                opacity: loading || !canSubmit ? 0.5 : 1,
                                transition: 'all 0.15s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin" style={{
                                        width: 14, height: 14,
                                        border: '2px solid transparent',
                                        borderTopColor: '#fff',
                                        borderRadius: '50%'
                                    }} />
                                    {t('common.deleting') || '删除中...'}
                                </>
                            ) : (
                                <>
                                    <Trash2 size={14} />
                                    {t('delete.modal.confirm_button') || '确认删除'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeleteTicketModal;
