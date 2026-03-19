import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    Plus, Package, Search,
    Edit2, X, ArrowLeft,
    Image as ImageIcon, Save
} from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

const MODAL_Z_INDEX = 9999;

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

// Column widths storage
const COL_WIDTHS_KEY = 'longhorn_sku_col_widths';
type ColKey = 'sku_code' | 'display_name' | 'model' | 'spec' | 'action';
const DEFAULT_COL_WIDTHS: Record<ColKey, number> = { 
    sku_code: 140, 
    display_name: 200, 
    model: 180, 
    spec: 120, 
    action: 80 
};

function loadColWidths(): Record<ColKey, number> {
    try {
        const saved = localStorage.getItem(COL_WIDTHS_KEY);
        return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
    } catch {
        return { ...DEFAULT_COL_WIDTHS };
    }
}

interface ProductModel {
    id: number;
    name_zh: string;
}

interface ProductSku {
    id: number;
    model_id: number;
    sku_code: string;
    material_id?: string;
    display_name: string;
    display_name_en?: string;
    spec_label?: string;
    sku_image?: string;
    is_active: boolean;
    weight_kg?: number;
    volume_cum?: number;
    length_cm?: number;
    width_cm?: number;
    depth_cm?: number;
    is_dangerous_goods: boolean;
    upc?: string;
    sn_prefix?: string;
    created_at: string;
    // Joined fields
    name_zh?: string;
    brand?: string;
    model_code?: string;
    product_family?: string;
}

type ProductFamily = 'ALL' | 'A' | 'B' | 'C' | 'D' | 'E';

const PRODUCT_FAMILY_TABS: { key: ProductFamily; label: string }[] = [
    { key: 'ALL', label: '全部' },
    { key: 'A', label: '在售电影机' },
    { key: 'B', label: '广播摄像机' },
    { key: 'C', label: '电子寻像器' },
    { key: 'D', label: '历史产品' },
    { key: 'E', label: '通用配件' }
];

const ProductSkusManagement: React.FC = () => {
    const { token, user } = useAuthStore();
    const { t: _t } = useLanguage();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialModelId = searchParams.get('model_id');

    // State
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [models, setModels] = useState<ProductModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterModelId, _setFilterModelId] = useState<string>(initialModelId || 'ALL');
    const [filterFamily, setFilterFamily] = useState<ProductFamily>('ALL');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false); // 搜索框展开状态

    // Column widths & resize
    const [colWidths, setColWidths] = useState<Record<ColKey, number>>(loadColWidths);
    const resizingRef = useRef<{ col: ColKey; startX: number; startWidth: number } | null>(null);

    // Column sort state
    type SortKey = 'sku_code' | 'display_name' | 'model' | 'spec';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSku, setEditingSku] = useState<ProductSku | null>(null);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<ProductSku>>({
        model_id: initialModelId ? parseInt(initialModelId) : 0,
        sku_code: '',
        material_id: '',
        display_name: '',
        display_name_en: '',
        spec_label: '',
        sku_image: '',
        is_active: true,
        weight_kg: undefined,
        volume_cum: undefined,
        length_cm: undefined,
        width_cm: undefined,
        depth_cm: undefined,
        is_dangerous_goods: false,
        upc: '',
        
    });

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [skusRes, modelsRes] = await Promise.all([
                axios.get('/api/v1/admin/product-skus', {
                    params: {
                        model_id: filterModelId === 'ALL' ? undefined : filterModelId,
                        product_family: filterFamily === 'ALL' ? undefined : filterFamily,
                        keyword: searchQuery
                    },
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get('/api/v1/admin/product-models', {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            if (skusRes.data.success) setSkus(skusRes.data.data || []);
            if (modelsRes.data.success) setModels(modelsRes.data.data || []);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error('Failed to fetch data', err);
            setError(err.response?.data?.error?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token, filterModelId, filterFamily, searchQuery]);

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

    // Filter and sort SKUs
    const filteredAndSortedSkus = skus.sort((a, b) => {
        if (!sortConfig.key) return 0;
        const dir = sortConfig.dir === 'asc' ? 1 : -1;
        switch (sortConfig.key) {
            case 'sku_code':
                return (a.sku_code || '').localeCompare(b.sku_code || '') * dir;
            case 'display_name':
                return (a.display_name || '').localeCompare(b.display_name || '') * dir;
            case 'model':
                return (a.name_zh || '').localeCompare(b.name_zh || '') * dir;
            case 'spec':
                return (a.spec_label || '').localeCompare(b.spec_label || '') * dir;
            default:
                return 0;
        }
    });

    const handleOpenModal = (sku?: ProductSku) => {
        if (sku) {
            setEditingSku(sku);
            setFormData({
                model_id: sku.model_id,
                sku_code: sku.sku_code,
                material_id: sku.material_id || '',
                display_name: sku.display_name,
                display_name_en: sku.display_name_en || '',
                spec_label: sku.spec_label || '',
                sku_image: sku.sku_image || '',
                is_active: !!sku.is_active,
                weight_kg: sku.weight_kg,
                volume_cum: sku.volume_cum,
                length_cm: sku.length_cm,
                width_cm: sku.width_cm,
                depth_cm: sku.depth_cm,
                is_dangerous_goods: !!sku.is_dangerous_goods,
                upc: sku.upc || '',

            });
        } else {
            setEditingSku(null);
            setFormData({
                model_id: initialModelId ? parseInt(initialModelId) : (models[0]?.id || 0),
                sku_code: '',
                material_id: '',
                display_name: '',
                display_name_en: '',
                spec_label: '',
                sku_image: '',
                is_active: true,
                weight_kg: undefined,
                volume_cum: undefined,
                length_cm: undefined,
                width_cm: undefined,
                depth_cm: undefined,
                is_dangerous_goods: false,
                upc: '',

            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSku(null);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!formData.model_id || !formData.sku_code || !formData.display_name) {
            alert('请完整填写必填项');
            return;
        }
        setSaving(true);
        try {
            if (editingSku) {
                await axios.put(`/api/v1/admin/product-skus/${editingSku.id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/v1/admin/product-skus', formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            handleCloseModal();
            fetchData();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('type', 'product_photo');

        try {
            const res = await axios.post('/api/v1/upload', uploadData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.data.success) {
                setFormData(prev => ({ ...prev, sku_image: res.data.file.url }));
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error(err);
            alert('上传图片失败');
        }
    };

    const canManage = user?.role === 'Admin' || user?.role === 'Exec' ||
        (user?.role === 'Lead' && user?.department_code === 'MS');

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <style>{colResizeHandleStyle}</style>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={() => navigate(-1)}
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
                            {_t('sidebar.product_skus')}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                            {_t('product.sku_list')}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* 搜索框 - 点击Icon展开，参考图5设计 */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        {!isSearchExpanded ? (
                            <button
                                onClick={() => setIsSearchExpanded(true)}
                                style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', color: 'var(--text-secondary)'
                                }}
                            >
                                <Search size={18} />
                            </button>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input
                                    type="text"
                                    placeholder={_t('product.search_sku')}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    autoFocus
                                    style={{
                                        padding: '8px 12px', paddingLeft: '32px', borderRadius: 8, background: 'var(--glass-bg-hover)',
                                        border: '1px solid var(--glass-border)', color: 'var(--text-main)', width: 200, outline: 'none'
                                    }}
                                />
                                <button
                                    onClick={() => {
                                        setIsSearchExpanded(false);
                                        setSearchQuery('');
                                    }}
                                    style={{
                                        width: 32, height: 32, borderRadius: '50%',
                                        background: 'transparent', border: 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', color: 'var(--text-tertiary)'
                                    }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                        {isSearchExpanded && (
                            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, pointerEvents: 'none' }}>
                                <Search size={14} />
                            </div>
                        )}
                    </div>
                    {canManage && (
                        <button className="btn-kine-lowkey" onClick={() => handleOpenModal()}>
                            <Plus size={18} /> {_t('product.add_sku')}
                        </button>
                    )}
                </div>
            </div>

            {/* Product Family Tabs - 移到标题下方，与图1一致 */}
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
                    {PRODUCT_FAMILY_TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilterFamily(tab.key)}
                            style={{
                                padding: '0 16px', height: '30px',
                                background: filterFamily === tab.key ? 'var(--glass-bg-hover)' : 'transparent',
                                color: filterFamily === tab.key ? 'var(--text-main)' : 'var(--text-secondary)',
                                borderRadius: 6,
                                fontWeight: filterFamily === tab.key ? 500 : 400,
                                fontSize: '0.9rem',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                boxShadow: filterFamily === tab.key ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{ marginBottom: 16, padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, color: '#EF4444' }}>
                    <ImageIcon size={20} />
                    {error}
                </div>
            )}

            {/* SKU Table */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--glass-bg-light)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                            <th 
                                onClick={() => handleSort('sku_code')}
                                style={{ padding: '16px', color: sortConfig.key === 'sku_code' ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', width: colWidths.sku_code, position: 'relative' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    SKU编码
                                    {sortConfig.key === 'sku_code' ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                                </span>
                                <div onMouseDown={e => startColResize(e, 'sku_code')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                            </th>
                            <th 
                                onClick={() => handleSort('display_name')}
                                style={{ padding: '16px', color: sortConfig.key === 'display_name' ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', width: colWidths.display_name, position: 'relative' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    商品规格名称
                                    {sortConfig.key === 'display_name' ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                                </span>
                                <div onMouseDown={e => startColResize(e, 'display_name')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                            </th>
                            <th 
                                onClick={() => handleSort('model')}
                                style={{ padding: '16px', color: sortConfig.key === 'model' ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', width: colWidths.model, position: 'relative' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    所属型号
                                    {sortConfig.key === 'model' ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                                </span>
                                <div onMouseDown={e => startColResize(e, 'model')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                            </th>
                            <th 
                                onClick={() => handleSort('spec')}
                                style={{ padding: '16px', color: sortConfig.key === 'spec' ? 'var(--text-main)' : 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', width: colWidths.spec, position: 'relative' }}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    规格标签
                                    {sortConfig.key === 'spec' ? (sortConfig.dir === 'asc' ? ' ↑' : ' ↓') : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                                </span>
                                <div onMouseDown={e => startColResize(e, 'spec')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                            </th>
                            <th style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center', width: colWidths.action }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>{_t('product.loading')}</td></tr>
                        ) : filteredAndSortedSkus.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>{_t('product.no_records')}</td></tr>
                        ) : (
                            filteredAndSortedSkus.map(sku => (
                                <tr
                                    key={sku.id}
                                    className="row-hover"
                                    style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
                                    onClick={() => navigate(`/service/product-skus/${sku.id}`)}
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{sku.sku_code}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-main)', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                                                {sku.sku_image ? <img src={sku.sku_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={14} opacity={0.2} style={{ margin: '11px' }} />}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{sku.display_name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{sku.display_name_en}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{sku.name_zh}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{sku.model_code}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{ fontSize: '0.85rem', background: 'var(--glass-bg-hover)', padding: '2px 8px', borderRadius: 4 }}>
                                            {sku.spec_label || '标准'}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenModal(sku); }}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer' }}
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={handleCloseModal}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
                            zIndex: MODAL_Z_INDEX
                        }}
                    />
                    {/* Modal Container */}
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 800, maxHeight: '85vh', background: 'var(--modal-bg)', borderRadius: 16,
                        boxShadow: 'var(--glass-shadow-lg)', border: '1px solid var(--glass-border)',
                        display: 'flex', flexDirection: 'column', zIndex: MODAL_Z_INDEX + 1,
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            flexShrink: 0
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: editingSku ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {editingSku ? <Edit2 size={22} color="#3B82F6" /> : <Plus size={22} color="#10B981" />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-main)' }}>
                                        {editingSku ? '编辑SKU' : '添加SKU'}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                                        {editingSku ? formData.display_name || '修改商品规格' : '创建新的商品规格'}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleCloseModal} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Body - 左右分栏布局 */}
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            {/* 左侧：基本信息表单 */}
                            <div className="custom-scroll" style={{ flex: 1, padding: 24, overflowY: 'auto', borderRight: '1px solid var(--glass-border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* 所属型号 - 关键关联 */}
                                    <div style={{ 
                                        padding: 20, background: 'var(--glass-bg-light)', borderRadius: 12, border: '1px solid var(--glass-border)'
                                    }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 12, display: 'block' }}>
                                            所属产品型号 * <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>(SKU必须关联到一个产品型号)</span>
                                        </label>
                                        <select
                                            value={formData.model_id}
                                            onChange={e => setFormData({ ...formData, model_id: parseInt(e.target.value) })}
                                            style={{ 
                                                width: '100%', padding: '12px', borderRadius: 8, 
                                                background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', 
                                                color: 'var(--text-main)', fontSize: '0.95rem'
                                            }}
                                        >
                                            {models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name_zh}</option>
                                            ))}
                                        </select>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
                                            产品型号定义了SKU的基础硬件特征。修改型号将影响所有关联此SKU的设备台账。
                                        </p>
                                    </div>

                                    {/* SKU代码和物料号 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                {_t('product.sku_id')} *
                                            </label>
                                            <input
                                                type="text" value={formData.sku_code}
                                                onChange={e => setFormData({ ...formData, sku_code: e.target.value.toUpperCase() })}
                                                style={{ 
                                                    padding: '10px 12px', borderRadius: 8, 
                                                    background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', 
                                                    color: 'var(--text-main)', fontSize: '0.9rem' 
                                                }}
                                                placeholder="例: A010-001-01"
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                {_t('product.material_id')}
                                            </label>
                                            <input
                                                type="text" value={formData.material_id}
                                                onChange={e => setFormData({ ...formData, material_id: e.target.value })}
                                                style={{ 
                                                    padding: '10px 12px', borderRadius: 8, 
                                                    background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', 
                                                    color: 'var(--text-main)', fontSize: '0.9rem' 
                                                }}
                                                placeholder="例: 9-010-001-01"
                                            />
                                        </div>
                                    </div>

                                    {/* 显示名称 */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            {_t('common.name')} *
                                        </label>
                                        <input
                                            type="text" value={formData.display_name}
                                            onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                                            style={{ 
                                                padding: '10px 12px', borderRadius: 8, 
                                                background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', 
                                                color: 'var(--text-main)', fontSize: '0.9rem' 
                                            }}
                                            placeholder="例如: MAVO Edge 8K 标准套装"
                                        />
                                    </div>

                                    {/* 规格标签 */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            规格标签
                                        </label>
                                        <input
                                            type="text" value={formData.spec_label}
                                            onChange={e => setFormData({ ...formData, spec_label: e.target.value })}
                                            placeholder="例: RF Mount, Professional Kit"
                                            style={{ 
                                                padding: '10px 12px', borderRadius: 8, 
                                                background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', 
                                                color: 'var(--text-main)', fontSize: '0.9rem' 
                                            }}
                                        />
                                    </div>

                                    {/* 物理属性 - 新增 */}
                                    <div style={{ padding: 16, background: 'var(--glass-bg-hover)', borderRadius: 12, border: '1px solid var(--glass-border)', marginTop: 8 }}>
                                        <h5 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>物理属性 (Physical Attributes)</h5>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>重量 (kg)</label>
                                                <input
                                                    type="number" step="0.001" value={formData.weight_kg ?? ''}
                                                    onChange={e => setFormData({ ...formData, weight_kg: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>体积 (m³)</label>
                                                <input
                                                    type="number" step="0.000001" value={formData.volume_cum ?? ''}
                                                    onChange={e => setFormData({ ...formData, volume_cum: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>外箱尺寸 (L x W x D cm)</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                                <input
                                                    type="number" placeholder="L" value={formData.length_cm ?? ''}
                                                    onChange={e => setFormData({ ...formData, length_cm: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                                <input
                                                    type="number" placeholder="W" value={formData.width_cm ?? ''}
                                                    onChange={e => setFormData({ ...formData, width_cm: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                                <input
                                                    type="number" placeholder="D" value={formData.depth_cm ?? ''}
                                                    onChange={e => setFormData({ ...formData, depth_cm: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* 业务标识 - 新增 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>UPC 条码</label>
                                            <input
                                                type="text" value={formData.upc || ''}
                                                onChange={e => setFormData({ ...formData, upc: e.target.value })}
                                                placeholder="Universal Product Code"
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                            />
                                        </div>

                                    </div>
                                </div>
                            </div>

                            {/* 右侧：图片和状态 */}
                            <div style={{ width: 280, padding: 24, overflowY: 'auto', background: 'var(--glass-bg-light)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)', fontWeight: 600 }}>SKU图片</h4>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{ 
                                                width: '100%', aspectRatio: '1/1', borderRadius: 12, 
                                                border: '2px dashed var(--glass-border)', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                cursor: 'pointer', overflow: 'hidden', background: 'var(--glass-bg)'
                                            }}
                                        >
                                            {formData.sku_image ? (
                                                <img src={formData.sku_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <Plus size={32} opacity={0.3} />
                                            )}
                                        </div>
                                        <input type="file" ref={fileInputRef} hidden onChange={handleUploadImage} />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                            {_t('product.image_hint')}
                                        </p>
                                        {formData.sku_image && (
                                            <button 
                                                onClick={() => setFormData({ ...formData, sku_image: '' })}
                                                style={{ fontSize: '0.75rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                移除图片
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ 
                                        padding: 16, background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                            <input
                                                type="checkbox" id="sku_active_modal" checked={formData.is_active}
                                                onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                                style={{ width: 18, height: 18, accentColor: '#10B981' }}
                                            />
                                            <label htmlFor="sku_active_modal" style={{ fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                                                {_t('product.on_sale')}
                                            </label>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <input
                                                type="checkbox" id="sku_dangerous_modal" checked={formData.is_dangerous_goods}
                                                onChange={e => setFormData({ ...formData, is_dangerous_goods: e.target.checked })}
                                                style={{ width: 18, height: 18, accentColor: '#EF4444' }}
                                            />
                                            <label htmlFor="sku_dangerous_modal" style={{ fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                                                危险品 (Dangerous Goods)
                                            </label>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 8, marginLeft: 30 }}>
                                            危险品标识将影响物流运输处理和仓储规范。
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ 
                            padding: '16px 24px', borderTop: '1px solid var(--glass-border)', 
                            display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 
                        }}>
                            <button
                                onClick={handleCloseModal}
                                style={{
                                    padding: '10px 20px', borderRadius: 10, fontWeight: 600,
                                    background: 'transparent', color: 'var(--text-secondary)',
                                    border: '1px solid var(--glass-border)',
                                    cursor: 'pointer', fontSize: '0.88rem'
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                style={{
                                    padding: '10px 24px', borderRadius: 10, fontWeight: 600,
                                    background: 'var(--accent-blue)', color: '#000',
                                    border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '0.88rem',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    opacity: saving ? 0.7 : 1
                                }}
                            >
                                {saving ? _t('product.saving') : (editingSku ? <><Save size={15} /> {_t('action.save')}</> : <><Plus size={15} /> {_t('action.create')}</>)}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductSkusManagement;
