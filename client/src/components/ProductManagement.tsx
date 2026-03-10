import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import { Search, Plus, Package, ChevronUp, ChevronDown, MoreHorizontal, Edit2, AlertCircle, X, Save, Trash2, Info, Power, PowerOff } from 'lucide-react';

// macOS 26 Modal Style - Device Ledger uses centered modal instead of drawer

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

    // Status - IB Status: ACTIVE/IN_REPAIR/STOLEN/SCRAPPED
    status: 'ACTIVE' | 'IN_REPAIR' | 'STOLEN' | 'SCRAPPED';
    description: string;
    created_at: string;
    updated_at: string;

    // Stats
    inquiry_count: number;
    rma_count: number;
    repair_count: number;
    ticket_count: number;
    sku_id?: number | null;
}

interface ProductModel {
    id: number;
    name_zh: string;
    model_code: string;
}

interface ProductSku {
    id: number;
    model_id: number;
    sku_code: string;
    display_name: string;
}

const PRODUCT_FAMILY_MAP = {
    'A': { code: 'A', name: 'Current Cine Cameras', label: '在售电影机', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
    'B': { code: 'B', name: 'Archived Cine Cameras', label: '历史机型', color: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
    'C': { code: 'C', name: 'Eagle e-Viewfinder', label: '电子寻像器', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    'D': { code: 'D', name: 'Universal Accessories', label: '通用配件', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' }
};

type ProductFamily = 'ALL' | 'A' | 'B' | 'C' | 'D';
type ProductStatus = 'ALL' | 'ACTIVE' | 'IN_REPAIR' | 'STOLEN' | 'SCRAPPED';

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
    const statusFilter = (searchParams.get('status') || 'ALL') as ProductStatus;

    const [products, setProducts] = useState<Product[]>([]);
    const [models, setModels] = useState<ProductModel[]>([]);
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [loading, setLoading] = useState(false);
    const [, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Modal State (macOS 26 style)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'basic' | 'business'>('basic');

    // More dropdown state (for header filter)
    const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
    const moreDropdownRef = useRef<HTMLDivElement>(null);

    // Row-level action dropdown state
    const [rowDropdownOpen, setRowDropdownOpen] = useState<number | null>(null);
    const rowDropdownRef = useRef<HTMLDivElement>(null);

    // Search expand state
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Product>>({
        model_name: '',
        serial_number: '',
        product_sku: '',
        firmware_version: '',
        production_date: '',
        description: '',
        status: 'ACTIVE',
        sales_channel: 'DIRECT',
        sold_to_dealer_id: undefined,
        ship_to_dealer_date: '',
        current_owner_id: undefined,
        registration_date: '',
        sales_invoice_date: '',
        sales_invoice_proof: '',
        warranty_start_date: '',
        warranty_months: 24,
        sku_id: undefined
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
                    status: statusFilter === 'ALL' ? undefined : statusFilter
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

    const fetchOptions = async () => {
        try {
            const [modelsRes, skusRes] = await Promise.all([
                axios.get('/api/v1/admin/product-models', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/v1/admin/product-skus', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (modelsRes.data.success) setModels(modelsRes.data.data);
            if (skusRes.data.success) setSkus(skusRes.data.data);
        } catch (err) {
            console.error('Failed to fetch product options', err);
        }
    };

    useEffect(() => {
        if (token) {
            fetchProducts();
            fetchOptions();
        }
    }, [token, productFamily, page, searchQuery, sortBy, sortOrder, statusFilter]);

    // Click outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
                setIsMoreDropdownOpen(false);
            }
            if (rowDropdownRef.current && !rowDropdownRef.current.contains(event.target as Node)) {
                setRowDropdownOpen(null);
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
                serial_number: product.serial_number,
                product_sku: product.product_sku,
                firmware_version: product.firmware_version,
                production_date: product.production_date,
                description: product.description,
                status: product.status || 'ACTIVE',
                sales_channel: product.sales_channel,
                sold_to_dealer_id: product.sold_to_dealer_id,
                ship_to_dealer_date: product.ship_to_dealer_date,
                current_owner_id: product.current_owner_id,
                registration_date: product.registration_date,
                sales_invoice_date: product.sales_invoice_date,
                sales_invoice_proof: product.sales_invoice_proof,
                warranty_start_date: product.warranty_start_date,
                warranty_months: product.warranty_months,
                sku_id: product.sku_id
            });
        } else {
            setEditingProduct(null);
            setFormData({
                model_name: '',
                serial_number: '',
                product_sku: '',
                firmware_version: '',
                production_date: '',
                description: '',
                status: 'ACTIVE',
                sales_channel: 'DIRECT',
                sold_to_dealer_id: undefined,
                ship_to_dealer_date: '',
                current_owner_id: undefined,
                registration_date: '',
                sales_invoice_date: '',
                sales_invoice_proof: '',
                warranty_start_date: '',
                warranty_months: 24,
                sku_id: undefined
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

    const handleDeleteClick = (product: Product) => {
        setDeleteConfirm(product);
        setIsDeleteModalOpen(true);
    };

    const handleStatusChange = async (product: Product, newStatus: Product['status']) => {
        try {
            await axios.put(`/api/v1/admin/products/${product.id}`, {
                status: newStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchProducts();
        } catch (err: any) {
            console.error('Failed to update status', err);
            alert(err.response?.data?.error?.message || 'Failed to update status');
        }
    };

    const handleCloseDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setDeleteConfirm(null);
    };

    const confirmDelete = async () => {
        if (!deleteConfirm) return;
        setDeleteLoading(true);
        try {
            await axios.delete(`/api/v1/admin/products/${deleteConfirm.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            handleCloseDeleteModal();
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
                                        筛选状态
                                    </div>
                                    <button
                                        onClick={() => setStatusFilter('ALL')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: statusFilter === 'ALL' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                            border: 'none',
                                            color: statusFilter === 'ALL' ? '#3B82F6' : 'var(--text-main)',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        全部
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('ACTIVE')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: statusFilter === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                            border: 'none',
                                            color: statusFilter === 'ACTIVE' ? '#10B981' : 'var(--text-main)',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        在役
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('IN_REPAIR')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: statusFilter === 'IN_REPAIR' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                            border: 'none',
                                            color: statusFilter === 'IN_REPAIR' ? '#F59E0B' : 'var(--text-main)',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        维修中
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('STOLEN')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: statusFilter === 'STOLEN' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                            border: 'none',
                                            color: statusFilter === 'STOLEN' ? '#EF4444' : 'var(--text-main)',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        失窃
                                    </button>
                                    <button
                                        onClick={() => setStatusFilter('SCRAPPED')}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            width: '100%',
                                            padding: '10px 12px',
                                            background: statusFilter === 'SCRAPPED' ? 'rgba(107, 114, 128, 0.1)' : 'transparent',
                                            border: 'none',
                                            color: statusFilter === 'SCRAPPED' ? '#6B7280' : 'var(--text-main)',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        报废
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
                                        navigate(`/service/products/${product.id}`);
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
                                        <div ref={rowDropdownOpen === product.id ? rowDropdownRef : null} style={{ position: 'relative', display: 'inline-block' }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setRowDropdownOpen(rowDropdownOpen === product.id ? null : product.id);
                                                }}
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: '50%',
                                                    background: rowDropdownOpen === product.id ? 'var(--glass-bg-hover)' : 'transparent',
                                                    border: '1.5px solid var(--glass-border)',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <MoreHorizontal size={18} />
                                            </button>
                                            {rowDropdownOpen === product.id && (
                                                <>
                                                    <div
                                                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setRowDropdownOpen(null);
                                                        }}
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
                                                        minWidth: 120,
                                                        zIndex: 100,
                                                        boxShadow: '0 8px 32px var(--glass-shadow)'
                                                    }}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRowDropdownOpen(null);
                                                                handleOpenDrawer(product);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                width: '100%',
                                                                padding: '10px 12px',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: 'var(--text-main)',
                                                                fontSize: '0.9rem',
                                                                cursor: 'pointer',
                                                                textAlign: 'left'
                                                            }}
                                                        >
                                                            <Edit2 size={14} /> 编辑
                                                        </button>
                                                        <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
                                                        {product.status !== 'ACTIVE' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRowDropdownOpen(null);
                                                                    handleStatusChange(product, 'ACTIVE');
                                                                }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 8,
                                                                    width: '100%',
                                                                    padding: '10px 12px',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: '#10B981',
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left'
                                                                }}
                                                            >
                                                                <Power size={14} /> 设为在役
                                                            </button>
                                                        )}
                                                        {product.status !== 'IN_REPAIR' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRowDropdownOpen(null);
                                                                    handleStatusChange(product, 'IN_REPAIR');
                                                                }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 8,
                                                                    width: '100%',
                                                                    padding: '10px 12px',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: '#F59E0B',
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left'
                                                                }}
                                                            >
                                                                <AlertCircle size={14} /> 设为维修中
                                                            </button>
                                                        )}
                                                        {product.status !== 'STOLEN' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRowDropdownOpen(null);
                                                                    handleStatusChange(product, 'STOLEN');
                                                                }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 8,
                                                                    width: '100%',
                                                                    padding: '10px 12px',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: '#EF4444',
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left'
                                                                }}
                                                            >
                                                                <AlertCircle size={14} /> 设为失窃
                                                            </button>
                                                        )}
                                                        {product.status !== 'SCRAPPED' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRowDropdownOpen(null);
                                                                    handleStatusChange(product, 'SCRAPPED');
                                                                }}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 8,
                                                                    width: '100%',
                                                                    padding: '10px 12px',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: '#6B7280',
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    textAlign: 'left'
                                                                }}
                                                            >
                                                                <PowerOff size={14} /> 设为报废
                                                            </button>
                                                        )}
                                                        <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRowDropdownOpen(null);
                                                                handleDeleteClick(product);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 8,
                                                                width: '100%',
                                                                padding: '10px 12px',
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: '#EF4444',
                                                                fontSize: '0.9rem',
                                                                cursor: 'pointer',
                                                                textAlign: 'left'
                                                            }}
                                                        >
                                                            <Trash2 size={14} /> 删除
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
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

            {/* Add/Edit Modal - macOS 26 Style */}
            {isModalOpen && (
                <>
                    <div
                        onClick={handleCloseModal}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.8)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 1000
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 560,
                        maxHeight: '85vh',
                        background: '#1c1c1e',
                        borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.1)',
                        zIndex: 1001,
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    background: editingProduct ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {editingProduct ? <Edit2 size={20} color="#3B82F6" /> : <Plus size={20} color="#10B981" />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 17, color: '#fff', letterSpacing: '-0.01em' }}>
                                        {editingProduct ? '编辑产品' : '添加产品'}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#888', marginTop: 2, letterSpacing: '-0.01em' }}>
                                        {editingProduct ? '修改设备台账信息' : '录入新设备到台账'}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#888',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Tab Navigation */}
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', padding: '0 24px' }}>
                            <button
                                onClick={() => setActiveTab('basic')}
                                style={{
                                    padding: '12px 20px',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: `2px solid ${activeTab === 'basic' ? '#3B82F6' : 'transparent'}`,
                                    color: activeTab === 'basic' ? '#3B82F6' : 'var(--text-secondary)',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer'
                                }}
                            >
                                基本信息
                            </button>
                            <button
                                onClick={() => setActiveTab('business')}
                                style={{
                                    padding: '12px 20px',
                                    background: 'none',
                                    border: 'none',
                                    borderBottom: `2px solid ${activeTab === 'business' ? '#3B82F6' : 'transparent'}`,
                                    color: activeTab === 'business' ? '#3B82F6' : 'var(--text-secondary)',
                                    fontWeight: 600,
                                    fontSize: '0.9rem',
                                    cursor: 'pointer'
                                }}
                            >
                                业务信息
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {activeTab === 'basic' ? (
                                <>
                                    {/* Section: Physical Identity */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: -12 }}>
                                        物理身份
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            型号名称 <span style={{ color: '#EF4444' }}>*</span>
                                        </label>
                                        <select
                                            required
                                            value={formData.model_name || ''}
                                            onChange={(e) => {
                                                const modelName = e.target.value;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    model_name: modelName,
                                                    product_sku: '', // Reset SKU when model changes
                                                    sku_id: undefined
                                                }));
                                            }}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        >
                                            <option value="" disabled>请选择型号</option>
                                            {models.map(m => (
                                                <option key={m.id} value={m.name_zh}>{m.name_zh}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            产品SKU
                                        </label>
                                        <select
                                            value={formData.sku_id || ''}
                                            onChange={(e) => {
                                                const skuId = e.target.value;
                                                const selectedSku = skus.find(s => s.id.toString() === skuId);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    sku_id: selectedSku ? selectedSku.id : undefined,
                                                    product_sku: selectedSku ? selectedSku.sku_code : ''
                                                }));
                                            }}
                                            disabled={!formData.model_name}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none', opacity: !formData.model_name ? 0.5 : 1 }}
                                        >
                                            <option value="">{formData.model_name ? '请选择 SKU' : '请先选择型号'}</option>
                                            {skus.filter(s => {
                                                const model = models.find(m => m.name_zh === formData.model_name);
                                                return model && s.model_id === model.id;
                                            }).map(s => (
                                                <option key={s.id} value={s.id}>{s.display_name} ({s.sku_code})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            序列号
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.serial_number || ''}
                                            onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                            placeholder="例如: ME_107649"
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            生产日期
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.production_date || ''}
                                            onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
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

                                    {/* Section: Description */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: -12, marginTop: 8 }}>
                                        其他
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
                                            placeholder="设备描述..."
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Section: Status */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: -12 }}>
                                        业务状态
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            设备状态 <span style={{ color: '#EF4444' }}>*</span>
                                        </label>
                                        <select
                                            required
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value as Product['status'] })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        >
                                            <option value="ACTIVE">在役</option>
                                            <option value="IN_REPAIR">维修中</option>
                                            <option value="STOLEN">失窃</option>
                                            <option value="SCRAPPED">报废</option>
                                        </select>
                                    </div>

                                    {/* Section: Sales Trace */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: -12, marginTop: 8 }}>
                                        销售溯源
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            销售渠道
                                        </label>
                                        <select
                                            value={formData.sales_channel}
                                            onChange={(e) => setFormData({ ...formData, sales_channel: e.target.value as 'DIRECT' | 'DEALER' })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        >
                                            <option value="DIRECT">直销</option>
                                            <option value="DEALER">经销商</option>
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            发货日期
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.ship_to_dealer_date || ''}
                                            onChange={(e) => setFormData({ ...formData, ship_to_dealer_date: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Section: Ownership */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: -12, marginTop: 8 }}>
                                        终端归属
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            注册日期
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.registration_date || ''}
                                            onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            发票日期
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.sales_invoice_date || ''}
                                            onChange={(e) => setFormData({ ...formData, sales_invoice_date: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Section: Warranty */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: -12, marginTop: 8 }}>
                                        保修信息
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            保修起始日期
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.warranty_start_date || ''}
                                            onChange={(e) => setFormData({ ...formData, warranty_start_date: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                            保修时长（月）
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={120}
                                            value={formData.warranty_months || 24}
                                            onChange={(e) => setFormData({ ...formData, warranty_months: parseInt(e.target.value) })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', outline: 'none' }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(0,0,0,0.2)' }}>
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

            {/* Delete Confirmation Modal - macOS 26 Style */}
            {isDeleteModalOpen && deleteConfirm && (
                <>
                    <div
                        onClick={handleCloseDeleteModal}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.8)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 1000
                        }}
                    />
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: 400,
                        background: '#1c1c1e',
                        borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.1)',
                        zIndex: 1001,
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '20px 24px',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(239,68,68,0.08)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    background: 'rgba(239,68,68,0.15)',
                                    borderRadius: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <AlertCircle size={20} color="#EF4444" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 17, color: '#fff', letterSpacing: '-0.01em' }}>
                                        确认删除
                                    </div>
                                    <div style={{ fontSize: 12, color: '#888', marginTop: 2, letterSpacing: '-0.01em' }}>
                                        此操作不可撤销
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseDeleteModal}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#888',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, padding: 24 }}>
                            <p style={{ color: '#aaa', lineHeight: 1.6, fontSize: 14, letterSpacing: '-0.01em' }}>
                                确定要删除产品 <span style={{ color: '#fff', fontWeight: 600 }}>{deleteConfirm.model_name}</span> 吗？
                                {deleteConfirm.ticket_count > 0 && (
                                    <span style={{ display: 'block', marginTop: 12, color: '#EF4444', fontSize: 13 }}>
                                        注意：此产品有 {deleteConfirm.ticket_count} 个关联工单，无法删除。
                                    </span>
                                )}
                            </p>
                        </div>
                        <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                            <button
                                onClick={handleCloseDeleteModal}
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

        </div>
    );
};

export default ProductManagement;
