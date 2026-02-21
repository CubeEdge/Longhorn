import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import BokehOrb from './BokehOrb';
import BokehPanel from './BokehPanel';
import { useAuthStore } from '../../store/useAuthStore';
import { useBokehContext } from '../../store/useBokehContext';
import axios from 'axios';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const BokehContainer: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const { token } = useAuthStore();
    const { currentContext, getContextSummary, getSuggestedActions, isEditorMode } = useBokehContext();

    // Global Shortcut Cmd+K / Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const sendMessage = async (text: string) => {
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        try {
            // Check if this is an editor mode request (direct content modification)
            const isEditorModeRequest = isEditorMode() && (
                text.includes('优化') ||
                text.includes('修改') ||
                text.includes('调整') ||
                text.includes('缩小') ||
                text.includes('放大') ||
                text.includes('图片') ||
                text.includes('段落') ||
                text.includes('格式') ||
                text.includes('太大') ||
                text.includes('太小') ||
                text.includes('重写') ||
                text.includes('精简') ||
                text.includes('缩短') ||
                text.includes('颜色') ||
                text.includes('样式') ||
                text.includes('标题')
            );

            if (isEditorModeRequest && currentContext?.type === 'wiki_article_edit') {
                // Call the bokeh-optimize API for editor mode
                const res = await axios.post(`/api/v1/knowledge/${currentContext.articleId}/bokeh-optimize`, {
                    instruction: text,
                    currentContent: currentContext.currentContent
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.data.success) {
                    const aiMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        content: res.data.data.response_message,
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, aiMsg]);
                    
                    // Dispatch event to notify editor to refresh with new content
                    window.dispatchEvent(new CustomEvent('bokeh-article-optimized', {
                        detail: { 
                            articleId: currentContext.articleId,
                            optimizedContent: res.data.data.optimized_content
                        }
                    }));
                }
            } else {
                // Regular chat request
                const contextSummary = getContextSummary();
                const res = await axios.post('/api/ai/chat', {
                    messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                    context: {
                        path: window.location.pathname,
                        title: document.title,
                        wikiContext: currentContext,
                        contextSummary
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
        } catch (err) {
            console.error('Bokeh Chat Error:', err);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: "Sorry, I couldn't reach the server. Please check your connection.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <AnimatePresence>
                {!isOpen && (
                    <BokehOrb onClick={() => setIsOpen(true)} />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <BokehPanel
                        isOpen={isOpen}
                        onClose={() => setIsOpen(false)}
                        onMinimize={() => setIsOpen(false)}
                        messages={messages}
                        onSendMessage={sendMessage}
                        loading={loading}
                        wikiContext={currentContext}
                        suggestedActions={getSuggestedActions()}
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default BokehContainer;
