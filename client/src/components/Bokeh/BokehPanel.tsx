import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Minimize2, Send, Paperclip, Box, FileText, Loader2, Sparkles, GripHorizontal, BookOpen } from 'lucide-react';
import { getTicketStyles } from './TicketLink';
import { useLanguage } from '../../i18n/useLanguage';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

// Extended context types matching useBokehContext
type EditorMode = 'editor';
type AssistantMode = 'assistant';

interface WikiArticleEditContext {
    type: 'wiki_article_edit';
    mode: EditorMode;
    articleId: number;
    articleTitle: string;
    articleSlug: string;
    currentContent: string;
    hasDraft: boolean;
}

interface WikiArticleViewContext {
    type: 'wiki_article_view';
    mode: AssistantMode;
    articleId: number;
    articleTitle: string;
    articleSlug: string;
    articleSummary?: string;
}

interface WikiHomeContext {
    type: 'wiki_home';
    mode: AssistantMode;
}

interface FileManagerContext {
    type: 'file_manager';
    mode: AssistantMode;
    currentPath?: string;
    selectedFiles?: string[];
}

interface TicketSystemContext {
    type: 'ticket_system';
    mode: AssistantMode;
    viewType?: 'inquiry' | 'rma' | 'dealer_repair' | 'dashboard';
}

interface GenericPageContext {
    type: 'generic';
    mode: AssistantMode;
    path: string;
    title: string;
}

type BokehContext =
    | WikiArticleEditContext
    | WikiArticleViewContext
    | WikiHomeContext
    | FileManagerContext
    | TicketSystemContext
    | GenericPageContext;

interface BokehPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onMinimize: () => void;
    messages: Message[];
    onSendMessage: (text: string) => void;
    loading: boolean;
    wikiContext?: BokehContext | null;
    suggestedActions?: string[];
}

const preprocessBokehAnswer = (text: string) => {
    if (!text) return '';
    // Format A: [ID|Num|Type] -> [ID](/bokeh-ticket/Num/Type)
    // Matches [ID|Num] or [ID|Num|Type] or [ID|Type]
    const ticketPatternA = /\[([A-Z]+-[A-Z]-\d{4}-\d{4}|[A-Z]\d{4}-\d{4}|SVC-\d{4}-\d{4})\|([^\]]+)\]/g;
    let processed = text.replace(ticketPatternA, (_match, ticketNumber, rest) => {
        const parts = rest.split('|');
        let ticketId = '0';
        let ticketType = 'inquiry';

        if (ticketNumber.startsWith('RMA') || parts.includes('rma')) ticketType = 'rma';
        else if (ticketNumber.startsWith('SVC') || parts.includes('dealer_repair')) ticketType = 'dealer_repair';

        // Find the numeric ID if it exists
        const idPart = parts.find((p: string) => /^\d+$/.test(p));
        if (idPart) ticketId = idPart;

        return `[${ticketNumber}](/bokeh-ticket/${ticketId}/${ticketType})`;
    });

    // Format B: Simple AI response [RMA-D-2601-0006] -> [RMA-D-2601-0006](/bokeh-ticket/0/rma)
    // Avoid double processing by checking negative lookbehind or just avoiding the pipe
    const ticketPatternB = /\[([A-Z]+-[A-Z]-\d{4}-\d{4}|[A-Z]\d{4}-\d{4}|SVC-\d{4}-\d{4})\](?!\()/g;
    processed = processed.replace(ticketPatternB, (_match, ticketNumber) => {
        let ticketType = 'inquiry';
        if (ticketNumber.startsWith('RMA')) ticketType = 'rma';
        else if (ticketNumber.startsWith('SVC') || ticketNumber.includes('DEALER')) ticketType = 'dealer_repair';
        return `[${ticketNumber}](/bokeh-ticket/0/${ticketType})`;
    });

    return processed;
};

const BokehPanel: React.FC<BokehPanelProps> = ({ isOpen, onClose, onMinimize, messages, onSendMessage, loading, wikiContext, suggestedActions }) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguage();

    // Drag state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Resize state
    const [size, setSize] = useState({ width: 400, height: 600 });
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartRef = useRef({ x: 0, y: 0, width: 400, height: 600 });


    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    // Drag handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return; // Don't drag when clicking buttons
        e.preventDefault();
        setIsDragging(true);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            posX: position.x,
            posY: position.y
        };
    }, [position]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - dragStartRef.current.x;
            const deltaY = e.clientY - dragStartRef.current.y;

            // Calculate new position with bounds checking
            const panelWidth = 400;
            const panelHeight = 600;
            const newX = Math.max(-window.innerWidth + panelWidth + 32, Math.min(window.innerWidth - 32, dragStartRef.current.posX + deltaX));
            const newY = Math.max(-window.innerHeight + panelHeight + 32, Math.min(window.innerHeight - 64, dragStartRef.current.posY + deltaY));

            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // Resize handlers
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height
        };
    }, [size]);

    useEffect(() => {
        if (!isResizing) return;

        const handleResizeMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartRef.current.x;
            const deltaY = e.clientY - resizeStartRef.current.y;

            const newWidth = Math.max(320, Math.min(800, resizeStartRef.current.width + deltaX));
            const newHeight = Math.max(400, Math.min(900, resizeStartRef.current.height + deltaY));

            setSize({ width: newWidth, height: newHeight });
        };

        const handleResizeEnd = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleResizeMove);
        document.addEventListener('mouseup', handleResizeEnd);
        return () => {
            document.removeEventListener('mousemove', handleResizeMove);
            document.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [isResizing]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleOpenTicketDetail = (_ticketNumber: string, ticketId: number, ticketType: string) => {
        const route = ticketType === 'inquiry' ? 'inquiry-tickets' : ticketType === 'rma' ? 'rma-tickets' : 'dealer-repairs';
        window.open(`/service/${route}/${ticketId}`, '_blank');
    };

    if (!isOpen) return null;

    return (
        <>
            <motion.div
                ref={panelRef}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    x: position.x,
                    y: position.y
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                    position: 'fixed',
                    bottom: '32px',
                    right: '32px',
                    width: `${size.width}px`,
                    height: `${size.height}px`,
                    maxHeight: 'calc(100vh - 64px)',
                    background: 'rgba(28, 28, 30, 0.85)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 9999,
                    overflow: 'hidden',
                    cursor: isDragging ? 'grabbing' : 'default'
                }}
            >
                {/* HEADER - Draggable */}
                <div
                    onMouseDown={handleMouseDown}
                    style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(255,255,255,0.03)',
                        cursor: 'grab',
                        userSelect: 'none'
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10B981, #8E24AA)',
                            boxShadow: '0 0 10px rgba(142, 36, 170, 0.5)'
                        }} />
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '14px' }}>Bokeh Assistant</span>
                        <GripHorizontal size={14} style={{ opacity: 0.3, marginLeft: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onMinimize} className="panel-btn"><Minimize2 size={16} /></button>
                        <button onClick={onClose} className="panel-btn"><X size={16} /></button>
                    </div>
                </div>

                {/* CHAT AREA */}
                <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Context Banner - Show based on context type */}
                    {messages.length === 0 && wikiContext && (
                        (() => {
                            const getBannerContent = () => {
                                switch (wikiContext.type) {
                                    case 'wiki_article_edit':
                                        return {
                                            icon: <FileText size={14} color="#FFD700" />,
                                            label: t('bokeh.context.editing'),
                                            title: wikiContext.articleTitle,
                                            subtitle: wikiContext.hasDraft ? t('bokeh.context.has_draft') : null,
                                            color: '#FFD700'
                                        };
                                    case 'wiki_article_view':
                                        return {
                                            icon: <FileText size={14} color="#10B981" />,
                                            label: t('bokeh.context.viewing'),
                                            title: wikiContext.articleTitle,
                                            subtitle: null,
                                            color: '#10B981'
                                        };
                                    case 'wiki_home':
                                        return {
                                            icon: <Sparkles size={14} color="#8E24AA" />,
                                            label: t('bokeh.context.wiki_home'),
                                            title: t('bokeh.context.browse_kb'),
                                            subtitle: null,
                                            color: '#8E24AA'
                                        };
                                    case 'file_manager':
                                        return {
                                            icon: <Box size={14} color="#2196F3" />,
                                            label: t('bokeh.context.file_mgr'),
                                            title: wikiContext.currentPath || t('bokeh.context.root_dir'),
                                            subtitle: null,
                                            color: '#2196F3'
                                        };
                                    case 'ticket_system':
                                        return {
                                            icon: <FileText size={14} color="#FF9800" />,
                                            label: t('bokeh.context.ticket_sys'),
                                            title: wikiContext.viewType || t('bokeh.context.ticket_list'),
                                            subtitle: null,
                                            color: '#FF9800'
                                        };
                                    default:
                                        return null;
                                }
                            };

                            const banner = getBannerContent();
                            if (!banner) return null;

                            return (
                                <div style={{
                                    background: `linear-gradient(135deg, ${banner.color}15, ${banner.color}08)`,
                                    border: `1px solid ${banner.color}30`,
                                    borderRadius: '12px',
                                    padding: '14px 16px',
                                    marginBottom: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                        {banner.icon}
                                        <span style={{ color: banner.color, fontWeight: 500, fontSize: '12px' }}>{banner.label}</span>
                                    </div>
                                    <div style={{ color: 'var(--text-main)', fontSize: '13px', lineHeight: '1.4' }}>
                                        {banner.title}
                                    </div>
                                    {banner.subtitle && (
                                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#10B981' }}>
                                            {banner.subtitle}
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                    )}

                    {/* Welcome Message */}
                    {messages.length === 0 && (
                        <div style={{ textAlign: 'center', marginTop: wikiContext ? '20px' : '40px', opacity: 0.7 }}>
                            <div style={{
                                width: '64px', height: '64px', margin: '0 auto 20px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(142, 36, 170, 0.2))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Sparkles size={32} color="#10B981" />
                            </div>
                            <p style={{ color: 'var(--text-main)', fontSize: '14px', marginBottom: '8px' }}>
                                {t('bokeh.welcome')}
                            </p>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} style={{
                            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%'
                        }}>
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '12px',
                                background: msg.role === 'user' ? '#10B981' : 'rgba(255, 255, 255, 0.08)',
                                color: 'var(--text-main)',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                                borderBottomLeftRadius: msg.role === 'user' ? '12px' : '2px',
                                border: 'none'
                            }}>
                                {msg.role === 'assistant' ? (
                                    <div style={{
                                        fontSize: '14px',
                                        color: '#e5e5e5',
                                        lineHeight: '1.6',
                                    }}>
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            rehypePlugins={[rehypeRaw]}
                                            components={{
                                                ul: ({ node, ...props }) => <ul style={{ paddingLeft: '20px', margin: '8px 0' }} {...props} />,
                                                li: ({ node, ...props }) => <li style={{ marginBottom: '4px' }} {...props} />,
                                                p: ({ node, ...props }) => <p style={{ marginBottom: '8px' }} {...props} />,
                                                a: ({ node, ...props }) => {
                                                    const text = props.children?.toString() || '';
                                                    const href = props.href || '';

                                                    // 工单卡片 (Ticket Card)
                                                    if (href.startsWith('/bokeh-ticket/')) {
                                                        const parts = href.split('/');
                                                        const ticketId = parseInt(parts[2]);
                                                        const ticketType = parts[3];
                                                        const styles = getTicketStyles(ticketType);

                                                        return (
                                                            <span
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    handleOpenTicketDetail(text, ticketId, ticketType);
                                                                }}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    background: styles.bg,
                                                                    border: `1px solid ${styles.border}`,
                                                                    padding: '1px 8px',
                                                                    borderRadius: '6px',
                                                                    color: styles.color,
                                                                    cursor: 'pointer',
                                                                    fontSize: '13px',
                                                                    margin: '0 4px',
                                                                    verticalAlign: 'bottom',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                <span style={{ display: 'flex', marginTop: '-1px' }}>{styles.icon}</span>
                                                                {text}
                                                            </span>
                                                        );
                                                    }

                                                    // 文章链接卡片 (Article Card)
                                                    return (
                                                        <a {...props}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                background: 'rgba(16, 185, 129, 0.1)',
                                                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                                                padding: '1px 8px',
                                                                borderRadius: '6px',
                                                                color: '#10B981',
                                                                textDecoration: 'none',
                                                                fontSize: '13px',
                                                                margin: '0 4px',
                                                                verticalAlign: 'bottom',
                                                                transition: 'all 0.2s',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                                                            }}
                                                        >
                                                            <span style={{ display: 'flex', marginTop: '-1px' }}><BookOpen size={14} /></span>
                                                            {props.children}
                                                        </a>
                                                    );
                                                }
                                            }}
                                        >
                                            {preprocessBokehAnswer(msg.content)}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', opacity: 0.6 }}>
                            <Loader2 size={16} className="animate-spin" color="#10B981" />
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>{t('bokeh.focusing')}</span>
                        </div>
                    )}
                </div>

                {/* QUICK ACTIONS - Context-aware suggestions */}
                {messages.length === 0 && (
                    <div style={{ padding: '0 20px 20px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                        {suggestedActions && suggestedActions.length > 0 ? (
                            // Use provided suggested actions
                            suggestedActions.slice(0, 4).map((action, idx) => (
                                <QuickAction
                                    key={idx}
                                    icon={<Sparkles size={14} />}
                                    label={action}
                                    onClick={() => onSendMessage(action)}
                                />
                            ))
                        ) : wikiContext ? (
                            // Fallback based on context type
                            (() => {
                                switch (wikiContext.type) {
                                    case 'wiki_article_edit':
                                        return (
                                            <>
                                                <QuickAction icon={<Sparkles size={14} />} label={t('bokeh.action.optimize')} onClick={() => onSendMessage(t('bokeh.action.optimize'))} />
                                                <QuickAction icon={<FileText size={14} />} label={t('bokeh.action.simplify')} onClick={() => onSendMessage(t('bokeh.action.simplify'))} />
                                                <QuickAction icon={<Box size={14} />} label={t('bokeh.action.resize_img')} onClick={() => onSendMessage(t('bokeh.action.resize_img_cmd'))} />
                                                <QuickAction icon={<Sparkles size={14} />} label={t('bokeh.action.yellow_title')} onClick={() => onSendMessage(t('bokeh.action.yellow_title_cmd'))} />
                                            </>
                                        );
                                    case 'wiki_article_view':
                                        return (
                                            <>
                                                <QuickAction icon={<FileText size={14} />} label={t('bokeh.action.article_summary')} onClick={() => onSendMessage(t('bokeh.action.article_summary_q'))} />
                                                <QuickAction icon={<Sparkles size={14} />} label={t('bokeh.action.find_related')} onClick={() => onSendMessage(t('bokeh.action.find_related_q'))} />
                                                <QuickAction icon={<Box size={14} />} label={t('bokeh.action.how_edit')} onClick={() => onSendMessage(t('bokeh.action.how_edit_q'))} />
                                            </>
                                        );
                                    case 'wiki_home':
                                        return (
                                            <>
                                                <QuickAction icon={<FileText size={14} />} label={t('bokeh.action.create_article')} onClick={() => onSendMessage(t('bokeh.action.create_article_q'))} />
                                                <QuickAction icon={<Sparkles size={14} />} label={t('bokeh.action.mavo_docs')} onClick={() => onSendMessage(t('bokeh.action.mavo_docs_q'))} />
                                                <QuickAction icon={<Box size={14} />} label={t('bokeh.action.import_doc')} onClick={() => onSendMessage(t('bokeh.action.import_doc_q'))} />
                                            </>
                                        );
                                    case 'file_manager':
                                        return (
                                            <>
                                                <QuickAction icon={<Box size={14} />} label={t('bokeh.action.share_file')} onClick={() => onSendMessage(t('bokeh.action.share_file_q'))} />
                                                <QuickAction icon={<FileText size={14} />} label={t('bokeh.action.create_folder')} onClick={() => onSendMessage(t('bokeh.action.create_folder_q'))} />
                                            </>
                                        );
                                    case 'ticket_system':
                                        return (
                                            <>
                                                <QuickAction icon={<FileText size={14} />} label={t('bokeh.action.create_ticket')} onClick={() => onSendMessage(t('bokeh.action.create_ticket_q'))} />
                                                <QuickAction icon={<Sparkles size={14} />} label={t('bokeh.action.ticket_flow')} onClick={() => onSendMessage(t('bokeh.action.ticket_flow_q'))} />
                                            </>
                                        );
                                    default:
                                        return (
                                            <>
                                                <QuickAction icon={<Box size={14} />} label={t('bokeh.action.rma_query')} onClick={() => onSendMessage(t('bokeh.action.rma_query_q'))} />
                                                <QuickAction icon={<FileText size={14} />} label={t('bokeh.action.edge_manual')} onClick={() => onSendMessage(t('bokeh.action.edge_manual_q'))} />
                                            </>
                                        );
                                }
                            })()
                        ) : (
                            // Default actions when no context
                            <>
                                <QuickAction icon={<Box size={14} />} label={t('bokeh.action.rma_query')} onClick={() => onSendMessage(t('bokeh.action.rma_query_q'))} />
                                <QuickAction icon={<FileText size={14} />} label={t('bokeh.action.edge_manual')} onClick={() => onSendMessage(t('bokeh.action.edge_manual_q'))} />
                            </>
                        )}
                    </div>
                )}

                {/* INPUT AREA */}
                <div style={{ padding: '20px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'flex-end'
                    }}>
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={wikiContext?.mode === 'editor' ? t('bokeh.input.editor_hint') : t('bokeh.input.placeholder')}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-main)',
                                padding: '12px',
                                fontSize: '14px',
                                resize: 'none',
                                minHeight: '44px',
                                maxHeight: '120px',
                                outline: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '4px', paddingBottom: '8px', paddingRight: '8px' }}>
                            <button className="input-btn"><Paperclip size={18} /></button>
                            <button
                                className="input-btn"
                                onClick={handleSend}
                                disabled={!input.trim()}
                                style={{
                                    background: input.trim() ? '#10B981' : 'rgba(255,255,255,0.1)',
                                    color: input.trim() ? 'white' : 'rgba(255,255,255,0.3)',
                                }}
                            >
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <style>{`
                 .panel-btn {
                     background: transparent;
                     border: none;
                     color: rgba(255,255,255,0.5);
                     cursor: pointer;
                     padding: 4px;
                     border-radius: 4px;
                     transition: all 0.2s;
                 }
                 .panel-btn:hover {
                     background: rgba(255,255,255,0.1);
                     color: var(--text-main);
                 }
                 .input-btn {
                     width: 32px;
                     height: 32px;
                     border-radius: 8px;
                     border: none;
                     background: transparent;
                     color: rgba(255,255,255,0.5);
                     cursor: pointer;
                     display: flex;
                     align-items: center;
                     justify-content: center;
                     transition: all 0.2s;
                 }
                 .input-btn:hover {
                     background: rgba(255,255,255,0.1);
                     color: var(--text-main);
                 }
             `}</style>
            </motion.div >

            {/* Resize Handle */}
            < div
                onMouseDown={handleResizeStart}
                style={{
                    position: 'fixed',
                    bottom: `${32 + size.height - 16}px`,
                    right: `${32 + size.width - 16}px`,
                    width: '24px',
                    height: '24px',
                    cursor: 'se-resize',
                    zIndex: 10000,
                    opacity: 0.4,
                    transition: 'opacity 0.2s'
                }
                }
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" fill="white" />
                </svg>
            </div >

        </>
    );
};

const QuickAction: React.FC<{ icon: React.ReactNode, label: string, onClick: () => void }> = ({ icon, label, onClick }) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
        }}
    >
        {icon} {label}
    </button>
);

export default BokehPanel;
