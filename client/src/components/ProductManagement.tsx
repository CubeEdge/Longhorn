import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import { Search, Plus, Package, ChevronUp, ChevronDown, MoreHorizontal, Edit2, AlertCircle } from 'lucide-react';

// Types
interface Product {
    id: number;
    model_name: string;
    internal_name: string;
    product_family: 'A' | 'B' | 'C' | 'D';
    firmware_version: string;
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    inquiry_count: number;
    rma_count: number;
    repair_count: number;
    ticket_count: number;
}

const PRODUCT_FAMILY_MAP = {
    'A': { code: 'A', name: 'Current Cine Cameras', label: '在售电影机', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
    'B': { code: 'B', name: 'Archived Cine Cameras', label: '历史机型', color: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
    'C': { code: 'C', name: 'Eagle e-Viewfinder', label: '电子寻像器', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    'D': { code: 'D', name: 'Universal Accessories', label: '通用配件', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' }
};

type ProductFamily = 'ALL' | 'A' | 'B' | 'C' | 'D';

const ProductManagement: React.FC = () => {
    const { t } = useLanguage();
    const { token, user } = useAuthStore();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // State from URL
    const productFamily = (searchParams.get('family') || 'ALL') as ProductFamily;
    const searchQuery = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const sortBy = searchParams.get('sort_by') || 'model_name';
    const sortOrder = (searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';
    const statusFilter = searchParams.get('status') || 'active';

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // More dropdown state
    const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
    const moreDropdownRef = useRef<HTMLDivElement>(null);

    // Search expand state
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Product>>({
        model_name: '',
        internal_name: '',
        product_family: 'A',
        firmware_version: '',
        description: '',
        is_active: true
    });

    const updateParams = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        setSearchParams({ ...current, ...newParams });
    };

    const setProductFamily = (family: ProductFamily) => {
        updateParams({ family, page: '1' });
    };

    const setSearchQuery = (q: string) => {
        updateParams({ q, page: '1' });
    };

    const setPage = (p: number) => {
        updateParams({ page: p.toString() });
    };

    const handleSort = (field: string) => {
        const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
        updateParams({ sort_by: field, sort_order: newOrder, page: '1' });
    };

    const setStatusFilter = (status: string) => {
        updateParams({ status, page: '1' });
        setIsMoreDropdownOpen(false);
    };

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`/api/v1/admin/products`, {
                params: {
                    product_family: productFamily === 'ALL' ? undefined : productFamily,
                    keyword: searchQuery,
                    page,
                    page_size: 20,
                    sort_by: sortBy,
                    sort_order: sortOrder,
                    status: statusFilter
                },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProducts(res.data.data);
                setTotal(res.data.meta.total);
            }
        } catch (err: any) {
            console.error('Failed to fetch products', err);
            setError(err.response?.data?.error?.message || 'Failed to fetch products');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchProducts();
    }, [token, productFamily, page, searchQuery, sortBy, sortOrder, statusFilter]);

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

    const handleOpenModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                model_name: product.model_name,
                internal_name: product.internal_name,
                product_family: product.product_family,
                firmware_version: product.firmware_version,
                description: product.description,
                is_active: product.is_active
            });
        } else {
            setEditingProduct(null);
            setFormData({
                model_name: '',
                internal_name: '',
                product_family: 'A',
                firmware_version: '',
                description: '',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingProduct(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingProduct) {
                await axios.put(`/api/v1/admin/products/${editingProduct.id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`/api/v1/admin/products`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            handleCloseModal();
            fetchProducts();
        } catch (err: any) {
            console.error('Failed to save product', err);
            alert(err.response?.data?.error?.message || 'Failed to save product');
        } finally {
            setSaving(false);
        }
    };

    // const handleDelete = async (product: Product) => {
    //     setDeleteConfirm(product);
    // };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setDeleteLoading(true);
        try {
            await axios.delete(`/api/v1/admin/products/${deleteConfirm.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDeleteConfirm(null);
            fetchProducts();
        } catch (err: any) {
            console.error('Failed to delete product', err);
            alert(err.response?.data?.error?.message || 'Failed to delete product');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Check if user has admin access
    const canManage = user?.role === 'Admin' || user?.role === 'Lead';

    // Family tabs configuration
    const familyTabs: { key: ProductFamily; label: string }[] = [
        { key: 'ALL', label: '全部' },
        { key: 'A', label: '在售电影机' },
        { key: 'B', label: '历史机型' },
        { key: 'C', label: '电子寻像器' },
        { key: 'D', label: '通用配件' }
    ];

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header - macOS26 Style */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Package size={28} color="#FFD700" />
                        产品管理
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{t('admin.manage_products_desc') || 'Manage Products & Device Models'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Search Icon / Expandable Input */}
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
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
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
                                onBlur={() => {
                                    if (!searchQuery) setIsSearchExpanded(false);
                                }}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    padding: '0 8px'
                                }}
                            />
                        )}
                    </div>
                    {canManage && (
                        <button className="btn-kine-lowkey" onClick={() => handleOpenModal()}>
                            <Plus size={18} /> 添加产品
                        </button>
                    )}
                    {/* More Dropdown */}
                    <div ref={moreDropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                            style={{
                                background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                padding: '0 16px',
                                height: '40px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            <MoreHorizontal size={18} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>更多</span>
                        </button>
                        {isMoreDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: 4,
                                background: 'var(--bg-sidebar)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                padding: '4px 0',
                                minWidth: 140,
                                zIndex: 100,
                                boxShadow: '0 8px 32px var(--glass-shadow)'
                            }}>
                                <div style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>
                                    查看列表
                                </div>
                                <button
                                    onClick={() => setStatusFilter('active')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: statusFilter === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                        border: 'none',
                                        color: statusFilter === 'active' ? '#10B981' : 'var(--text-main)',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    启用中
                                </button>
                                <button
                                    onClick={() => setStatusFilter('inactive')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: statusFilter === 'inactive' ? 'rgba(156, 163, 175, 0.1)' : 'transparent',
                                        border: 'none',
                                        color: statusFilter === 'inactive' ? '#9ca3af' : 'var(--text-main)',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    已停用
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Family Filter Tabs */}
            <div style={{ marginBottom: 20 }}>
                <div className="tabs" style={{ display: 'flex', gap: 4, background: 'var(--glass-bg-hover)', padding: 4, borderRadius: 10, height: '48px', alignItems: 'center', width: 'fit-content' }}>
                    {familyTabs.map((tab) => (
                        <button
                            key={tab.key}
                            className={`tab-btn ${productFamily === tab.key ? 'active' : ''}`}
                            onClick={() => setProductFamily(tab.key)}
                            style={{
                                padding: '0 24px',
                                height: '40px',
                                background: productFamily === tab.key ? 'rgba(var(--accent-rgb), 0.2)' : 'transparent',
                                color: productFamily === tab.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                borderRadius: 8,
                                fontWeight: productFamily === tab.key ? 600 : 400,
                                fontSize: '1rem',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mx-6 mt-4 p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg flex items-center gap-2 text-[#EF4444]">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Product List - macOS26 Card Style */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--glass-bg-light)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('model_name')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    型号
                                    {sortBy === 'model_name' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>族群</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>固件版本</th>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('ticket_count')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    关联工单
                                    {sortBy === 'ticket_count' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>Loading...</td></tr>
                        ) : products.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                    <Package size={48} opacity={0.3} />
                                    <span>暂无产品数据</span>
                                </div>
                            </td></tr>
                        ) : (
                            products.map((product) => (
                                <tr
                                    key={product.id}
                                    className="row-hover"
                                    style={{
                                        borderBottom: '1px solid var(--glass-border)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => navigate(`/service/products/${product.id}`)}
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{product.model_name}</div>
                                        {product.internal_name && product.internal_name !== product.model_name && (
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{product.internal_name}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PRODUCT_FAMILY_MAP[product.product_family]?.color || 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                            }`}>
                                            {PRODUCT_FAMILY_MAP[product.product_family]?.label || product.product_family}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>{product.firmware_version || '-'}</span>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{product.ticket_count || 0}</span>
                                    </td>
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenModal(product);
                                            }}
                                            title="编辑"
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                padding: '8px',
                                                color: 'var(--accent-blue)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.2s',
                                                borderRadius: '6px',
                                                margin: '0 auto'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.1)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <Edit2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20, paddingBottom: 20 }}>
                <button
                    disabled={page === 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className="btn-secondary"
                    style={{ background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: 8, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                    上一页
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', opacity: 0.8 }}>
                    第 {page} 页
                </span>
                <button
                    onClick={() => setPage(page + 1)}
                    className="btn-secondary"
                    style={{ background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
                >
                    下一页
                </button>
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#1C1C1E] rounded-2xl border border-white/10 shadow-xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/10">
                            <h2 className="text-lg font-semibold text-white">
                                {editingProduct ? '编辑产品' : '添加产品'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    型号名称 <span className="text-[#EF4444]">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.model_name}
                                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#000] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FFD700]"
                                    placeholder="例如: MAVO Edge 8K"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    内部名称
                                </label>
                                <input
                                    type="text"
                                    value={formData.internal_name || ''}
                                    onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#000] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FFD700]"
                                    placeholder="例如: MAVO Edge 8K (内部代号)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    产品族群 <span className="text-[#EF4444]">*</span>
                                </label>
                                <select
                                    required
                                    value={formData.product_family}
                                    onChange={(e) => setFormData({ ...formData, product_family: e.target.value as 'A' | 'B' | 'C' | 'D' })}
                                    className="w-full px-3 py-2 bg-[#000] border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FFD700]"
                                >
                                    {Object.entries(PRODUCT_FAMILY_MAP).map(([code, info]) => (
                                        <option key={code} value={code}>
                                            {code} - {info.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    固件版本
                                </label>
                                <input
                                    type="text"
                                    value={formData.firmware_version || ''}
                                    onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                                    className="w-full px-3 py-2 bg-[#000] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FFD700]"
                                    placeholder="例如: 8.0.123"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">
                                    描述
                                </label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 bg-[#000] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FFD700] resize-none"
                                    placeholder="产品描述..."
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-[#FFD700] border-white/20 rounded bg-[#000] focus:ring-[#FFD700]"
                                />
                                <label htmlFor="is_active" className="text-sm text-gray-300">
                                    启用
                                </label>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-semibold text-black bg-[#FFD700] hover:bg-[#E6BD00] rounded-lg transition-colors disabled:opacity-50"
                                >
                                    {saving ? '保存中...' : '保存'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-[#1C1C1E] rounded-2xl border border-white/10 shadow-xl w-full max-w-md mx-4 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-[#EF4444]/20 rounded-full">
                                <AlertCircle className="w-6 h-6 text-[#EF4444]" />
                            </div>
                            <h2 className="text-lg font-semibold text-white">确认删除</h2>
                        </div>
                        <p className="text-gray-400 mb-6">
                            确定要删除产品 <span className="font-medium text-white">{deleteConfirm.model_name}</span> 吗？
                            {deleteConfirm.ticket_count > 0 && (
                                <span className="block mt-2 text-[#EF4444]">
                                    注意：此产品有 {deleteConfirm.ticket_count} 个关联工单，无法删除。
                                </span>
                            )}
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleteLoading || deleteConfirm.ticket_count > 0}
                                className="px-4 py-2 text-sm font-medium text-white bg-[#EF4444] hover:bg-[#DC2626] rounded-lg transition-colors disabled:opacity-50"
                            >
                                {deleteLoading ? '删除中...' : '删除'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductManagement;
