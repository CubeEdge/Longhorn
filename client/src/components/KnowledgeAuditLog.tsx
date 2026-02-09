/**
 * Knowledge Audit Log - Admin Panel
 * 知识库操作审计日志 - 管理员页面
 * 追踪所有知识库写操作
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface AuditLog {
    id: number;
    operation: string;
    operation_detail: string | null;
    article_id: number | null;
    article_title: string;
    article_slug: string | null;
    category: string | null;
    product_line: string | null;
    product_models: string[] | null;
    changes_summary: any;
    old_status: string | null;
    new_status: string | null;
    source_type: string | null;
    source_reference: string | null;
    batch_id: string | null;
    user_id: number;
    user_name: string;
    user_role: string | null;
    created_at: string;
}

interface Stats {
    by_operation: { operation: string; count: number }[];
    by_user: { user_id: number; user_name: string; count: number }[];
    by_product_line: { product_line: string; count: number }[];
    last_7_days: { date: string; count: number }[];
    total: {
        total_operations: number;
        total_users: number;
        total_batches: number;
    };
}

const OPERATION_LABELS: Record<string, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    import: '导入',
    publish: '发布',
    archive: '归档'
};

const OPERATION_COLORS: Record<string, string> = {
    create: '#10b981',
    update: '#3b82f6',
    delete: '#ef4444',
    import: '#8b5cf6',
    publish: '#f59e0b',
    archive: '#6b7280'
};

export default function KnowledgeAuditLog() {
    const { token, user } = useAuthStore();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 50;

    // 过滤条件
    const [filters, setFilters] = useState({
        operation: '',
        user_id: '',
        product_line: '',
        start_date: '',
        end_date: '',
        search: ''
    });

    // 权限检查
    if (user?.role !== 'Admin') {
        return (
            <div style={{
                padding: '80px 32px',
                textAlign: 'center',
                color: '#666'
            }}>
                <div style={{
                    fontSize: '48px',
                    marginBottom: '16px'
                }}>🔒</div>
                <h2 style={{ fontSize: '24px', marginBottom: '12px', color: '#fff' }}>
                    仅管理员可访问
                </h2>
                <p>审计日志功能仅限管理员查看</p>
            </div>
        );
    }

    // 加载日志
    const loadLogs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                page_size: pageSize.toString(),
                ...Object.fromEntries(
                    Object.entries(filters).filter(([_, v]) => v)
                )
            });

            const response = await fetch(`${API_BASE_URL}/api/v1/knowledge/audit?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            if (data.success) {
                setLogs(data.data);
                setTotal(data.meta.total);
            }
        } catch (err) {
            console.error('Failed to load logs:', err);
        } finally {
            setLoading(false);
        }
    };

    // 加载统计
    const loadStats = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/knowledge/audit/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await response.json();
            if (data.success) {
                setStats(data.data);
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [page, filters]);

    useEffect(() => {
        loadStats();
    }, []);

    // 格式化时间
    const formatTime = (datetime: string) => {
        const date = new Date(datetime);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 7) return `${days}天前`;
        return date.toLocaleString('zh-CN');
    };

    return (
        <div style={{
            maxWidth: '1600px',
            margin: '0 auto'
        }}>
            {/* Header */}
            <div style={{
                marginBottom: '32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
            }}>
                <div>
                    <h1 style={{
                        fontSize: '28px',
                        fontWeight: 600,
                        color: '#fff',
                        marginBottom: '8px'
                    }}>
                        知识库审计日志
                    </h1>
                    <p style={{ color: '#999', fontSize: '14px' }}>
                        追踪所有知识库写操作，包括创建、更新、删除和导入
                    </p>
                </div>
                <button
                    onClick={() => { loadLogs(); loadStats(); }}
                    style={{
                        padding: '8px 16px',
                        background: 'rgba(255,215,0,0.1)',
                        border: '1px solid rgba(255,215,0,0.3)',
                        borderRadius: '8px',
                        color: '#FFD700',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,215,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,215,0,0.1)';
                    }}
                >
                    刷新
                </button>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '20px',
                    marginBottom: '32px'
                }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        padding: '24px'
                    }}>
                        <div style={{ fontSize: '14px', color: '#999', marginBottom: '8px' }}>总操作数</div>
                        <div style={{ fontSize: '32px', fontWeight: 700, color: '#FFD700' }}>
                            {stats.total.total_operations}
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        padding: '24px'
                    }}>
                        <div style={{ fontSize: '14px', color: '#999', marginBottom: '8px' }}>操作人数</div>
                        <div style={{ fontSize: '32px', fontWeight: 700, color: '#10b981' }}>
                            {stats.total.total_users}
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '12px',
                        padding: '24px'
                    }}>
                        <div style={{ fontSize: '14px', color: '#999', marginBottom: '8px' }}>批量导入次数</div>
                        <div style={{ fontSize: '32px', fontWeight: 700, color: '#8b5cf6' }}>
                            {stats.total.total_batches}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 200px 200px 140px',
                    gap: '16px',
                    alignItems: 'start'
                }}>
                    {/* 搜索 */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ 
                            fontSize: '13px', 
                            color: '#999', 
                            marginBottom: '8px',
                            height: '18px',
                            lineHeight: '18px'
                        }}>
                            搜索文章标题
                        </label>
                        <input
                            type="text"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            placeholder="输入文章标题..."
                            style={{
                                width: '100%',
                                height: '36px',
                                padding: '0 12px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '13px',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                boxSizing: 'border-box'
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,215,0,0.3)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                        />
                    </div>

                    {/* 操作类型 */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ 
                            fontSize: '13px', 
                            color: '#999', 
                            marginBottom: '8px',
                            height: '18px',
                            lineHeight: '18px'
                        }}>
                            操作类型
                        </label>
                        <select
                            value={filters.operation}
                            onChange={(e) => setFilters({ ...filters, operation: e.target.value })}
                            style={{
                                width: '100%',
                                height: '36px',
                                padding: '0 12px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '13px',
                                outline: 'none',
                                cursor: 'pointer',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">全部</option>
                            <option value="create">创建</option>
                            <option value="update">更新</option>
                            <option value="delete">删除</option>
                            <option value="import">导入</option>
                            <option value="publish">发布</option>
                            <option value="archive">归档</option>
                        </select>
                    </div>

                    {/* 产品线 */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{ 
                            fontSize: '13px', 
                            color: '#999', 
                            marginBottom: '8px',
                            height: '18px',
                            lineHeight: '18px'
                        }}>
                            产品线
                        </label>
                        <select
                            value={filters.product_line}
                            onChange={(e) => setFilters({ ...filters, product_line: e.target.value })}
                            style={{
                                width: '100%',
                                height: '36px',
                                padding: '0 12px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '13px',
                                outline: 'none',
                                cursor: 'pointer',
                                boxSizing: 'border-box'
                            }}
                        >
                            <option value="">全部</option>
                            <option value="Cinema">Cinema</option>
                            <option value="Cinema 5 Axis">Cinema 5 Axis</option>
                            <option value="Accessories">Accessories</option>
                        </select>
                    </div>

                    {/* 清空过滤 */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ height: '18px', marginBottom: '8px' }}></div>
                        <button
                            onClick={() => setFilters({
                                operation: '',
                                user_id: '',
                                product_line: '',
                                start_date: '',
                                end_date: '',
                                search: ''
                            })}
                            style={{
                                width: '100%',
                                height: '36px',
                                padding: '0 16px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: '#999',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 500,
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                boxSizing: 'border-box'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.color = '#999';
                            }}
                        >
                            清空过滤
                        </button>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                overflow: 'hidden'
            }}>
                {loading ? (
                    <div style={{ padding: '80px', textAlign: 'center', color: '#666' }}>
                        <div style={{ 
                            fontSize: '32px', 
                            animation: 'spin 1s linear infinite',
                            display: 'inline-block'
                        }}>⌛</div>
                        <div style={{ marginTop: '16px' }}>加载中...</div>
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: '80px', textAlign: 'center', color: '#666' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                        <div>暂无审计日志</div>
                    </div>
                ) : (
                    <>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#999', fontWeight: 600 }}>时间</th>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#999', fontWeight: 600 }}>操作</th>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#999', fontWeight: 600 }}>文章</th>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#999', fontWeight: 600 }}>分类</th>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#999', fontWeight: 600 }}>产品线</th>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#999', fontWeight: 600 }}>操作人</th>
                                        <th style={{ padding: '16px', textAlign: 'left', fontSize: '13px', color: '#999', fontWeight: 600 }}>来源</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <tr key={log.id} style={{
                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '16px', fontSize: '13px', color: '#999' }}>
                                                {formatTime(log.created_at)}
                                            </td>
                                            <td style={{ padding: '16px' }}>
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '4px 12px',
                                                    background: `${OPERATION_COLORS[log.operation]}15`,
                                                    color: OPERATION_COLORS[log.operation],
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 600
                                                }}>
                                                    {OPERATION_LABELS[log.operation] || log.operation}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px', fontSize: '13px', color: '#fff' }}>
                                                <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {log.article_title}
                                                </div>
                                                {log.operation_detail && (
                                                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                                        {log.operation_detail}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px', fontSize: '13px', color: '#999' }}>
                                                {log.category || '-'}
                                            </td>
                                            <td style={{ padding: '16px', fontSize: '13px', color: '#999' }}>
                                                {log.product_line || '-'}
                                            </td>
                                            <td style={{ padding: '16px', fontSize: '13px', color: '#fff' }}>
                                                {log.user_name}
                                                {log.user_role && (
                                                    <span style={{ fontSize: '11px', color: '#666', marginLeft: '4px' }}>
                                                        ({log.user_role})
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px', fontSize: '12px', color: '#999' }}>
                                                {log.source_type && (
                                                    <div>
                                                        <div>{log.source_type}</div>
                                                        {log.source_reference && (
                                                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                                                {log.source_reference}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div style={{
                            padding: '20px',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{ fontSize: '13px', color: '#999' }}>
                                共 {total} 条记录
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                    style={{
                                        padding: '8px 16px',
                                        background: page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '8px',
                                        color: page === 1 ? '#666' : '#fff',
                                        cursor: page === 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    上一页
                                </button>
                                <div style={{
                                    padding: '8px 16px',
                                    background: 'rgba(255,215,0,0.1)',
                                    border: '1px solid rgba(255,215,0,0.3)',
                                    borderRadius: '8px',
                                    color: '#FFD700',
                                    fontSize: '13px'
                                }}>
                                    {page} / {Math.ceil(total / pageSize)}
                                </div>
                                <button
                                    disabled={page >= Math.ceil(total / pageSize)}
                                    onClick={() => setPage(page + 1)}
                                    style={{
                                        padding: '8px 16px',
                                        background: page >= Math.ceil(total / pageSize) ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '8px',
                                        color: page >= Math.ceil(total / pageSize) ? '#666' : '#fff',
                                        cursor: page >= Math.ceil(total / pageSize) ? 'not-allowed' : 'pointer',
                                        fontSize: '13px'
                                    }}
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
