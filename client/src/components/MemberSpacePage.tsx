import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Users, Mail, Building, HardDrive, Folder } from 'lucide-react';

interface User {
    id: number;
    username: string;
    email?: string;
    role: string;
    department_id?: number;
    department?: string;
}

export const MemberSpacePage: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { token } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await axios.get('/api/admin/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data);
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                加载中...
            </div>
        );
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Users size={32} color="var(--accent-blue)" />
                    👥 成员空间管理
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    查看和管理所有用户的个人空间
                </p>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '24px' }}>
                <input
                    type="text"
                    placeholder="🔍 搜索用户..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        fontSize: '0.95rem'
                    }}
                />
            </div>

            {/* Stats */}
            <div style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                padding: '16px 24px',
                marginBottom: '24px',
                display: 'flex',
                gap: '32px'
            }}>
                <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>总用户</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{users.length} 人</div>
                </div>
            </div>

            {/* User List */}
            <div style={{ display: 'grid', gap: '16px' }}>
                {filteredUsers.map(user => (
                    <div
                        key={user.id}
                        style={{
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '12px',
                            padding: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--glass-bg)';
                        }}
                    >
                        {/* Avatar */}
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: 'var(--accent-blue)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: '#000',
                            flexShrink: 0
                        }}>
                            {user.username.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>
                                {user.username}
                            </h3>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {user.email && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Mail size={14} />
                                        {user.email}
                                    </span>
                                )}
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Building size={14} />
                                    {user.department || '未分配'} · {user.role}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <button
                            onClick={() => navigate(`/dept/members/${user.username}`)}
                            style={{
                                padding: '10px 20px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--accent-blue)',
                                color: '#000',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.opacity = '0.8';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.opacity = '1';
                            }}
                        >
                            <Folder size={16} />
                            查看文件
                        </button>
                    </div>
                ))}
            </div>

            {filteredUsers.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    未找到匹配的用户
                </div>
            )}
        </div>
    );
};

export default MemberSpacePage;
