import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, FileText, MessageSquare, Loader2, Clock } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface DocumentReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    documentType: 'pi' | 'repair_report';
    documentId: number;
    documentNumber: string;
    onSuccess: () => void;
}

interface DocumentDetail {
    id: number;
    status: string;
    content: any;
    created_by?: { id: number; display_name: string };
    created_at: string;
    submitted_for_review_at?: string;
    review_comment?: string;
}

export const DocumentReviewModal: React.FC<DocumentReviewModalProps> = ({
    isOpen, onClose, documentType, documentId, documentNumber, onSuccess
}) => {
    const { token, user } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [document, setDocument] = useState<DocumentDetail | null>(null);
    const [action, setAction] = useState<'approve' | 'reject' | null>(null);
    const [comment, setComment] = useState('');

    useEffect(() => {
        if (isOpen && documentId) {
            loadDocument();
        }
    }, [isOpen, documentId]);

    const loadDocument = async () => {
        setLoading(true);
        try {
            const endpoint = documentType === 'pi'
                ? `/api/v1/rma-documents/pi/${documentId}`
                : `/api/v1/rma-documents/repair-reports/${documentId}`;

            const res = await axios.get(endpoint, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setDocument(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load document:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async () => {
        if (!action) return;

        setSubmitting(true);
        try {
            const endpoint = documentType === 'pi'
                ? `/api/v1/rma-documents/pi/${documentId}/review`
                : `/api/v1/rma-documents/repair-reports/${documentId}/review`;

            await axios.post(endpoint, {
                action,
                comment: comment.trim() || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '审核失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handlePublish = async () => {
        setSubmitting(true);
        try {
            const endpoint = documentType === 'pi'
                ? `/api/v1/rma-documents/pi/${documentId}/publish`
                : `/api/v1/rma-documents/repair-reports/${documentId}/publish`;

            await axios.post(endpoint, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '发布失败');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const isLeadOrAdmin = ['Admin', 'Lead'].includes(user?.role || '');
    const canReview = isLeadOrAdmin && document?.status === 'pending_review';
    const canPublish = isLeadOrAdmin && document?.status === 'approved';

    const getDocumentTitle = () => {
        if (documentType === 'pi') return '形式发票 (PI)';
        return '维修报告';
    };

    const getStatusConfig = (status: string) => {
        const configs: Record<string, { text: string; color: string; bg: string; icon: React.ReactNode }> = {
            'draft': { text: '草稿', color: '#888', bg: 'rgba(255,255,255,0.1)', icon: <FileText size={16} /> },
            'pending_review': { text: '待审核', color: '#FFD200', bg: 'rgba(245,158,11,0.15)', icon: <Clock size={16} /> },
            'approved': { text: '已批准', color: '#10B981', bg: 'rgba(16,185,129,0.15)', icon: <CheckCircle size={16} /> },
            'rejected': { text: '已驳回', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', icon: <XCircle size={16} /> },
            'published': { text: '已发布', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: <FileText size={16} /> }
        };
        return configs[status] || configs['draft'];
    };

    const statusConfig = document ? getStatusConfig(document.status) : configs['draft'];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 500, background: '#1c1c1e', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 10,
                            background: documentType === 'pi' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            {documentType === 'pi'
                                ? <FileText size={20} color="#10B981" />
                                : <FileText size={20} color="#3B82F6" />
                            }
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>
                                审核{getDocumentTitle()}
                            </h3>
                            <p style={{ margin: 0, fontSize: 12, color: '#888', marginTop: 4 }}>
                                {documentNumber}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
                            加载中...
                        </div>
                    ) : !document ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                            文档不存在
                        </div>
                    ) : (
                        <>
                            {/* Status Display */}
                            <div style={{
                                padding: 16, borderRadius: 12,
                                background: statusConfig.bg,
                                border: `1px solid ${statusConfig.color}40`,
                                display: 'flex', alignItems: 'center', gap: 12
                            }}>
                                <div style={{ color: statusConfig.color }}>{statusConfig.icon}</div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: statusConfig.color }}>
                                        当前状态: {statusConfig.text}
                                    </div>
                                    {document.submitted_for_review_at && (
                                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                            提交审核时间: {new Date(document.submitted_for_review_at).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Document Info */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
                                    文档信息
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#888', fontSize: 13 }}>创建人</span>
                                        <span style={{ color: '#fff', fontSize: 13 }}>
                                            {document.created_by?.display_name || '-'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#888', fontSize: 13 }}>创建时间</span>
                                        <span style={{ color: '#fff', fontSize: 13 }}>
                                            {new Date(document.created_at).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Review Actions */}
                            {canReview && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <h4 style={{ margin: 0, fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>
                                        审核操作
                                    </h4>

                                    {/* Action Selection */}
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <button
                                            onClick={() => setAction('approve')}
                                            style={{
                                                flex: 1, padding: 16, borderRadius: 12,
                                                border: `2px solid ${action === 'approve' ? '#10B981' : 'rgba(255,255,255,0.1)'}`,
                                                background: action === 'approve' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                                                cursor: 'pointer',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
                                            }}
                                        >
                                            <CheckCircle size={24} color={action === 'approve' ? '#10B981' : '#888'} />
                                            <span style={{ color: action === 'approve' ? '#10B981' : '#fff', fontWeight: 600 }}>
                                                批准
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => setAction('reject')}
                                            style={{
                                                flex: 1, padding: 16, borderRadius: 12,
                                                border: `2px solid ${action === 'reject' ? '#EF4444' : 'rgba(255,255,255,0.1)'}`,
                                                background: action === 'reject' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                                                cursor: 'pointer',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
                                            }}
                                        >
                                            <XCircle size={24} color={action === 'reject' ? '#EF4444' : '#888'} />
                                            <span style={{ color: action === 'reject' ? '#EF4444' : '#fff', fontWeight: 600 }}>
                                                驳回
                                            </span>
                                        </button>
                                    </div>

                                    {/* Comment Input */}
                                    {action && (
                                        <div>
                                            <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 8 }}>
                                                {action === 'reject' ? '驳回原因 (必填)' : '审核意见 (可选)'}
                                            </label>
                                            <textarea
                                                value={comment}
                                                onChange={e => setComment(e.target.value)}
                                                placeholder={action === 'reject' ? '请输入驳回原因...' : '请输入审核意见...'}
                                                style={{
                                                    width: '100%', minHeight: 100, padding: 12,
                                                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: 8, color: '#fff', fontSize: 13, resize: 'vertical'
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Publish Action */}
                            {canPublish && (
                                <div style={{
                                    padding: 16, borderRadius: 12,
                                    background: 'rgba(16,185,129,0.1)',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    display: 'flex', alignItems: 'center', gap: 12
                                }}>
                                    <CheckCircle size={20} color="#10B981" />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#10B981' }}>
                                            文档已批准
                                        </div>
                                        <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                                            点击"发布"按钮将此文档正式发布
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Previous Review Comment */}
                            {document.review_comment && (
                                <div style={{
                                    padding: 16, borderRadius: 12,
                                    background: 'rgba(245,158,11,0.1)',
                                    border: '1px solid rgba(245,158,11,0.3)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <MessageSquare size={14} color="#FFD200" />
                                        <span style={{ fontSize: 12, color: '#FFD200', fontWeight: 600 }}>
                                            上次审核意见
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 13, color: '#fff', lineHeight: 1.6 }}>
                                        {document.review_comment}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                    <button
                        onClick={onClose}
                        disabled={submitting}
                        style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: 8 }}
                    >
                        关闭
                    </button>

                    {canReview && action && (
                        <button
                            onClick={handleReview}
                            disabled={submitting || (action === 'reject' && !comment.trim())}
                            style={{
                                padding: '10px 24px',
                                background: action === 'approve' ? '#10B981' : '#EF4444',
                                border: 'none', color: '#fff', borderRadius: 8, fontWeight: 600,
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting || (action === 'reject' && !comment.trim()) ? 0.6 : 1,
                                display: 'flex', alignItems: 'center', gap: 8
                            }}
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                            {action === 'approve' ? '确认批准' : '确认驳回'}
                        </button>
                    )}

                    {canPublish && (
                        <button
                            onClick={handlePublish}
                            disabled={submitting}
                            style={{
                                padding: '10px 24px',
                                background: '#3B82F6',
                                border: 'none', color: '#fff', borderRadius: 8, fontWeight: 600,
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                opacity: submitting ? 0.6 : 1,
                                display: 'flex', alignItems: 'center', gap: 8
                            }}
                        >
                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            发布文档
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const configs: Record<string, { text: string; color: string; bg: string; icon: React.ReactNode }> = {
    'draft': { text: '草稿', color: '#888', bg: 'rgba(255,255,255,0.1)', icon: <FileText size={16} /> },
    'pending_review': { text: '待审核', color: '#FFD200', bg: 'rgba(245,158,11,0.15)', icon: <Clock size={16} /> },
    'approved': { text: '已批准', color: '#10B981', bg: 'rgba(16,185,129,0.15)', icon: <CheckCircle size={16} /> },
    'rejected': { text: '已驳回', color: '#EF4444', bg: 'rgba(239,68,68,0.15)', icon: <XCircle size={16} /> },
    'published': { text: '已发布', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', icon: <FileText size={16} /> }
};
