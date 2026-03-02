import React, { useState, useRef, useEffect } from 'react';
import { Send, User as UserIcon } from 'lucide-react';
import axios from 'axios';

interface User {
    id: number;
    name: string;
    department?: string;
}

interface MentionCommentInputProps {
    onSubmit: (content: string, visibility: string, mentions: number[]) => void;
    loading?: boolean;
}

export const MentionCommentInput: React.FC<MentionCommentInputProps> = ({ onSubmit, loading }) => {
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState('all');
    const [mentions, setMentions] = useState<number[]>([]);

    const [users, setUsers] = useState<User[]>([]);
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(-1);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mentionMenuRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('/api/v1/system/users', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setUsers(res.data.data);
                }
            } catch (err) {
                console.error('[MentionInput] Failed to fetch users', err);
            }
        };
        fetchUsers();
    }, []);

    // Click outside to close mention menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMentionMenu && mentionMenuRef.current && !mentionMenuRef.current.contains(event.target as Node)) {
                setShowMentionMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMentionMenu]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setContent(val);

        const cursor = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursor);
        const lastAtMatch = textBeforeCursor.match(/@([^@\s]*)$/);

        if (lastAtMatch) {
            setShowMentionMenu(true);
            setMentionQuery(lastAtMatch[1].toLowerCase());
            setMentionIndex(lastAtMatch.index!);
            setSelectedIndex(0);
        } else {
            setShowMentionMenu(false);
        }
    };

    const filteredUsers = showMentionMenu
        ? users.filter(u => u.name.toLowerCase().includes(mentionQuery) || (u.department && u.department.toLowerCase().includes(mentionQuery)))
        : [];

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentionMenu && filteredUsers.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredUsers.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredUsers.length) % filteredUsers.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                insertMention(filteredUsers[selectedIndex]);
            } else if (e.key === 'Escape') {
                setShowMentionMenu(false);
            }
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            // Command+Enter (Mac) or Ctrl+Enter (Windows/Linux) to submit
            e.preventDefault();
            handleSubmit();
        }
    };

    const insertMention = (user: User) => {
        if (!textareaRef.current) return;

        const textBeforeAt = content.slice(0, mentionIndex);
        const textAfterCursor = content.slice(textareaRef.current.selectionStart);

        const newContent = `${textBeforeAt}@${user.name} ${textAfterCursor}`;
        setContent(newContent);
        setShowMentionMenu(false);

        if (!mentions.includes(user.id)) {
            setMentions(prev => [...prev, user.id]);
        }

        setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    };

    const handleSubmit = () => {
        if (!content.trim()) return;

        // Verify mapped mentions still exist in text
        const finalMentions = mentions.filter(id => {
            const u = users.find(x => x.id === id);
            return u && content.includes(`@${u.name}`);
        });

        onSubmit(content, visibility, finalMentions);
        setContent('');
        setMentions([]);
    };

    return (
        <div style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: 16,
            background: 'rgba(30, 30, 30, 0.6)',
            position: 'relative'
        }}>
            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="添加评论... (支持 @用户 提及)"
                style={{
                    width: '100%',
                    minHeight: 80,
                    padding: 12,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 14,
                    resize: 'vertical',
                    marginBottom: 12,
                    outline: 'none',
                    boxShadow: showMentionMenu ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
                    transition: 'box-shadow 0.2s'
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)'; }}
                onBlur={(e) => { e.target.style.boxShadow = 'none'; }}
            />

            {showMentionMenu && filteredUsers.length > 0 && (
                <ul ref={mentionMenuRef} style={{
                    position: 'absolute',
                    bottom: 70,
                    left: 20,
                    background: '#2A2A2A',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    padding: '4px 0',
                    margin: 0,
                    listStyle: 'none',
                    maxHeight: 200,
                    overflowY: 'auto',
                    zIndex: 100,
                    minWidth: 200
                }}>
                    {filteredUsers.map((user, idx) => (
                        <li
                            key={user.id}
                            onClick={() => insertMention(user)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                background: idx === selectedIndex ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                color: '#fff',
                                fontSize: 14
                            }}
                        >
                            <div style={{
                                width: 24, height: 24, borderRadius: '50%', background: '#555',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <UserIcon size={14} color="#aaa" />
                            </div>
                            <span>{user.name}</span>
                            {user.department && <span style={{ fontSize: 12, color: '#888', marginLeft: 'auto' }}>{user.department}</span>}
                        </li>
                    ))}
                </ul>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <select
                    value={visibility}
                    onChange={e => setVisibility(e.target.value)}
                    style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        color: '#ccc',
                        fontSize: 13,
                        outline: 'none'
                    }}
                >
                    <option value="all">所有人可见</option>
                    <option value="internal">仅内部</option>
                    <option value="op_only">仅 OP</option>
                </select>

                <div style={{ flex: 1 }} />

                <button
                    onClick={handleSubmit}
                    disabled={loading || !content.trim()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        background: content.trim() ? '#FFD700' : 'rgba(255,255,255,0.1)',
                        color: content.trim() ? '#000' : '#666',
                        border: 'none',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: content.trim() ? 'pointer' : 'not-allowed',
                        transition: 'background 0.2s, color 0.2s'
                    }}
                >
                    <Send size={14} />
                    发送
                </button>
            </div>
        </div>
    );
};
