import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Link2, Copy, Trash2, Lock, Eye, MoreHorizontal, File, Check, X, Clock, User, Calendar, Package } from 'lucide-react';
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

interface ShareCollection {
    id: number;
    token: string;
    name: string;
    expires_at: string | null;
    access_count: number;
    created_at: string;
    item_count: number;
}

// Unified interface for displaying both types
interface UnifiedShareItem {
    id: number;
    type: 'file' | 'collection';
    created_at: string;
    // For file shares
    file_path?: string;
    share_token?: string;
    has_password?: boolean;
    last_accessed?: string | null;
    // For collections
    token?: string;
    name?: string;
    item_count?: number;
    // Common
    expires_at: string | null;
    access_count: number;
}

export const SharesPage: React.FC = () => {
    const [shares, setShares] = useState<ShareLink[]>([]);
    const [collections, setCollections] = useState<ShareCollection[]>([]);
    const [loading, setLoading] = useState(true);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; share: ShareLink } | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [selectedCollectionIds, setSelectedCollectionIds] = useState<number[]>([]);
    const [detailShare, setDetailShare] = useState<ShareLink | null>(null);
    const { token } = useAuthStore();

    useEffect(() => {
        fetchShares();
        fetchCollections();
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

    const fetchCollections = async () => {
        try {
            const res = await axios.get('/api/my-share-collections', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCollections(res.data);
        } catch (err) {
            console.error('Failed to fetch share collections:', err);
        }
    };

    const copyShareLink = async (shareToken: string) => {
        const url = `${window.location.origin}/s/${shareToken}`;
        let success = false;

        try {
            await navigator.clipboard.writeText(url);
            success = true;
        } catch (err) {
            // Safari fallback
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                success = document.execCommand('copy');
            } catch (e) {
                console.error('Copy failed:', e);
            }
            document.body.removeChild(textArea);
        }

        alert(success ? '✅ 链接已复制到剪贴板！' : '❌ 复制失败，请手动复制');
    };

    const copyCollectionLink = async (token: string) => {
        const url = `${window.location.origin}/share-collection/${token}`;
        let success = false;

        try {
            await navigator.clipboard.writeText(url);
            success = true;
        } catch (err) {
            // Safari fallback
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                success = document.execCommand('copy');
            } catch (e) {
                console.error('Copy failed:', e);
            }
            document.body.removeChild(textArea);
        }

        alert(success ? '✅ 批量分享链接已复制到剪贴板！' : '❌ 复制失败，请手动复制');
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

    const deleteCollection = async (id: number) => {
        if (!confirm('确定要删除此批量分享吗？')) return;

        try {
            await axios.delete(`/api/share-collection/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCollections(collections.filter(c => c.id !== id));
            setSelectedCollectionIds(selectedCollectionIds.filter(cid => cid !== id));
            alert('✅ 批量分享已删除');
        } catch (err) {
            alert('❌ 删除失败');
        }
    };

    const bulkDelete = async () => {
        const totalSelected = selectedIds.length + selectedCollectionIds.length;
        if (totalSelected === 0) return;
        if (!confirm(`确定要删除选中的 ${totalSelected} 个分享吗？`)) return;

        try {
            // Delete file shares
            const fileDeletePromises = selectedIds.map(id =>
                axios.delete(`/api/shares/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            );

            // Delete share collections
            const collectionDeletePromises = selectedCollectionIds.map(id =>
                axios.delete(`/api/share-collection/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            );

            await Promise.all([...fileDeletePromises, ...collectionDeletePromises]);

            setShares(shares.filter(s => !selectedIds.includes(s.id)));
            setCollections(collections.filter(c => !selectedCollectionIds.includes(c.id)));
            setSelectedIds([]);
            setSelectedCollectionIds([]);
            alert('✅ 已删除选中的分享');
        } catch (err) {
            console.error('Bulk delete error:', err);
            alert('❌ 批量删除失败，请重试');
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

    // Merge and sort shares and collections by creation time (newest first)
    const allShares = useMemo(() => {
        const fileShares: UnifiedShareItem[] = shares.map(s => ({
            id: s.id,
            type: 'file' as const,
            created_at: s.created_at,
            file_path: s.file_path,
            share_token: s.share_token,
            has_password: s.has_password,
            expires_at: s.expires_at,
            access_count: s.access_count,
            last_accessed: s.last_accessed
        }));

        const collectionShares: UnifiedShareItem[] = collections.map(c => ({
            id: c.id,
            type: 'collection' as const,
            created_at: c.created_at,
            token: c.token,
            name: c.name,
            item_count: c.item_count,
            expires_at: c.expires_at,
            access_count: c.access_count
        }));

        return [...fileShares, ...collectionShares].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }, [shares, collections]);

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
                    {shares.length} 个文件分享 · {collections.length} 个批量分享
                </p>
            </div>

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    background: 'rgba(32, 32, 32, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: '16px',
                    marginBottom: 20,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                    animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button onClick={() => setSelectedIds([])} className="btn-icon-only" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                            <X size={18} />
                        </button>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>已选中 <span style={{ color: 'var(--accent-blue)', fontWeight: 800 }}>{selectedIds.length}</span> 个项目</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={bulkDelete}
                            style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: '#fff',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                padding: '8px 16px',
                                borderRadius: '10px',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.2s',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                            }}
                        >
                            <Trash2 size={16} strokeWidth={2.5} color="var(--accent-blue)" /> 批量删除
                        </button>
                    </div>
                </div>
            )}

            {allShares.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
                    <Link2 size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>还没有分享链接</h3>
                    <p>在文件浏览器中右键文件，选择"分享"</p>
                </div>
            )}

            {allShares.length > 0 && (
                <div className="file-list">
                    <div className="file-list-header">
                        <div style={{ width: 40, paddingLeft: 12 }} onClick={selectAll}>
                            {selectedIds.length > 0 && selectedIds.length === shares.length ? <Check size={16} color="var(--accent-blue)" strokeWidth={4} /> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 4 }} />}
                        </div>
                        <div className="col-name">名称</div>
                        <div className="col-stats">访问次数</div>
                        <div className="col-date">创建时间</div>
                        <div style={{ width: 140, textAlign: 'center' }}>操作</div>
                        <div style={{ width: 40 }}></div>
                    </div>
                    {allShares.map((item) => {
                        const isFile = item.type === 'file';
                        const isCollection = item.type === 'collection';

                        return (
                            <div
                                key={`${item.type}-${item.id}`}
                                className={`file-list-row ${selectedIds.includes(item.id) ? 'selected' : ''}`}
                                style={{ opacity: isExpired(item.expires_at) ? 0.5 : 1 }}
                                onClick={() => isFile ? handleRowClick({ ...item, file_path: item.file_path!, share_token: item.share_token!, has_password: item.has_password! } as ShareLink) : undefined}
                            >
                                <div style={{ width: 40, paddingLeft: 12 }} onClick={(e) => toggleSelect(e, item.id)}>
                                    {selectedIds.includes(item.id) ? <div style={{ width: 16, height: 16, background: 'var(--accent-blue)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#000" strokeWidth={4} /></div> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 4 }} />}
                                </div>
                                <div className="col-name">
                                    <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                                        {isFile ? <File size={20} color="var(--accent-blue)" /> : <Package size={20} color="var(--accent-blue)" />}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, overflow: 'hidden' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isCollection ? 600 : 400 }}>
                                            {isFile ? getFileName(item.file_path!) : (item.name || `分享 - ${format(new Date(item.created_at), 'yyyy-MM-dd')}`)}
                                        </span>
                                        {isFile && Boolean(item.has_password) && <Lock size={14} color="var(--accent-blue)" style={{ flexShrink: 0 }} />}
                                        {isCollection && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: 4 }}>({item.item_count} 项)</span>}
                                    </div>
                                </div>
                                <div className="col-stats">
                                    <Eye size={14} style={{ marginBottom: -2, marginRight: 4 }} color="var(--accent-blue)" />
                                    {item.access_count || 0}
                                </div>
                                <div className="col-date">
                                    {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}
                                </div>
                                <div style={{ width: 140, display: 'flex', gap: '8px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => isFile ? copyShareLink(item.share_token!) : copyCollectionLink(item.token!)}
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
                                <div className="list-more-btn" onClick={(e) => {
                                    if (isFile) {
                                        handleOpenMenu(e, { ...item, file_path: item.file_path!, share_token: item.share_token!, has_password: item.has_password! } as ShareLink);
                                    } else {
                                        e.stopPropagation();
                                        deleteCollection(item.id);
                                    }
                                }}>
                                    {isFile ? <MoreHorizontal size={18} /> : <Trash2 size={18} />}
                                </div>
                            </div>
                        );
                    })}
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
