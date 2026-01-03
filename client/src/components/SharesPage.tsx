import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Link2, Copy, Trash2, Lock, Clock, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface ShareLink {
    id: number;
    file_path: string;
    share_token: string;
    expires_at: string | null;
    access_count: number;
    last_accessed: string | null;
    created_at: string;
    has_password: boolean;
}

export const SharesPage: React.FC = () => {
    const [shares, setShares] = useState<ShareLink[]>([]);
    const [loading, setLoading] = useState(true);
    const { token } = useAuthStore();

    useEffect(() => {
        fetchShares();
    }, []);

    const fetchShares = async () => {
        try {
            const res = await axios.get('/api/shares', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShares(res.data);
        } catch (err) {
            console.error('Failed to fetch shares:', err);
        } finally {
            setLoading(false);
        }
    };

    const copyShareLink = (shareToken: string) => {
        const url = `${window.location.origin}/share/${shareToken}`;
        navigator.clipboard.writeText(url);
        alert('链接已复制！');
    };

    const deleteShare = async (id: number) => {
        if (!confirm('确定要删除此分享链接吗？')) return;

        try {
            await axios.delete(`/api/shares/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShares(shares.filter(s => s.id !== id));
        } catch (err) {
            alert('删除失败');
        }
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link2 size={32} color="var(--accent-blue)" />
                    我的分享
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {shares.length} 个分享链接
                </p>
            </div>

            {shares.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
                    <Link2 size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>还没有分享链接</h3>
                    <p>在文件浏览器中右键文件，选择"创建分享链接"</p>
                </div>
            )}

            {shares.map(share => (
                <div
                    key={share.id}
                    style={{
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '16px',
                        opacity: isExpired(share.expires_at) ? 0.6 : 1
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'start', gap: '16px', marginBottom: '12px' }}>
                        <Link2 size={24} color="var(--accent-blue)" style={{ marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '6px' }}>
                                {share.file_path.split('/').pop()}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                {share.file_path.split('/').slice(0, -1).join('/')}
                            </div>

                            <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                {share.has_password && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Lock size={14} />
                                        密码保护
                                    </span>
                                )}
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Eye size={14} />
                                    {share.access_count} 次访问
                                </span>
                                {share.expires_at && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isExpired(share.expires_at) ? '#ff3b30' : 'inherit' }}>
                                        <Clock size={14} />
                                        {isExpired(share.expires_at) ? '已过期' : `过期于 ${formatDistanceToNow(new Date(share.expires_at), { addSuffix: true, locale: zhCN })}`}
                                    </span>
                                )}
                                <span>
                                    创建于 {formatDistanceToNow(new Date(share.created_at), { addSuffix: true, locale: zhCN })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => copyShareLink(share.share_token)}
                            style={{
                                flex: 1,
                                padding: '10px 16px',
                                background: 'var(--accent-blue)',
                                color: '#000',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                        >
                            <Copy size={16} />
                            复制链接
                        </button>
                        <button
                            onClick={() => deleteShare(share.id)}
                            style={{
                                padding: '10px 16px',
                                background: 'rgba(255, 0, 0, 0.1)',
                                color: '#ff3b30',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Trash2 size={16} />
                            删除
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SharesPage;
