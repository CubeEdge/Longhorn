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

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/admin/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats(res.data);
        } catch (err) {
            console.error('Failed to fetch system stats:', err);
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

    if (loading || !stats) {
        return <div style={{ padding: 40, textAlign: 'center' }}>正在加载系统概览...</div>;
    }

    return (
        <div className="fade-in" style={{ padding: '0 0 40px' }}>
            {/* Header Area */}
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 8px' }}>系统概览</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <ShieldCheck size={16} color="var(--accent-blue)" />
                    <span>系统状态运行良好</span>
                    <span style={{ opacity: 0.3 }}>|</span>
                    <Clock size={16} />
                    <span>最近更新: {new Date().toLocaleTimeString()}</span>
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
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.users.total}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>总注册用户</div>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{stats.users.active} 位活跃用户 (24h)</span>
                    </div>
                </div>

                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 20, padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div style={{ padding: 10, background: 'rgba(255, 210, 0, 0.1)', borderRadius: 12 }}>
                            <Database size={20} color="var(--accent-blue)" />
                        </div>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatBytes(stats.storage.used)}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>资产库占用</div>
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
                    <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.totalFiles}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>系统总文件数</div>
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#10b981' }}>
                        <TrendingUp size={16} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>今日新增 {stats.todayStats.count}</span>
                    </div>
                </div>
            </div>

            {/* Detailed Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                {/* Department Storage */}
                <div style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: 24, padding: 28 }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 24 }}>部门存储分布</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {Object.entries(stats.storage.perDept).map(([name, size]) => (
                            <div key={name}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.9rem' }}>
                                    <span style={{ fontWeight: 600 }}>{name}</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{formatBytes(size)}</span>
                                </div>
                                <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div
                                        style={{
                                            width: `${(size / (stats.storage.used || 1)) * 100}%`,
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
                                <span style={{ fontWeight: 600 }}>个人空间 (Members)</span>
                                <span style={{ color: 'var(--text-secondary)' }}>{formatBytes(stats.storage.members)}</span>
                            </div>
                            <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                                <div
                                    style={{
                                        width: `${(stats.storage.members / (stats.storage.used || 1)) * 100}%`,
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
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 24 }}>活跃贡献者</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {stats.topUploaders.map((uploader, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 16 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-blue)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                                    {uploader.username[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700 }}>{uploader.username}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>上传了 {uploader.fileCount} 个文件</div>
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
