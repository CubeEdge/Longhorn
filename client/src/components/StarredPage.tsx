import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Star, Folder, File, Image, Video, FileText, LayoutGrid, List, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface StarredFile {
    id: number;
    file_path: string;
    starred_at: string;
}

export const StarredPage: React.FC = () => {
    const [starred, setStarred] = useState<StarredFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const { token } = useAuthStore();
    const navigate = useNavigate();

    useEffect(() => {
        fetchStarred();
    }, []);

    const fetchStarred = async () => {
        try {
            const res = await axios.get('/api/starred', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStarred(res.data);
        } catch (err) {
            console.error('Failed to fetch starred:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (id: number) => {
        if (!confirm('确定要取消星标吗？')) return;
        try {
            await axios.delete(`/api/starred/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStarred(starred.filter(s => s.id !== id));
        } catch (err) {
            console.error('Failed to remove starred:', err);
            alert('取消星标失败');
        }
    };

    const getFileIcon = (path: string) => {
        const ext = path.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image size={20} />;
        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) return <Video size={20} />;
        if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText size={20} />;
        if (!ext) return <Folder size={20} />;
        return <File size={20} />;
    };

    const navigateToFile = (filePath: string) => {
        // Parse path like "/市场部 (MS)/folder/file.jpg"
        const parts = filePath.split('/').filter(Boolean);
        if (parts.length === 0) return;

        // Check if it's a personal space
        if (parts[0] === 'Members' && parts.length > 1) {
            navigate(`/dept/members/${parts[1]}`);
            return;
        }

        // Check department
        const deptCodeMap: { [key: string]: string } = {
            '市场部 (MS)': 'MS',
            '运营部 (OP)': 'OP',
            '研发中心 (RD)': 'RD',
            '综合管理 (GE)': 'GE'
        };

        const deptCode = deptCodeMap[parts[0]];
        if (deptCode) {
            navigate(`/dept/${deptCode}`);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                加载中...
            </div>
        );
    }

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Star size={32} color="var(--accent-blue)" fill="var(--accent-blue)" />
                        星标文件
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                        {starred.length} 个已收藏的文件
                    </p>
                </div>

                {/* View Toggle */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={() => setViewMode('grid')}
                        style={{
                            padding: '8px 12px',
                            border: viewMode === 'grid' ? '2px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                            borderRadius: '6px',
                            background: viewMode === 'grid' ? 'rgba(255, 210, 0, 0.1)' : 'var(--glass-bg)',
                            cursor: 'pointer'
                        }}
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        style={{
                            padding: '8px 12px',
                            border: viewMode === 'list' ? '2px solid var(--accent-blue)' : '1px solid var(--glass-border)',
                            borderRadius: '6px',
                            background: viewMode === 'list' ? 'rgba(255, 210, 0, 0.1)' : 'var(--glass-bg)',
                            cursor: 'pointer'
                        }}
                    >
                        <List size={18} />
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {starred.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '80px 20px',
                    color: 'var(--text-secondary)'
                }}>
                    <Star size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>还没有星标文件</h3>
                    <p>在文件浏览器中右键文件，选择"添加星标"</p>
                </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && starred.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                    {starred.map(item => (
                        <div
                            key={item.id}
                            style={{
                                background: 'var(--glass-bg)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                            onClick={() => navigateToFile(item.file_path)}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ fontSize: '2rem', marginBottom: '12px', color: 'var(--accent-blue)' }}>
                                {getFileIcon(item.file_path)}
                            </div>
                            <div style={{ fontWeight: 600, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.file_path.split('/').pop()}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                {item.file_path.split('/').slice(0, -1).join('/')}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {formatDistanceToNow(new Date(item.starred_at), { addSuffix: true, locale: zhCN })}
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove(item.id);
                                }}
                                style={{
                                    position: 'absolute',
                                    top: '8px',
                                    right: '8px',
                                    padding: '4px',
                                    border: 'none',
                                    background: 'rgba(255, 0, 0, 0.1)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                <Trash2 size={14} color="#ff3b30" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && starred.length > 0 && (
                <div>
                    {starred.map(item => (
                        <div
                            key={item.id}
                            style={{
                                background: 'var(--glass-bg)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                marginBottom: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '16px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => navigateToFile(item.file_path)}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
                        >
                            <div style={{ color: 'var(--accent-blue)' }}>
                                {getFileIcon(item.file_path)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                                    {item.file_path.split('/').pop()}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    {item.file_path.split('/').slice(0, -1).join('/')}
                                </div>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                                {formatDistanceToNow(new Date(item.starred_at), { addSuffix: true, locale: zhCN })}
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemove(item.id);
                                }}
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    background: 'rgba(255, 0, 0, 0.1)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    color: '#ff3b30',
                                    fontWeight: 600,
                                    fontSize: '0.85rem'
                                }}
                            >
                                取消星标
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StarredPage;
