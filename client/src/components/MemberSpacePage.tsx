import React, { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/useLanguage';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';

interface User {
    id: number;
    username: string;
    email?: string;
    role: string;
    department_id?: number;
    department?: string;
    file_count?: number;
    total_size?: number;
}

const formatSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const MemberSpacePage: React.FC = () => {
    const { t } = useLanguage();
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
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('status.loading')}</div>
        );
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Users size={32} color="var(--accent-blue)" />
                    {t('member.space_management')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {t('member.view_manage_hint')}
                </p>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '24px' }}>
                <input
                    type="text"
                    placeholder={t('member.search_users')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        fontSize: '0.95rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: '#fff'
                    }}
                />
            </div>

            {/* Stats Header */}
            <div style={{
                marginBottom: '10px',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                padding: '0 16px'
            }}>
                {t('member.total_users', { count: filteredUsers.length })}
            </div>

            {/* User List - Table Style */}
            <div style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                {/* Table Header */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(200px, 2fr) minmax(150px, 1.5fr) minmax(120px, 1fr) minmax(100px, 1fr) 120px',
                    padding: '16px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                }}>
                    <div>{t('member.table_user')}</div>
                    <div>{t('member.table_department')}</div>
                    <div>{t('common.personal_space')}</div>
                    <div>{t('member.table_file_count')}</div>
                    <div style={{ textAlign: 'center' }}>{t('member.table_actions')}</div>
                </div>

                {/* Table Rows */}
                {filteredUsers.map(user => (
                    <div
                        key={user.id}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(200px, 2fr) minmax(150px, 1.5fr) minmax(120px, 1fr) minmax(100px, 1fr) 120px',
                            padding: '16px 24px',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            alignItems: 'center',
                            transition: 'background 0.2s',
                            fontSize: '0.95rem'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        {/* User Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: 'var(--accent-blue)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: '#000',
                                flexShrink: 0
                            }}>
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600 }}>{user.username}</div>
                                {user.role === 'Admin' && <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)' }}>Admin</span>}
                            </div>
                        </div>

                        {/* Department */}
                        <div style={{ color: 'var(--text-secondary)' }}>
                            {user.department || t('member.unassigned')}
                        </div>

                        {/* Capacity */}
                        <div style={{ fontFamily: 'monospace', color: '#fff' }}>
                            {formatSize(user.total_size)}
                        </div>

                        {/* File Count */}
                        <div style={{ color: 'var(--text-secondary)' }}>
                            {user.file_count || 0}
                        </div>

                        {/* Actions */}
                        <div style={{ textAlign: 'center' }}>
                            <button
                                onClick={() => navigate(`/dept/members/${user.username}`)}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    color: 'var(--accent-blue)',
                                    cursor: 'pointer',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 122, 255, 0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                查看
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredUsers.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {t('member.not_found')}
                </div>
            )}
        </div>
    );
};

export default MemberSpacePage;
