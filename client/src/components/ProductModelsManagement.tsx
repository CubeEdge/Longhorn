import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import {
    Search, Plus, Layers, MoreHorizontal,
    Edit2, AlertCircle, X, Save, Trash2, ArrowLeft
} from 'lucide-react';

// Top bar height constant for drawer positioning
const TOP_BAR_HEIGHT = 64;

// Types - Product Model (Product Line definition)
interface ProductModel {
    id: number;
    model_name: string;
    internal_name: string;
    product_family: 'A' | 'B' | 'C' | 'D';
    product_type: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    // Stats
    instance_count: number;
}

const PRODUCT_FAMILY_MAP = {
    'A': { code: 'A', name: 'Current Cine Cameras', label: '在售电影机', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
    'B': { code: 'B', name: 'Archived Cine Cameras', label: '历史机型', color: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
    'C': { code: 'C', name: 'Eagle e-Viewfinder', label: '电子寻像器', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    'D': { code: 'D', name: 'Universal Accessories', label: '通用配件', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' }
};

const PRODUCT_TYPE_OPTIONS = [
    { value: 'CAMERA', label: '摄影机' },
    { value: 'VIEWFINDER', label: '寻像器' },
    { value: 'LENS', label: '镜头' },
    { value: 'BATTERY', label: '电池' },
    { value: 'CHARGER', label: '充电器' },
    { value: 'CABLE', label: '线缆' },
    { value: 'MOUNT', label: '卡口/转接环' },
    { value: 'MONITOR', label: '监视器' },
    { value: 'STORAGE', label: '存储介质' },
    { value: 'ACCESSORY', label: '配件/其他' }
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

    // Form State
    const [formData, setFormData] = useState<Partial<ProductModel>>({
        model_name: '',
        internal_name: '',
        product_family: 'A',
        product_type: 'CAMERA',
        description: '',
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
                model_name: model.model_name,
                internal_name: model.internal_name,
                product_family: model.product_family,
                product_type: model.product_type,
                description: model.description,
                is_active: model.is_active
            });
        } else {
            setEditingModel(null);
            setFormData({
                model_name: '',
                internal_name: '',
                product_family: 'A',
                product_type: 'CAMERA',
                description: '',
                is_active: true
            });
        }
        setIsDrawerOpen(true);
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
        } catch (err: any) {
            console.error('Failed to save product model', err);
            alert(err.response?.data?.error?.message || 'Failed to save product model');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (model: ProductModel) => {
        setDeleteConfirm(model);
        setIsDeleteDrawerOpen(true);
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
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>型号名称</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>内部名称</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>族群</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>类型</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>实例数</th>
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
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{model.model_name}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{model.internal_name || '-'}</span>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRODUCT_FAMILY_MAP[model.product_family]?.color || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}>
                                            {PRODUCT_FAMILY_MAP[model.product_family]?.label || model.product_family}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                                            {PRODUCT_TYPE_OPTIONS.find(t => t.value === model.product_type)?.label || model.product_type}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{model.instance_count || 0}</span>
                                    </td>
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        <span style={{
                                            fontSize: '0.8rem', padding: '4px 10px', borderRadius: 12,
                                            background: model.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(107,114,128,0.15)',
                                            color: model.is_active ? '#10B981' : '#9CA3AF'
                                        }}>
                                            {model.is_active ? '启用' : '停用'}
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

            {/* Add/Edit Drawer */}
            {isDrawerOpen && (
                <>
                    <div
                        onClick={handleCloseDrawer}
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
                        {/* Drawer Header */}
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {editingModel ? <Edit2 size={18} color="#3B82F6" /> : <Plus size={18} color="#3B82F6" />}
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                                    {editingModel ? '编辑型号' : '添加型号'}
                                </span>
                            </div>
                            <button onClick={handleCloseDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    型号名称 <span style={{ color: '#EF4444' }}>*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.model_name}
                                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                    placeholder="例如: MAVO Edge 8K"
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    内部名称
                                </label>
                                <input
                                    type="text"
                                    value={formData.internal_name || ''}
                                    onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                    placeholder="例如: MAVO Edge 8K (内部代号)"
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    产品族群 <span style={{ color: '#EF4444' }}>*</span>
                                </label>
                                <select
                                    required
                                    value={formData.product_family}
                                    onChange={(e) => setFormData({ ...formData, product_family: e.target.value as 'A' | 'B' | 'C' | 'D' })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                >
                                    {Object.entries(PRODUCT_FAMILY_MAP).map(([code, info]) => (
                                        <option key={code} value={code}>{code} - {info.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    产品类型 <span style={{ color: '#EF4444' }}>*</span>
                                </label>
                                <select
                                    required
                                    value={formData.product_type}
                                    onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                >
                                    {PRODUCT_TYPE_OPTIONS.map((type) => (
                                        <option key={type.value} value={type.value}>{type.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    描述
                                </label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', resize: 'none' }}
                                    placeholder="产品型号描述..."
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', background: 'var(--glass-bg-light)', borderRadius: 8 }}>
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    style={{ width: 18, height: 18, accentColor: '#10B981' }}
                                />
                                <label htmlFor="is_active" style={{ fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                                    启用此型号
                                </label>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {editingModel && (
                                <button
                                    onClick={() => handleDeleteClick(editingModel)}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: 10, fontWeight: 600,
                                        background: 'rgba(239,68,68,0.08)', color: '#EF4444',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        cursor: 'pointer', fontSize: '0.88rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                    }}
                                >
                                    <Trash2 size={15} /> 删除型号
                                </button>
                            )}
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                style={{
                                    width: '100%', padding: '10px', borderRadius: 10, fontWeight: 600,
                                    background: 'var(--accent-blue)', color: '#000',
                                    border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '0.88rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    opacity: saving ? 0.7 : 1
                                }}
                            >
                                {editingModel
                                    ? <><Save size={15} /> {saving ? '保存中...' : '保存更改'}</>
                                    : <><Plus size={15} /> {saving ? '创建中...' : '创建型号'}</>
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
                                确定要删除产品型号 <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{deleteConfirm.model_name}</span> 吗？
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
