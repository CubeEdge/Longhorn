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
            assignee: { color: '#10B981', label: '对接人' },
            mentioned: { color: '#3B82F6', label: '协作中' },
            follower: { color: '#8B5CF6', label: '关注者' }
        };
        const r = roles[role] || { color: 'var(--text-tertiary)', label: role };
        return (
            <span style={{
                fontSize: 10, padding: '1px 5px', borderRadius: 3,
                background: `${r.color}20`, color: r.color, fontWeight: 600
            }}>
                {r.label}
            </span>
        );
    };
    
    // 协作成员列表最多显示4人
    const MAX_VISIBLE_PARTICIPANTS = 4;
    const [showAllParticipants, setShowAllParticipants] = useState(false);
    const visibleParticipants = showAllParticipants ? participants : participants.slice(0, MAX_VISIBLE_PARTICIPANTS);
    const hiddenCount = participants.length - MAX_VISIBLE_PARTICIPANTS;

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
            background: 'var(--glass-bg-light)', backdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
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
                <User size={16} color="var(--accent-blue)" />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-main)' }}>
                    协作成员
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>({participants.length})</span>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!collapsed && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowInvite(!showInvite); }}
                            style={{
                                width: 26, height: 26, borderRadius: 6,
                                border: '1px solid var(--glass-border)',
                                background: showInvite ? 'var(--accent-subtle)' : 'var(--glass-bg-light)',
                                color: showInvite ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s', padding: 0,
                            }}
                        >
                            {showInvite ? <X size={13} /> : <Plus size={13} />}
                        </button>
                    )}
                    {collapsed ? <ChevronRight size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
                </div>
            </div>

            {!collapsed && (<>
                {/* Invite Dropdown */}
                {showInvite && (
                    <div ref={dropdownRef} style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        zIndex: 50,
                        background: 'var(--modal-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 10,
                        boxShadow: 'var(--glass-shadow-lg)',
                        maxHeight: 320,
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Search */}
                        <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid var(--glass-border)' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '6px 10px',
                                background: 'var(--glass-bg-light)',
                                borderRadius: 6,
                            }}>
                                <Search size={13} color="var(--text-tertiary)" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="搜索..."
                                    autoFocus
                                    style={{
                                        flex: 1, background: 'none', border: 'none',
                                        color: 'var(--text-main)', fontSize: 13, outline: 'none',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Grouped list */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                            {buildInviteGroups().map(group => (
                                <div key={group.name}>
                                    <div style={{
                                        fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
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
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-subtle)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
                                                    {user.department && (
                                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                                            {user.department}
                                                        </div>
                                                    )}
                                                </div>

                                                {totalScore > 0 && (
                                                    <span style={{
                                                        fontSize: 11, color: 'var(--accent-blue)', fontWeight: 600,
                                                        background: 'var(--accent-subtle)',
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
                                <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>
                                    无可邀请的用户
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Participants List */}
                <div style={{ padding: '8px 12px 12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {visibleParticipants.map(p => (
                            <div
                                key={p.user_id}
                                title={`于 ${new Date(p.joined_at || p.added_at).toLocaleString('zh-CN')} 加入`}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: '7px 8px',
                                    background: 'var(--glass-bg-light)',
                                    borderRadius: 8,
                                    transition: 'background 0.15s',
                                    position: 'relative',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                    const btn = e.currentTarget.querySelector('.remove-btn') as HTMLElement;
                                    if (btn) btn.style.opacity = '1';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'var(--glass-bg-light)';
                                    const btn = e.currentTarget.querySelector('.remove-btn') as HTMLElement;
                                    if (btn) btn.style.opacity = '0';
                                }}
                            >
                                <div style={{
                                    width: 26, height: 26, borderRadius: '50%',
                                    background: 'var(--accent-subtle)', color: 'var(--accent-blue)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, fontWeight: 600
                                }}>
                                    {(p.name || '?')[0].toUpperCase()}
                                </div>

                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-main)', fontWeight: 500 }}>{p.name}</span>
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
                        
                        {/* 展开/收起更多成员 */}
                        {hiddenCount > 0 && (
                            <button
                                onClick={() => setShowAllParticipants(!showAllParticipants)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: 4, padding: '6px 0', marginTop: 4,
                                    background: 'none', border: 'none',
                                    color: 'var(--text-tertiary)', fontSize: 12,
                                    cursor: 'pointer', transition: 'color 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-blue)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
                            >
                                {showAllParticipants ? (
                                    <>收起 <ChevronRight size={12} style={{ transform: 'rotate(-90deg)' }} /></>
                                ) : (
                                    <>查看全部 (+{hiddenCount}) <ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /></>
                                )}
                            </button>
                        )}
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
