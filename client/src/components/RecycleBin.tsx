import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
    Trash2, RotateCcw, Trash, FileText, Folder, AlertCircle, Clock,
    LayoutGrid, List, X, Image as ImageIcon, Video as VideoIcon,
    Check
} from 'lucide-react';

interface RecycleItem {
    id: number;
    name: string;
    original_path: string;
    deleted_path: string;
    deletion_date: string;
    user_id: number;
    is_directory: number;
    deleted_by: string;
}

const RecycleBin: React.FC = () => {
    const [items, setItems] = useState<RecycleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [previewItem, setPreviewItem] = useState<RecycleItem | null>(null);
    const { token } = useAuthStore();

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        try {
            const res = await axios.get('/api/recycle-bin', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setItems(res.data);
        } catch (err) {
            console.error('Failed to fetch recycle bin:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = async () => {
        if (!window.confirm('确定清空整个回收站？此操作不可撤销！')) return;
        try {
            await axios.delete('/api/recycle-bin-clear', {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchItems();
        } catch (err) {
            console.error('Clear all failed:', err);
            alert('清空失败');
        }
    };

    const handleBulkRestore = async () => {
        if (selectedIds.length === 0) return;
        try {
            for (const id of selectedIds) {
                await axios.post(`/api/recycle-bin/restore/${id}`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setSelectedIds([]);
            fetchItems();
        } catch (err) {
            alert('批量恢复失败');
        }
    };

    const handleBulkDelete = async () => {
        if (!window.confirm(`确定要永久删除选中的 ${selectedIds.length} 项吗？此操作不可撤销！`)) return;
        try {
            for (const id of selectedIds) {
                await axios.delete(`/api/recycle-bin/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            setSelectedIds([]);
            fetchItems();
        } catch (err) {
            alert('批量删除失败');
        }
    };

    const toggleSelection = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const getFileIcon = (item: RecycleItem) => {
        if (item.is_directory) {
            return <Folder size={24} />;
        }
        const ext = item.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
            return <ImageIcon size={24} />;
        }
        if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'hevc', 'h265'].includes(ext || '')) {
            return <VideoIcon size={24} />;
        }
        return <FileText size={24} />;
    };

    const getThumbnail = (item: RecycleItem) => {
        if (item.is_directory) return null;
        const ext = item.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
            return `/preview?path=${encodeURIComponent(item.deleted_path)}`;
        }
        return null;
    };

    const canPreview = (item: RecycleItem) => {
        if (item.is_directory) return false;
        const ext = item.name.split('.').pop()?.toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'hevc', 'h265', 'pdf', 'txt'].includes(ext || '');
    };

    return (
        <div style={{ padding: '32px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <Trash2 size={32} color="var(--accent-blue)" />
                        回收站
                    </h1>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {/* View Mode Toggle */}
                        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.05)', padding: '4px', borderRadius: '8px' }}>
                            <button
                                onClick={() => setViewMode('grid')}
                                style={{
                                    padding: '8px 12px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    background: viewMode === 'grid' ? '#FFF' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: viewMode === 'grid' ? '#007AFF' : 'var(--text-secondary)'
                                }}
                            >
                                <LayoutGrid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                style={{
                                    padding: '8px 12px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    background: viewMode === 'list' ? '#FFF' : 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: viewMode === 'list' ? '#007AFF' : 'var(--text-secondary)'
                                }}
                            >
                                <List size={16} />
                            </button>
                        </div>

                        {/* Bulk Actions */}
                        {selectedIds.length > 0 && (
                            <>
                                <button
                                    onClick={handleBulkRestore}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#34C759',
                                        color: '#FFF',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <RotateCcw size={16} />
                                    批量恢复 ({selectedIds.length})
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    style={{
                                        padding: '10px 16px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#FF3B30',
                                        color: '#FFF',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Trash size={16} />
                                    批量删除
                                </button>
                            </>
                        )}

                        <button
                            onClick={handleClearAll}
                            disabled={items.length === 0}
                            style={{
                                padding: '10px 16px',
                                borderRadius: '8px',
                                border: '1px solid var(--glass-border)',
                                background: 'transparent',
                                color: '#FF3B30',
                                fontWeight: 600,
                                cursor: items.length > 0 ? 'pointer' : 'not-allowed',
                                opacity: items.length > 0 ? 1 : 0.5,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            <Trash2 size={16} />
                            清空回收站
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'rgba(255, 149, 0, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 149, 0, 0.3)' }}>
                    <AlertCircle size={16} color="#FF9500" />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                        删除的文件将保留 30 天，过期后将自动物理销毁
                    </span>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                    加载中...
                </div>
            ) : items.length === 0 ? (
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px',
                    color: 'var(--text-secondary)'
                }}>
                    <Trash2 size={64} style={{ opacity: 0.3 }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>回收站是空的</h3>
                    <p>删除的文件将显示在这里</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '16px',
                    overflowY: 'auto'
                }}>
                    {items.map(item => {
                        const isSelected = selectedIds.includes(item.id);
                        const thumbnail = getThumbnail(item);

                        return (
                            <div
                                key={item.id}
                                style={{
                                    background: 'var(--glass-bg)',
                                    border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    position: 'relative'
                                }}
                                onClick={() => canPreview(item) && setPreviewItem(item)}
                            >
                                {/* Selection Checkbox */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSelection(item.id);
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '8px',
                                        left: '8px',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '6px',
                                        border: isSelected ? '2px solid var(--accent-blue)' : '2px solid rgba(0,0,0,0.2)',
                                        background: isSelected ? 'var(--accent-blue)' : '#FFF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                        zIndex: 10
                                    }}
                                >
                                    {isSelected && <Check size={14} color="#000" />}
                                </div>

                                {/* Thumbnail or Icon */}
                                <div style={{
                                    width: '100%',
                                    height: '140px',
                                    borderRadius: '8px',
                                    background: 'rgba(0,0,0,0.03)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '12px',
                                    overflow: 'hidden'
                                }}>
                                    {thumbnail ? (
                                        <img
                                            src={thumbnail}
                                            alt={item.name}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover'
                                            }}
                                        />
                                    ) : (
                                        <div style={{ color: 'var(--text-secondary)' }}>
                                            {getFileIcon(item)}
                                        </div>
                                    )}
                                </div>

                                {/* File Info */}
                                <div>
                                    <div style={{
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        marginBottom: '4px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {item.name}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                                        {item.original_path}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Clock size={12} />
                                        {formatDistanceToNow(new Date(item.deletion_date), { addSuffix: true, locale: zhCN })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div style={{ overflowY: 'auto' }}>
                    {items.map(item => {
                        const isSelected = selectedIds.includes(item.id);
                        return (
                            <div
                                key={item.id}
                                style={{
                                    background: 'var(--glass-bg)',
                                    border: isSelected ? '2px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    cursor: 'pointer'
                                }}
                                onClick={() => canPreview(item) && setPreviewItem(item)}
                            >
                                {/* Checkbox */}
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleSelection(item.id);
                                    }}
                                    style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '6px',
                                        border: isSelected ? '2px solid var(--accent-blue)' : '2px solid rgba(0,0,0,0.2)',
                                        background: isSelected ? 'var(--accent-blue)' : '#FFF',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {isSelected && <Check size={14} color="#000" />}
                                </div>

                                {/* Icon */}
                                <div style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
                                    {getFileIcon(item)}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                                        {item.name}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {item.original_path}
                                    </div>
                                </div>

                                {/* Metadata */}
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                                    <div style={{ marginBottom: '4px' }}>
                                        {formatDistanceToNow(new Date(item.deletion_date), { addSuffix: true, locale: zhCN })}
                                    </div>
                                    <div>by {item.deleted_by}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )
            }

            {/* Preview Modal */}
            {
                previewItem && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.9)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '40px'
                        }}
                        onClick={() => setPreviewItem(null)}
                    >
                        <button
                            onClick={() => setPreviewItem(null)}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '20px',
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#FFF'
                            }}
                        >
                            <X size={24} />
                        </button>

                        <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '90%', maxHeight: '90%' }}>
                            {(() => {
                                const ext = previewItem.name.split('.').pop()?.toLowerCase();
                                const previewUrl = `/preview?path=${encodeURIComponent(previewItem.deleted_path)}`;

                                if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
                                    return <img src={previewUrl} alt={previewItem.name} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />;
                                }
                                if (['mp4', 'mov', 'hevc', 'h265'].includes(ext || '')) {
                                    return <video src={previewUrl} controls style={{ maxWidth: '100%', maxHeight: '80vh' }} />;
                                }
                                return (
                                    <div style={{ background: '#FFF', padding: '40px', borderRadius: '12px', textAlign: 'center' }}>
                                        <p>无法预览此文件类型</p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default RecycleBin;
