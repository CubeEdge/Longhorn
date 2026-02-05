import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Minimize2, Send, Paperclip, Box, FileText, Loader2, Sparkles } from 'lucide-react';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

interface BokehPanelProps {
    isOpen: boolean;
    onClose: () => void;
    onMinimize: () => void;
    messages: Message[];
    onSendMessage: (text: string) => void;
    loading: boolean;
}

const BokehPanel: React.FC<BokehPanelProps> = ({ isOpen, onClose, onMinimize, messages, onSendMessage, loading }) => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

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

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
                position: 'fixed',
                bottom: '32px',
                right: '32px',
                width: '400px',
                height: '600px',
                maxHeight: 'calc(100vh - 64px)',
                background: 'rgba(28, 28, 30, 0.85)',
                backdropFilter: 'blur(20px)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 9999,
                overflow: 'hidden'
            }}
        >
            {/* HEADER */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(255,255,255,0.03)'
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
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={onMinimize} className="panel-btn"><Minimize2 size={16} /></button>
                    <button onClick={onClose} className="panel-btn"><X size={16} /></button>
                </div>
            </div>

            {/* CHAT AREA */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Welcome Message */}
                {messages.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.7 }}>
                        <div style={{
                            width: '64px', height: '64px', margin: '0 auto 20px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(0, 191, 165, 0.2), rgba(142, 36, 170, 0.2))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Sparkles size={32} color="#00BFA5" />
                        </div>
                        <p style={{ color: 'white', fontSize: '14px', marginBottom: '8px' }}>How can I help you today?</p>
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
                            background: msg.role === 'user' ? '#00BFA5' : 'rgba(255,255,255,0.1)',
                            color: msg.role === 'user' ? 'black' : 'white',
                            fontSize: '14px',
                            lineHeight: '1.5',
                            borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                            borderBottomLeftRadius: msg.role === 'user' ? '12px' : '2px',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {msg.content}
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

            {/* QUICK ACTIONS */}
            {messages.length === 0 && (
                <div style={{ padding: '0 20px 20px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
                    <QuickAction icon={<Box size={14} />} label="查询RMA物流" onClick={() => onSendMessage("帮我查询最新的RMA物流状态")} />
                    <QuickAction icon={<FileText size={14} />} label="Edge说明书" onClick={() => onSendMessage("查找MAVO Edge的使用手册")} />
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
                        placeholder="Type your question..."
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
                            style={{ background: input.trim() ? '#00BFA5' : 'rgba(255,255,255,0.1)', color: input.trim() ? 'black' : 'rgba(255,255,255,0.3)' }}
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
