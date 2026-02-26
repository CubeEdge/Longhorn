import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Save, Send, ArrowLeft,
    Loader2, History, ChevronDown, FileText, Trash2, X, Check
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import axios from 'axios';
import TipTapEditor from './WikiEditor/TipTapEditor';
import type { TipTapEditorRef } from './WikiEditor/TipTapEditor';
import BokehEditorPanel from '../Bokeh/BokehEditorPanel';
import VersionHistory from './VersionHistory';
import { useBokehContext } from '../../store/useBokehContext';
import { useConfirm } from '../../store/useConfirm';

interface Article {
    id: number;
    title: string;
    content: string;
    slug: string;
    formatted_content?: string;
    format_status?: string;
    summary?: string;
}

interface WikiEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    article: Article | null;
    onSaved?: () => void;
    onStatusChange?: (status: string) => void;
    onToast?: (message: string, type: 'success' | 'error') => void;
}

const WikiEditorModal: React.FC<WikiEditorModalProps> = ({ isOpen, onClose, article, onSaved, onStatusChange, onToast }) => {
    const { token, user } = useAuthStore();
    const { setWikiEditContext, clearContext } = useBokehContext();
    const [isSaving, setIsSaving] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [optimizationProgress, setOptimizationProgress] = useState(0);
    const [optimizeAbortController, setOptimizeAbortController] = useState<AbortController | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [currentMarkdown, setCurrentMarkdown] = useState('');
    const [title, setTitle] = useState('');
    const [summary, setSummary] = useState('');
    const [showSummaryDropdown, setShowSummaryDropdown] = useState(false);
    const [showBokehDropdown, setShowBokehDropdown] = useState(false);
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);

    // Check if user has edit permission
    const hasEditPermission = user?.role === 'Admin' || user?.role === 'Lead';

    // 摘要编辑状态
    const SUMMARY_MAX_LENGTH = 300;

    // 删除草稿状态
    const [isDeleting, setIsDeleting] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    type ConfirmType = 'publish' | 'delete' | null;
    const [confirmAction, setConfirmAction] = useState<ConfirmType>(null);
    const summaryRef = useRef<HTMLTextAreaElement>(null);

    // Bokeh optimization review state
    const [bokehReviewContent, setBokehReviewContent] = useState<string | null>(null);
    const [bokehReviewSummary, setBokehReviewSummary] = useState<string | null>(null);
    const [bokehReviewMode, setBokehReviewMode] = useState<'summary' | 'layout' | 'full' | null>(null);

    // Get the global confirm from store
    const { confirm } = useConfirm();

    const handleSummaryResize = () => {
        if (summaryRef.current) {
            summaryRef.current.style.height = '78px';
            const scrollHeight = summaryRef.current.scrollHeight;
            summaryRef.current.style.height = Math.max(78, Math.min(scrollHeight, 300)) + 'px';
        }
    };

    useEffect(() => {
        if (showSummaryDropdown) {
            handleSummaryResize();
        }
    }, [showSummaryDropdown, summary]);

    // TipTap 编辑器引用 - 用于直接获取编辑器内容
    const editorRef = useRef<TipTapEditorRef>(null);
    const summaryDropdownRef = useRef<HTMLDivElement>(null);
    const bokehDropdownRef = useRef<HTMLDivElement>(null);
    const moreActionsDropdownRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭下拉框
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // 关闭摘要下拉框
            if (showSummaryDropdown && summaryDropdownRef.current && !summaryDropdownRef.current.contains(event.target as Node)) {
                setShowSummaryDropdown(false);
            }
            // 关闭Bokeh下拉框
            if (showBokehDropdown && bokehDropdownRef.current && !bokehDropdownRef.current.contains(event.target as Node)) {
                setShowBokehDropdown(false);
            }
            // 关闭更多操作下拉框
            if (showMoreActions && moreActionsDropdownRef.current && !moreActionsDropdownRef.current.contains(event.target as Node)) {
                setShowMoreActions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showSummaryDropdown, showBokehDropdown, showMoreActions]);

    // Load article content when modal opens
    useEffect(() => {
        if (isOpen && article) {
            // Priority: formatted_content (draft) > content (published)
            const rawContent = article.formatted_content || article.content || '';
            console.log('[WikiEditor] Article data:', {
                id: article.id,
                title: article.title,
                hasContent: !!article.content,
                contentLen: article.content?.length || 0,
                hasFormatted: !!article.formatted_content,
                formattedLen: article.formatted_content?.length || 0,
                rawContentLen: rawContent.length
            });
            console.log('[WikiEditor] Loading content preview:', rawContent.substring(0, 200) + '...');
            setEditorContent(rawContent);
            // Initialize currentMarkdown so publish button is enabled
            setCurrentMarkdown(rawContent);
            setTitle(article.title || '');
            // 加载摘要 - 统一使用 summary 字段
            setSummary(article.summary || '');

            // 设置 Bokeh 编辑器上下文
            setWikiEditContext({
                id: article.id,
                title: article.title,
                slug: article.slug,
                content: rawContent,
                hasDraft: !!article.formatted_content
            });
        }
    }, [isOpen, article, setWikiEditContext]);

    // 清除 Bokeh 上下文当编辑器关闭
    useEffect(() => {
        if (!isOpen) {
            clearContext();
        }
    }, [isOpen, clearContext]);

    // Use conditional rendering instead of early return to avoid React Hooks violation
    if (!isOpen || !article || !article.id) {
        return null;
    }

    // Save as draft - 直接保存 HTML 格式
    const handleSaveDraft = async () => {
        if (!token) {
            setError('请先登录');
            return;
        }
        if (!article?.id) {
            setError('文章ID无效');
            return;
        }

        setIsSaving(true);
        setError(null);
        try {
            // 直接从 TipTap 编辑器获取 HTML 内容
            let htmlContent: string;
            if (editorRef.current) {
                htmlContent = editorRef.current.getContent();
                console.log('[WikiEditor] Got HTML content from editor ref, length:', htmlContent.length);
            } else {
                // 降级：使用 state 中的内容
                htmlContent = currentMarkdown || editorContent;
                console.log('[WikiEditor] Editor ref not available, using state');
            }

            if (!htmlContent || htmlContent.trim() === '') {
                setError('内容不能为空');
                return;
            }

            console.log('[WikiEditor] Saving HTML content preview:', htmlContent.substring(0, 200) + '...');

            const res = await axios.patch(`/api/v1/knowledge/${article.id}`, {
                // 直接保存 HTML 格式，不转换为 Markdown
                formatted_content: htmlContent,
                format_status: 'draft',
                title: title,
                // 保存摘要 - 统一保存到summary字段
                summary: summary || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                if (onStatusChange) onStatusChange('draft');
                if (onSaved) onSaved();
            }
            onClose();
        } catch (err: any) {
            console.error('Save draft error:', err);
            setError(err.response?.data?.message || '保存草稿失败');
        } finally {
            setIsSaving(false);
        }
    };

    // AI Optimize with mode support
    const handleAIOptimize = async (mode: 'summary' | 'layout' | 'full' = 'layout') => {
        if (!token) {
            setError('请先登录');
            return;
        }
        if (!article?.id) {
            setError('文章ID无效');
            return;
        }

        setIsOptimizing(true);
        setError(null);
        setShowBokehDropdown(false);
        setOptimizationProgress(5);

        const controller = new AbortController();
        setOptimizeAbortController(controller);

        const progressInterval = setInterval(() => {
            setOptimizationProgress(prev => {
                const next = prev + (Math.random() * 5);
                return next > 95 ? 95 : next;
            });
        }, 800);

        try {
            const res = await axios.post(`/api/v1/knowledge/${article.id}/format`,
                { mode },
                {
                    headers: { Authorization: `Bearer ${token}` },
                    signal: controller.signal
                }
            );

            clearInterval(progressInterval);
            setOptimizationProgress(100);

            if (res.data.success) {
                // Show review modal instead of applying directly
                if (mode === 'summary' || mode === 'full') {
                    const newSummary = res.data.data.summary || null;
                    setBokehReviewSummary(newSummary);
                } else {
                    setBokehReviewSummary(null);
                }

                if (mode === 'layout' || mode === 'full') {
                    const newContent = res.data.data.formatted_content || null;
                    setBokehReviewContent(newContent);
                } else {
                    setBokehReviewContent(null);
                }

                setBokehReviewMode(mode);
            }
        } catch (err: any) {
            clearInterval(progressInterval);
            if (axios.isCancel(err)) {
                console.log('Optimization canceled');
                return;
            }
            console.error('AI optimize error:', err);
            setError(err.response?.data?.message || 'AI优化失败');
        } finally {
            setIsOptimizing(false);
            setOptimizationProgress(0);
            setOptimizeAbortController(null);
        }
    };

    const handleApplyBokehOptimization = () => {
        if (bokehReviewSummary) setSummary(bokehReviewSummary);
        if (bokehReviewContent) {
            setEditorContent(bokehReviewContent);
            setCurrentMarkdown(bokehReviewContent);
        }

        setBokehReviewSummary(null);
        setBokehReviewContent(null);
        setBokehReviewMode(null);

        if (onToast) onToast('AI 优化已成功应用，请切记保存草稿！', 'success');
    };

    const handleCancelBokehOptimization = () => {
        setBokehReviewSummary(null);
        setBokehReviewContent(null);
        setBokehReviewMode(null);
    };

    // Handle Bokeh panel changes
    const handleBokehChanges = (newContent: string) => {
        setEditorContent(newContent);
        setCurrentMarkdown(newContent);

        // 更新 Bokeh 上下文中的当前内容
        if (article) {
            setWikiEditContext({
                id: article.id,
                title: article.title,
                slug: article.slug,
                content: newContent,
                hasDraft: true
            });
        }
    };

    // Handle version rollback
    const handleVersionRollback = () => {
        // Refresh article content after rollback
        if (onSaved) onSaved();
    };

    // 跳过预览直接发布
    const handleDirectPublish = async () => {
        if (!token || !article?.id) return;
        setIsPublishing(true);
        setError(null);
        try {
            const htmlContent = editorRef.current?.getHTML() || '';
            // 保存至草稿
            await axios.patch(`/api/v1/knowledge/${article.id}`, {
                formatted_content: htmlContent,
                format_status: 'draft',
                title: title,
                change_summary: '发布前自动保存'
            }, { headers: { Authorization: `Bearer ${token}` } });

            // 自动备份快照
            await axios.post(`/api/v1/knowledge/${article.id}/create-snapshot`, {
                change_summary: '发布前自动备份'
            }, { headers: { Authorization: `Bearer ${token}` } });

            // 触发正式发布
            const res = await axios.post(`/api/v1/knowledge/${article.id}/publish-format`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                if (onStatusChange) onStatusChange('published');
                if (onSaved) onSaved();
                if (onToast) onToast('发布成功', 'success');
                onClose();
            }
        } catch (err: any) {
            console.error('Publish error:', err);
            if (onToast) onToast(err.response?.data?.message || '发布失败', 'error');
        } finally {
            setIsPublishing(false);
            setConfirmAction(null);
        }
    };

    // 删除草稿
    const handleDeleteDraft = async () => {
        if (!token) {
            setError('请先登录');
            return;
        }
        if (!article?.id) {
            setError('文章ID无效');
            return;
        }

        setIsDeleting(true);
        setError(null);
        try {
            // 将草稿内容清空，状态设为 none
            const res = await axios.patch(`/api/v1/knowledge/${article.id}`, {
                formatted_content: '',
                format_status: 'none',
                change_summary: '删除草稿'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                if (onStatusChange) onStatusChange('none');
                if (onSaved) onSaved();
                if (onToast) onToast('草稿已删除', 'success');
            }
            onClose();
        } catch (err: any) {
            console.error('Delete draft error:', err);
            if (onToast) onToast(err.response?.data?.message || '删除草稿失败', 'error');
        } finally {
            setIsDeleting(false);
            setConfirmAction(null);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.8)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
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
                            maxWidth: '1100px',
                            height: '90vh',
                            background: 'rgba(28, 28, 30, 0.95)',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            boxShadow: '0 25px 80px rgba(0,0,0,0.6)',
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
                            background: 'rgba(255,255,255,0.02)',
                            position: 'relative',
                            height: '72px'
                        }}>
                            {/* Left Section: Back button and Title */}
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                minWidth: 0,
                                paddingRight: '80px' // Ensure some space before middle button
                            }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.5)',
                                        cursor: 'pointer',
                                        padding: '8px',
                                        flexShrink: 0
                                    }}
                                >
                                    <ArrowLeft size={20} />
                                </button>

                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="编辑文章标题"
                                    style={{
                                        fontSize: title.length > 40 ? '1.4rem' : '1.8rem',
                                        fontWeight: 800,
                                        color: '#fff',
                                        letterSpacing: '-0.5px',
                                        margin: 0,
                                        flex: 1,
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        minWidth: 0
                                    }}
                                />
                            </div>

                            {/* Center Section: Summary Button (Absolute Centered) */}
                            <div ref={summaryDropdownRef} style={{
                                position: 'absolute',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 10
                            }}>
                                <button
                                    onClick={() => setShowSummaryDropdown(!showSummaryDropdown)}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        borderRadius: '8px',
                                        color: summary ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                    }}
                                >
                                    <FileText size={14} />
                                    摘要
                                    {summary && <span style={{ fontSize: '11px', opacity: 0.7, background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: '4px' }}>{summary.length}</span>}
                                    <ChevronDown size={14} style={{ transform: showSummaryDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                </button>

                                {/* 摘要下拉面板 */}
                                {showSummaryDropdown && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        marginTop: '10px',
                                        width: '640px',
                                        background: 'rgba(30, 30, 35, 0.98)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                                        padding: '16px',
                                        zIndex: 100,
                                        animation: 'fadeInUp 0.2s ease-out'
                                    }}>
                                        <textarea
                                            ref={summaryRef}
                                            value={summary}
                                            onChange={e => {
                                                setSummary(e.target.value);
                                                handleSummaryResize();
                                            }}
                                            placeholder="简要概括文章的核心内容..."
                                            maxLength={300}
                                            style={{
                                                width: '100%',
                                                height: '100px',
                                                background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '8px',
                                                padding: '14px',
                                                color: '#fff',
                                                fontSize: '14px',
                                                lineHeight: 1.6,
                                                resize: 'none',
                                                outline: 'none',
                                                transition: 'all 0.2s'
                                            }}
                                            autoFocus
                                        />
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginTop: '10px',
                                            fontSize: '11px',
                                            color: 'rgba(255,255,255,0.4)'
                                        }}>
                                            <span>用于列表预览和 SEO 优化</span>
                                            <span style={{
                                                color: summary.length >= SUMMARY_MAX_LENGTH ? '#ef4444' : 'rgba(255,255,255,0.4)'
                                            }}>
                                                {summary.length} / {SUMMARY_MAX_LENGTH}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Section: Error, Bokeh, Version */}
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                paddingLeft: '80px' // Ensure some space after middle button
                            }}>
                                {/* Error Display */}
                                {error && (
                                    <div style={{
                                        padding: '6px 12px',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '6px',
                                        color: '#fca5a5',
                                        fontSize: '12px',
                                        maxWidth: '200px',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {error}
                                    </div>
                                )}

                                {/* Bokeh 优化下拉菜单 */}
                                <div ref={bokehDropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                                    <button
                                        onClick={() => setShowBokehDropdown(!showBokehDropdown)}
                                        disabled={isOptimizing}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'rgba(0, 166, 80, 0.1)',
                                            border: '1px solid rgba(0, 166, 80, 0.3)',
                                            borderRadius: '8px',
                                            color: '#00A650',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: isOptimizing ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 4px 15px rgba(0, 166, 80, 0.15)'
                                        }}
                                        onMouseEnter={e => {
                                            if (!isOptimizing) {
                                                e.currentTarget.style.background = 'rgba(0, 166, 80, 0.2)';
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isOptimizing) {
                                                e.currentTarget.style.background = 'rgba(0, 166, 80, 0.1)';
                                                e.currentTarget.style.transform = 'translateY(0)';
                                            }
                                        }}
                                    >
                                        {isOptimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        Bokeh 优化
                                        <ChevronDown size={14} style={{ opacity: 0.7, transform: showBokehDropdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                    </button>

                                    {showBokehDropdown && !isOptimizing && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            right: 0,
                                            marginTop: '8px',
                                            width: '160px',
                                            background: 'rgba(30, 30, 35, 0.98)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '10px',
                                            boxShadow: '0 15px 40px rgba(0,0,0,0.5)',
                                            overflow: 'hidden',
                                            zIndex: 100
                                        }}>
                                            {[
                                                { label: '优化摘要', mode: 'summary' as const },
                                                { label: '优化正文', mode: 'layout' as const },
                                                { label: '同时优化', mode: 'full' as const }
                                            ].map((option) => (
                                                <button
                                                    key={option.mode}
                                                    onClick={() => handleAIOptimize(option.mode)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#fff',
                                                        fontSize: '13px',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        transition: 'background 0.2s',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Version History Button */}
                                <button
                                    onClick={() => setShowVersionHistory(true)}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.12)',
                                        borderRadius: '8px',
                                        color: 'rgba(255,255,255,0.7)',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        transition: 'all 0.2s',
                                        flexShrink: 0
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                                    }}
                                >
                                    <History size={14} />
                                    版本历史
                                </button>
                            </div>
                        </div>

                        {/* TipTap Editor */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <TipTapEditor
                                ref={editorRef}
                                content={editorContent}
                                editable={true}
                                onChange={(markdown) => {
                                    console.log('[WikiEditor] onChange called, markdown length:', markdown?.length || 0);
                                    setCurrentMarkdown(markdown);
                                }}
                                onSave={(markdown) => {
                                    setCurrentMarkdown(markdown);
                                    handleSaveDraft();
                                }}
                                placeholder="开始编辑文章内容..."
                            />
                        </div>

                        {/* Footer Actions - 包含 Bokeh 助手和操作按钮 */}
                        <div style={{
                            padding: '12px 24px',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '12px',
                            background: 'rgba(0,0,0,0.2)'
                        }}>
                            {/* 左侧: Bokeh 助手按钮 */}
                            <BokehEditorPanel
                                articleId={article.id}
                                articleTitle={article.title}
                                currentContent={currentMarkdown || editorContent}
                                onApplyChanges={handleBokehChanges}
                            />
                            {/* 右侧: 操作按钮 - 归纳至两个按钮 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
                                {/* 主要操作组：存草稿 */}
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={isSaving}
                                    style={{
                                        padding: '8px 24px',
                                        background: '#00A650',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(0, 166, 80, 0.3)'
                                    }}
                                    onMouseEnter={e => {
                                        if (!isSaving) {
                                            e.currentTarget.style.background = '#008b43';
                                            e.currentTarget.style.transform = 'translateY(-1px)';
                                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 166, 80, 0.4)';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isSaving) {
                                            e.currentTarget.style.background = '#00A650';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 166, 80, 0.3)';
                                        }
                                    }}
                                >
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    保存修改
                                </button>

                                {/* 更多操作下拉菜单 */}
                                <div ref={moreActionsDropdownRef} className="more-actions-container" style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => setShowMoreActions(!showMoreActions)}
                                        style={{
                                            padding: '8px 12px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px',
                                            color: '#fff',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        更多操作
                                        <ChevronDown size={14} />
                                    </button>

                                    <AnimatePresence>
                                        {showMoreActions && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                transition={{ duration: 0.15 }}
                                                style={{
                                                    position: 'absolute',
                                                    bottom: '100%',
                                                    right: 0,
                                                    marginBottom: '8px',
                                                    width: '160px',
                                                    background: '#2a2a2a',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 -4px 20px rgba(0,0,0,0.5)',
                                                    overflow: 'hidden',
                                                    zIndex: 100
                                                }}
                                            >
                                                <button
                                                    onClick={async () => {
                                                        setShowMoreActions(false);
                                                        const confirmed = await confirm(
                                                            '发布内容将立刻覆盖现有的线上稳定版本，确定发布此草稿？',
                                                            '发布此草稿',
                                                            '确认发布',
                                                            '取消',
                                                            3 // 3秒倒计时
                                                        );
                                                        if (confirmed) {
                                                            await handleDirectPublish();
                                                        }
                                                    }}
                                                    disabled={isSaving || !currentMarkdown || !hasEditPermission || isPublishing}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 14px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                        color: '#FFD700',
                                                        fontSize: '12px',
                                                        textAlign: 'left',
                                                        cursor: (isSaving || !currentMarkdown || !hasEditPermission || isPublishing) ? 'not-allowed' : 'pointer',
                                                        opacity: (!currentMarkdown || !hasEditPermission || isPublishing) ? 0.5 : 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    {isPublishing ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                                    发布草稿
                                                </button>

                                                <button
                                                    onClick={async () => {
                                                        setShowMoreActions(false);
                                                        const confirmed = await confirm(
                                                            '确定要删除当前草稿吗？此操作不可逆。删除后将展示之前已发布的线上版本。',
                                                            '删除草稿',
                                                            '确认删除',
                                                            '取消',
                                                            3 // 3秒倒计时
                                                        );
                                                        if (confirmed) {
                                                            await handleDeleteDraft();
                                                        }
                                                    }}
                                                    disabled={isDeleting || !hasEditPermission}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 14px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                        color: '#ef4444',
                                                        fontSize: '12px',
                                                        textAlign: 'left',
                                                        cursor: (isDeleting || !hasEditPermission) ? 'not-allowed' : 'pointer',
                                                        opacity: !hasEditPermission ? 0.5 : 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <Trash2 size={12} />
                                                    删除草稿
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setShowMoreActions(false);
                                                        onClose();
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        padding: '10px 14px',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#aaa',
                                                        fontSize: '12px',
                                                        textAlign: 'left',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px'
                                                    }}
                                                >
                                                    <X size={12} />
                                                    取消并退出
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Version History Panel */}
            <AnimatePresence>
                {showVersionHistory && (
                    <VersionHistory
                        articleId={article.id}
                        onClose={() => setShowVersionHistory(false)}
                        onRollback={handleVersionRollback}
                    />
                )}
            </AnimatePresence>

            {/* Custom Confirm Modal for Delete and Publish */}
            {confirmAction && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 11000,
                    borderRadius: '20px'
                }}>
                    <div style={{
                        width: '80%',
                        maxWidth: '400px',
                        background: '#1a1a1a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '32px',
                        boxShadow: '0 30px 100px rgba(0,0,0,0.8)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '24px'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                width: '56px', height: '56px',
                                background: confirmAction === 'delete' ? 'rgba(239,68,68,0.1)' : 'rgba(56,189,248,0.1)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px',
                                color: confirmAction === 'delete' ? '#EF4444' : '#38BDF8'
                            }}>
                                {confirmAction === 'delete' ? <Trash2 size={28} /> : <Send size={28} />}
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', margin: '0 0 12px' }}>
                                {confirmAction === 'delete' ? '删除草稿' : '发布为正式版？'}
                            </h3>
                            <p style={{ fontSize: '14px', color: '#888', margin: 0, lineHeight: 1.6 }}>
                                {confirmAction === 'delete'
                                    ? '确定要删除当前草稿吗？此操作不可逆。删除后将展示之前已发布的线上版本。'
                                    : '发布后，内容将立刻对用户可见，并自动创建一个备份快照以供回滚。'}
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button
                                onClick={async () => {
                                    if (confirmAction === 'publish') {
                                        await handleDirectPublish();
                                    } else {
                                        await handleDeleteDraft();
                                    }
                                }}
                                disabled={isDeleting || isPublishing}
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    background: confirmAction === 'delete' ? '#EF4444' : '#FFD700',
                                    border: 'none',
                                    borderRadius: '12px',
                                    color: confirmAction === 'delete' ? '#fff' : '#000',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    cursor: (isDeleting || isPublishing) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s',
                                    opacity: (isDeleting || isPublishing) ? 0.7 : 1
                                }}
                            >
                                {(isDeleting || isPublishing) && <Loader2 size={16} className="animate-spin" />}
                                {confirmAction === 'delete' ? '确认删除' : '直接发布'}
                            </button>
                            <button
                                onClick={() => setConfirmAction(null)}
                                disabled={isDeleting || isPublishing}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: '14px',
                                    cursor: (isDeleting || isPublishing) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bokeh Optimization Progress Modal */}
            {isOptimizing && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 11000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <div style={{
                        width: '400px',
                        background: '#1a1a1a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        padding: '30px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '20px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.6)'
                    }}>
                        <div style={{ color: '#00A650', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 600 }}>
                            <Sparkles className="animate-pulse" />
                            Bokeh 正在优化中...
                        </div>

                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${optimizationProgress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, #00A650 0%, #8E24AA 100%)',
                                transition: 'width 0.2s',
                                borderRadius: '4px'
                            }} />
                        </div>

                        <div style={{ color: '#888', fontSize: '13px', textAlign: 'center' }}>
                            AI 正在分析并处理内容，可能需要十多秒，请耐心等待。
                        </div>

                        <button
                            onClick={() => {
                                if (optimizeAbortController) {
                                    optimizeAbortController.abort();
                                }
                            }}
                            style={{
                                padding: '8px 24px',
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#ddd',
                                borderRadius: '8px',
                                fontSize: '14px',
                                cursor: 'pointer',
                                marginTop: '8px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            取消优化
                        </button>
                    </div>
                </div>
            )}

            {/* Bokeh Review Diff Modal */}
            {bokehReviewMode && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 11000,
                    borderRadius: '20px'
                }}>
                    <div style={{
                        width: '90%',
                        height: '90%',
                        background: '#1a1a1a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '16px',
                        boxShadow: '0 30px 100px rgba(0,0,0,0.8)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    background: 'linear-gradient(135deg, rgba(0, 166, 80, 0.2), rgba(142, 36, 170, 0.2))',
                                    padding: '8px',
                                    borderRadius: '8px',
                                    color: '#00A650'
                                }}>
                                    <Sparkles size={20} />
                                </div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
                                    Bokeh AI 优化结果预览
                                </h3>
                            </div>
                            <button
                                onClick={handleCancelBokehOptimization}
                                style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }}
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* Left Side - Original */}
                            <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888', fontSize: '13px', fontWeight: 600, textAlign: 'center' }}>
                                    原版内容
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', color: 'rgba(255,255,255,0.6)' }} className="markdown-content">
                                    {(bokehReviewMode === 'summary' || bokehReviewMode === 'full') && (
                                        <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                                            <h4 style={{ color: '#fff', marginBottom: '8px' }}>当前摘要:</h4>
                                            <p>{summary || '（暂无摘要）'}</p>
                                        </div>
                                    )}
                                    {(bokehReviewMode === 'layout' || bokehReviewMode === 'full') && (
                                        <div dangerouslySetInnerHTML={{ __html: editorContent }} />
                                    )}
                                </div>
                            </div>

                            {/* Right Side - Optimized */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '12px 20px', background: 'rgba(0, 166, 80, 0.05)', borderBottom: '1px solid rgba(0, 166, 80, 0.1)', color: '#00A650', fontSize: '13px', fontWeight: 600, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                                    <Sparkles size={14} /> Bokeh 优化版
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', color: '#fff' }} className="markdown-content">
                                    {(bokehReviewMode === 'summary' || bokehReviewMode === 'full') && bokehReviewSummary && (
                                        <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px dashed rgba(255,255,255,0.1)' }}>
                                            <h4 style={{ color: '#00A650', marginBottom: '8px' }}>优化后摘要:</h4>
                                            <p>{bokehReviewSummary}</p>
                                        </div>
                                    )}
                                    {(bokehReviewMode === 'layout' || bokehReviewMode === 'full') && bokehReviewContent && (
                                        <div dangerouslySetInnerHTML={{ __html: bokehReviewContent }} />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div style={{
                            padding: '20px 24px',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            background: 'rgba(0,0,0,0.2)'
                        }}>
                            <button
                                onClick={handleCancelBokehOptimization}
                                style={{
                                    padding: '10px 24px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                放弃修改
                            </button>
                            <button
                                onClick={handleApplyBokehOptimization}
                                style={{
                                    padding: '10px 24px',
                                    background: '#00A650',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 4px 15px rgba(0, 166, 80, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = '#008b43';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = '#00A650';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <Check size={16} />
                                保存修改
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default WikiEditorModal;
