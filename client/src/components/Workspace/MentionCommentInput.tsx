import React, { useState, useRef, useEffect } from 'react';
import { Send, AtSign, Paperclip, X, Image, Loader2 } from 'lucide-react';
import axios from 'axios';

const INTERACTION_FREQS_KEY = 'longhorn_interaction_freqs';

const getInteractionFreqs = (): Record<number, number> => {
    try {
        return JSON.parse(localStorage.getItem(INTERACTION_FREQS_KEY) || '{}');
    } catch {
        return {};
    }
};

const trackInteraction = (userId: number) => {
    try {
        const freqs = getInteractionFreqs();
        freqs[userId] = (freqs[userId] || 0) + 1;
        localStorage.setItem(INTERACTION_FREQS_KEY, JSON.stringify(freqs));
    } catch { }
};

interface User {
    id: number;
    name: string;
    department?: string;
    department_name?: string;
    role?: string;
}

interface MentionStat {
    user_id: number;
    mention_count: number;
}

interface AttachmentFile {
    file: File;
    preview?: string;
}

interface MentionCommentInputProps {
    onSubmit: (content: string, visibility: string, mentions: number[], attachments?: File[]) => Promise<void> | void;
    loading?: boolean;
}

const FREQ_THRESHOLD = 2;

export const MentionCommentInput: React.FC<MentionCommentInputProps> = ({ onSubmit, loading: externalLoading }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const loading = externalLoading || isSubmitting;
    const [content, setContent] = useState('');
    const [visibility, setVisibility] = useState('all');
    const [mentions, setMentions] = useState<number[]>([]);
    const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

    const [users, setUsers] = useState<User[]>([]);
    const [mentionStats, setMentionStats] = useState<Record<number, number>>({});
    const [showMentionMenu, setShowMentionMenu] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionIndex, setMentionIndex] = useState(-1);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mentionMenuRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const [usersRes, statsRes] = await Promise.all([
                    axios.get('/api/v1/system/users', {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get('/api/v1/tickets/mention-stats', {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => ({ data: { data: [] } }))
                ]);
                if (usersRes.data.success) {
                    setUsers(usersRes.data.data);
                }
                const statsMap: Record<number, number> = {};
                (statsRes.data?.data || []).forEach((s: MentionStat) => {
                    statsMap[s.user_id] = s.mention_count;
                });
                setMentionStats(statsMap);
            } catch (err) {
                console.error('[MentionInput] Failed to fetch users', err);
            }
        };
        fetchData();
    }, []);

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

    // Build grouped filtered users — use department_name (not role) for grouping
    const buildGroupedUsers = () => {
        const freqs = getInteractionFreqs();
        const query = mentionQuery.toLowerCase();

        const filtered = users.filter(u =>
            u.name.toLowerCase().includes(query) ||
            (u.department && u.department.toLowerCase().includes(query)) ||
            (u.department_name && u.department_name.toLowerCase().includes(query))
        ).sort((a, b) => {
            const aScore = (mentionStats[a.id] || 0) + (freqs[a.id] || 0);
            const bScore = (mentionStats[b.id] || 0) + (freqs[b.id] || 0);
            if (aScore !== bScore) return bScore - aScore;
            return a.name.localeCompare(b.name);
        });

        const frequentUsers: User[] = [];
        const deptGroups: Record<string, User[]> = {};

        filtered.forEach(u => {
            const score = (mentionStats[u.id] || 0) + (freqs[u.id] || 0);
            if (score >= FREQ_THRESHOLD) {
                frequentUsers.push(u);
            }
            // Use department_name or department for grouping, NOT role
            const dept = u.department_name || u.department || '其他';
            if (!deptGroups[dept]) deptGroups[dept] = [];
            deptGroups[dept].push(u);
        });

        const groups: { name: string; users: User[] }[] = [];
        if (frequentUsers.length > 0) {
            groups.push({ name: '⭐ 常用', users: frequentUsers });
        }
        Object.entries(deptGroups).forEach(([name, us]) => {
            groups.push({ name, users: us });
        });

        return { groups, flatList: filtered };
    };

    const { groups: mentionGroups, flatList } = showMentionMenu ? buildGroupedUsers() : { groups: [], flatList: [] };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showMentionMenu && flatList.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % flatList.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + flatList.length) % flatList.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                insertMention(flatList[selectedIndex]);
            } else if (e.key === 'Escape') {
                setShowMentionMenu(false);
            }
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
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
        trackInteraction(user.id);
        setTimeout(() => { textareaRef.current?.focus(); }, 0);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);

        const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
        const validFiles: File[] = [];

        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                alert(`文件 ${file.name} 超过了 50MB 的限制。`);
            } else {
                validFiles.push(file);
            }
        }

        const newAttachments: AttachmentFile[] = validFiles.map(file => {
            const attachment: AttachmentFile = { file };
            if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                attachment.preview = URL.createObjectURL(file);
            }
            return attachment;
        });
        setAttachments(prev => [...prev, ...newAttachments]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeAttachment = (idx: number) => {
        setAttachments(prev => {
            const removed = prev[idx];
            if (removed.preview) URL.revokeObjectURL(removed.preview);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
            const validFiles: File[] = [];
            const files = Array.from(e.dataTransfer.files);

            for (const file of files) {
                if (file.size > MAX_FILE_SIZE) {
                    alert(`文件 ${file.name} 超过了 50MB 的限制。`);
                } else {
                    validFiles.push(file);
                }
            }

            const newAttachments: AttachmentFile[] = validFiles.map(file => {
                const attachment: AttachmentFile = { file };
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    attachment.preview = URL.createObjectURL(file);
                }
                return attachment;
            });
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    };

    const handleSubmit = async () => {
        if (loading || (!content.trim() && attachments.length === 0)) return;
        const finalMentions = mentions.filter(id => {
            const u = users.find(x => x.id === id);
            return u && content.toLowerCase().includes(`@${u.name.toLowerCase()}`);
        });

        try {
            setIsSubmitting(true);
            await onSubmit(content, visibility, finalMentions, attachments.map(a => a.file));
            setContent('');
            setMentions([]);
            attachments.forEach(a => { if (a.preview) URL.revokeObjectURL(a.preview); });
            setAttachments([]);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            style={{ padding: 16, background: 'var(--card-bg)', position: 'relative', borderRadius: 12, border: '1px solid var(--card-border)', boxShadow: 'var(--card-shadow)' }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
            {/* Uploading Overlay - More prominent for "global" feel */}
            {(loading || isSubmitting) && (
                <div style={{
                    position: 'absolute', inset: -4, background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)', zIndex: 2000, borderRadius: 16,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
                    animation: 'fadeIn 0.2s ease-out', border: '1px solid rgba(255,215,0,0.2)'
                }}>
                    <div style={{ position: 'relative', width: 56, height: 56 }}>
                        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid rgba(255,215,0,0.1)', borderTopColor: '#FFD700', animation: 'spin 1s linear infinite' }} />
                        <div style={{ position: 'absolute', inset: 8, borderRadius: '50%', border: '2px solid rgba(255,215,0,0.4)', borderBottomColor: 'transparent', animation: 'spin 1.5s linear infinite reverse' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#FFD700', fontSize: 16, fontWeight: 700, letterSpacing: 0.5 }}>
                            {attachments.length > 0 ? '正在安全上传大文件...' : '正在提交评论...'}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>请勿刷新或关闭此页面</div>
                    </div>
                </div>
            )}
            <textarea
                ref={textareaRef}
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder="添加评论... (输入 @ 提及用户)"
                style={{
                    width: '100%', minHeight: 72, padding: 12,
                    background: 'var(--card-bg-light)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 8, color: 'var(--text-main)', fontSize: 14,
                    resize: 'vertical', marginBottom: attachments.length > 0 ? 8 : 10,
                    outline: 'none',
                    boxShadow: showMentionMenu ? '0 0 0 2px var(--accent-blue)' : 'none',
                    transition: 'box-shadow 0.2s'
                }}
                onFocus={(e) => { e.target.style.boxShadow = '0 0 0 2px var(--accent-blue)'; }}
                onBlur={(e) => { if (!showMentionMenu) e.target.style.boxShadow = 'none'; }}
            />

            {/* Attachment previews */}
            {attachments.length > 0 && (
                <div style={{
                    display: 'flex', gap: 8, flexWrap: 'wrap',
                    padding: '8px 0', marginBottom: 8,
                }}>
                    {attachments.map((att, idx) => (
                        <div key={idx} style={{
                            position: 'relative', borderRadius: 8, overflow: 'hidden',
                            border: '1px solid var(--card-border)',
                            background: 'var(--card-bg-light)',
                        }}>
                            {att.preview ? (
                                att.file.type.startsWith('video/') ? (
                                    <div style={{ position: 'relative', width: 80, height: 80, background: '#000' }}>
                                        <video src={att.preview} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                            <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '50%', padding: 4, color: '#FFD700' }}>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <img src={att.preview} alt="" style={{
                                        width: 80, height: 80, objectFit: 'cover', display: 'block',
                                    }} />
                                )
                            ) : (
                                <div style={{
                                    width: 80, height: 80, display: 'flex',
                                    flexDirection: 'column', alignItems: 'center',
                                    justifyContent: 'center', gap: 4,
                                }}>
                                    <Paperclip size={16} color="var(--text-tertiary)" />
                                    <span style={{
                                        fontSize: 10, color: 'var(--text-tertiary)', maxWidth: 70,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        textAlign: 'center',
                                    }}>{att.file.name}</span>
                                </div>
                            )}
                            <button
                                onClick={() => removeAttachment(idx)}
                                style={{
                                    position: 'absolute', top: 2, right: 2,
                                    width: 18, height: 18, borderRadius: '50%',
                                    background: 'rgba(0,0,0,0.7)', border: 'none',
                                    color: '#fff', cursor: 'pointer', padding: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Grouped @mention dropdown */}
            {showMentionMenu && flatList.length > 0 && (
                <div ref={mentionMenuRef} style={{
                    position: 'absolute', bottom: attachments.length > 0 ? 160 : 80,
                    left: 16,
                    background: 'var(--modal-bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 10,
                    boxShadow: 'var(--glass-shadow-lg)',
                    padding: '8px 0',
                    maxHeight: 400,
                    overflowY: 'auto',
                    zIndex: 9999,
                    minWidth: 260, maxWidth: 320,
                }}>
                    {mentionGroups.map(group => (
                        <div key={group.name}>
                            <div style={{
                                fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                                padding: '6px 14px 4px', letterSpacing: 0.5,
                            }}>
                                {group.name} ({group.users.length})
                            </div>
                            {group.users.map(user => {
                                const currentFlatIdx = flatList.findIndex(u => u.id === user.id);
                                const isSelected = currentFlatIdx === selectedIndex;
                                const mCount = mentionStats[user.id] || 0;
                                const localFreq = getInteractionFreqs()[user.id] || 0;
                                const totalInteractions = mCount + localFreq;
                                const deptLabel = user.department_name || user.department;

                                return (
                                    <div
                                        key={`${group.name}-${user.id}`}
                                        onClick={() => insertMention(user)}
                                        onMouseEnter={() => setSelectedIndex(currentFlatIdx)}
                                        style={{
                                            padding: '7px 14px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                                            transition: 'background 0.1s',
                                        }}
                                    >
                                        <div style={{
                                            width: 26, height: 26, borderRadius: '50%',
                                            background: 'var(--accent-subtle)', color: 'var(--accent-blue)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 11, fontWeight: 600, flexShrink: 0,
                                        }}>
                                            {user.name[0]?.toUpperCase() || '?'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 13, fontWeight: 500, color: 'var(--text-main)',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            }}>
                                                {user.name}
                                            </div>
                                            {deptLabel && (
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{deptLabel}</div>
                                            )}
                                        </div>
                                        {totalInteractions > 0 && (
                                            <span style={{
                                                fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600,
                                                background: 'var(--accent-subtle)',
                                                padding: '1px 6px', borderRadius: 4,
                                                display: 'flex', alignItems: 'center', gap: 3,
                                            }}>
                                                <AtSign size={9} /> {totalInteractions}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                    value={visibility}
                    onChange={e => setVisibility(e.target.value)}
                    style={{
                        background: 'var(--card-bg-light)',
                        border: '1px solid var(--card-border)',
                        borderRadius: 6, padding: '6px 10px',
                        color: 'var(--text-secondary)', fontSize: 12, outline: 'none'
                    }}
                >
                    <option value="all">所有人可见</option>
                    <option value="internal">仅内部</option>
                    <option value="op_only">仅 OP</option>
                </select>

                {/* Attachment button */}
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.zip"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    title="添加附件"
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 32, height: 32, borderRadius: 6,
                        border: '1px solid var(--card-border)',
                        background: 'var(--card-bg-light)',
                        color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0,
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
                >
                    <Image size={14} />
                </button>

                <div style={{ flex: 1 }} />

                <button
                    onClick={handleSubmit}
                    disabled={loading || (!content.trim() && attachments.length === 0)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 16px',
                        background: loading ? 'var(--glass-bg-hover)' : ((content.trim() || attachments.length > 0) ? 'var(--accent-blue)' : 'var(--glass-bg-light)'),
                        color: loading ? 'var(--text-tertiary)' : ((content.trim() || attachments.length > 0) ? '#000' : 'var(--text-tertiary)'),
                        border: 'none', borderRadius: 6,
                        fontSize: 13, fontWeight: 600,
                        cursor: (loading || (!content.trim() && attachments.length === 0)) ? 'not-allowed' : 'pointer',
                        transition: 'background 0.2s, color 0.2s'
                    }}
                >
                    {loading ? (
                        <>
                            <Loader2 className="animate-spin" size={13} />
                            {attachments.length > 0 ? '正在上传附件...' : '正在发送...'}
                        </>
                    ) : (
                        <>
                            <Send size={13} />
                            发送
                        </>
                    )}
                </button>
            </div>
            {/* Loading Overlay */}
            {loading && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: 12, borderRadius: 12,
                    border: '1px solid rgba(255,215,0,0.2)'
                }}>
                    <div className="animate-spin" style={{
                        width: 32, height: 32, border: '3px solid rgba(255,215,0,0.1)',
                        borderTopColor: '#FFD700', borderRadius: '50%'
                    }} />
                    <div style={{ fontSize: 13, color: '#FFD700', fontWeight: 600, textAlign: 'center' }}>
                        {attachments.length > 0 ? (
                            <>正在上传大文件...<br /><span style={{ fontSize: 11, opacity: 0.8 }}>请勿刷新或关闭页面</span></>
                        ) : '请稍候...'}
                    </div>
                </div>
            )}
            <style>{`
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
