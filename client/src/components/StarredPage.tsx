import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Star, MoreHorizontal, File, Eye, User, FileText, Image, Film, Check, X, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface StarredFile {
    id: number;
    file_path: string;
    starred_at: string;
}

interface FileStats {
    name: string;
    size: number;
    mtime: string;
    accessCount: number;
    uploader?: string;
}

export const StarredPage: React.FC = () => {
    const [starredFiles, setStarredFiles] = useState<StarredFile[]>([]);
    const [fileStats, setFileStats] = useState<Map<string, FileStats>>(new Map());
    const [loading, setLoading] = useState(true);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; file: StarredFile } | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [detailFile, setDetailFile] = useState<StarredFile | null>(null);
    const { token } = useAuthStore();

    useEffect(() => {
        fetchStarredFiles();
    }, []);

    const fetchStarredFiles = async () => {
        try {
            const res = await axios.get('/api/starred', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStarredFiles(res.data);

            // Fetch stats for each file
            const statsMap = new Map();
            for (const item of res.data) {
                try {
                    const statsRes = await axios.get(`/api/files/stats?path=${encodeURIComponent(item.file_path)}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (statsRes.data) {
                        statsMap.set(item.file_path, statsRes.data);
                    }
                } catch (err) {
                    console.error(`Failed to fetch stats for ${item.file_path}`);
                }
            }
            setFileStats(statsMap);
        } catch (err) {
            console.error('Failed to fetch starred files:', err);
        } finally {
            setLoading(false);
        }
    };

    const unstarFile = async (id: number) => {
        try {
            await axios.delete(`/api/starred/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStarredFiles(starredFiles.filter(f => f.id !== id));
            setSelectedIds(selectedIds.filter(sid => sid !== id));
            setDetailFile(null);
            alert('✅ 已取消星标');
        } catch (err) {
            alert('❌ 取消星标失败');
        }
    };

    const bulkUnstar = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`确定要取消选中的 ${selectedIds.length} 个文件的星标吗？`)) return;

        try {
            await Promise.all(selectedIds.map(id =>
                axios.delete(`/api/starred/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ));
            setStarredFiles(starredFiles.filter(f => !selectedIds.includes(f.id)));
            setSelectedIds([]);
            alert('✅ 已取消选中文件的星标');
        } catch (err) {
            alert('❌ 批量取消星标失败');
        }
    };

    const handleOpenMenu = (e: React.MouseEvent, file: StarredFile) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuAnchor({ x: e.clientX, y: e.clientY, file });
    };

    const handleRowClick = (file: StarredFile) => {
        setDetailFile(file);
    };

    const toggleSelect = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    const selectAll = () => {
        if (selectedIds.length === starredFiles.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(starredFiles.map(f => f.id));
        }
    };

    const getFileName = (path: string) => path.split('/').pop() || '';
    const getDirPath = (path: string) => path.split('/').slice(0, -1).join('/');

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const getIcon = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext || '')) {
            return <Image size={20} color="var(--accent-blue)" />;
        }
        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) {
            return <Film size={20} color="var(--accent-blue)" />;
        }
        if (['doc', 'docx', 'pdf', 'txt'].includes(ext || '')) {
            return <FileText size={20} color="var(--accent-blue)" />;
        }
        return <File size={20} color="var(--accent-blue)" />;
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Star size={32} color="var(--accent-blue)" />
                    我的星标
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    {starredFiles.length} 个已星标文件
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
                            onClick={bulkUnstar}
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
                            <Star size={16} strokeWidth={2.5} color="var(--accent-blue)" /> 批量取消星标
                        </button>
                    </div>
                </div>
            )}

            {starredFiles.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
                    <Star size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>还没有星标文件</h3>
                    <p>在文件浏览器中右键文件，选择"添加星标"</p>
                </div>
            )}

            {starredFiles.length > 0 && (
                <div className="file-list">
                    <div className="file-list-header">
                        <div style={{ width: 40, paddingLeft: 12 }} onClick={selectAll}>
                            {selectedIds.length > 0 && selectedIds.length === starredFiles.length ? <Check size={16} color="var(--accent-blue)" strokeWidth={4} /> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 4 }} />}
                        </div>
                        <div className="col-name">文件名</div>
                        <div className="col-size">大小</div>
                        <div className="col-stats">访问次数</div>
                        <div className="col-date">星标时间</div>
                        <div style={{ width: 40 }}></div>
                    </div>
                    {starredFiles.map((file) => {
                        const stats = fileStats.get(file.file_path);
                        return (
                            <div
                                key={file.id}
                                className={`file-list-row ${selectedIds.includes(file.id) ? 'selected' : ''}`}
                                onClick={() => handleRowClick(file)}
                            >
                                <div style={{ width: 40, paddingLeft: 12 }} onClick={(e) => toggleSelect(e, file.id)}>
                                    {selectedIds.includes(file.id) ? <div style={{ width: 16, height: 16, background: 'var(--accent-blue)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#000" strokeWidth={4} /></div> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 4 }} />}
                                </div>
                                <div className="col-name">
                                    <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                                        {getIcon(file.file_path)}
                                    </div>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getFileName(file.file_path)}</span>
                                </div>
                                <div className="col-size">
                                    {stats ? formatSize(stats.size) : '--'}
                                </div>
                                <div className="col-stats">
                                    <Eye size={14} style={{ marginBottom: -2, marginRight: 4 }} color="var(--accent-blue)" />
                                    {stats?.accessCount || 0}
                                </div>
                                <div className="col-date">
                                    {format(new Date(file.starred_at), 'yyyy-MM-dd HH:mm')}
                                </div>
                                <div className="list-more-btn" onClick={(e) => handleOpenMenu(e, file)}>
                                    <MoreHorizontal size={18} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detail Modal */}
            {detailFile && (
                <div className="modal-overlay" onClick={() => setDetailFile(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <Star size={24} color="var(--accent-blue)" />
                                星标详情
                            </h3>
                            <button
                                onClick={() => setDetailFile(null)}
                                className="modal-close-btn"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--text-main)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {getIcon(detailFile.file_path)}
                                {getFileName(detailFile.file_path)}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                {getDirPath(detailFile.file_path)}
                            </div>

                            <div style={{ display: 'grid', gap: '16px' }}>
                                {fileStats.get(detailFile.file_path) ? (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <File size={18} color="var(--accent-blue)" />
                                            <div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>文件大小</div>
                                                <div style={{ fontWeight: 600 }}>{formatSize(fileStats.get(detailFile.file_path)!.size)}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <Eye size={18} color="var(--accent-blue)" />
                                            <div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>访问次数</div>
                                                <div style={{ fontWeight: 600 }}>{fileStats.get(detailFile.file_path)!.accessCount || 0} 次</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <User size={18} color="var(--accent-blue)" />
                                            <div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>上传者</div>
                                                <div style={{ fontWeight: 600 }}>{fileStats.get(detailFile.file_path)!.uploader || 'system'}</div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                            <Clock size={18} color="var(--accent-blue)" />
                                            <div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>修改时间</div>
                                                <div style={{ fontWeight: 600 }}>{format(new Date(fileStats.get(detailFile.file_path)!.mtime), 'yyyy-MM-dd HH:mm')}</div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        正在加载文件信息...
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,210,0,0.1)', borderRadius: '8px' }}>
                                    <Calendar size={18} color="var(--accent-blue)" />
                                    <div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>星标时间</div>
                                        <div style={{ fontWeight: 600 }}>{format(new Date(detailFile.starred_at), 'yyyy-MM-dd HH:mm')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => unstarFile(detailFile.id)}
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
                                <Star size={16} /> 取消星标
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
                        <div className="context-menu-item" onClick={() => { setDetailFile(menuAnchor.file); setMenuAnchor(null); }}>
                            <Eye size={16} color="var(--accent-blue)" /> 查看详情
                        </div>
                        <div className="context-menu-separator" />
                        <div className="context-menu-item danger" onClick={() => { unstarFile(menuAnchor.file.id); setMenuAnchor(null); }}>
                            <Star size={16} /> 取消星标
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StarredPage;
