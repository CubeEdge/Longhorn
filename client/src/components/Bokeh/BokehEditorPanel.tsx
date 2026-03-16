/**
 * BokehEditorPanel - 编辑器内嵌Bokeh助手面板
 * 用于Wiki编辑器中，支持AI修改建议、预览和确认
 * 设计：底部栏按钮 + 向上展开浮层
 * 注意：本组件仅处理正文内容，摘要优化请使用顶部栏的 Bokeh优化 下拉菜单
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, ChevronUp, ChevronDown, Sparkles,
    Check, X, Loader2, Wand2
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import axios from 'axios';

interface BokehEditorPanelProps {
    articleId: number;
    articleTitle: string;
    currentContent: string;
    onApplyChanges: (newContent: string) => void;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface PendingChange {
    instruction: string;
    originalContent: string;
    optimizedContent: string;
    changeSummary: string;
}

const BokehEditorPanel: React.FC<BokehEditorPanelProps> = ({
    articleId,
    articleTitle,
    currentContent,
    onApplyChanges
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
    const [isOptimizing, setIsOptimizing] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const { token } = useAuthStore();

    // Quick action suggestions - 仅针对正文
    const quickActions = [
        { label: '优化排版', prompt: '请优化正文的排版格式' },
        { label: '检查格式', prompt: '请检查并修复正文格式问题' },
        { label: '精简内容', prompt: '请精简正文内容，删除冗余部分' }
    ];

    const handleSend = async (text?: string) => {
        const messageText = text || input.trim();
        if (!messageText || !token) return;

        // 检测是否涉及摘要，提示用户使用顶部菜单
        if (messageText.includes('摘要')) {
            const aiMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: '💡 摘要优化请使用顶部栏的「Bokeh优化 → 优化摘要」功能。\n\n本助手仅处理正文内容。请输入对正文的修改要求。',
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, aiMsg]);
            setInput('');
            return;
        }

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        setPendingChange(null);

        try {
            // 判断是否为修改指令
            const isModificationRequest =
                messageText.includes('优化') ||
                messageText.includes('修改') ||
                messageText.includes('调整') ||
                messageText.includes('缩小') ||
                messageText.includes('放大') ||
                messageText.includes('重写') ||
                messageText.includes('精简') ||
                messageText.includes('格式') ||
                messageText.includes('图片') ||
                messageText.includes('段落');

            if (isModificationRequest) {
                // 调用优化API
                setIsOptimizing(true);
                const res = await axios.post(`/api/v1/knowledge/${articleId}/bokeh-optimize`, {
                    instruction: messageText,
                    currentContent: currentContent
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success) {
                    const optimizedContent = res.data.data.optimized_content || res.data.data.formatted_content;

                    if (optimizedContent && optimizedContent !== currentContent) {
                        // 设置待确认的变更
                        setPendingChange({
                            instruction: messageText,
                            originalContent: currentContent,
                            optimizedContent: optimizedContent,
                            changeSummary: res.data.data.change_summary || '内容已优化'
                        });

                        const aiMsg: Message = {
                            id: (Date.now() + 1).toString(),
                            role: 'assistant',
                            content: `我已完成优化。${res.data.data.change_summary || ''}\n\n请预览变更后决定是否应用。`,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, aiMsg]);
                    } else {
                        const aiMsg: Message = {
                            id: (Date.now() + 1).toString(),
                            role: 'assistant',
                            content: res.data.data.response_message || '内容已处理，无需更改。',
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, aiMsg]);
                    }
                }
            } else {
                // 普通问答
                const res = await axios.post('/api/ai/chat', {
                    messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                    context: {
                        path: `/tech-hub/wiki/${articleId}`,
                        title: `编辑: ${articleTitle}`,
                        wikiContext: {
                            type: 'wiki_article',
                            articleId,
                            articleTitle
                        }
                    }
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success) {
                    const aiMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: res.data.data,
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, aiMsg]);
                }
            }
        } catch (err: any) {
            console.error('Bokeh Editor Error:', err);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `处理失败: ${err.response?.data?.message || err.message}`,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
            setIsOptimizing(false);
        }
    };

    const handleApplyChange = () => {
        if (pendingChange) {
            onApplyChanges(pendingChange.optimizedContent);
            setPendingChange(null);

            const confirmMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: '✅ 变更已应用到编辑器。',
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, confirmMsg]);
        }
    };

    const handleRejectChange = () => {
        setPendingChange(null);

        const rejectMsg: Message = {
            id: Date.now().toString(),
            role: 'assistant',
            content: '已取消变更。如需调整，请告诉我具体要求。',
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, rejectMsg]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSend();
        }
    };

    // 浮层容器引用，用于检测点击外部
    const panelRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isExpanded && panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsExpanded(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isExpanded]);

    // Esc 关闭
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isExpanded) {
                setIsExpanded(false);
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isExpanded]);

    return (
        <div
            ref={panelRef}
            style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center'
            }}
        >
            {/* 底部栏按钮 - 统一暗色风格 */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    padding: '8px 16px',
                    background: 'var(--glass-bg-light)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    whiteSpace: 'nowrap'
                }}
            >
                <Sparkles size={14} />
                <span>Bokeh 助手</span>
                {isOptimizing ? (
                    <Loader2 size={12} className="animate-spin" />
                ) : (
                    isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />
                )}
            </button>

            {/* 向上展开的浮层面板 */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        style={{
                            position: 'absolute',
                            bottom: '100%',
                            left: 0,
                            marginBottom: '8px',
                            width: '400px',
                            maxHeight: '350px',
                            background: 'var(--modal-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '12px',
                            boxShadow: '0 -4px 24px var(--glass-shadow)',
                            overflow: 'hidden',
                            zIndex: 1000
                        }}
                    >
                        {/* 浮层标题 */}
                        <div style={{
                            padding: '12px 16px',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <span style={{
                                color: 'var(--text-main)',
                                fontSize: '13px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <Sparkles size={14} />
                                Bokeh 编辑助手
                            </span>
                            <button
                                onClick={() => setIsExpanded(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    borderRadius: '4px'
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div style={{ padding: '12px 16px', maxHeight: '280px', overflowY: 'auto' }}>
                            {/* Quick Actions - 紧凑布局 */}
                            <div style={{
                                display: 'flex',
                                gap: '6px',
                                marginBottom: '10px',
                                flexWrap: 'wrap'
                            }}>
                                {quickActions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSend(action.prompt)}
                                        disabled={loading}
                                        style={{
                                            padding: '4px 10px',
                                            background: 'var(--glass-bg-light)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '14px',
                                            color: 'var(--text-secondary)',
                                            fontSize: '11px',
                                            cursor: loading ? 'not-allowed' : 'pointer',
                                            opacity: loading ? 0.5 : 1,
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        <Wand2 size={10} />
                                        {action.label}
                                    </button>
                                ))}
                            </div>

                            {/* Messages - 紧凑消息历史 */}
                            {messages.length > 0 && (
                                <div style={{
                                    maxHeight: '120px',
                                    overflowY: 'auto',
                                    marginBottom: '10px',
                                    padding: '6px',
                                    background: 'rgba(0,0,0,0.25)',
                                    borderRadius: '6px'
                                }}>
                                    {messages.slice(-3).map(msg => (
                                        <div
                                            key={msg.id}
                                            style={{
                                                marginBottom: '6px',
                                                textAlign: msg.role === 'user' ? 'right' : 'left'
                                            }}
                                        >
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '5px 8px',
                                                borderRadius: '8px',
                                                fontSize: '11px',
                                                maxWidth: '90%',
                                                background: msg.role === 'user'
                                                    ? 'var(--glass-bg-hover)'
                                                    : 'transparent',
                                                border: msg.role === 'user' ? '1px solid var(--glass-bg-hover)' : 'none',
                                                color: 'var(--text-main)',
                                                lineHeight: '1.4'
                                            }}>
                                                {msg.content}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pending Change Preview - 紧凑预览 */}
                            {pendingChange && (
                                <div style={{
                                    marginBottom: '10px',
                                    padding: '10px',
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    borderRadius: '6px'
                                }}>
                                    <div style={{
                                        fontSize: '11px',
                                        color: 'var(--text-main)',
                                        marginBottom: '6px',
                                        fontWeight: 600
                                    }}>
                                        📝 {pendingChange.changeSummary}
                                    </div>
                                    <div style={{
                                        fontSize: '10px',
                                        color: 'var(--text-secondary)',
                                        marginBottom: '8px'
                                    }}>
                                        "{pendingChange.instruction}"
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={handleApplyChange}
                                            style={{
                                                flex: 1,
                                                padding: '6px',
                                                background: 'var(--glass-bg-hover)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '5px',
                                                color: 'var(--text-main)',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <Check size={12} />
                                            应用
                                        </button>
                                        <button
                                            onClick={handleRejectChange}
                                            style={{
                                                padding: '6px 12px',
                                                background: 'var(--glass-bg-hover)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '5px',
                                                color: 'var(--text-secondary)',
                                                fontSize: '11px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <X size={12} />
                                            取消
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Input - 紧凑输入框 */}
                            <div style={{
                                display: 'flex',
                                gap: '6px',
                                alignItems: 'flex-end'
                            }}>
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="输入对正文的修改建议..."
                                    disabled={loading}
                                    rows={1}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        background: 'var(--glass-bg-light)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        color: 'var(--text-main)',
                                        fontSize: '12px',
                                        resize: 'none',
                                        minHeight: '34px',
                                        maxHeight: '60px',
                                        outline: 'none',
                                        lineHeight: '1.4'
                                    }}
                                />
                                <button
                                    onClick={() => handleSend()}
                                    disabled={loading || !input.trim()}
                                    style={{
                                        width: '34px',
                                        height: '34px',
                                        background: loading || !input.trim()
                                            ? 'var(--glass-bg-light)'
                                            : '#10B981',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '8px',
                                        color: loading || !input.trim() ? 'rgba(255,255,255,0.3)' : '#fff',
                                        cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}
                                >
                                    {loading ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <Send size={14} />
                                    )}
                                </button>
                            </div>

                            <div style={{
                                fontSize: '9px',
                                color: 'var(--text-tertiary)',
                                marginTop: '6px',
                                textAlign: 'center'
                            }}>
                                ⌘+Enter 发送 · 点击外部或 Esc 关闭
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BokehEditorPanel;
