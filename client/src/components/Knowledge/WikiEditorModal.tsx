import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bold, Italic, List, ListOrdered, Heading2, Quote, Code, Sparkles, Save, Send, ArrowLeft,
    Loader2, Image as ImageIcon
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import axios from 'axios';

// Simple markdown to HTML converter
const markdownToHtml = (markdown: string): string => {
    if (!markdown) return '';
    
    let html = markdown
        // Escape HTML
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Headers
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.*?)__/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/_(.*?)_/g, '<em>$1</em>')
        // Code
        .replace(/`([^`]+)`/g, '<code style="background:rgba(255,215,0,0.1);padding:2px 6px;border-radius:4px;color:#FFD700;font-size:13px;">$1</code>')
        // Code blocks
        .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.4);padding:16px;border-radius:10px;overflow:auto;font-size:13px;margin:16px 0;border:1px solid rgba(255,255,255,0.08);"><code>$1</code></pre>')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:#FFD700;text-decoration:none;border-bottom:1px solid rgba(255,215,0,0.3);">$1</a>')
        // Images - with resize handle
        .replace(/<img([^>]+)>/g, '<div class="wiki-image-wrapper" style="position:relative;display:inline-block;margin:16px 0;" contenteditable="false"><img$1 style="max-width:100%;height:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.1);display:block;" class="resizable-image"><div class="resize-handle" style="position:absolute;bottom:-8px;right:-8px;width:16px;height:16px;background:#FFD700;border-radius:50%;cursor:nwse-resize;box-shadow:0 2px 8px rgba(0,0,0,0.5);z-index:10;"></div></div>')
        // Tables
        .replace(/\|(.+)\|/g, (_match, content) => {
            const cells = content.split('|').map((c: string) => c.trim());
            return '<tr>' + cells.map((c: string) => `<td style="padding:12px;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px;">${c}</td>`).join('') + '</tr>';
        })
        // Blockquotes
        .replace(/^> (.*$)/gim, '<blockquote style="border-left:3px solid #FFD700;padding-left:20px;margin:16px 0;color:#999;font-style:italic;">$1</blockquote>')
        // Horizontal rule
        .replace(/^---$/gim, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:32px 0;">')
        // Line breaks
        .replace(/\n/g, '<br>');
    
    return html;
};

// HTML to markdown converter
const htmlToMarkdown = (html: string): string => {
    if (!html) return '';
    
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Process nodes recursively
    const processNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            const tag = el.tagName.toLowerCase();
            const children = Array.from(el.childNodes).map(processNode).join('');
            
            switch (tag) {
                case 'h1': return `# ${children}\n\n`;
                case 'h2': return `## ${children}\n\n`;
                case 'h3': return `### ${children}\n\n`;
                case 'strong':
                case 'b': return `**${children}**`;
                case 'em':
                case 'i': return `*${children}*`;
                case 'code': return children.includes('\n') ? children : `\`${children}\``;
                case 'pre': return `\`\`\`${children}\`\`\`\n\n`;
                case 'a': return `[${children}](${el.getAttribute('href') || ''})`;
                case 'blockquote': return `> ${children}\n\n`;
                case 'br': return '\n';
                case 'div':
                    if (el.classList.contains('wiki-image-wrapper')) {
                        const img = el.querySelector('img');
                        if (img) {
                            const src = img.getAttribute('src') || '';
                            const alt = img.getAttribute('alt') || '';
                            const width = img.style.width;
                            const widthAttr = width ? ` style="width:${width}"` : '';
                            return `<img src="${src}" alt="${alt}"${widthAttr}>`;
                        }
                    }
                    return children;
                case 'img':
                    const src = el.getAttribute('src') || '';
                    const alt = el.getAttribute('alt') || '';
                    const width = el.style.width;
                    const widthAttr = width ? ` style="width:${width}"` : '';
                    return `<img src="${src}" alt="${alt}"${widthAttr}>`;
                default: return children;
            }
        }
        return '';
    };
    
    return processNode(temp).trim();
};

interface Article {
    id: number;
    title: string;
    content: string;
    slug: string;
    formatted_content?: string;
    format_status?: string;
}

interface WikiEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    article: Article | null;
    onSaved?: (article: Article) => void;
}

const WikiEditorModal: React.FC<WikiEditorModalProps> = ({ isOpen, onClose, article, onSaved }) => {
    const { token } = useAuthStore();
    const [markdownContent, setMarkdownContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);
    
    const editorRef = useRef<HTMLDivElement>(null);

    // Set isClient on mount
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Load article content
    useEffect(() => {
        if (article && article.content) {
            const content = article.formatted_content || article.content || '';
            setMarkdownContent(content);
            setError(null);
        } else if (article) {
            setMarkdownContent(article.content || article.formatted_content || '');
        }
    }, [article]);

    // Sync HTML content when markdown changes or when editor is ready
    useEffect(() => {
        if (editorRef.current && isClient && markdownContent) {
            const html = markdownToHtml(markdownContent);
            editorRef.current.innerHTML = html;
        }
    }, [markdownContent, isClient]);

    // Handle editor input - update markdown from HTML
    const handleEditorInput = useCallback(() => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            const md = htmlToMarkdown(html);
            setMarkdownContent(md);
        }
    }, []);

    // Handle image resize
    useEffect(() => {
        if (!editorRef.current) return;

        const editor = editorRef.current;
        let resizingImage: HTMLImageElement | null = null;
        let startX = 0;
        let startWidth = 0;

        const handleMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('resize-handle')) {
                e.preventDefault();
                e.stopPropagation();
                const wrapper = target.parentElement;
                if (wrapper) {
                    resizingImage = wrapper.querySelector('img');
                    if (resizingImage) {
                        startX = e.clientX;
                        startWidth = resizingImage.offsetWidth;
                    }
                }
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (resizingImage) {
                e.preventDefault();
                const deltaX = e.clientX - startX;
                const newWidth = Math.max(100, startWidth + deltaX);
                resizingImage.style.width = `${newWidth}px`;
                resizingImage.style.maxWidth = 'none';
            }
        };

        const handleMouseUp = () => {
            if (resizingImage) {
                // Update markdown content with new width
                handleEditorInput();
                resizingImage = null;
            }
        };

        editor.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            editor.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleEditorInput]);

    // Toolbar actions
    const toolbarActions = [
        { icon: <Bold size={16} />, label: '粗体', action: () => document.execCommand('bold') },
        { icon: <Italic size={16} />, label: '斜体', action: () => document.execCommand('italic') },
        { icon: <Heading2 size={16} />, label: '标题', action: () => document.execCommand('formatBlock', false, 'h2') },
        { icon: <List size={16} />, label: '无序列表', action: () => document.execCommand('insertUnorderedList') },
        { icon: <ListOrdered size={16} />, label: '有序列表', action: () => document.execCommand('insertOrderedList') },
        { icon: <Quote size={16} />, label: '引用', action: () => document.execCommand('formatBlock', false, 'blockquote') },
        { icon: <Code size={16} />, label: '代码', action: () => document.execCommand('formatBlock', false, 'pre') },
        { 
            icon: <ImageIcon size={16} />, 
            label: '插入图片', 
            action: () => {
                const url = prompt('请输入图片URL:');
                if (url) {
                    const html = `<div class="wiki-image-wrapper" style="position:relative;display:inline-block;margin:16px 0;" contenteditable="false"><img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:12px;border:1px solid rgba(255,255,255,0.1);display:block;" class="resizable-image"><div class="resize-handle" style="position:absolute;bottom:-8px;right:-8px;width:16px;height:16px;background:#FFD700;border-radius:50%;cursor:nwse-resize;box-shadow:0 2px 8px rgba(0,0,0,0.5);z-index:10;"></div></div><br>`;
                    document.execCommand('insertHTML', false, html);
                }
            }
        },
    ];

    // Use conditional rendering instead of early return to avoid React Hooks violation
    if (!isOpen || !article || !article.id) {
        return null;
    }

    // Save as draft
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
            const res = await axios.put(`/api/v1/knowledge/${article.id}`, {
                formatted_content: markdownContent,
                format_status: 'draft'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success && onSaved) {
                onSaved(res.data.data);
            }
            onClose();
        } catch (err: any) {
            console.error('Save draft error:', err);
            setError(err.response?.data?.message || '保存草稿失败');
        } finally {
            setIsSaving(false);
        }
    };

    // Publish
    const handlePublish = async () => {
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
            const res = await axios.post(`/api/v1/knowledge/${article.id}/publish-format`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success && onSaved) {
                onSaved(res.data.data);
            }
            onClose();
        } catch (err: any) {
            console.error('Publish error:', err);
            setError(err.response?.data?.message || '发布失败');
        } finally {
            setIsSaving(false);
        }
    };

    // AI Optimize
    const handleAIOptimize = async () => {
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
        try {
            const res = await axios.post(`/api/v1/knowledge/${article.id}/format`, 
                { mode: 'full' },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setMarkdownContent(res.data.data.formatted_content || markdownContent);
            }
        } catch (err: any) {
            console.error('AI optimize error:', err);
            setError(err.response?.data?.message || 'AI优化失败');
        } finally {
            setIsOptimizing(false);
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
                            maxWidth: '1000px',
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
                                flex: 1, 
                                fontSize: '18px', 
                                fontWeight: 600, 
                                color: '#fff',
                                margin: 0 
                            }}>
                                {article?.title || '编辑文章'}
                            </h2>

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

                            {/* View Mode Toggle - Hidden since we now use split view */}
                        </div>

                        {/* Toolbar - Always visible */}
                        <div style={{
                            padding: '12px 24px',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap'
                        }}>
                            {toolbarActions.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={action.action}
                                    title={action.label}
                                    style={{
                                        width: '36px',
                                        height: '36px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '8px',
                                        color: '#ccc',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {action.icon}
                                </button>
                            ))}

                            <div style={{ flex: 1 }} />

                            {/* AI Optimize Button */}
                            <button
                                onClick={handleAIOptimize}
                                disabled={isOptimizing}
                                style={{
                                    padding: '8px 16px',
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
                            </button>
                        </div>

                        {/* WYSIWYG Editor - Single Column */}
                        <div 
                            ref={editorRef}
                            style={{
                                flex: 1,
                                overflow: 'auto',
                                padding: '32px',
                                background: '#1a1a1d',
                                fontSize: '15px',
                                lineHeight: '1.8',
                                color: '#ccc'
                            }}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={handleEditorInput}
                            onBlur={handleEditorInput}
                        />

                        {/* Footer Actions */}
                        <div style={{
                            padding: '20px 24px',
                            borderTop: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '12px',
                            background: 'rgba(0,0,0,0.2)'
                        }}>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '10px 20px',
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    borderRadius: '8px',
                                    color: '#ccc',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                取消
                            </button>
                            
                            <button
                                onClick={handleSaveDraft}
                                disabled={isSaving}
                                style={{
                                    padding: '10px 20px',
                                    background: 'rgba(255,255,255,0.1)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '14px',
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
                                onClick={handlePublish}
                                disabled={isSaving}
                                style={{
                                    padding: '10px 20px',
                                    background: 'linear-gradient(135deg, #FFD700, #D4A017)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: '#000',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: isSaving ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                发布
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default WikiEditorModal;
