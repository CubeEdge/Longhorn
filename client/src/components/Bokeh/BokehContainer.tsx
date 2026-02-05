import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import BokehOrb from './BokehOrb';
import BokehPanel from './BokehPanel';
import { useAuthStore } from '../../store/useAuthStore';
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
            const res = await axios.post('/api/ai/chat', {
                messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                context: {
                    path: window.location.pathname,
                    title: document.title
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
                    />
                )}
            </AnimatePresence>
        </>
    );
};

export default BokehContainer;
