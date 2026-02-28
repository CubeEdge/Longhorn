import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import {
    HardDrive,
    FileText,
    Star,
    Link2,
    Clock,
    Calendar,
    Activity
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '../i18n/useLanguage';
import { getDateLocale } from '../utils/dateLocale';

interface UserStats {
    uploadCount: number;
    storageUsed: number;
    starredCount: number;
    shareCount: number;
    lastLogin: string;
    accountCreated: string;
    username: string;
    role: string;
}

export const Dashboard: React.FC = () => {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { token } = useAuthStore();
    const navigate = useNavigate();
    const { t, language } = useLanguage();

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await axios.get('/api/user/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
        } catch (err: any) {
            console.error('Failed to fetch stats:', err);
            setError(err.response?.data?.error || err.message || t('error.load_stats_failed'));
        } finally {
            setLoading(false);
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <Activity size={48} style={{ opacity: 0.3, marginBottom: '16px', display: 'block', margin: '0 auto 16px' }} />
                <p>{t('dashboard.loading')}</p>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: '#ff4444', marginBottom: '16px' }}>
                    ❌ {error || t('dashboard.load_failed')}
                </p>
                <button
                    onClick={fetchStats}
                    style={{
                        padding: '12px 24px',
                        background: 'var(--accent-blue)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '1rem'
                    }}
                >
                    {t('dashboard.retry')}
                </button>
            </div>
        );
    }

    const storagePercent = Math.min((stats.storageUsed / (10 * 1024 * 1024 * 1024)) * 100, 100); // Assume 10GB quota

    return (
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity size={32} color="var(--accent-blue)" />
                    {t('dashboard.title')}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {t('dashboard.welcome')}, {stats.username} · {stats.role === 'Admin' ? t('dashboard.role_admin') : t('dashboard.role_user')}
                </p>
            </div>

            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '20px',
                marginBottom: '32px'
            }}>
                {/* Upload Count */}
                <div style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '24px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
                    onClick={() => navigate(`/dept/members/${stats.username}`)}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(255, 210, 0, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FileText size={24} color="var(--accent-blue)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('dashboard.uploaded')}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.uploadCount}</div>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {t('dashboard.click_view_space')}
                    </div>
                </div>

                {/* Storage Used */}
                <div style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '24px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(255, 210, 0, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <HardDrive size={24} color="var(--accent-blue)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('dashboard.storage')}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatBytes(stats.storageUsed)}</div>
                        </div>
                    </div>
                    <div style={{
                        width: '100%',
                        height: '8px',
                        background: 'rgba(0,0,0,0.1)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '8px'
                    }}>
                        <div style={{
                            width: `${storagePercent}%`,
                            height: '100%',
                            background: 'var(--accent-blue)',
                            transition: 'width 0.3s'
                        }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {storagePercent.toFixed(1)}% {t('dashboard.storage_quota')}
                    </div>
                </div>

                {/* Starred Files */}
                <div style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '24px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
                    onClick={() => navigate('/starred')}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(255, 210, 0, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Star size={24} color="var(--accent-blue)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('dashboard.starred')}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.starredCount || 0}</div>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {t('dashboard.click_view_starred')}
                    </div>
                </div>

                {/* Share Links */}
                <div style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '24px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
                    onClick={() => navigate('/shares')}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            background: 'rgba(255, 210, 0, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Link2 size={24} color="var(--accent-blue)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('dashboard.shares')}</div>
                            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.shareCount}</div>
                        </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {t('dashboard.click_manage_shares')}
                    </div>
                </div>
            </div>

            {/* Account Info */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '20px'
            }}>
                {/* Last Login */}
                <div style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <Clock size={20} color="var(--accent-blue)" />
                        <div style={{ fontWeight: 600 }}>{t('dashboard.last_login')}</div>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>
                        {formatDistanceToNow(new Date(stats.lastLogin), { addSuffix: true, locale: getDateLocale(language) })}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(stats.lastLogin).toLocaleString('zh-CN')}
                    </div>
                </div>

                {/* Account Created */}
                <div style={{
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px',
                    padding: '20px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <Calendar size={20} color="var(--accent-blue)" />
                        <div style={{ fontWeight: 600 }}>{t('dashboard.account_created')}</div>
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px' }}>
                        {formatDistanceToNow(new Date(stats.accountCreated), { addSuffix: true, locale: getDateLocale(language) })}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(stats.accountCreated).toLocaleString('zh-CN')}
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: '32px' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '16px' }}>{t('dashboard.quick_actions')}</h2>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => navigate(`/dept/members/${stats.username}`)}
                        style={{
                            padding: '12px 24px',
                            background: 'var(--accent-blue)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: '0.95rem'
                        }}
                    >
                        {t('dashboard.goto_space')}
                    </button>
                    <button
                        onClick={() => navigate('/starred')}
                        style={{
                            padding: '12px 24px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            color: 'var(--text-main)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    >
                        {t('dashboard.view_starred')}
                    </button>
                    <button
                        onClick={() => navigate('/search')}
                        style={{
                            padding: '12px 24px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            color: 'var(--text-main)',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    >
                        {t('dashboard.search_files')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
