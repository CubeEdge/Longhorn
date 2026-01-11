import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useToast } from '../store/useToast';
import { useConfirm } from '../store/useConfirm';
import { Star, MoreHorizontal, File, Eye, FileText, Image, Check, X, Folder, Download, Share2, Video, Table as TableIcon } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { format } from 'date-fns';
import { useLanguage } from '../i18n/useLanguage';

interface StarredFile {
    id: number;
    file_path: string;
    starred_at: string;
    name?: string;
    size?: number;
    mtime?: string;
    accessCount?: number;
    uploader?: string;
    isDirectory?: boolean;
}

const DEPT_NAME_MAP: { [key: string]: string } = {
    // Department mappings moved to App.tsx
};

export const StarredPage: React.FC = () => {
    const [starredFiles, setStarredFiles] = useState<StarredFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; file: StarredFile } | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [previewFile, setPreviewFile] = useState<StarredFile | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const { token, user } = useAuthStore();
    const navigate = useNavigate();
    const { t } = useLanguage();

    const { showToast } = useToast();
    const { confirm } = useConfirm();

    useEffect(() => {
        fetchStarredFiles();
    }, []);

    const fetchStarredFiles = async () => {
        try {
            const res = await axios.get('/api/starred', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStarredFiles(res.data);
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
            if (previewFile?.id === id) setPreviewFile(null);
            showToast(t('starred.removed'), 'success');
        } catch (err) {
            showToast(t('starred.unstar_failed'), 'error');
        }
    };

    const bulkUnstar = async () => {
        if (selectedIds.length === 0) return;
        if (!await confirm(t('starred.confirm_unstar', { count: selectedIds.length }), t('dialog.confirm_title'))) return;

        try {
            await Promise.all(selectedIds.map(id =>
                axios.delete(`/api/starred/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ));
            setStarredFiles(starredFiles.filter(f => !selectedIds.includes(f.id)));
            setSelectedIds([]);
            showToast(t('starred.batch_unstar_success'), 'success');
        } catch (err) {
            showToast(t('starred.batch_unstar_failed'), 'error');
        }
    };

    const handleOpenMenu = (e: React.MouseEvent, file: StarredFile) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuAnchor({ x: e.clientX, y: e.clientY, file });
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

    const handleItemClick = (file: StarredFile) => {
        if (!file.file_path) return;

        if (file.isDirectory) {
            // Navigation Logic
            const path = file.file_path;

            // 1. Personal Space
            if (path.startsWith('Members/')) {
                const parts = path.split('/');
                if (parts.length >= 2) {
                    const username = parts[1];
                    const relPath = parts.slice(2).join('/');
                    if (username === user?.username) {
                        navigate('/personal' + (relPath ? `?path=${encodeURIComponent(relPath)}` : ''));
                        return;
                    }
                    // Viewing other's space (if allowed) - currently mapped to admin members or we can use dept route logic if members is treated as a dept
                    // For now, let's assume /dept/Members is not a standard route for users, usually it's /personal
                    // If regular user accessing others, maybe fallback to direct navigation if supported? 
                    // Actually FileBrowser handles "Members/username" if we pass it? 
                    // The App routes are /dept/:deptCode. 
                    // If we navigate to /dept/Members/username/relPath?
                    // Let's try to map to accessible departments
                }
            }

            // 2. Departments
            const firstSegment = path.split('/')[0]; // "市场部 (MS)"
            if (DEPT_NAME_MAP[firstSegment]) {
                const code = DEPT_NAME_MAP[firstSegment];
                const relPath = path.substring(firstSegment.length + 1); // +1 for slash
                navigate(`/dept/${code}/${relPath}`);
                return;
            }

            // Fallback for known system folders or just try direct path?
            // If unknown, maybe just alert or try finding closest match
            console.warn('Cannot map path to route:', path);
        } else {
            // Preview
            setPreviewFile(file);
        }
    };

    const renderPreviewContent = (file: StarredFile) => {
        if (!file.file_path) return null;
        const name = getFileName(file.file_path);
        const ext = name.split('.').pop()?.toLowerCase();
        const url = `/preview/${file.file_path}`;

        if (ext?.match(/(mp4|mov|m4v|hevc|h265)$/i)) return <video controls autoPlay className="preview-media" onClick={e => e.stopPropagation()}><source src={url} /></video>;
        if (ext === 'pdf') return <iframe src={url} className="doc-preview-container" title="PDF" onClick={e => e.stopPropagation()} style={{ width: '100%', height: '80vh', border: 'none', background: '#fff' }} />;
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <img src={url} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} onClick={e => e.stopPropagation()} />;

        // Simple fallback
        return (
            <div style={{ textAlign: 'center', color: '#fff', padding: 40 }}>
                <File size={64} style={{ opacity: 0.5, marginBottom: 20 }} />
                <h3>{t('starred.cannot_preview')}</h3>
                <p>{t('starred.download_to_view')}</p>
                <a href={url} download={name} style={{ display: 'inline-block', marginTop: 20, padding: '10px 20px', background: 'var(--accent-blue)', color: '#000', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>{t('common.download_file')}</a>
            </div>
        );
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    };

    const getIcon = (path: string, size: number = 20) => {
        if (!path) return <File size={size} color="var(--accent-blue)" />;
        const ext = path.split('.').pop()?.toLowerCase();

        if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'].includes(ext || '')) {
            return (
                <div className="thumbnail-box" style={{ width: size > 30 ? '100%' : size, height: size > 30 ? '100%' : size, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 4 }}>
                    <img
                        src={`/preview/${path}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        alt=""
                        loading="lazy"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.parentElement!.innerHTML = renderToStaticMarkup(<Image size={size} color="var(--accent-blue)" />);
                        }}
                    />
                </div>
            );
        }
        if (['mp4', 'mov', 'avi', 'mkv', 'm4v'].includes(ext || '')) {
            return <Video size={size} color="var(--accent-blue)" />;
        }
        if (['doc', 'docx', 'pdf', 'txt'].includes(ext || '')) {
            return <FileText size={size} color="var(--accent-blue)" />;
        }
        if (['xlsx', 'xls'].includes(ext || '')) {
            return <TableIcon size={size} color="#1D6F42" />;
        }
        return <File size={size} color="var(--accent-blue)" />;
    };

    if (loading) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>{t('status.loading')}</div>;
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Star size={32} color="var(--accent-blue)" />
                        {t('browser.starred')}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        {t('browser.starred_files', { count: starredFiles.length })}
                    </p>
                </div>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                        onClick={() => setViewMode('grid')}
                        style={{
                            padding: '8px',
                            background: viewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            color: viewMode === 'grid' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        title={t('starred.grid_view')}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, width: 16, height: 16 }}>
                            <div style={{ background: 'currentColor', borderRadius: 1 }} />
                            <div style={{ background: 'currentColor', borderRadius: 1 }} />
                            <div style={{ background: 'currentColor', borderRadius: 1 }} />
                            <div style={{ background: 'currentColor', borderRadius: 1 }} />
                        </div>
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        style={{
                            padding: '8px',
                            background: viewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent',
                            border: 'none',
                            borderRadius: '8px',
                            color: viewMode === 'list' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        title={t('starred.list_view')}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: 16, height: 16 }}>
                            <div style={{ background: 'currentColor', height: 2, borderRadius: 1, width: '100%' }} />
                            <div style={{ background: 'currentColor', height: 2, borderRadius: 1, width: '100%' }} />
                            <div style={{ background: 'currentColor', height: 2, borderRadius: 1, width: '100%' }} />
                            <div style={{ background: 'currentColor', height: 2, borderRadius: 1, width: '60%' }} />
                        </div>
                    </button>
                </div>
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
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t('browser.selected')}<span style={{ color: 'var(--accent-blue)', fontWeight: 800 }}>{selectedIds.length}</span>{t('browser.items_count')}</span>
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
                            <Star size={16} strokeWidth={2.5} color="var(--accent-blue)" /> {t('starred.batch_unstar')}
                        </button>
                    </div>
                </div>
            )}

            {starredFiles.length === 0 && (
                <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
                    <Star size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>{t('starred.no_files')}</h3>
                    <p>{t('starred.add_hint')}</p>
                </div>
            )}

            {starredFiles.length > 0 && viewMode === 'list' && (
                <div className="file-list">
                    <div className="file-list-header">
                        <div style={{ width: 40, paddingLeft: 12 }} onClick={selectAll}>
                            {selectedIds.length > 0 && selectedIds.length === starredFiles.length ? <Check size={16} color="var(--accent-blue)" strokeWidth={4} /> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 4 }} />}
                        </div>
                        <div className="col-name">{t('browser.col_name')}</div>
                        <div className="col-size">{t('browser.col_size')}</div>
                        <div className="col-stats">{t('browser.col_access')}</div>
                        <div className="col-date">{t('browser.starred_at')}</div>
                        <div style={{ width: 40 }}></div>
                    </div>
                    {starredFiles.map((file) => {
                        return (
                            <div
                                key={file.id}
                                className={`file-list-row ${selectedIds.includes(file.id) ? 'selected' : ''}`}
                                onClick={() => handleItemClick(file)}
                            >
                                <div style={{ width: 40, paddingLeft: 12 }} onClick={(e) => toggleSelect(e, file.id)}>
                                    {selectedIds.includes(file.id) ? <div style={{ width: 16, height: 16, background: 'var(--accent-blue)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} color="#000" strokeWidth={4} /></div> : <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.2)', borderRadius: 4 }} />}
                                </div>
                                <div className="col-name">
                                    <div style={{ width: 32, display: 'flex', justifyContent: 'center' }}>
                                        {file.isDirectory ?
                                            <Folder size={20} fill="var(--accent-blue)" color="var(--accent-blue)" opacity={0.9} /> :
                                            getIcon(file.file_path)
                                        }
                                    </div>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getFileName(file.file_path || '')}</span>
                                </div>
                                <div className="col-size">
                                    {file.isDirectory ? '-' : formatSize(file.size || 0)}
                                </div>
                                <div className="col-stats">
                                    <Eye size={14} style={{ marginBottom: -2, marginRight: 4 }} color="var(--accent-blue)" />
                                    {file.accessCount || 0}
                                </div>
                                <div className="col-date">
                                    {file.starred_at ? format(new Date(file.starred_at), 'yyyy-MM-dd HH:mm') : '-'}
                                </div>
                                <div className="list-more-btn" onClick={(e) => handleOpenMenu(e, file)}>
                                    <MoreHorizontal size={18} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {starredFiles.length > 0 && viewMode === 'grid' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
                    {starredFiles.map((file) => (
                        <div
                            key={file.id}
                            className={`file-grid-item ${selectedIds.includes(file.id) ? 'selected' : ''}`}
                            onClick={() => handleItemClick(file)}
                            style={{
                                position: 'relative',
                                background: selectedIds.includes(file.id) ? 'rgba(255,210,0,0.1)' : 'rgba(255,255,255,0.03)',
                                border: selectedIds.includes(file.id) ? '1px solid var(--accent-blue)' : '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                padding: '16px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                aspectRatio: '1/1.1'
                            }}
                            onMouseEnter={(e) => {
                                if (!selectedIds.includes(file.id)) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!selectedIds.includes(file.id)) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }
                            }}
                        >
                            <div
                                onClick={(e) => toggleSelect(e, file.id)}
                                style={{
                                    position: 'absolute',
                                    top: 10,
                                    left: 10,
                                    zIndex: 2,
                                    opacity: selectedIds.includes(file.id) ? 1 : 0.5
                                }}
                            >
                                {selectedIds.includes(file.id) ? <div style={{ width: 18, height: 18, background: 'var(--accent-blue)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={14} color="#000" strokeWidth={3} /></div> : <div className="grid-select-circle" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderRadius: 6 }} />}
                            </div>

                            <button
                                onClick={(e) => handleOpenMenu(e, file)}
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    padding: 4,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    opacity: 0.7
                                }}
                            >
                                <MoreHorizontal size={20} />
                            </button>

                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                <div style={{ transform: 'scale(1.2)' }}>
                                    {file.isDirectory ?
                                        <Folder size={48} fill="var(--accent-blue)" color="var(--accent-blue)" opacity={0.9} /> :
                                        getIcon(file.file_path, 48)
                                    }
                                </div>
                            </div>

                            <div style={{ width: '100%', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                                    {getFileName(file.file_path || '')}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                    {file.isDirectory ?
                                        <span>{t('starred.folder')}</span> :
                                        <span>{formatSize(file.size || 0)}</span>
                                    }
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Preview Modal */}
            {previewFile && (
                <div className="preview-overlay" onClick={() => setPreviewFile(null)}>
                    <div className="preview-header" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button onClick={() => setPreviewFile(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={24} /></button>
                            <span style={{ fontWeight: 600 }}>{getFileName(previewFile.file_path || '')}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <a href={`/preview/${previewFile.file_path}`} download={getFileName(previewFile.file_path || '')} className="btn-preview"><Download size={18} />{t('common.download')}</a>
                            <button className="btn-preview primary" onClick={() => showToast(t('common.feature_coming_soon'), 'info')}><Share2 size={18} />{t('common.share')}</button>
                        </div>
                    </div>

                    <div className="preview-content">{renderPreviewContent(previewFile)}</div>

                    <div className="preview-actions">
                        <div className="hint" style={{ color: 'white', opacity: 0.6 }}>
                            {formatSize(previewFile.size || 0)} • {t('browser.uploader_label')} {previewFile.uploader || 'unknown'} • {t('browser.access_label')} {previewFile.accessCount || 0}
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
                        <div className="context-menu-item" onClick={() => { handleItemClick(menuAnchor.file); setMenuAnchor(null); }}>
                            <Eye size={16} color="var(--accent-blue)" /> {t('starred.view_preview')}
                        </div>
                        <div className="context-menu-separator" />
                        <div className="context-menu-item danger" onClick={() => { unstarFile(menuAnchor.file.id); setMenuAnchor(null); }}>
                            <Star size={16} /> {t('starred.unstar')}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default StarredPage;
