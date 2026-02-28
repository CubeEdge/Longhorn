import React, { useState, useEffect } from 'react';
import { Network, Users, Shield, TrendingUp, HardDrive, Activity } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

interface DepartmentStats {
    department: {
        name: string;
        code: string;
    };
    totalMembers: number;
    activeMembers: number;
    totalFiles: number;
    totalSize: number;
    storageByMember: Array<{
        username: string;
        size: number;
        fileCount: number;
    }>;
    recentActivity: Array<{
        user: string;
        action: string;
        file: string;
        time: string;
    }>;
}

interface Member {
    id: number;
    username: string;
    role: string;
    last_login: string | null;
    storageUsed: number;
    fileCount: number;
}

interface Permission {
    id: number;
    user_id: number;
    username: string;
    folder_path: string;
    access_type: string;
    expires_at: string | null;
    granted_by: number | null;
    granted_by_name: string | null;
    created_at: string;
}

type TabType = 'overview' | 'members' | 'permissions';

const DepartmentDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [stats, setStats] = useState<DepartmentStats | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { t } = useLanguage();

    // Helper to translate department names
    const getDeptDisplayName = (deptName: string): string => {
        const match = deptName.match(/\(([A-Z]{2,3})\)$/);
        if (match) {
            const code = match[1];
            const deptKey = `dept.${code}` as any;
            return `${t(deptKey)} (${code})`;
        }
        return deptName;
    };

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (activeTab === 'overview') {
                const response = await fetch('/api/department/stats', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }
                const data = await response.json();
                setStats(data);
            } else if (activeTab === 'members') {
                const response = await fetch('/api/department/members', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }
                const data = await response.json();
                setMembers(data);
            } else if (activeTab === 'permissions') {
                const response = await fetch('/api/department/permissions', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP ${response.status}`);
                }
                const data = await response.json();
                setPermissions(data);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setError(error instanceof Error ? error.message : t('modal.error'));
        } finally {
            setLoading(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return t('dept.inactive');
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN');
    };

    const tabs = [
        { id: 'overview' as TabType, label: t('dept.overview'), icon: TrendingUp },
        { id: 'members' as TabType, label: t('dept.members'), icon: Users },
        { id: 'permissions' as TabType, label: t('dept.permissions'), icon: Shield }
    ];

    const renderContent = () => {
        if (error) {
            return (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ color: '#ff6666', fontSize: '1.2rem', marginBottom: '16px' }}>{t('error.load_failed_icon')}</div>
                    <div style={{ color: 'var(--text-secondary)' }}>{error}</div>
                    <button
                        onClick={() => fetchData()}
                        style={{
                            marginTop: '20px',
                            padding: '10px 24px',
                            background: 'var(--accent-blue)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        {t('action.cancel')}
                    </button>
                </div>
            );
        }

        if (loading) {
            return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>{t('browser.loading')}</div>;
        }

        if (activeTab === 'overview' && stats) {
            return (
                <div>
                    {/* Department Header */}
                    <div style={{ marginBottom: '32px' }}>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>{getDeptDisplayName(stats.department.name)}</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>{t('dept.manage')}: {stats.department.code}</p>
                    </div>

                    {/* Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                        <div style={{ background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)', padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <Users size={20} color="var(--accent-blue)" />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dept.total_members')}</span>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalMembers}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px' }}>{t('dept.active')}: {stats.activeMembers} {t('common.people_suffix')}</div>
                        </div>

                        <div style={{ background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)', padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <Activity size={20} color="var(--accent-blue)" />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dept.file_count')}</span>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalFiles}</div>
                        </div>

                        <div style={{ background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)', padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <HardDrive size={20} color="var(--accent-blue)" />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dept.storage_used')}</span>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{formatSize(stats.totalSize)}</div>
                        </div>
                    </div>

                    {/* Storage by Member */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)', padding: '24px', marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>{t('dept.member_storage')}</h3>
                        {stats.storageByMember.map((member, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: idx < stats.storageByMember.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
                                <div>
                                    <div style={{ fontWeight: 600 }}>{member.username}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{member.fileCount} {t('dept.files')}</div>
                                </div>
                                <div style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{formatSize(member.size)}</div>
                            </div>
                        ))}
                    </div>

                    {/* Recent Activity */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)', padding: '24px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '20px' }}>{t('dept.recent_activity')}</h3>
                        {stats.recentActivity.slice(0, 10).map((activity, idx) => {
                            // Translate department name in file path
                            let translatedFile = activity.file;
                            const pathMatch = activity.file.match(/^([^\/]+)\//);
                            if (pathMatch) {
                                const deptPart = pathMatch[1];
                                const translatedDept = getDeptDisplayName(deptPart);
                                translatedFile = activity.file.replace(deptPart, translatedDept);
                            }
                            return (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: idx < 9 ? '1px solid var(--glass-bg-light)' : 'none' }}>
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontWeight: 600 }}>{activity.user}</span>
                                        <span style={{ margin: '0 8px', color: 'var(--text-secondary)' }}>{t('dept.visited')}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{translatedFile}</span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '16px' }}>{formatDate(activity.time)}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );
        }

        if (activeTab === 'members') {
            return (
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '24px' }}>{t('dept.members')}</h2>
                    <div style={{ background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)', padding: '24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('browser.col_name')}</th>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dept.file_count')}</th>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dept.storage_used')}</th>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('browser.col_date')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map(member => (
                                    <tr key={member.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: '16px 12px', fontWeight: 600 }}>{member.username}</td>
                                        <td style={{ padding: '16px 12px' }}>{member.fileCount}</td>
                                        <td style={{ padding: '16px 12px', color: 'var(--accent-blue)' }}>{formatSize(member.storageUsed)}</td>
                                        <td style={{ padding: '16px 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{formatDate(member.last_login)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        if (activeTab === 'permissions') {
            return (
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '24px' }}>{t('dept.permissions')}</h2>
                    <div style={{ background: 'var(--glass-bg)', borderRadius: '16px', border: '1px solid var(--glass-border)', padding: '24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--glass-border)' }}>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('browser.col_name')}</th>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dept.permissions')}</th>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dept.permissions')}</th>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dept.permissions')}</th>
                                    <th style={{ textAlign: 'left', padding: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>{t('share.expire_time')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {permissions.map(perm => (
                                    <tr key={perm.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <td style={{ padding: '16px 12px', fontWeight: 600 }}>{perm.username}</td>
                                        <td style={{ padding: '16px 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{perm.folder_path}</td>
                                        <td style={{ padding: '16px 12px' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem',
                                                background: perm.access_type === 'Full' ? 'rgba(255,100,100,0.2)' : perm.access_type === 'Contribute' ? 'rgba(100,200,255,0.2)' : 'rgba(150,150,150,0.2)',
                                                color: perm.access_type === 'Full' ? '#ff6666' : perm.access_type === 'Contribute' ? '#66ccff' : '#aaa'
                                            }}>
                                                {perm.access_type === 'Read' ? t('dept.permissions') : perm.access_type === 'Contribute' ? t('dept.permissions') : t('dept.permissions')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '16px 12px', fontSize: '0.9rem' }}>{perm.granted_by_name || '-'}</td>
                                        <td style={{ padding: '16px 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{perm.expires_at ? formatDate(perm.expires_at) : t('share.forever_label')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-main)', overflow: 'hidden' }}>
            {/* Sidebar */}
            <div style={{ width: '260px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--glass-border)', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ marginBottom: '24px', paddingLeft: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Network size={24} color="var(--accent-blue)" />
                        <h1 style={{ fontSize: '1.3rem', fontWeight: 800 }}>{t('dept.manage')}</h1>
                    </div>
                </div>

                {tabs.map(item => (
                    <div
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            paddingLeft: activeTab === item.id ? '12px' : '16px',
                            borderRadius: 12,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: activeTab === item.id ? 'rgba(255, 210, 0, 0.15)' : 'transparent',
                            borderLeft: activeTab === item.id ? '4px solid var(--accent-blue)' : '4px solid transparent',
                            color: activeTab === item.id ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontWeight: activeTab === item.id ? 700 : 500
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <item.icon size={18} />
                            <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
                {renderContent()}
            </div>
        </div>
    );
};

export default DepartmentDashboard;
