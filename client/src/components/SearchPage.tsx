import React, { useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Search, File, Folder, Image, Video, FileText, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface SearchResult {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modified: string;
}

export const SearchPage: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [typeFilter, setTypeFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const { token } = useAuthStore();
    const navigate = useNavigate();

    const handleSearch = async () => {
        if (!query.trim()) return;

        setLoading(true);
        try {
            const params: any = { q: query };
            if (typeFilter) params.type = typeFilter;

            const res = await axios.get('/api/search', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            setResults(res.data.results || []);
        } catch (err) {
            console.error('Search failed:', err);
            alert('搜索失败');
        } finally {
            setLoading(false);
        }
    };

    const getFileIcon = (item: SearchResult) => {
        if (item.isDirectory) return <Folder size={20} color="var(--accent-blue)" />;
        const ext = item.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <Image size={20} color="var(--accent-blue)" />;
        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) return <Video size={20} color="var(--accent-blue)" />;
        if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText size={20} color="var(--accent-blue)" />;
        return <File size={20} color="var(--accent-blue)" />;
    };

    const navigateToFile = (filePath: string) => {
        const parts = filePath.split('/').filter(Boolean);
        if (parts.length === 0) return;

        if (parts[0] === 'Members' && parts.length > 1) {
            navigate(`/dept/members/${parts[1]}`);
        } else {
            const deptCodeMap: { [key: string]: string } = { 'MS': 'MS', 'OP': 'OP', 'RD': 'RD', 'GE': 'GE' };
            const code = deptCodeMap[parts[0]];
            if (code) navigate(`/dept/${code}`);
        }
    };

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Search size={32} color="var(--accent-blue)" />
                    搜索全部文件
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                    在所有有权限的文件夹中搜索
                </p>
            </div>

            {/* Search Bar */}
            <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="输入文件名关键词..."
                        style={{
                            flex: 1,
                            padding: '14px 18px',
                            fontSize: '1rem',
                            border: '2px solid var(--glass-border)',
                            borderRadius: '10px',
                            background: 'var(--glass-bg)',
                            color: '#fff',
                            outline: 'none'
                        }}
                        onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
                        onBlur={(e) => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        style={{
                            padding: '14px 32px',
                            background: 'var(--accent-blue)',
                            color: '#000',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '1rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        {loading ? '搜索中...' : '搜索'}
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{
                            padding: '14px 20px',
                            background: showFilters ? 'rgba(255, 210, 0, 0.2)' : 'var(--glass-bg)',
                            border: '2px solid var(--glass-border)',
                            borderRadius: '10px',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        <Filter size={20} />
                    </button>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div style={{
                        padding: '16px',
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '10px',
                        display: 'flex',
                        gap: '12px',
                        flexWrap: 'wrap'
                    }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, width: '100%' }}>文件类型:</div>
                        {['', 'image', 'video', 'document'].map(type => (
                            <button
                                key={type}
                                onClick={() => setTypeFilter(type)}
                                style={{
                                    padding: '8px 16px',
                                    background: typeFilter === type ? 'rgba(255, 210, 0, 0.15)' : 'rgba(0,0,0,0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderLeft: typeFilter === type ? '4px solid var(--accent-blue)' : '1px solid rgba(255, 255, 255, 0.15)',
                                    color: 'var(--text-main)',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: typeFilter === type ? 700 : 500,
                                    fontSize: '0.85rem'
                                }}
                            >
                                {type === '' ? '全部' : type === 'image' ? '图片' : type === 'video' ? '视频' : '文档'}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div>
                    <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        找到 {results.length} 个结果
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {results.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => navigateToFile(item.path)}
                                style={{
                                    background: 'var(--glass-bg)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '10px',
                                    padding: '14px 18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '14px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--glass-bg)'}
                            >
                                {getFileIcon(item)}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, marginBottom: '2px' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {item.path.split('/').slice(0, -1).join('/')}
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                                    {!item.isDirectory && `${(item.size / 1024).toFixed(1)} KB · `}
                                    {formatDistanceToNow(new Date(item.modified), { addSuffix: true, locale: zhCN })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && results.length === 0 && query && (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
                    <Search size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>未找到匹配的文件</h3>
                    <p>尝试使用不同的关键词</p>
                </div>
            )}
        </div>
    );
};

export default SearchPage;
