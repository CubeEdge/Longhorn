/**
 * Audit Reason Modal (审计化修正理由输入弹窗)
 * PRD §7.1 - 强制审计字段变更时需填写修正理由
 * 
 * UI 规范: macOS26 风格, Kine Yellow 主题色
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, AlertTriangle, Edit3, ArrowRight } from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';

interface AuditChange {
    field: string;
    label: string;
    oldValue: string | number | null;
    newValue: string | number | null;
}

interface AuditReasonModalProps {
    /** 待修改的审计字段列表 */
    changes: AuditChange[];
    /** 是否终结期工单（仅管理员可修改） */
    isFinalized?: boolean;
    /** 提交回调 */
    onSubmit: (reason: string) => void;
    /** 取消回调 */
    onCancel: () => void;
    /** 加载状态 */
    loading?: boolean;
}

const AuditReasonModal: React.FC<AuditReasonModalProps> = ({
    changes,
    isFinalized = false,
    onSubmit,
    onCancel,
    loading = false
}) => {
    const { t } = useLanguage();
    const [reason, setReason] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (reason.trim().length > 0) {
            onSubmit(reason.trim());
        }
    };

    const formatValue = (value: string | number | null): string => {
        if (value === null || value === undefined) return '(空)';
        if (typeof value === 'boolean') return value ? '是' : '否';
        if (typeof value === 'number') return String(value);
        return String(value);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.65)',
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
                width: 480,
                borderRadius: 16,
                boxShadow: 'var(--glass-shadow-lg)',
                border: '1px solid var(--glass-border)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--accent-subtle)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32,
                            borderRadius: 8,
                            background: 'rgba(var(--accent-rgb, 255, 215, 0), 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Edit3 size={16} color="var(--accent-blue)" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                                {t('audit.modal.title') || '审计化修正'}
                            </h3>
                            {isFinalized && (
                                <div style={{
                                    fontSize: 11,
                                    color: 'var(--text-danger)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    marginTop: 2
                                }}>
                                    <AlertTriangle size={10} />
                                    {t('audit.modal.finalized_warning') || '工单已终结，此为特权修正'}
                                </div>
                            )}
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

                {/* Changes List - 对比高亮 */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-tertiary)',
                        marginBottom: 12,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        {t('audit.modal.changes_label') || '变更内容'} ({changes.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {changes.map((change, idx) => (
                            <div key={idx} style={{
                                background: 'var(--glass-bg-light)',
                                borderRadius: 10,
                                padding: '12px 14px',
                                border: '1px solid var(--glass-border)'
                            }}>
                                <div style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'var(--accent-blue)',
                                    marginBottom: 8
                                }}>
                                    {change.label}
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    fontSize: 13
                                }}>
                                    {/* Old Value */}
                                    <div style={{
                                        flex: 1,
                                        padding: '8px 10px',
                                        background: 'rgba(239,68,68,0.08)',
                                        border: '1px solid rgba(239,68,68,0.2)',
                                        borderRadius: 6,
                                        color: '#EF4444',
                                        textDecoration: 'line-through',
                                        wordBreak: 'break-word',
                                        minHeight: 36,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}>
                                        {formatValue(change.oldValue)}
                                    </div>
                                    
                                    {/* Arrow */}
                                    <ArrowRight size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                                    
                                    {/* New Value */}
                                    <div style={{
                                        flex: 1,
                                        padding: '8px 10px',
                                        background: 'rgba(16,185,129,0.08)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        borderRadius: 6,
                                        color: '#10B981',
                                        fontWeight: 500,
                                        wordBreak: 'break-word',
                                        minHeight: 36,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}>
                                        {formatValue(change.newValue)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Reason Input */}
                <form onSubmit={handleSubmit}>
                    <div style={{ padding: '20px 24px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--text-tertiary)',
                            marginBottom: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {t('audit.modal.reason_label') || '修正理由'} *
                        </label>
                        <textarea
                            ref={inputRef}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder={t('audit.modal.reason_placeholder') || '请说明修改核心字段的原因...'}
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
                        />
                        <div style={{
                            fontSize: 11,
                            color: 'var(--text-tertiary)',
                            marginTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                        }}>
                            <AlertTriangle size={10} />
                            {t('audit.modal.reason_hint') || '此修改将被记录到工单时间轴，确保修改过程透明可追溯'}
                        </div>
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
                            disabled={loading || reason.trim().length === 0}
                            style={{
                                padding: '10px 24px',
                                background: isFinalized 
                                    ? 'var(--accent-red, #EF4444)' 
                                    : 'var(--accent-blue)',
                                border: 'none',
                                borderRadius: 8,
                                color: isFinalized ? '#fff' : '#000',
                                fontSize: 14,
                                fontWeight: 700,
                                cursor: loading || reason.trim().length === 0 ? 'not-allowed' : 'pointer',
                                opacity: loading || reason.trim().length === 0 ? 0.5 : 1,
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
                                        borderTopColor: isFinalized ? '#fff' : '#000',
                                        borderRadius: '50%'
                                    }} />
                                    {t('common.submitting') || '提交中...'}
                                </>
                            ) : (
                                <>
                                    <Edit3 size={14} />
                                    {isFinalized 
                                        ? (t('audit.modal.submit_privileged') || '特权修正') 
                                        : (t('audit.modal.submit') || '确认修改')}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AuditReasonModal;
