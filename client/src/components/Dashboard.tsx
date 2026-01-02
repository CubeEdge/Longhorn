import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    Users as UsersIcon,
    FolderTree,
    HardDrive,
    Activity,
    ShieldCheck
} from 'lucide-react';

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({
        userCount: 0,
        deptCount: 0,
        totalFiles: 0,
        totalAccess: 0
    });
    const { token } = useAuthStore();

    useEffect(() => {
        const fetchStats = async () => {
            const headers = { Authorization: `Bearer ${token}` };
            const [uRes, dRes] = await Promise.all([
                axios.get('/api/admin/users', { headers }),
                axios.get('/api/admin/departments', { headers })
            ]);
            setStats({
                userCount: uRes.data.length,
                deptCount: dRes.data.length,
                totalFiles: 0, // 示例占位
                totalAccess: 0 // 示例占位
            });
        };
        fetchStats();
    }, [token]);

    const cards = [
        { label: '系统用户', value: stats.userCount, icon: UsersIcon, color: '#007AFF' },
        { label: '组织架构', value: stats.deptCount, icon: FolderTree, color: '#34C759' },
        { label: '存储资源', value: '4.2 TB', icon: HardDrive, color: '#FF9500' },
        { label: '安全健康', value: '良', icon: ShieldCheck, color: '#FF3B30' },
    ];

    return (
        <div className="fade-in">
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800 }}>系统概览</h2>
                <p className="hint">欢迎回来，Administrator。这是 Longhorn 数据中心的实时快照。</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 40 }}>
                {cards.map((card, i) => (
                    <div key={i} style={{
                        background: 'rgba(255,255,255,0.05)',
                        padding: 24,
                        borderRadius: 16,
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 20
                    }}>
                        <div style={{
                            width: 56,
                            height: 56,
                            borderRadius: 14,
                            background: `${card.color}20`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <card.icon size={28} color={card.color} />
                        </div>
                        <div>
                            <div className="hint" style={{ fontSize: '0.9rem' }}>{card.label}</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{card.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 20,
                border: '1px solid var(--glass-border)',
                padding: 32,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 200,
                gap: 16
            }}>
                <Activity size={48} opacity={0.3} />
                <p className="hint">访问流量分析图表加载中...</p>
            </div>
        </div>
    );
};

export default Dashboard;
