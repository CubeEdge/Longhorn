import React, { useState, useEffect, useRef } from 'react';
import { User, Plus, X, Search, ChevronDown, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

const INTERACTION_FREQS_KEY = 'longhorn_interaction_freqs';

const getInteractionFreqs = (): Record<number, number> => {
    try {
        return JSON.parse(localStorage.getItem(INTERACTION_FREQS_KEY) || '{}');
    } catch {
        return {};
    }
};

interface ParticipantsSidebarProps {
    ticketId: number;
    participants: any[];
    onUpdate: () => void;
}

interface UserOption {
    id: number;
    name: string;
    department?: string;
    department_name?: string;
    role?: string;
}

// Threshold for "frequent"
const FREQ_THRESHOLD = 2;

export const ParticipantsSidebar: React.FC<ParticipantsSidebarProps> = ({
    ticketId,
    participants,
    onUpdate
}) => {
    const { user: currentUserProfile } = useAuthStore();
    const [showInvite, setShowInvite] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [allUsers, setAllUsers] = useState<UserOption[]>([]);
    const [inviteStats, setInviteStats] = useState<Record<number, number>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showInvite) return;
        const fetchUsers = async () => {
            try {
                const token = localStorage.getItem('token');
                const [usersRes, statsRes] = await Promise.all([
                    axios.get('/api/v1/system/users', {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get('/api/v1/tickets/invite-stats', {
                        headers: { Authorization: `Bearer ${token}` }
                    }).catch(() => ({ data: { data: [] } }))
                ]);
                if (usersRes.data.success) {
                    setAllUsers(usersRes.data.data);
                }
                const map: Record<number, number> = {};
                (statsRes.data?.data || []).forEach((s: { user_id: number; invite_count: number }) => {
                    map[s.user_id] = s.invite_count;
                });
                setInviteStats(map);
            } catch (e) {
                console.error('Failed to fetch users', e);
            }
        };
        fetchUsers();
    }, [showInvite]);

    // Click outside to close
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (showInvite && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowInvite(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showInvite]);

    const handleInvite = async (userId: number) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`/api/v1/tickets/${ticketId}/participants`, {
                user_ids: [userId]
            }, { headers: { Authorization: `Bearer ${token}` } });
            onUpdate();
            setShowInvite(false);
            setSearchQuery('');
        } catch (e) {
            console.error('Invite failed', e);
        }
    };

    const handleRemove = async (userId: number) => {
        const isSelf = currentUserProfile?.id === userId;
        const msg = isSelf
            ? '确定要退出该工单讨论吗？退出后将不再接收到此工单的评论通知。'
            : '确定要移除该成员吗？';
        if (!window.confirm(msg)) return;
        try {
            await axios.delete(`/api/v1/tickets/${ticketId}/participants/${userId}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            onUpdate();
        } catch (e) {
            console.error('Remove participant failed', e);
        }
    };

    const getRoleBadge = (role: string) => {
        const roles: Record<string, { color: string; label: string }> = {
            owner: { color: '#FFD700', label: '创建者' },
            assignee: { color: '#10B981', label: '处理人' },
            mentioned: { color: '#3B82F6', label: '协作中' },
            follower: { color: '#8B5CF6', label: '关注者' }
        };
        const r = roles[role] || { color: '#888', label: role };
        return (
            <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: `${r.color}20`, color: r.color, fontWeight: 600
            }}>
                {r.label}
            </span>
        );
    };

    // Build grouped user list for invite dropdown
    const buildInviteGroups = () => {
        const freqs = getInteractionFreqs();
        const participantIds = new Set(participants.map(p => p.user_id));
        const query = searchQuery.toLowerCase();

        const available = allUsers
            .filter(u => !participantIds.has(u.id))
            .filter(u =>
                u.name.toLowerCase().includes(query) ||
                (u.department && u.department.toLowerCase().includes(query))
            )
            .sort((a, b) => {
                const aScore = (inviteStats[a.id] || 0) + (freqs[a.id] || 0);
                const bScore = (inviteStats[b.id] || 0) + (freqs[b.id] || 0);
                if (aScore !== bScore) return bScore - aScore;
                return a.name.localeCompare(b.name);
            });

        const frequentUsers: UserOption[] = [];
        const deptGroups: Record<string, UserOption[]> = {};

        available.forEach(u => {
            const score = (inviteStats[u.id] || 0) + (freqs[u.id] || 0);
            if (score >= FREQ_THRESHOLD) {
                frequentUsers.push(u);
            }
            // Use department_name for grouping, NOT role
            const dept = u.department_name || u.department || '其他';
            if (!deptGroups[dept]) deptGroups[dept] = [];
            deptGroups[dept].push(u);
        });

        const groups: { name: string; users: UserOption[] }[] = [];
        if (frequentUsers.length > 0) {
            groups.push({ name: '⭐ 常用', users: frequentUsers });
        }
        Object.entries(deptGroups).forEach(([name, us]) => {
            groups.push({ name, users: us });
        });

        return groups;
    };

    return (
        <div style={{
            borderRadius: 12, marginBottom: 16,
            background: 'rgba(30,30,30,0.5)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'visible',
            position: 'relative',
        }}>
            {/* Header - Collapsible */}
            <div
                onClick={() => setCollapsed(!collapsed)}
                style={{
                    padding: '14px 16px',
                    borderBottom: collapsed ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    cursor: 'pointer',
                }}>
                <User size={16} color="#FFD700" />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                    协作成员
                </span>
                <span style={{ fontSize: 12, color: '#666' }}>({participants.length})</span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!collapsed && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowInvite(!showInvite); }}
                            style={{
                                width: 26, height: 26, borderRadius: 6,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: showInvite ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.04)',
                                color: showInvite ? '#FFD700' : '#888',
                                cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s', padding: 0,
                            }}
                        >
                            {showInvite ? <X size={13} /> : <Plus size={13} />}
                        </button>
                    )}
                    {collapsed ? <ChevronRight size={14} color="#888" /> : <ChevronDown size={14} color="#888" />}
                </div>
            </div>

            {!collapsed && (<>
                {/* Invite Dropdown */}
                {showInvite && (
                    <div ref={dropdownRef} style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        zIndex: 50,
                        background: '#1E1E1E',
                        border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: 10,
                        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                        maxHeight: 320,
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Search */}
                        <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '6px 10px',
                                background: 'rgba(255,255,255,0.06)',
                                borderRadius: 6,
                            }}>
                                <Search size={13} color="#666" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索..."
                                    autoFocus
                                    style={{
                                        flex: 1, background: 'none', border: 'none',
                                        color: '#fff', fontSize: 13, outline: 'none',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Grouped list */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                            {buildInviteGroups().map(group => (
                                <div key={group.name}>
                                    <div style={{
                                        fontSize: 11, fontWeight: 600, color: '#888',
                                        padding: '6px 14px 3px', letterSpacing: 0.5,
                                    }}>
                                        {group.name} ({group.users.length})
                                    </div>
                                    {group.users.map(user => {
                                        const freqs = getInteractionFreqs();
                                        const totalScore = (inviteStats[user.id] || 0) + (freqs[user.id] || 0);
                                        return (
                                            <div
                                                key={`${group.name}-${user.id}`}
                                                onClick={() => handleInvite(user.id)}
                                                style={{
                                                    padding: '7px 14px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,215,0,0.08)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <div style={{
                                                    width: 26, height: 26, borderRadius: '50%',
                                                    background: 'rgba(255,215,0,0.15)', color: '#FFD700',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 11, fontWeight: 600, flexShrink: 0,
                                                }}>
                                                    {user.name[0]?.toUpperCase() || '?'}
                                                </div>

                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontSize: 13, fontWeight: 500, color: '#e0e0e0',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {user.name}
                                                    </div>
                                                    {user.department && (
                                                        <div style={{ fontSize: 11, color: '#666' }}>
                                                            {user.department}
                                                        </div>
                                                    )}
                                                </div>

                                                {totalScore > 0 && (
                                                    <span style={{
                                                        fontSize: 11, color: '#FFD700', fontWeight: 600,
                                                        background: 'rgba(255,215,0,0.1)',
                                                        padding: '1px 6px', borderRadius: 4,
                                                    }}>
                                                        ↑{totalScore}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                            {buildInviteGroups().length === 0 && (
                                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#666' }}>
                                    无可邀请的用户
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Participants List */}
                <div style={{ padding: '8px 12px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {participants.map(p => (
                            <div
                                key={p.user_id}
                                title={`于 ${new Date(p.joined_at || p.added_at).toLocaleString('zh-CN')} 加入`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '7px 8px',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: 8,
                                    transition: 'background 0.15s',
                                    position: 'relative',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                    const btn = e.currentTarget.querySelector('.remove-btn') as HTMLElement;
                                    if (btn) btn.style.opacity = '1';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                    const btn = e.currentTarget.querySelector('.remove-btn') as HTMLElement;
                                    if (btn) btn.style.opacity = '0';
                                }}
                            >
                                <div style={{
                                    width: 26, height: 26, borderRadius: '50%',
                                    background: 'rgba(255,215,0,0.15)', color: '#FFD700',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, fontWeight: 600
                                }}>
                                    {(p.name || '?')[0].toUpperCase()}
                                </div>

                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{p.name}</span>
                                    {getRoleBadge(p.role)}
                                </div>

                                <button
                                    className="remove-btn"
                                    onClick={() => handleRemove(p.user_id)}
                                    title={currentUserProfile?.id === p.user_id ? '退出协作' : '移除成员'}
                                    style={{
                                        background: 'transparent', border: 'none',
                                        color: '#ef4444', cursor: 'pointer', padding: 4,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: 0, transition: 'opacity 0.15s',
                                    }}
                                >
                                    <X size={13} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {participants.length === 0 && (
                        <div style={{ fontSize: 12, color: '#666', textAlign: 'center', padding: '12px 0' }}>
                            暂无协作成员
                        </div>
                    )}
                </div>
            </>)}
        </div>
    );
};
