import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import {
    Search, Plus, Layers, MoreHorizontal,
    Edit2, AlertCircle, X, Save, ArrowLeft, Package
} from 'lucide-react';

// Top bar height constant for drawer positioning
const TOP_BAR_HEIGHT = 64;

// Types - Product Model (Product Line definition)
interface ProductModel {
    id: number;
    name_zh: string;
    name_en?: string;
    brand?: string;
    model_code?: string;
    material_id_prefix?: string;
    product_family: 'A' | 'B' | 'C' | 'D';
    product_type: string;
    description: string;
    hero_image?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Stats
    instance_count: number;
    sku_count: number;
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
    created_at: string;
}

const PRODUCT_FAMILY_MAP = {
    'A': { code: 'A', name: 'Current Cine Cameras', label: '在售电影机', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
    'B': { code: 'B', name: 'Archived Cine Cameras', label: '历史机型', color: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
    'C': { code: 'C', name: 'Eagle e-Viewfinder', label: '电子寻像器', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    'D': { code: 'D', name: 'Universal Accessories', label: '通用配件', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' }
};

const PRODUCT_TYPE_OPTIONS = [
    { value: 'CAMERA', label: 'product.type.CAMERA' },
    { value: 'VIEWFINDER', label: 'product.type.VIEWFINDER' },
    { value: 'LENS', label: 'product.type.LENS' },
    { value: 'BATTERY', label: 'product.type.BATTERY' },
    { value: 'CHARGER', label: 'product.type.CHARGER' },
    { value: 'CABLE', label: 'product.type.CABLE' },
    { value: 'MOUNT', label: 'product.type.MOUNT' },
    { value: 'MONITOR', label: 'product.type.MONITOR' },
    { value: 'STORAGE', label: 'product.type.STORAGE' },
    { value: 'ACCESSORY', label: 'product.type.ACCESSORY' },
    { value: 'OTHER', label: 'product.type.OTHER' }
];

type ProductFamily = 'ALL' | 'A' | 'B' | 'C' | 'D';

const ProductModelsManagement: React.FC = () => {
    const { t: _t } = useLanguage();
    const { token, user } = useAuthStore();
    const navigate = useNavigate();

    // State
    const [productFamily, setProductFamily] = useState<ProductFamily>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [productModels, setProductModels] = useState<ProductModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Drawer State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingModel, setEditingModel] = useState<ProductModel | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<ProductModel | null>(null);
    const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState(false);

    // More dropdown state
    const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
    const moreDropdownRef = useRef<HTMLDivElement>(null);

    // Search expand state
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // SKU list for right panel
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [loadingSkus, setLoadingSkus] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<ProductModel>>({
        name_zh: '',
        name_en: '',
        brand: 'Kinefinity',
        model_code: '',
        material_id_prefix: '',
        product_family: 'A',
        product_type: 'CAMERA',
        description: '',
        hero_image: '',
        is_active: true
    });

    const fetchProductModels = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`/api/v1/admin/product-models`, {
                params: {
                    product_family: productFamily === 'ALL' ? undefined : productFamily,
                    keyword: searchQuery
                },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProductModels(res.data.data || []);
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error('Failed to fetch product models', err);
            setError(err.response?.data?.error?.message || 'Failed to fetch product models');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchProductModels();
    }, [token, productFamily, searchQuery]);

    // Click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
                setIsMoreDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleOpenDrawer = (model?: ProductModel) => {
        if (model) {
            setEditingModel(model);
            setFormData({
                name_zh: model.name_zh,
                name_en: model.name_en || '',
                brand: model.brand || 'Kinefinity',
                model_code: model.model_code || '',
                material_id_prefix: model.material_id_prefix || '',
                product_family: model.product_family,
                product_type: model.product_type,
                description: model.description || '',
                hero_image: model.hero_image || '',
                is_active: !!model.is_active
            });
            fetchSkus(model.id);
        } else {
            setEditingModel(null);
            setFormData({
                name_zh: '',
                name_en: '',
                brand: 'Kinefinity',
                model_code: '',
                material_id_prefix: '',
                product_family: 'A',
                product_type: 'CAMERA',
                description: '',
                hero_image: '',
                is_active: true
            });
            setSkus([]);
        }
        setIsDrawerOpen(true);
    };

    const fetchSkus = async (modelId: number) => {
        setLoadingSkus(true);
        try {
            const res = await axios.get(`/api/v1/admin/product-models/${modelId}/skus`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setSkus(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch SKUs', err);
        } finally {
            setLoadingSkus(false);
        }
    };

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('type', 'product_photo'); // Based on modified upload.js

        try {
            const res = await axios.post('/api/v1/upload', formDataUpload, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.data.success) {
                setFormData(prev => ({ ...prev, hero_image: res.data.file.url }));
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            alert('上传图片失败: ' + (err.response?.data?.error?.message || err.message));
        }
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setEditingModel(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingModel) {
                await axios.put(`/api/v1/admin/product-models/${editingModel.id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`/api/v1/admin/product-models`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            handleCloseDrawer();
            fetchProductModels();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error('Failed to save product model', err);
            alert(err.response?.data?.error?.message || 'Failed to save product model');
        } finally {
            setSaving(false);
        }
    };

    const handleCloseDeleteDrawer = () => {
        setIsDeleteDrawerOpen(false);
        setDeleteConfirm(null);
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setSaving(true);
        try {
            await axios.delete(`/api/v1/admin/product-models/${deleteConfirm.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            handleCloseDeleteDrawer();
            fetchProductModels();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error('Failed to delete product model', err);
            alert(err.response?.data?.error?.message || 'Failed to delete product model');
        } finally {
            setSaving(false);
        }
    };

    // Permission check - only MS Lead, Exec, or Admin can manage product models
    const canManage = user?.role === 'Admin' || user?.role === 'Exec' ||
        (user?.role === 'Lead' && user?.department_code === 'MS');

    const familyTabs: { key: ProductFamily; label: string }[] = [
        { key: 'ALL', label: '全部' },
        { key: 'A', label: '在售电影机' },
        { key: 'B', label: '历史机型' },
        { key: 'C', label: '电子寻像器' },
        { key: 'D', label: '通用配件' }
    ];

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                            <Layers size={28} color="#FFD700" />
                            产品目录
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                            管理产品型号定义、规格参数及配件兼容性
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Search */}
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
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="搜索型号..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onBlur={() => { if (!searchQuery) setIsSearchExpanded(false); }}
                                style={{
                                    flex: 1, background: 'transparent', border: 'none',
                                    color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none', padding: '0 8px'
                                }}
                            />
                        )}
                    </div>
                    {canManage && (
                        <button className="btn-kine-lowkey" onClick={() => handleOpenDrawer()}>
                            <Plus size={18} /> 添加型号
                        </button>
                    )}
                    {/* More Dropdown - Circular Button */}
                    <div ref={moreDropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                            style={{
                                width: 40, height: 40, borderRadius: '50%',
                                background: 'var(--glass-bg-hover)', border: '1.5px solid var(--glass-border)',
                                color: 'var(--text-secondary)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                        >
                            <MoreHorizontal size={20} />
                        </button>
                        {isMoreDropdownOpen && (
                            <>
                                <div
                                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                                    onClick={() => setIsMoreDropdownOpen(false)}
                                />
                                <div style={{
                                    position: 'absolute', top: '100%', right: 0, marginTop: 4,
                                    background: 'var(--bg-sidebar)', border: '1px solid var(--glass-border)',
                                    borderRadius: 8, padding: '4px 0', minWidth: 140, zIndex: 100,
                                    boxShadow: '0 8px 32px var(--glass-shadow)'
                                }}>
                                    <div style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>
                                        查看列表
                                    </div>
                                    <button
                                        onClick={() => { setIsMoreDropdownOpen(false); }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            width: '100%', padding: '10px 12px', background: 'transparent',
                                            border: 'none', color: 'var(--text-main)', fontSize: '0.9rem',
                                            cursor: 'pointer', textAlign: 'left'
                                        }}
                                    >
                                        全部型号
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Family Filter Tabs - macOS26 Segmented Control Style */}
            <div style={{ marginBottom: 20 }}>
                <div className="tabs" style={{
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
                    {familyTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setProductFamily(tab.key)}
                            style={{
                                padding: '0 16px', height: '30px',
                                background: productFamily === tab.key ? 'var(--glass-bg-hover)' : 'transparent',
                                color: productFamily === tab.key ? 'var(--text-main)' : 'var(--text-secondary)',
                                borderRadius: 6,
                                fontWeight: productFamily === tab.key ? 500 : 400,
                                fontSize: '0.9rem',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                display: 'flex',
                                alignItems: 'center',
                                boxShadow: productFamily === tab.key ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'
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
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Product Models List */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--glass-bg-light)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>{_t('product.model_code')}</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>{_t('product.model_name_zh')}</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>型号特征</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>族群/类型</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>SKU/实例</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>状态</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center' }}>Loading...</td></tr>
                        ) : productModels.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                    <Layers size={48} opacity={0.3} />
                                    <span>暂无产品型号数据</span>
                                </div>
                            </td></tr>
                        ) : (
                            productModels.map((model) => (
                                <tr
                                    key={model.id}
                                    className="row-hover"
                                    style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
                                    onClick={() => navigate(`/service/product-models/${model.id}`)}
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 40, height: 40, borderRadius: 8,
                                                background: 'var(--glass-bg-hover)',
                                                overflow: 'hidden', border: '1px solid var(--glass-border)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0
                                            }}>
                                                {model.hero_image ? (
                                                    <img src={model.hero_image} alt={model.name_zh} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <Layers size={18} opacity={0.3} />
                                                )}
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--accent-blue)', fontVariantNumeric: 'tabular-nums' }}>
                                                {model.model_code}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{model.name_zh}</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{model.name_en || '-'}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{model.brand}</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{model.material_id_prefix ? `${_t('product.material_id_prefix')}: ${model.material_id_prefix}` : '-'}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${PRODUCT_FAMILY_MAP[model.product_family]?.color || 'bg-gray-500/10 text-gray-400'}`} style={{ marginBottom: 4 }}>
                                            {model.product_family}{_t('product.series')}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                                            {_t(PRODUCT_TYPE_OPTIONS.find(t => t.value === model.product_type)?.label || model.product_type)}
                                        </div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{model.sku_count || 0} {_t('product.sku_count_label')}</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{model.instance_count || 0} {_t('product.instances')}</div>
                                    </td>
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        <span style={{
                                            fontSize: '0.75rem', padding: '3px 8px', borderRadius: 6,
                                            background: model.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                                            color: model.is_active ? '#10B981' : '#9CA3AF',
                                            border: `1px solid ${model.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(107,114,128,0.2)'}`
                                        }}>
                                            {model.is_active ? _t('product.active') : _t('product.inactive')}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        {canManage && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenDrawer(model); }}
                                                title="编辑"
                                                style={{
                                                    background: 'transparent', border: 'none', padding: 8,
                                                    color: 'var(--accent-blue)', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s', borderRadius: 6, margin: '0 auto'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.1)'}
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

            {/* Add/Edit Modal - 居中弹窗 */}
            {isDrawerOpen && (
                <>
                    <div
                        onClick={handleCloseDrawer}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
                            zIndex: 9999
                        }}
                    />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: editingModel ? 900 : 520, maxHeight: '85vh',
                        background: 'var(--modal-bg)', borderRadius: 16,
                        boxShadow: 'var(--glass-shadow-lg)', border: '1px solid var(--glass-border)',
                        display: 'flex', flexDirection: 'column', zIndex: 10000,
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
                                    background: editingModel ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {editingModel ? <Edit2 size={22} color="#3B82F6" /> : <Plus size={22} color="#10B981" />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-main)' }}>
                                        {editingModel ? '编辑产品型号' : '添加产品型号'}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                                        {editingModel ? formData.name_zh : '创建新的产品型号定义'}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleCloseDrawer} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Body - 左右分栏布局 */}
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            {/* 左侧 - 基本信息 */}
                            <div className="custom-scroll" style={{ flex: 1, padding: 24, overflowY: 'auto', borderRight: editingModel ? '1px solid var(--glass-border)' : 'none' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* Hero Image Section */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.image')}</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                style={{
                                                    width: 100, height: 100, borderRadius: 12, background: 'var(--glass-bg-hover)', border: '2px dashed var(--glass-border)',
                                                    cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    position: 'relative'
                                                }}
                                            >
                                                {formData.hero_image ? (
                                                    <img src={formData.hero_image} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <Plus size={24} opacity={0.3} />
                                                )}
                                                <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleUploadImage} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 8 }}>
                                                    建议尺寸: 800x600, 支持 JPG/PNG/WEBP.
                                                </p>
                                                {formData.hero_image && (
                                                    <button onClick={() => setFormData(p => ({ ...p, hero_image: '' }))} style={{ fontSize: '0.75rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                        移除图片
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.model_name_zh')} <span style={{ color: '#EF4444' }}>*</span></label>
                                            <input
                                                type="text" required value={formData.name_zh}
                                                onChange={(e) => setFormData({ ...formData, name_zh: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder={_t('product.name_zh_hint')}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.model_name_en')}</label>
                                            <input
                                                type="text" value={formData.name_en || ''}
                                                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder="Model Name (EN)"
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.model_code')} <span style={{ color: '#EF4444' }}>*</span></label>
                                            <input
                                                type="text" required value={formData.model_code}
                                                onChange={(e) => setFormData({ ...formData, model_code: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder={_t('product.model_code_hint')}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.material_id_prefix')}</label>
                                            <input
                                                type="text" value={formData.material_id_prefix || ''}
                                                onChange={(e) => setFormData({ ...formData, material_id_prefix: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder={_t('product.material_id_hint')}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('parts.category')} <span style={{ color: '#EF4444' }}>*</span></label>
                                            <select
                                                required value={formData.product_family}
                                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                onChange={(e) => setFormData({ ...formData, product_family: e.target.value as any })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                            >
                                                {Object.entries(PRODUCT_FAMILY_MAP).map(([code, info]) => (
                                                    <option key={code} value={code}>{code} - {info.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('customer.type.internal')} <span style={{ color: '#EF4444' }}>*</span></label>
                                            <select
                                                required value={formData.product_type}
                                                onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                            >
                                                {PRODUCT_TYPE_OPTIONS.map((type) => (
                                                    <option key={type.value} value={type.value}>{_t(type.label)}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.brand')}</label>
                                        <input
                                            type="text" value={formData.brand || 'Kinefinity'}
                                            onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.description')}</label>
                                        <textarea
                                            value={formData.description || ''}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows={2}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', resize: 'none' }}
                                            placeholder={_t('product.description_hint')}
                                        />
                                    </div>
                                    {/* 状态设置已移除 - 移动到右上角更多菜单 */}
                                </div>
                            </div>
                            
                            {/* 右侧 - SKU体系（仅在编辑时显示） */}
                            {editingModel && (
                                <div className="custom-scroll" style={{ width: 320, padding: 24, background: 'var(--glass-bg-light)', overflowY: 'auto' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)', fontWeight: 600 }}>SKU体系</h4>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{skus.length} 个SKU</span>
                                        </div>

                                        {loadingSkus ? (
                                            <div style={{ textAlign: 'center', padding: 20, opacity: 0.5 }}>{_t('product.loading')}</div>
                                        ) : skus.length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: 32, background: 'var(--glass-bg)', borderRadius: 12, border: '1px dashed var(--glass-border)' }}>
                                                <Package size={32} opacity={0.2} style={{ margin: '0 auto 8px' }} />
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>暂无SKU</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {skus.map(sku => (
                                                    <div
                                                        key={sku.id}
                                                        onClick={() => navigate(`/service/product-skus/${sku.id}`)}
                                                        style={{
                                                            padding: 12, background: 'var(--glass-bg)', borderRadius: 10, border: '1px solid var(--glass-border)',
                                                            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                                                            transition: 'all 0.15s'
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                                                    >
                                                        <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            {sku.sku_image ? (
                                                                <img src={sku.sku_image} alt={sku.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <Package size={14} opacity={0.3} />
                                                            )}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sku.display_name}</div>
                                                            <div style={{ fontSize: '0.7rem', opacity: 0.6, fontFamily: 'monospace' }}>{sku.sku_code}</div>
                                                        </div>
                                                        {!sku.is_active && (
                                                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF', background: 'rgba(107,114,128,0.1)', padding: '2px 5px', borderRadius: 4 }}>下架</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        <button
                                            className="btn-kine-lowkey"
                                            style={{ padding: '8px 12px', fontSize: '0.8rem', marginTop: 8 }}
                                            onClick={() => navigate('/admin/product-skus')}
                                        >
                                            <Plus size={14} style={{ marginRight: 6 }} /> 管理SKU
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
                            <button
                                onClick={handleCloseDrawer}
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
                                {editingModel
                                    ? <><Save size={15} /> {saving ? _t('product.saving') : _t('action.save')}</>
                                    : <><Plus size={15} /> {saving ? _t('product.saving') : _t('action.create')}</>
                                }
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Delete Confirmation Drawer */}
            {isDeleteDrawerOpen && deleteConfirm && (
                <>
                    <div
                        onClick={handleCloseDeleteDrawer}
                        style={{
                            position: 'fixed', top: TOP_BAR_HEIGHT, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.6)', zIndex: 1000
                        }}
                    />
                    <div style={{
                        position: 'fixed', top: TOP_BAR_HEIGHT, right: 0, bottom: 0, width: 400,
                        background: '#0a0a0a', borderLeft: '1px solid var(--glass-border)',
                        zIndex: 1001, display: 'flex', flexDirection: 'column',
                        boxShadow: '-8px 0 32px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ padding: 8, background: 'rgba(239,68,68,0.2)', borderRadius: '50%' }}>
                                    <AlertCircle size={18} color="#EF4444" />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                                    确认删除
                                </span>
                            </div>
                            <button onClick={handleCloseDeleteDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, padding: 24 }}>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                确定要删除产品型号 <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{deleteConfirm.name_zh}</span> 吗？
                                {deleteConfirm.instance_count > 0 && (
                                    <span style={{ display: 'block', marginTop: 12, color: '#EF4444' }}>
                                        注意：此型号有 {deleteConfirm.instance_count} 个实例，无法删除。
                                    </span>
                                )}
                            </p>
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 12 }}>
                            <button
                                onClick={handleCloseDeleteDrawer}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: 10, fontWeight: 600,
                                    background: 'transparent', color: 'var(--text-secondary)',
                                    border: '1px solid var(--glass-border)',
                                    cursor: 'pointer', fontSize: '0.88rem'
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={saving || deleteConfirm.instance_count > 0}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: 10, fontWeight: 600,
                                    background: '#EF4444', color: '#fff',
                                    border: 'none', cursor: saving || deleteConfirm.instance_count > 0 ? 'not-allowed' : 'pointer',
                                    fontSize: '0.88rem',
                                    opacity: saving || deleteConfirm.instance_count > 0 ? 0.5 : 1
                                }}
                            >
                                {saving ? '删除中...' : '删除'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductModelsManagement;
