import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Minimize2, Send, Paperclip, Box, FileText, Loader2, Sparkles, GripHorizontal } from 'lucide-react';
import { parseTicketReferences } from './TicketLink';
import TicketDetailDialog from './TicketDetailDialog';

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

const BokehPanel: React.FC<BokehPanelProps> = ({ isOpen, onClose, onMinimize, messages, onSendMessage, loading, wikiContext, suggestedActions }) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    
    // Drag state
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
    const panelRef = useRef<HTMLDivElement>(null);
    
    // Resize state
    const [size, setSize] = useState({ width: 400, height: 600 });
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartRef = useRef({ x: 0, y: 0, width: 400, height: 600 });

    // Ticket detail dialog state
    const [ticketDetailOpen, setTicketDetailOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<{
        ticketNumber: string;
        ticketId: number;
        ticketType: 'inquiry' | 'rma' | 'dealer_repair';
    } | null>(null);

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

    const handleOpenTicketDetail = (ticketNumber: string, ticketId: number, ticketType: string) => {
        setSelectedTicket({
            ticketNumber,
            ticketId,
            ticketType: ticketType as 'inquiry' | 'rma' | 'dealer_repair'
        });
        setTicketDetailOpen(true);
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
                            background: 'linear-gradient(135deg, #00BFA5, #8E24AA)',
                            boxShadow: '0 0 10px rgba(142, 36, 170, 0.5)'
                        }} />
                        <span style={{ fontWeight: 600, color: 'white', fontSize: '14px' }}>Bokeh Assistant</span>
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
                                            label: '正在编辑文章',
                                            title: wikiContext.articleTitle,
                                            subtitle: wikiContext.hasDraft ? '有待发布的Bokeh优化草稿' : null,
                                            color: '#FFD700'
                                        };
                                    case 'wiki_article_view':
                                        return {
                                            icon: <FileText size={14} color="#00BFA5" />,
                                            label: '正在浏览文章',
                                            title: wikiContext.articleTitle,
                                            subtitle: null,
                                            color: '#00BFA5'
                                        };
                                    case 'wiki_home':
                                        return {
                                            icon: <Sparkles size={14} color="#8E24AA" />,
                                            label: 'Wiki 首页',
                                            title: '浏览知识库',
                                            subtitle: null,
                                            color: '#8E24AA'
                                        };
                                    case 'file_manager':
                                        return {
                                            icon: <Box size={14} color="#2196F3" />,
                                            label: '文件管理',
                                            title: wikiContext.currentPath || '根目录',
                                            subtitle: null,
                                            color: '#2196F3'
                                        };
                                    case 'ticket_system':
                                        return {
                                            icon: <FileText size={14} color="#FF9800" />,
                                            label: '工单系统',
                                            title: wikiContext.viewType || '工单列表',
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
                                    <div style={{ color: 'white', fontSize: '13px', lineHeight: '1.4' }}>
                                        {banner.title}
                                    </div>
                                    {banner.subtitle && (
                                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#00BFA5' }}>
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
                                background: 'linear-gradient(135deg, rgba(0, 191, 165, 0.2), rgba(142, 36, 170, 0.2))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <Sparkles size={32} color="#00BFA5" />
                            </div>
                            <p style={{ color: 'white', fontSize: '14px', marginBottom: '8px' }}>
                                {wikiContext ? '有什么我可以帮您的？' : 'How can I help you today?'}
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
                                background: msg.role === 'user' ? '#10B981' : 'rgba(255,255,255,0.1)',
                                color: msg.role === 'user' ? 'white' : 'white',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                                borderBottomLeftRadius: msg.role === 'user' ? '12px' : '2px',
                                whiteSpace: 'pre-wrap'
                            }}>
                                {msg.role === 'assistant' ? (
                                    <span style={{ display: 'inline' }}>
                                        {parseTicketReferences(msg.content, handleOpenTicketDetail)}
                                    </span>
                                ) : (
                                    msg.content
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', opacity: 0.6 }}>
                            <Loader2 size={16} className="animate-spin" color="#00BFA5" />
                            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Bokeh is focusing...</span>
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
                                                <QuickAction icon={<Sparkles size={14} />} label="优化排版" onClick={() => onSendMessage("优化排版")} />
                                                <QuickAction icon={<FileText size={14} />} label="精简内容" onClick={() => onSendMessage("精简内容")} />
                                                <QuickAction icon={<Box size={14} />} label="调整图片" onClick={() => onSendMessage("把图片尺寸改为原来的1/2")} />
                                                <QuickAction icon={<Sparkles size={14} />} label="标题改黄色" onClick={() => onSendMessage("把标题颜色改为 kine yellow")} />
                                            </>
                                        );
                                    case 'wiki_article_view':
                                        return (
                                            <>
                                                <QuickAction icon={<FileText size={14} />} label="文章摘要" onClick={() => onSendMessage("这篇文章讲了什么？")} />
                                                <QuickAction icon={<Sparkles size={14} />} label="查找相关" onClick={() => onSendMessage("查找相关内容")} />
                                                <QuickAction icon={<Box size={14} />} label="如何编辑" onClick={() => onSendMessage("如何编辑这篇文章？")} />
                                            </>
                                        );
                                    case 'wiki_home':
                                        return (
                                            <>
                                                <QuickAction icon={<FileText size={14} />} label="创建文章" onClick={() => onSendMessage("如何创建新文章？")} />
                                                <QuickAction icon={<Sparkles size={14} />} label="MAVO文档" onClick={() => onSendMessage("查找关于 MAVO Edge 的文档")} />
                                                <QuickAction icon={<Box size={14} />} label="导入文档" onClick={() => onSendMessage("如何导入文档？")} />
                                            </>
                                        );
                                    case 'file_manager':
                                        return (
                                            <>
                                                <QuickAction icon={<Box size={14} />} label="分享文件" onClick={() => onSendMessage("如何分享文件？")} />
                                                <QuickAction icon={<FileText size={14} />} label="创建文件夹" onClick={() => onSendMessage("如何创建文件夹？")} />
                                            </>
                                        );
                                    case 'ticket_system':
                                        return (
                                            <>
                                                <QuickAction icon={<FileText size={14} />} label="创建工单" onClick={() => onSendMessage("如何创建新工单？")} />
                                                <QuickAction icon={<Sparkles size={14} />} label="工单流程" onClick={() => onSendMessage("工单处理流程")} />
                                            </>
                                        );
                                    default:
                                        return (
                                            <>
                                                <QuickAction icon={<Box size={14} />} label="查询RMA物流" onClick={() => onSendMessage("帮我查询最新的RMA物流状态")} />
                                                <QuickAction icon={<FileText size={14} />} label="Edge说明书" onClick={() => onSendMessage("查找MAVO Edge的使用手册")} />
                                            </>
                                        );
                                }
                            })()
                        ) : (
                            // Default actions when no context
                            <>
                                <QuickAction icon={<Box size={14} />} label="查询RMA物流" onClick={() => onSendMessage("帮我查询最新的RMA物流状态")} />
                                <QuickAction icon={<FileText size={14} />} label="Edge说明书" onClick={() => onSendMessage("查找MAVO Edge的使用手册")} />
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
                            placeholder={wikiContext?.mode === 'editor' ? "输入修改指令，如：把标题改为黄色..." : "输入您的问题..."}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
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
                                style={{ background: input.trim() ? '#10B981' : 'rgba(255,255,255,0.1)', color: input.trim() ? 'white' : 'rgba(255,255,255,0.3)' }}
                                onClick={handleSend}
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
                     color: white;
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
                     color: white;
                 }
             `}</style>
            </motion.div>

            {/* Resize Handle */}
            <div
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
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.4'}
            >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" fill="white"/>
                </svg>
            </div>

            {/* Ticket Detail Dialog */}
            {selectedTicket && (
                <TicketDetailDialog
                    isOpen={ticketDetailOpen}
                    onClose={() => setTicketDetailOpen(false)}
                    ticketNumber={selectedTicket.ticketNumber}
                    ticketId={selectedTicket.ticketId}
                    ticketType={selectedTicket.ticketType}
                />
            )}
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
