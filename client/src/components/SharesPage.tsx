import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Link2, Copy, Trash2, Lock, Eye, MoreHorizontal, File, Check, X, Clock, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';

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
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; share: ShareLink } | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [detailShare, setDetailShare] = useState<ShareLink | null>(null);
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
        const url = `${window.location.origin}/s/${shareToken}`;
        navigator.clipboard.writeText(url);
        alert('✅ 链接已复制到剪贴板！');
    };

    const deleteShare = async (id: number) => {
        if (!confirm('确定要删除此分享链接吗？')) return;

        try {
            await axios.delete(`/api/shares/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShares(shares.filter(s => s.id !== id));
            setSelectedIds(selectedIds.filter(sid => sid !== id));
            setDetailShare(null);
            alert('✅ 分享链接已删除');
        } catch (err) {
            alert('❌ 删除失败');
        }
    };

    const bulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 个分享链接吗？`)) return;

        try {
            await Promise.all(selectedIds.map(id =>
                axios.delete(`/api/shares/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ));
            setShares(shares.filter(s => !selectedIds.includes(s.id)));
            setSelectedIds([]);
            alert('✅ 已删除选中的分享链接');
        } catch (err) {
            alert('❌ 批量删除失败');
        }
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    const handleOpenMenu = (e: React.MouseEvent, share: ShareLink) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuAnchor({ x: e.clientX, y: e.clientY, share });
    };

    const handleRowClick = (share: ShareLink) => {
        setDetailShare(share);
    };

    const toggleSelect = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selectedIds.length === shares.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(shares.map(s => s.id));
        }
    };

    const getFileName = (path: string) => path.split('/').pop() || '';
    const getDirPath = (path: string) => path.split('/').slice(0, -1).join('/');

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Link2 size={32} color="var(--accent-blue)" />
                    我的分享
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {shares.length} 个分享链接
                </p>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div style={{
                    background: 'var(--accent-blue)',
                    borderRadius: '12px',
                    padding: '16px 24px',
                    marginBottom: '20px',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 20px rgba(255, 210, 0, 0.3)',
                    animation: 'slideDown 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button onClick={() => setSelectedIds([])} className="btn-icon-only" style={{ background: 'rgba(0,0,0,0.1)' }}><X size={18} color="#000" /></button>
                        <span style={{ fontWeight: 800 }}>已选中 {selectedIds.length} 个链接</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button onClick={bulkDelete} style={{ background: '#FF3B30', color: '#FFF', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Trash2 size={16} /> 批量删除
                        </button>
                    </div>
                </div>
            )}

            {shares.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
                    <Link2 size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>还没有分享链接</h3>
                    <p>在文件浏览器中右键文件，选择"分享"</p>
                </div>
            )}

            {shares.length > 0 && (
                <div className="file-list">
                    <div className="file-list-header">
                        <div style={{ width: 40, paddingLeft: 12 }} onClick={selectAll}>
                            {selectedIds.length > 0 && selectedIds.length === shares.length ? <Check size={16} color="var(--accent-blue)" strokeWidth={4} /> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 0 }} />}
                        </div>
                        <div className="col-name">文件名</div>
                        <div className="col-stats">访问次数</div>
                        <div className="col-date">过期时间</div>
                        <div style={{ width: 140, textAlign: 'center' }}>操作</div>
                        <div style={{ width: 40 }}></div>
                    </div>
                    {shares.map((share) => (
                        <div
                            key={share.id}
                            className={`file-list-row ${selectedIds.includes(share.id) ? 'selected' : ''}`}
                            style={{ opacity: isExpired(share.expires_at) ? 0.5 : 1 }}
                            onClick={() => handleRowClick(share)}
                        >
                            <div style={{ width: 40, paddingLeft: 12 }} onClick={(e) => toggleSelect(e, share.id)}>
                                {selectedIds.includes(share.id) ? <div style={{ width: 16, height: 16, background: 'var(--accent-blue)', borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#000" strokeWidth={4} /></div> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 0 }} />}
                            </div>
                            <div className="col-name">
                                <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                                    <File size={20} color="var(--accent-blue)" />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getFileName(share.file_path)}</span>
                                    {Boolean(share.has_password) && <Lock size={14} color="var(--accent-blue)" style={{ flexShrink: 0 }} />}
                                </div>
                            </div>
                            <div className="col-stats">
                                <Eye size={14} style={{ marginBottom: -2, marginRight: 4 }} color="var(--accent-blue)" />
                                {share.access_count || 0}
                            </div>
                            <div className="col-date" style={{ color: isExpired(share.expires_at) ? '#ff3b30' : 'inherit' }}>
                                {share.expires_at ? (
                                    isExpired(share.expires_at) ? '已过期' : format(new Date(share.expires_at), 'yyyy-MM-dd')
                                ) : '永久'}
                            </div>
                            <div style={{ width: 140, display: 'flex', gap: '8px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={() => copyShareLink(share.share_token)}
                                    style={{
                                        padding: '6px 12px',
                                        background: 'var(--accent-blue)',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <Copy size={14} /> 复制
                                </button>
                            </div>
                            <div className="list-more-btn" onClick={(e) => handleOpenMenu(e, share)}>
                                <MoreHorizontal size={18} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Detail Modal */}
            {detailShare && (
                <div className="modal-overlay" onClick={() => setDetailShare(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <Link2 size={24} color="var(--accent-blue)" />
                                分享详情
                            </h3>
                            <button
                                onClick={() => setDetailShare(null)}
                                className="modal-close-btn"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--text-main)', fontSize: '1.1rem' }}>
                                {getFileName(detailShare.file_path)}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                {getDirPath(detailShare.file_path)}
                            </div>

                            {/* File Preview */}
                            {(() => {
                                const ext = getFileName(detailShare.file_path).split('.').pop()?.toLowerCase();
                                const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
                                const isVideo = ['mp4', 'webm', 'mov'].includes(ext || '');

                                if (isImage) {
                                    return (
                                        <div style={{ marginBottom: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px' }}>
                                            <img
                                                src={`/preview/${detailShare.file_path}`}
                                                alt={getFileName(detailShare.file_path)}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '400px',
                                                    borderRadius: '8px',
                                                    objectFit: 'contain'
                                                }}
                                            />
                                        </div>
                                    );
                                }

                                if (isVideo) {
                                    return (
                                        <div style={{ marginBottom: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px' }}>
                                            <video
                                                controls
                                                style={{
                                                    width: '100%',
                                                    maxHeight: '400px',
                                                    borderRadius: '8px'
                                                }}
                                            >
                                                <source src={`/preview/${detailShare.file_path}`} type={`video/${ext}`} />
                                                您的浏览器不支持视频播放
                                            </video>
                                        </div>
                                    );
                                }

                                return null;
                            })()}

                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                    <Eye size={18} color="var(--accent-blue)" />
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>访问次数</div>
                                        <div style={{ fontWeight: 600 }}>{detailShare.access_count || 0} 次</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                    <Clock size={18} color="var(--accent-blue)" />
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>过期时间</div>
                                        <div style={{ fontWeight: 600, color: isExpired(detailShare.expires_at) ? '#ff3b30' : 'inherit' }}>
                                            {detailShare.expires_at ? (
                                                isExpired(detailShare.expires_at) ? '已过期' : format(new Date(detailShare.expires_at), 'yyyy-MM-dd HH:mm')
                                            ) : '永久有效'}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                    <Calendar size={18} color="var(--accent-blue)" />
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>创建时间</div>
                                        <div style={{ fontWeight: 600 }}>{format(new Date(detailShare.created_at), 'yyyy-MM-dd HH:mm')}</div>
                                    </div>
                                </div>

                                {detailShare.last_accessed && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                        <User size={18} color="var(--accent-blue)" />
                                        <div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>最后访问</div>
                                            <div style={{ fontWeight: 600 }}>{format(new Date(detailShare.last_accessed), 'yyyy-MM-dd HH:mm')}</div>
                                        </div>
                                    </div>
                                )}

                                {Boolean(detailShare.has_password) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,210,0,0.1)', borderRadius: '8px' }}>
                                        <Lock size={18} color="var(--accent-blue)" />
                                        <div>
                                            <div style={{ fontWeight: 600 }}>密码保护</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>此链接需要密码才能访问</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => copyShareLink(detailShare.share_token)}
                                style={{
                                    padding: '12px 24px',
                                    background: 'var(--accent-blue)',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Copy size={16} /> 复制链接
                            </button>
                            <button
                                onClick={() => deleteShare(detailShare.id)}
                                style={{
                                    padding: '12px 24px',
                                    background: 'rgba(255,0,0,0.1)',
                                    color: '#ff3b30',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Trash2 size={16} /> 删除分享
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Context Menu */}
            {menuAnchor && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setMenuAnchor(null)} />
                    <div
                        className="context-menu"
                        style={{
                            position: 'fixed',
                            left: menuAnchor.x,
                            top: menuAnchor.y,
                            zIndex: 1000
                        }}
                    >
                        <div className="context-menu-item" onClick={() => { setDetailShare(menuAnchor.share); setMenuAnchor(null); }}>
                            <Eye size={16} color="var(--accent-blue)" /> 查看详情
                        </div>
                        <div className="context-menu-item" onClick={() => { copyShareLink(menuAnchor.share.share_token); setMenuAnchor(null); }}>
                            <Copy size={16} color="var(--accent-blue)" /> 复制链接
                        </div>
                        <div className="context-menu-separator" />
                        <div className="context-menu-item danger" onClick={() => { deleteShare(menuAnchor.share.id); setMenuAnchor(null); }}>
                            <Trash2 size={16} /> 删除
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default SharesPage;
