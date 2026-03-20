/**
 * PartsCatalogPage - 配件目录（重写版）
 * 
 * 对齐 ProductModelsManagement / ProductSkusManagement 的设计风格：
 * - macOS26 Segmented Control 族群切换
 * - 可调列宽表格
 * - 搜索图标展开/收起
 * - 行点击跳转详情页
 * - 深色/浅色模式：全部使用 CSS 变量
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Package, Plus, Search, Edit2,
    Loader2, AlertCircle, X, ArrowLeft
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

// Column resize handle styles
const colResizeHandleStyle = `
  .col-resize-handle {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    background: transparent;
    transition: background 0.2s;
  }
  .col-resize-handle:hover {
    background: var(--kine-yellow);
  }
  .col-resize-handle:active {
    background: var(--kine-yellow);
  }
`;

interface Part {
    id: number;
    sku: string;
    name: string;
    name_en?: string;
    name_internal?: string;
    name_internal_en?: string;
    material_id?: string;
    category: string;
    description?: string;
    price_cny?: number;
    price_usd?: number;
    price_eur?: number;
    cost_cny?: number;
    status: 'active' | 'discontinued' | 'pending';
    compatible_models?: string[];
    created_by_name?: string;
    created_at?: string;
}

// Product family definitions (aligned with ProductModelsManagement)
type ProductFamily = 'ALL' | 'A' | 'B' | 'C' | 'D' | 'E';

const FAMILY_TABS: { key: ProductFamily; label: string }[] = [
    { key: 'ALL', label: '全部' },
    { key: 'A', label: '在售电影机' },
    { key: 'B', label: '广播摄像机' },
    { key: 'C', label: '电子寻像器' },
    { key: 'D', label: '历史产品' },
    { key: 'E', label: '通用配件' },
];

// Family-to-model name mapping for client-side filtering
const FAMILY_MODEL_KEYWORDS: Record<string, string[]> = {
    'A': ['MAVO Edge', 'MAVO mark2'],
    'B': ['MC5030', 'MC6030', 'MC8030', 'M503', 'M603', 'M606', 'M803'],
    'C': ['EAGLE', '猎影', 'KVF', 'EVF'],
    'D': ['MAVO LF', 'MAVO S35', 'Terra', 'KineMINI', 'KineRAW'],
    'E': ['GripBAT', 'KineBAT', 'KineMON', 'NATO', 'Movcam'],
};

// Column widths
const COL_WIDTHS_KEY = 'longhorn_parts_col_widths';
type ColKey = 'sku' | 'name' | 'category' | 'compatible' | 'price' | 'action';
const DEFAULT_COL_WIDTHS: Record<ColKey, number> = {
    sku: 160, name: 200, category: 100, compatible: 220, price: 100, action: 70
};

function loadColWidths(): Record<ColKey, number> {
    try {
        const saved = localStorage.getItem(COL_WIDTHS_KEY);
        return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
    } catch {
        return { ...DEFAULT_COL_WIDTHS };
    }
}

// Sort configuration
type SortKey = 'sku' | 'name' | 'category' | 'price';

const PartsCatalogPage: React.FC = () => {
    const { t: _t } = useLanguage();
    const { token, user } = useAuthStore();
    const navigate = useNavigate();

    // State
    const [parts, setParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFamily, setSelectedFamily] = useState<ProductFamily>('ALL');

    // Search expand
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Column widths & resize
    const [colWidths, setColWidths] = useState<Record<ColKey, number>>(loadColWidths);
    const resizingRef = useRef<{ col: ColKey; startX: number; startWidth: number } | null>(null);

    // Sort state
    const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });

    // Delete confirm
    const [deleteConfirm, setDeleteConfirm] = useState<Part | null>(null);

    const isAdmin = ['Admin', 'Lead', 'Exec'].includes(user?.role || '');
    const isOP = user?.department_code === 'OP';

    // Fetch parts
    const fetchParts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params: Record<string, string | number> = { page_size: 200 };
            if (searchQuery) params.search = searchQuery;

            const res = await axios.get('/api/v1/parts-master', {
                headers: { Authorization: `Bearer ${token}` },
                params
            });
            if (res.data?.success) {
                setParts(res.data.data);
            }
        } catch (err: any) {
            console.error('Failed to fetch parts:', err);
            setError(err.response?.data?.error?.message || 'Failed to fetch parts');
        } finally {
            setLoading(false);
        }
    }, [searchQuery, token]);

    useEffect(() => {
        if (token) fetchParts();
    }, [fetchParts, token]);

    // Family filter (client-side via compatible_models)
    const filterByFamily = (part: Part): boolean => {
        if (selectedFamily === 'ALL') return true;
        const keywords = FAMILY_MODEL_KEYWORDS[selectedFamily] || [];
        const models = part.compatible_models || [];
        return models.some(model =>
            keywords.some(kw => model.toUpperCase().includes(kw.toUpperCase()))
        );
    };

    // Sort + filter
    const filteredAndSortedParts = parts
        .filter(filterByFamily)
        .sort((a, b) => {
            if (!sortConfig.key) return 0;
            const dir = sortConfig.dir === 'asc' ? 1 : -1;
            switch (sortConfig.key) {
                case 'sku':
                    return (a.sku || '').localeCompare(b.sku || '') * dir;
                case 'name':
                    return (a.name || '').localeCompare(b.name || '') * dir;
                case 'category':
                    return (a.category || '').localeCompare(b.category || '') * dir;
                case 'price':
                    return ((a.price_usd || 0) - (b.price_usd || 0)) * dir;
                default:
                    return 0;
            }
        });

    // Column resize handlers
    const startColResize = (e: React.MouseEvent, col: ColKey) => {
        e.preventDefault();
        e.stopPropagation();
        resizingRef.current = { col, startX: e.clientX, startWidth: colWidths[col] };
        const onMouseMove = (me: MouseEvent) => {
            if (!resizingRef.current) return;
            const delta = me.clientX - resizingRef.current.startX;
            const newWidth = Math.max(50, resizingRef.current.startWidth + delta);
            setColWidths(prev => {
                const next = { ...prev, [resizingRef.current!.col]: newWidth };
                localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(next));
                return next;
            });
        };
        const onMouseUp = () => {
            resizingRef.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
        };
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // Sort handler
    const handleSort = (key: SortKey) => {
        setSortConfig(prev => {
            if (prev.key === key) {
                if (prev.dir === 'asc') return { key, dir: 'desc' as const };
                return { key: null, dir: 'asc' as const };
            }
            return { key, dir: 'asc' as const };
        });
    };

    const handleDelete = async (part: Part) => {
        try {
            await axios.delete(`/api/v1/parts-master/${part.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDeleteConfirm(null);
            fetchParts();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '删除失败');
        }
    };

    // Sort indicator
    const sortIndicator = (key: SortKey) => {
        if (sortConfig.key === key) {
            return sortConfig.dir === 'asc' ? ' ↑' : ' ↓';
        }
        return <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>;
    };

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <style>{colResizeHandleStyle}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={() => navigate('/service/products')}
                        style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--text-secondary)'
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <Package size={28} color="#FFD700" />
                            配件目录
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                            管理维修配件的基础信息、价格与兼容性
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Search - expand/collapse */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isSearchExpanded ? 'flex-start' : 'center',
                        width: isSearchExpanded ? 280 : 40,
                        height: 40,
                        background: isSearchExpanded ? 'var(--glass-bg-hover)' : 'transparent',
                        border: isSearchExpanded ? '1px solid var(--glass-border)' : 'none',
                        borderRadius: 8,
                        transition: 'all 0.3s ease',
                        overflow: 'hidden'
                    }}>
                        <button
                            onClick={() => {
                                setIsSearchExpanded(!isSearchExpanded);
                                if (!isSearchExpanded) {
                                    setTimeout(() => searchInputRef.current?.focus(), 100);
                                }
                            }}
                            style={{
                                background: 'none', border: 'none', color: 'var(--text-secondary)',
                                cursor: 'pointer', padding: 8, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}
                        >
                            <Search size={20} />
                        </button>
                        {isSearchExpanded && (
                            <>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="搜索SKU或配件名称..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onBlur={() => { if (!searchQuery) setIsSearchExpanded(false); }}
                                    style={{
                                        flex: 1, background: 'transparent', border: 'none',
                                        color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', padding: '0 8px'
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                                        style={{
                                            background: 'none', border: 'none', color: 'var(--text-tertiary)',
                                            cursor: 'pointer', padding: 4, marginRight: 4
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {isAdmin && (
                        <button className="btn-kine-lowkey" onClick={() => navigate('/service/parts/new')}>
                            <Plus size={18} /> 新增配件
                        </button>
                    )}
                </div>
            </div>

            {/* Family Filter Tabs - macOS26 Segmented Control */}
            <div style={{ marginBottom: 20 }}>
                <div style={{
                    display: 'flex',
                    gap: 2,
                    background: 'var(--glass-bg-light)',
                    padding: 3,
                    borderRadius: 8,
                    height: '36px',
                    alignItems: 'center',
                    width: 'fit-content',
                    border: '1px solid var(--glass-border)'
                }}>
                    {FAMILY_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedFamily(tab.key)}
                            style={{
                                padding: '0 16px', height: '30px',
                                background: selectedFamily === tab.key ? 'var(--glass-bg-hover)' : 'transparent',
                                color: selectedFamily === tab.key ? 'var(--text-main)' : 'var(--text-secondary)',
                                borderRadius: 6,
                                fontWeight: selectedFamily === tab.key ? 500 : 400,
                                fontSize: '0.9rem',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                boxShadow: selectedFamily === tab.key ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div style={{ marginBottom: 16, padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#EF4444' }}>
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--glass-bg-light)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                            <th
                                onClick={() => handleSort('sku')}
                                style={{ padding: '16px', color: sortConfig.key === 'sku' ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', width: colWidths.sku, position: 'relative' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    SKU{sortIndicator('sku')}
                                </span>
                                <div onMouseDown={e => startColResize(e, 'sku')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                            </th>
                            <th
                                onClick={() => handleSort('name')}
                                style={{ padding: '16px', color: sortConfig.key === 'name' ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', width: colWidths.name, position: 'relative' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    配件名称{sortIndicator('name')}
                                </span>
                                <div onMouseDown={e => startColResize(e, 'name')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                            </th>
                            <th
                                onClick={() => handleSort('category')}
                                style={{ padding: '16px', color: sortConfig.key === 'category' ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', width: colWidths.category, position: 'relative' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    分类{sortIndicator('category')}
                                </span>
                                <div onMouseDown={e => startColResize(e, 'category')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                            </th>
                            <th style={{ padding: '16px', color: 'var(--text-secondary)', width: colWidths.compatible, position: 'relative' }}>
                                兼容机型
                                <div onMouseDown={e => startColResize(e, 'compatible')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                            </th>
                            {!isOP && (
                                <th
                                    onClick={() => handleSort('price')}
                                    style={{ padding: '16px', color: sortConfig.key === 'price' ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', width: colWidths.price, position: 'relative', textAlign: 'right' }}
                                >
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        USD{sortIndicator('price')}
                                    </span>
                                    <div onMouseDown={e => startColResize(e, 'price')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                                </th>
                            )}
                            <th style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center', width: colWidths.action }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={isOP ? 5 : 6} style={{ padding: 40, textAlign: 'center' }}>
                                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', opacity: 0.5 }} />
                            </td></tr>
                        ) : filteredAndSortedParts.length === 0 ? (
                            <tr><td colSpan={isOP ? 5 : 6} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                    <Package size={48} opacity={0.3} />
                                    <span>暂无配件数据</span>
                                </div>
                            </td></tr>
                        ) : (
                            filteredAndSortedParts.map(part => (
                                <tr
                                    key={part.id}
                                    className="row-hover"
                                    style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
                                    onClick={() => navigate(`/service/parts/${part.id}`)}
                                >
                                    {/* SKU */}
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                                            {part.sku}
                                        </div>
                                    </td>
                                    {/* Name */}
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{part.name}</div>
                                        {part.name_en && <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{part.name_en}</div>}
                                    </td>
                                    {/* Category */}
                                    <td style={{ padding: 16 }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            background: 'var(--glass-bg-hover)',
                                            borderRadius: 4,
                                            fontSize: '0.8rem',
                                            color: 'var(--text-main)'
                                        }}>
                                            {part.category}
                                        </span>
                                    </td>
                                    {/* Compatible Models */}
                                    <td style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {(part.compatible_models || []).slice(0, 3).map((model, idx) => (
                                                <span key={idx} style={{
                                                    padding: '1px 6px',
                                                    background: 'rgba(59,130,246,0.1)',
                                                    border: '1px solid rgba(59,130,246,0.2)',
                                                    borderRadius: 4,
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-secondary)',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {model}
                                                </span>
                                            ))}
                                            {(part.compatible_models || []).length > 3 && (
                                                <span style={{
                                                    padding: '1px 6px',
                                                    background: 'var(--glass-bg-hover)',
                                                    borderRadius: 4,
                                                    fontSize: '0.75rem',
                                                    color: 'var(--text-tertiary)'
                                                }}>
                                                    +{(part.compatible_models || []).length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Price USD */}
                                    {!isOP && (
                                        <td style={{ padding: 16, textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
                                                {part.price_usd ? `$${part.price_usd.toLocaleString()}` : '—'}
                                            </div>
                                        </td>
                                    )}
                                    {/* Action */}
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); /* TODO: open edit modal */ }}
                                                title="编辑"
                                                style={{
                                                    background: 'transparent', border: 'none', padding: 8,
                                                    color: 'var(--accent-blue)', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s', borderRadius: 6, margin: '0 auto'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Stats footer */}
            <div style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: '0.8rem',
                color: 'var(--text-tertiary)'
            }}>
                <span>{filteredAndSortedParts.length} 条配件</span>
                {selectedFamily !== 'ALL' && (
                    <span>· 族群筛选: {FAMILY_TABS.find(t => t.key === selectedFamily)?.label}</span>
                )}
            </div>

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <>
                    <div
                        onClick={() => setDeleteConfirm(null)}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
                            zIndex: 9999
                        }}
                    />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 400, background: 'var(--modal-bg)', borderRadius: 16,
                        boxShadow: 'var(--glass-shadow-lg)', border: '1px solid var(--glass-border)',
                        padding: 24, zIndex: 10000
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <AlertCircle size={24} color="#EF4444" />
                            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--text-main)' }}>确认删除</h3>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                            确定要删除配件 <strong>{deleteConfirm.sku}</strong> ({deleteConfirm.name}) 吗？<br />
                            此操作不可恢复。
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                style={{
                                    padding: '8px 16px',
                                    background: 'transparent',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 6,
                                    color: 'var(--text-main)',
                                    cursor: 'pointer'
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                style={{
                                    padding: '8px 16px',
                                    background: '#EF4444',
                                    border: 'none',
                                    borderRadius: 6,
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default PartsCatalogPage;
