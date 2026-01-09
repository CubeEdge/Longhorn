import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    Users,
    Database,
    ShieldCheck,
    ArrowUpRight,
    Clock,
    FileText,
    TrendingUp
} from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

interface SystemStats {
    todayStats: { count: number; size: number };
    weekStats: { count: number; size: number };
    monthStats: { count: number; size: number };
    storage: {
        used: number;
        perDept: { [key: string]: number };
        members: number;
    };
    users: {
        total: number;
        active: number;
    };
    topUploaders: Array<{
        username: string;
        fileCount: number;
        totalSize: number;
    }>;
    totalFiles: number;
}

const SystemDashboard: React.FC = () => {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const { token } = useAuthStore();
    const { t } = useLanguage();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await axios.get('/api/admin/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data);
            } catch (err) {
                console.error('Failed to fetch admin stats:', err);
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchStats();
    }, [token]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    if (loading || !stats) {
        return <div style={{ padding: 40, textAlign: 'center' }}>{t('system.loading')}</div>;
    }

    return (
        <div className="fade-in" style={{ padding: '0 0 40px' }}>
            {/* Header Area */}
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px' }}>{t('system.overview')}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <ShieldCheck size={16} color="var(--accent-blue)" />
                    <span>{t('system.status_good')}</span>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <Clock size={16} />
                    <span>{t('system.last_update')} {new Date().toLocaleTimeString()}</span>
                </div>
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 20, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ padding: 10, background: 'rgba(255, 210, 0, 0.1)', borderRadius: 12 }}>
                            <Users size={20} color="var(--accent-blue)" />
                        </div>
                        <ArrowUpRight size={16} style={{ opacity: 0.3 }} />
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats?.users?.total || 0}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('system.total_users')}</div>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t('system.active_users', { count: stats?.users?.active || 0 })}</span>
                    </div>
                </div>

                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 20, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ padding: 10, background: 'rgba(255, 210, 0, 0.1)', borderRadius: 12 }}>
                            <Database size={20} color="var(--accent-blue)" />
                        </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatBytes(stats?.storage?.used || 0)}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('system.storage_used')}</div>
                    <div style={{ marginTop: 16, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: '65%', height: '100%', background: 'var(--accent-blue)' }} />
                    </div>
                </div>

                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 20, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ padding: 10, background: 'rgba(255, 210, 0, 0.1)', borderRadius: 12 }}>
                            <FileText size={20} color="var(--accent-blue)" />
                        </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats?.totalFiles || 0}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{t('system.total_files')}</div>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#10b981' }}>
                        <TrendingUp size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{t('system.today_new', { count: stats?.todayStats?.count || 0 })}</span>
                    </div>
                </div>
            </div>

            {/* Detailed Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                {/* Department Storage */}
                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 24, padding: 28 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 24 }}>{t('system.dept_storage')}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {Object.entries(stats?.storage?.perDept || {}).map(([name, size]) => (
                            <div key={name}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                                    <span style={{ fontWeight: 600 }}>{name}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{formatBytes(size as number)}</span>
                                </div>
                                <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${((size as number) / (stats?.storage?.used || 1)) * 100}%`,
                                            height: '100%',
                                            background: 'var(--accent-blue)',
                                            borderRadius: 4
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                                <span style={{ fontWeight: 600 }}>{t('system.personal_space')}</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{formatBytes(stats?.storage?.members || 0)}</span>
                            </div>
                            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        width: `${((stats?.storage?.members || 0) / (stats?.storage?.used || 1)) * 100}%`,
                                        height: '100%',
                                        background: 'var(--text-secondary)',
                                        opacity: 0.5,
                                        borderRadius: 4
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Contributors */}
                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 24, padding: 28 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 24 }}>{t('system.top_contributors')}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {(stats?.topUploaders || []).map((uploader, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 16 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-blue)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                    {uploader.username[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>{uploader.username}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('system.uploaded_files', { count: uploader.fileCount })}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{formatBytes(uploader.totalSize)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SystemDashboard;
