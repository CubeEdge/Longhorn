import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import { Search, Plus, Package, ChevronUp, ChevronDown, MoreHorizontal, Edit2, AlertCircle, X, Save, Trash2, Info } from 'lucide-react';
import { ProductDetailModal } from './ProductDetailModal';

// Top bar height constant for drawer positioning
const TOP_BAR_HEIGHT = 64;

// Types - Installed Base (PRD Service PRD_P2.md lines 209-265)
interface Product {
    // Physical Identity
    id: number;
    model_name: string;
    internal_name: string;
    serial_number: string;
    product_sku: string;
    product_type: string;
    product_family: 'A' | 'B' | 'C' | 'D';
    production_date: string;
    
    // IoT Status
    is_iot_device: boolean;
    is_activated: boolean;
    activation_date: string;
    last_connected_at: string;
    firmware_version: string;
    ip_address: string;
    
    // Sales Trace
    sales_channel: 'DIRECT' | 'DEALER';
    original_order_id: string;
    sold_to_dealer_id: number;
    ship_to_dealer_date: string;
    
    // Ownership
    current_owner_id: number;
    current_owner_name?: string;
    registration_date: string;
    sales_invoice_date: string;
    sales_invoice_proof: string;
    
    // Warranty
    warranty_source: 'IOT_ACTIVATION' | 'INVOICE_PROOF' | 'DIRECT_SHIPMENT' | 'DEALER_FALLBACK';
    warranty_start_date: string;
    warranty_months: number;
    warranty_end_date: string;
    warranty_status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
    
    // Basic
    description: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    
    // Stats
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

    // Drawer State (replacing Modal)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [isDeleteDrawerOpen, setIsDeleteDrawerOpen] = useState(false);

    // Product Detail Modal State
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

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

    const handleOpenDrawer = (product?: Product) => {
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
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
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
            handleCloseDrawer();
            fetchProducts();
        } catch (err: any) {
            console.error('Failed to save product', err);
            alert(err.response?.data?.error?.message || 'Failed to save product');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteClick = (product: Product) => {
        setDeleteConfirm(product);
        setIsDeleteDrawerOpen(true);
    };

    const handleCloseDeleteDrawer = () => {
        setIsDeleteDrawerOpen(false);
        setDeleteConfirm(null);
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setDeleteLoading(true);
        try {
            await axios.delete(`/api/v1/admin/products/${deleteConfirm.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            handleCloseDeleteDrawer();
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

    // Check if user can manage product models (MS Lead, Exec, Admin)
    const canManageModels = user?.role === 'Admin' || user?.role === 'Exec' || 
                            (user?.role === 'Lead' && user?.department_code === 'MS');

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
                        设备台账
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{t('admin.manage_products_desc') || '管理已售设备序列号及保修信息'}</p>
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
                        <button className="btn-kine-lowkey" onClick={() => handleOpenDrawer()}>
                            <Plus size={18} /> 添加产品
                        </button>
                    )}
                    {/* More Dropdown - Circular Button */}
                    <div ref={moreDropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: '50%',
                                background: 'var(--glass-bg-hover)',
                                border: '1.5px solid var(--glass-border)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: 4,
                                    background: 'var(--bg-sidebar)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 8,
                                    padding: '4px 0',
                                    minWidth: 160,
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
                                            color: statusFilter === 'inactive' ? 'var(--text-secondary)' : 'var(--text-main)',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        已停用
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Permission Notice */}
            {canManageModels && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', marginBottom: 16,
                    background: 'rgba(255, 215, 0, 0.08)',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)'
                }}>
                    <Info size={16} color="#FFD700" />
                    <span>
                        设备台账权限：<strong style={{ color: '#FFD700' }}>仅 MS Lead、Exec 或 Admin 可添加/编辑设备</strong>
                    </span>
                </div>
            )}

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
                            className={`tab-btn ${productFamily === tab.key ? 'active' : ''}`}
                            onClick={() => setProductFamily(tab.key)}
                            style={{
                                padding: '0 16px',
                                height: '30px',
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
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>序列号</th>
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
                                    onClick={() => {
                                        setSelectedProductId(product.id);
                                        setDetailModalOpen(true);
                                    }}
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{product.model_name}</div>
                                        {product.internal_name && product.internal_name !== product.model_name && (
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{product.internal_name}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{ fontSize: '0.9rem', fontFamily: 'monospace', opacity: 0.9 }}>
                                            {product.serial_number || '-'}
                                        </span>
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
                                                handleOpenDrawer(product);
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

            {/* Add/Edit Drawer - positioned below top bar */}
            {isDrawerOpen && (
                <>
                    <div
                        onClick={handleCloseDrawer}
                        style={{
                            position: 'fixed',
                            top: TOP_BAR_HEIGHT,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.6)',
                            zIndex: 1000
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        top: TOP_BAR_HEIGHT,
                        right: 0,
                        bottom: 0,
                        width: 400,
                        background: '#0a0a0a',
                        borderLeft: '1px solid var(--glass-border)',
                        zIndex: 1001,
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '-8px 0 32px rgba(0,0,0,0.5)'
                    }}>
                        {/* Drawer Header */}
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {editingProduct ? <Edit2 size={18} color="#3B82F6" /> : <Plus size={18} color="#3B82F6" />}
                                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>
                                    {editingProduct ? '编辑产品' : '添加产品'}
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
                                        <option key={code} value={code}>
                                            {code} - {info.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    固件版本
                                </label>
                                <input
                                    type="text"
                                    value={formData.firmware_version || ''}
                                    onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                                    style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                    placeholder="例如: 8.0.123"
                                />
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
                                    placeholder="产品描述..."
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
                                    启用此产品
                                </label>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {editingProduct && (
                                <button
                                    onClick={() => handleDeleteClick(editingProduct)}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: 10, fontWeight: 600,
                                        background: 'rgba(239,68,68,0.08)', color: '#EF4444',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        cursor: 'pointer', fontSize: '0.88rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                                    }}
                                >
                                    <Trash2 size={15} /> 删除产品
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
                                {editingProduct
                                    ? <><Save size={15} /> {saving ? '保存中...' : '保存更改'}</>
                                    : <><Plus size={15} /> {saving ? '创建中...' : '创建产品'}</>
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
                            position: 'fixed',
                            top: TOP_BAR_HEIGHT,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.6)',
                            zIndex: 1000
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        top: TOP_BAR_HEIGHT,
                        right: 0,
                        bottom: 0,
                        width: 400,
                        background: '#0a0a0a',
                        borderLeft: '1px solid var(--glass-border)',
                        zIndex: 1001,
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '-8px 0 32px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
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
                                确定要删除产品 <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{deleteConfirm.model_name}</span> 吗？
                                {deleteConfirm.ticket_count > 0 && (
                                    <span style={{ display: 'block', marginTop: 12, color: '#EF4444' }}>
                                        注意：此产品有 {deleteConfirm.ticket_count} 个关联工单，无法删除。
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
                                disabled={deleteLoading || deleteConfirm.ticket_count > 0}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: 10, fontWeight: 600,
                                    background: '#EF4444', color: '#fff',
                                    border: 'none', cursor: deleteLoading || deleteConfirm.ticket_count > 0 ? 'not-allowed' : 'pointer',
                                    fontSize: '0.88rem',
                                    opacity: deleteLoading || deleteConfirm.ticket_count > 0 ? 0.5 : 1
                                }}
                            >
                                {deleteLoading ? '删除中...' : '删除'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Product Detail Modal */}
            {detailModalOpen && selectedProductId && (
                <ProductDetailModal
                    productId={selectedProductId}
                    onClose={() => {
                        setDetailModalOpen(false);
                        setSelectedProductId(null);
                    }}
                />
            )}
        </div>
    );
};

export default ProductManagement;
