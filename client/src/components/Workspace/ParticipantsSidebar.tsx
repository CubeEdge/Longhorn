import React, { useState, useEffect } from 'react';
import { User, Plus, X } from 'lucide-react';
import axios from 'axios';

interface ParticipantsSidebarProps {
    ticketId: string | number;
    participants: any[];
    onUpdate: () => void;
}

export const ParticipantsSidebar: React.FC<ParticipantsSidebarProps> = ({ ticketId, participants, onUpdate }) => {
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [users, setUsers] = useState<any[]>([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteUserId, setInviteUserId] = useState('');

    useEffect(() => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setCurrentUser(payload);
            }
            axios.get('/api/v1/system/users', { headers: { Authorization: `Bearer ${token}` } })
                .then(res => setUsers(res.data.data));
        } catch (e) {
            console.error('Failed to parse token or fetch users', e);
        }
    }, []);

    const handleInvite = async () => {
        if (!inviteUserId) return;
        try {
            await axios.post(`/api/v1/tickets/${ticketId}/participants`, { user_id: parseInt(inviteUserId) },
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            setShowInvite(false);
            setInviteUserId('');
            onUpdate();
        } catch (e) {
            console.error('Invite failed', e);
        }
    };

    const handleLeave = async (userId: number) => {
        if (!window.confirm('确定要退出该工单讨论吗？退出后将不再接收到此工单的评论通知。')) return;
        try {
            await axios.delete(`/api/v1/tickets/${ticketId}/participants/${userId}`,
                { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
            onUpdate();
        } catch (e) {
            console.error('Leave failed', e);
        }
    };

    const getRoleBadge = (role: string) => {
        const roles: Record<string, { color: string, label: string }> = {
            owner: { color: '#FFD700', label: '创建者' },
            assignee: { color: '#10B981', label: '处理人' },
            mentioned: { color: '#3B82F6', label: '协作中' }
        };
        const r = roles[role] || { color: '#888', label: '协作中' };
        return (
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${r.color}20`, color: r.color }}>
                {r.label}
            </span>
        );
    };

    // Filter out users who are already participants
    const availableUsers = users.filter(u => !participants.some(p => p.user_id === u.id));

    return (
        <div style={{
            background: 'rgba(30, 30, 30, 0.5)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            padding: '16px 20px',
            marginBottom: 16
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <User size={16} color="#FFD700" />
                    协作成员 <span style={{ color: '#888', fontSize: 13, fontWeight: 'normal' }}>({participants.length})</span>
                </div>
                <button
                    onClick={() => setShowInvite(!showInvite)}
                    title="静默邀请成员加入"
                    style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff',
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background 0.2s'
                    }}
                >
                    <Plus size={14} />
                </button>
            </div>

            {showInvite && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <select
                        value={inviteUserId}
                        onChange={e => setInviteUserId(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 6,
                            color: '#fff',
                            padding: '6px 8px',
                            fontSize: 13,
                            outline: 'none'
                        }}
                    >
                        <option value="">选择邀请成员...</option>
                        {availableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.name} {u.department ? `(${u.department})` : ''}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleInvite}
                        disabled={!inviteUserId}
                        style={{
                            background: inviteUserId ? '#FFD700' : 'rgba(255,255,255,0.1)',
                            color: inviteUserId ? '#000' : '#666',
                            border: 'none',
                            borderRadius: 6,
                            padding: '0 12px',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: inviteUserId ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s'
                        }}
                    >
                        添加
                    </button>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {participants.map(p => (
                    <div
                        key={p.user_id}
                        title={`于 ${new Date(p.joined_at || p.added_at).toLocaleString('zh-CN')} 加入`}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: 8,
                            transition: 'background 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                        <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'rgba(255,215,0,0.15)', color: '#FFD700',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500
                        }}>
                            {(p.name || '?')[0].toUpperCase()}
                        </div>

                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 13, color: '#e0e0e0', fontWeight: 500 }}>{p.name}</span>
                                {getRoleBadge(p.role)}
                            </div>
                        </div>

                        {currentUser?.id === p.user_id && (
                            <button
                                onClick={() => handleLeave(p.user_id)}
                                title="退出协作"
                                style={{
                                    background: 'transparent', border: 'none',
                                    color: '#ef4444', cursor: 'pointer', padding: 4,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                ))}

                {participants.length === 0 && (
                    <div style={{ fontSize: 12, color: '#666', textAlign: 'center', padding: '16px 0' }}>
                        暂无协作成员
                    </div>
                )}
            </div>
        </div>
    );
};
