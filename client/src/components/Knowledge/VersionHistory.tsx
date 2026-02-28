/**
 * VersionHistory - Wiki文章版本历史组件
 * 显示版本列表、查看历史版本、回滚功能
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    History, ChevronLeft, RotateCcw, Eye,
    Loader2, Clock, User, FileText, Trash2, CheckCircle, XCircle
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useConfirm } from '../../store/useConfirm';

interface Version {
    id: number;
    version: number;
    title: string;
    change_summary: string | null;
    created_at: string;
    created_by: string | null;
}

interface VersionHistoryProps {
    articleId: number;
    onClose: () => void;
    onRollback?: () => void;
}

const VersionHistory: React.FC<VersionHistoryProps> = ({
    articleId,
    onClose,
    onRollback
}) => {
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
    const [versionContent, setVersionContent] = useState<string>('');
    const [contentLoading, setContentLoading] = useState(false);
    const [rollingBack, setRollingBack] = useState<number | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const { token } = useAuthStore();
    const { confirm } = useConfirm();

    useEffect(() => {
        fetchVersions();
    }, [articleId]);

    const fetchVersions = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/knowledge/${articleId}/versions`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setVersions(res.data.data.versions);
            }
        } catch (err) {
            console.error('Failed to fetch versions:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchVersionContent = async (version: Version) => {
        setSelectedVersion(version);
        setContentLoading(true);
        setVersionContent('');

        try {
            const res = await axios.get(`/api/v1/knowledge/${articleId}/versions/${version.version}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setVersionContent(res.data.data.content);
            }
        } catch (err) {
            console.error('Failed to fetch version content:', err);
        } finally {
            setContentLoading(false);
        }
    };

    // Show toast notification
    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3000);
    };

    const handleRollback = async (version: Version) => {
        const confirmed = await confirm(
            `当前内容将被备份为新版本。`,
            `回滚到版本 #${version.version}`,
            '确认回滚',
            '取消'
        );
        if (!confirmed) return;

        setRollingBack(version.version);
        try {
            const res = await axios.post(`/api/v1/knowledge/${articleId}/rollback/${version.version}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                showToast('success', res.data.data.message || `已回滚到版本 #${version.version}`);
                fetchVersions();
                if (onRollback) onRollback();
            }
        } catch (err: any) {
            console.error('Rollback failed:', err);
            showToast('error', err.response?.data?.error?.message || '回滚失败');
        } finally {
            setRollingBack(null);
        }
    };

    const handleDelete = async (version: Version) => {
        const confirmed = await confirm(
            `此操作不可撤销。`,
            `删除版本 #${version.version}`,
            '确认删除',
            '取消'
        );
        if (!confirmed) return;

        setDeleting(version.version);
        try {
            const res = await axios.delete(`/api/v1/knowledge/${articleId}/versions/${version.version}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                showToast('success', res.data.data.message || `已删除版本 #${version.version}`);
                fetchVersions();
            }
        } catch (err: any) {
            console.error('Delete version failed:', err);
            showToast('error', err.response?.data?.error?.message || '删除失败');
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <>
            {/* 遗罩层 - 点击关闭侧边栏 */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.3)',
                    zIndex: 10000
                }}
            />
            <motion.div
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 300 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    right: 0,
                    width: '500px',
                    height: '100vh',
                    background: 'rgba(28, 28, 30, 0.98)',
                    borderLeft: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 10001
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <History size={18} color="#FFD700" />
                    <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '16px' }}>版本历史</h3>
                </div>

                {/* Version List */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                            <Loader2 size={24} className="animate-spin" color="#FFD700" />
                        </div>
                    ) : versions.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px' }}>
                            暂无版本历史
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {versions.map((v, idx) => (
                                <div
                                    key={v.id}
                                    style={{
                                        background: selectedVersion?.id === v.id
                                            ? 'rgba(255,215,0,0.1)'
                                            : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${selectedVersion?.id === v.id ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: '12px',
                                        padding: '16px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{
                                            background: idx === 0 ? 'linear-gradient(135deg, #FFD700, #D4A017)' : 'rgba(255,255,255,0.1)',
                                            color: idx === 0 ? '#000' : 'rgba(255,255,255,0.7)',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: 600
                                        }}>
                                            v{v.version}
                                            {idx === 0 && ' (当前)'}
                                        </span>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => fetchVersionContent(v)}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '6px',
                                                    color: 'rgba(255,255,255,0.7)',
                                                    padding: '6px 10px',
                                                    fontSize: '12px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Eye size={12} />
                                                查看
                                            </button>
                                            {idx !== 0 && (
                                                <>
                                                    <button
                                                        onClick={() => handleRollback(v)}
                                                        disabled={rollingBack === v.version}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            borderRadius: '6px',
                                                            color: '#fca5a5',
                                                            padding: '6px 10px',
                                                            fontSize: '12px',
                                                            cursor: rollingBack === v.version ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            opacity: rollingBack === v.version ? 0.5 : 1
                                                        }}
                                                    >
                                                        {rollingBack === v.version ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <RotateCcw size={12} />
                                                        )}
                                                        回滚
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(v)}
                                                        disabled={deleting === v.version}
                                                        style={{
                                                            background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.15)',
                                                            borderRadius: '6px',
                                                            color: 'rgba(255,255,255,0.5)',
                                                            padding: '6px 10px',
                                                            fontSize: '12px',
                                                            cursor: deleting === v.version ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            opacity: deleting === v.version ? 0.5 : 1
                                                        }}
                                                    >
                                                        {deleting === v.version ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Trash2 size={12} />
                                                        )}
                                                        删除
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginBottom: '6px' }}>
                                        <FileText size={12} style={{ marginRight: '6px', display: 'inline', opacity: 0.5 }} />
                                        {v.title}
                                    </div>

                                    {v.change_summary && (
                                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                                            {v.change_summary}
                                        </div>
                                    )}

                                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', display: 'flex', gap: '16px' }}>
                                        <span>
                                            <Clock size={10} style={{ marginRight: '4px', display: 'inline' }} />
                                            {formatDate(v.created_at)}
                                        </span>
                                        {v.created_by && (
                                            <span>
                                                <User size={10} style={{ marginRight: '4px', display: 'inline' }} />
                                                {v.created_by}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Version Content Preview */}
                <AnimatePresence>
                    {selectedVersion && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: '40vh', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            style={{
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <span style={{ fontSize: '13px', color: '#FFD700' }}>
                                    v{selectedVersion.version} 内容预览
                                </span>
                                <button
                                    onClick={() => setSelectedVersion(null)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer',
                                        fontSize: '12px'
                                    }}
                                >
                                    关闭
                                </button>
                            </div>
                            <div style={{
                                flex: 1,
                                overflow: 'auto',
                                padding: '16px',
                                background: 'rgba(0,0,0,0.2)'
                            }}>
                                {contentLoading ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
                                        <Loader2 size={20} className="animate-spin" color="#FFD700" />
                                    </div>
                                ) : (
                                    <pre style={{
                                        margin: 0,
                                        fontSize: '12px',
                                        color: 'rgba(255,255,255,0.8)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontFamily: 'monospace'
                                    }}>
                                        {versionContent.substring(0, 3000)}
                                        {versionContent.length > 3000 && '\n\n... (内容已截断)'}
                                    </pre>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toast Notification */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            style={{
                                position: 'fixed',
                                bottom: '24px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '14px 24px',
                                borderRadius: '8px',
                                background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                                zIndex: 10100
                            }}
                        >
                            {toast.type === 'success' ? (
                                <CheckCircle size={18} color="#fff" />
                            ) : (
                                <XCircle size={18} color="#fff" />
                            )}
                            <span style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: 500 }}>
                                {toast.message}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </>
    );
};

export default VersionHistory;
