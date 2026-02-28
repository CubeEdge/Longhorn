/**
 * PublishPreviewModal - 发布预览确认组件
 * 显示草稿与当前版本的对比，确认后发布
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Send, X, FileText,
    Check, AlertTriangle, Loader2
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface PublishPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    articleId: number;
    articleTitle: string;
    draftContent: string;
    onPublished: () => void;
}

const PublishPreviewModal: React.FC<PublishPreviewModalProps> = ({
    isOpen,
    onClose,
    articleId,
    articleTitle,
    draftContent,
    onPublished
}) => {
    const [currentContent, setCurrentContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [changeSummary, setChangeSummary] = useState('');
    const { token } = useAuthStore();

    useEffect(() => {
        if (isOpen && articleId) {
            fetchCurrentContent();
        }
    }, [isOpen, articleId]);

    const fetchCurrentContent = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/knowledge/${articleId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setCurrentContent(res.data.data.content || '');
                
                // Calculate change summary
                const currentLen = (res.data.data.content || '').length;
                const draftLen = draftContent.length;
                const diff = draftLen - currentLen;
                
                if (diff > 0) {
                    setChangeSummary(`新增 ${diff} 字符`);
                } else if (diff < 0) {
                    setChangeSummary(`减少 ${Math.abs(diff)} 字符`);
                } else {
                    setChangeSummary('内容长度相同');
                }
            }
        } catch (err) {
            console.error('Failed to fetch current content:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            // First save draft
            await axios.patch(`/api/v1/knowledge/${articleId}`, {
                formatted_content: draftContent,
                format_status: 'draft',
                change_summary: '发布前保存'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Create snapshot before publish
            await axios.post(`/api/v1/knowledge/${articleId}/create-snapshot`, {
                change_summary: '发布前自动备份'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Publish
            const res = await axios.post(`/api/v1/knowledge/${articleId}/publish-format`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                onPublished();
                onClose();
            }
        } catch (err: any) {
            console.error('Publish error:', err);
            alert(err.response?.data?.error?.message || '发布失败');
        } finally {
            setPublishing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10002,
                padding: '40px'
            }}
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                style={{
                    width: '100%',
                    maxWidth: '900px',
                    maxHeight: '85vh',
                    background: 'rgba(28, 28, 30, 0.98)',
                    borderRadius: '20px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Send size={18} color="#FFD700" />
                            发布预览确认
                        </h3>
                        <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                            {articleTitle}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px',
                            color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content Comparison */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    gap: '16px',
                    padding: '20px',
                    overflow: 'auto'
                }}>
                    {/* Current Version */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.08)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <FileText size={14} color="rgba(255,255,255,0.5)" />
                            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 500 }}>
                                当前版本
                            </span>
                            <span style={{
                                marginLeft: 'auto',
                                fontSize: '11px',
                                color: 'rgba(255,255,255,0.3)',
                                background: 'rgba(255,255,255,0.05)',
                                padding: '2px 8px',
                                borderRadius: '4px'
                            }}>
                                {currentContent.length} 字符
                            </span>
                        </div>
                        <div style={{
                            flex: 1,
                            padding: '16px',
                            overflow: 'auto',
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.6)',
                            lineHeight: 1.6,
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}>
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                                    <Loader2 size={20} className="animate-spin" color="rgba(255,255,255,0.3)" />
                                </div>
                            ) : (
                                currentContent.substring(0, 2000) || '(空)'
                            )}
                            {currentContent.length > 2000 && <span style={{ color: 'rgba(255,255,255,0.3)' }}>... (已截断)</span>}
                        </div>
                    </div>

                    {/* Draft Version */}
                    <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'rgba(255,215,0,0.03)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,215,0,0.2)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid rgba(255,215,0,0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}>
                            <FileText size={14} color="#FFD700" />
                            <span style={{ color: '#FFD700', fontSize: '13px', fontWeight: 500 }}>
                                待发布草稿
                            </span>
                            <span style={{
                                marginLeft: 'auto',
                                fontSize: '11px',
                                color: '#FFD700',
                                background: 'rgba(255,215,0,0.1)',
                                padding: '2px 8px',
                                borderRadius: '4px'
                            }}>
                                {draftContent.length} 字符
                            </span>
                        </div>
                        <div style={{
                            flex: 1,
                            padding: '16px',
                            overflow: 'auto',
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.8)',
                            lineHeight: 1.6,
                            fontFamily: 'monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}>
                            {draftContent.substring(0, 2000) || '(空)'}
                            {draftContent.length > 2000 && <span style={{ color: 'rgba(255,255,255,0.3)' }}>... (已截断)</span>}
                        </div>
                    </div>
                </div>

                {/* Change Summary */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: changeSummary.includes('新增') ? '#4ade80' : 
                               changeSummary.includes('减少') ? '#fca5a5' : 'rgba(255,255,255,0.5)',
                        fontSize: '13px'
                    }}>
                        {changeSummary.includes('新增') ? <Check size={14} /> : 
                         changeSummary.includes('减少') ? <AlertTriangle size={14} /> : null}
                        {changeSummary}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
                        发布后将自动创建备份快照
                    </div>
                </div>

                {/* Actions */}
                <div style={{
                    padding: '20px 24px',
                    borderTop: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    <button
                        onClick={onClose}
                        disabled={publishing}
                        style={{
                            padding: '12px 24px',
                            background: 'transparent',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '10px',
                            color: 'rgba(255,255,255,0.7)',
                            fontSize: '14px',
                            cursor: publishing ? 'not-allowed' : 'pointer',
                            opacity: publishing ? 0.5 : 1
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={handlePublish}
                        disabled={publishing || !draftContent}
                        style={{
                            padding: '12px 28px',
                            background: publishing || !draftContent 
                                ? 'rgba(255,215,0,0.3)' 
                                : 'linear-gradient(135deg, #FFD700, #D4A017)',
                            border: 'none',
                            borderRadius: '10px',
                            color: '#000',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: publishing || !draftContent ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {publishing ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                发布中...
                            </>
                        ) : (
                            <>
                                <Send size={16} />
                                确认发布
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default PublishPreviewModal;
