import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Sparkles, Save, Send, ArrowLeft,
    Loader2, History, ChevronDown, FileText, Trash2
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import axios from 'axios';
import TipTapEditor from './WikiEditor/TipTapEditor';
import type { TipTapEditorRef } from './WikiEditor/TipTapEditor';
import BokehEditorPanel from '../Bokeh/BokehEditorPanel';
import VersionHistory from './VersionHistory';
import PublishPreviewModal from './PublishPreviewModal';
import { useConfirm } from '../../store/useConfirm';
import { useBokehContext } from '../../store/useBokehContext';

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
}

const WikiEditorModal: React.FC<WikiEditorModalProps> = ({ isOpen, onClose, article, onSaved }) => {
    const { token } = useAuthStore();
    const { confirm } = useConfirm();
    const { setWikiEditContext, clearContext } = useBokehContext();
    const [isSaving, setIsSaving] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState('');
    const [currentMarkdown, setCurrentMarkdown] = useState('');
    const [showVersionHistory, setShowVersionHistory] = useState(false);
    const [showPublishPreview, setShowPublishPreview] = useState(false);
    
    // 摘要编辑状态
    const [summary, setSummary] = useState('');
    const [showSummaryDropdown, setShowSummaryDropdown] = useState(false);
    const SUMMARY_MAX_LENGTH = 200;
    
    // Bokeh 优化下拉菜单
    const [showBokehDropdown, setShowBokehDropdown] = useState(false);
    
    // 删除草稿状态
    const [isDeleting, setIsDeleting] = useState(false);
    
    // TipTap 编辑器引用 - 用于直接获取编辑器内容
    const editorRef = useRef<TipTapEditorRef>(null);
    const summaryDropdownRef = useRef<HTMLDivElement>(null);
    const bokehDropdownRef = useRef<HTMLDivElement>(null);

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
                // 保存摘要 - 统一保存到summary字段
                summary: summary || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success && onSaved) {
                onSaved();
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
    const handleAIOptimize = async (mode: 'summary' | 'content' | 'full' = 'content') => {
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
        try {
            const res = await axios.post(`/api/v1/knowledge/${article.id}/format`, 
                { mode },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                // Update editor content with AI-optimized result
                if (mode === 'summary' || mode === 'full') {
                    // 使用 summary 字段
                    const newSummary = res.data.data.summary || '';
                    if (newSummary) setSummary(newSummary);
                }
                if (mode === 'content' || mode === 'full') {
                    const newContent = res.data.data.formatted_content || '';
                    if (newContent) setEditorContent(newContent);
                }
            }
        } catch (err: any) {
            console.error('AI optimize error:', err);
            setError(err.response?.data?.message || 'AI优化失败');
        } finally {
            setIsOptimizing(false);
        }
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

    // Handle publish completed
    const handlePublishComplete = () => {
        if (onSaved) onSaved();
        onClose();
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

            if (res.data.success && onSaved) {
                onSaved();
            }
            onClose();
        } catch (err: any) {
            console.error('Delete draft error:', err);
            setError(err.response?.data?.message || '删除草稿失败');
        } finally {
            setIsDeleting(false);
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
                            gap: '16px',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <button 
                                onClick={onClose}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.5)',
                                    cursor: 'pointer',
                                    padding: '8px'
                                }}
                            >
                                <ArrowLeft size={20} />
                            </button>
                            
                            <h2 style={{ 
                                fontSize: '18px', 
                                fontWeight: 600, 
                                color: '#fff',
                                margin: 0 
                            }}>
                                {article?.title || '编辑文章'}
                            </h2>
                            
                            {/* 摘要下拉按钮 */}
                            <div ref={summaryDropdownRef} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowSummaryDropdown(!showSummaryDropdown)}
                                    style={{
                                        padding: '6px 12px',
                                        background: summary ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255,255,255,0.05)',
                                        border: summary ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '6px',
                                        color: summary ? '#4CAF50' : 'rgba(255,255,255,0.6)',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <FileText size={13} />
                                    摘要
                                    {summary && <span style={{ fontSize: '10px', opacity: 0.7 }}>({summary.length})</span>}
                                    <ChevronDown size={12} />
                                </button>
                                
                                {/* 摘要下拉面板 */}
                                {showSummaryDropdown && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '4px',
                                        width: '640px',
                                        background: 'rgba(30, 30, 35, 0.98)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                        padding: '12px',
                                        zIndex: 100
                                    }}>
                                        <textarea
                                            value={summary}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val.length <= SUMMARY_MAX_LENGTH) {
                                                    setSummary(val);
                                                }
                                            }}
                                            placeholder="输入文章摘要..."
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '6px',
                                                color: '#fff',
                                                fontSize: '12px',
                                                resize: 'none',
                                                height: '80px',
                                                outline: 'none',
                                                lineHeight: '1.5'
                                            }}
                                            autoFocus
                                        />
                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            marginTop: '8px',
                                            fontSize: '10px',
                                            color: 'rgba(255,255,255,0.4)'
                                        }}>
                                            <span>用于列表和SEO</span>
                                            <span style={{
                                                color: summary.length >= SUMMARY_MAX_LENGTH ? '#f87171' : 'rgba(255,255,255,0.4)'
                                            }}>
                                                {summary.length}/{SUMMARY_MAX_LENGTH}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ flex: 1 }} />

                            {/* Error Display */}
                            {error && (
                                <div style={{
                                    padding: '8px 12px',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    borderRadius: '8px',
                                    color: '#fca5a5',
                                    fontSize: '12px'
                                }}>
                                    {error}
                                </div>
                            )}

                            {/* Bokeh 优化下拉菜单 */}
                            <div ref={bokehDropdownRef} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowBokehDropdown(!showBokehDropdown)}
                                    disabled={isOptimizing}
                                    style={{
                                        padding: '8px 14px',
                                        background: isOptimizing ? 'rgba(142, 36, 170, 0.3)' : 'linear-gradient(135deg, #00BFA5, #8E24AA)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: isOptimizing ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {isOptimizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    Bokeh 优化
                                    <ChevronDown size={12} />
                                </button>
                                
                                {/* Bokeh 下拉菜单选项 */}
                                {showBokehDropdown && !isOptimizing && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '4px',
                                        width: '160px',
                                        background: 'rgba(30, 30, 35, 0.98)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                        overflow: 'hidden',
                                        zIndex: 100
                                    }}>
                                        {[
                                            { label: '优化摘要', mode: 'summary' as const },
                                            { label: '优化正文', mode: 'content' as const },
                                            { label: '同时优化', mode: 'full' as const }
                                        ].map((option) => (
                                            <button
                                                key={option.mode}
                                                onClick={() => handleAIOptimize(option.mode)}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    borderBottom: option.mode !== 'full' ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                                    color: '#fff',
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'background 0.15s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'transparent';
                                                }}
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
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <History size={14} />
                                版本历史
                            </button>
                        </div>

                        {/* TipTap Editor */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <TipTapEditor
                                ref={editorRef}
                                content={editorContent}
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
                            {/* 右侧: 操作按钮 */}
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        borderRadius: '6px',
                                        color: '#ccc',
                                        fontSize: '13px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    取消
                                </button>
                                
                                <button
                                    onClick={async () => {
                                        const confirmed = await confirm(
                                            '确定要删除当前草稿吗？此操作不可恢复，将会清空所有草稿内容。',
                                            '删除草稿',
                                            '删除',
                                            '取消'
                                        );
                                        if (confirmed) {
                                            await handleDeleteDraft();
                                        }
                                    }}
                                    disabled={isDeleting}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'rgba(239, 68, 68, 0.15)',
                                        border: '1px solid rgba(239, 68, 68, 0.4)',
                                        borderRadius: '6px',
                                        color: '#ef4444',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    删除草稿
                                </button>
                                
                                <button
                                    onClick={handleSaveDraft}
                                    disabled={isSaving}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: isSaving ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    存草稿
                                </button>
                                
                                <button
                                    onClick={() => setShowPublishPreview(true)}
                                    disabled={isSaving || !currentMarkdown}
                                    style={{
                                        padding: '8px 16px',
                                        background: 'rgba(255, 215, 0, 0.15)',
                                        border: '1px solid #FFD700',
                                        borderRadius: '6px',
                                        color: '#FFD700',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: isSaving || !currentMarkdown ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        opacity: !currentMarkdown ? 0.5 : 1
                                    }}
                                >
                                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    发布草稿
                                </button>
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

            {/* Publish Preview Modal */}
            <PublishPreviewModal
                isOpen={showPublishPreview}
                onClose={() => setShowPublishPreview(false)}
                articleId={article.id}
                articleTitle={article.title}
                draftContent={currentMarkdown || editorContent}
                onPublished={handlePublishComplete}
            />
        </AnimatePresence>
    );
};

export default WikiEditorModal;
