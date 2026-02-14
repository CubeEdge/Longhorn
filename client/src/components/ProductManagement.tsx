import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { Search, Plus, Edit2, Package, ChevronUp, ChevronDown, Trash2, AlertCircle } from 'lucide-react';

// Types
interface Product {
    id: number;
    model_name: string;
    internal_name: string;
    product_family: 'A' | 'B' | 'C' | 'D';
    product_line: string;
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
    'A': { code: 'A', name: 'Current Cine Cameras', label: '在售电影机', color: 'bg-blue-100 text-blue-800' },
    'B': { code: 'B', name: 'Archived Cine Cameras', label: '历史机型', color: 'bg-gray-100 text-gray-800' },
    'C': { code: 'C', name: 'Eagle e-Viewfinder', label: '电子寻像器', color: 'bg-green-100 text-green-800' },
    'D': { code: 'D', name: 'Universal Accessories', label: '通用配件', color: 'bg-purple-100 text-purple-800' }
};

const ProductManagement: React.FC = () => {
    const { token, user } = useAuthStore();
    const [searchParams, setSearchParams] = useSearchParams();

    // State from URL
    const productFamily = searchParams.get('family') || 'all';
    const searchQuery = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const sortBy = searchParams.get('sort_by') || 'model_name';
    const sortOrder = (searchParams.get('sort_order') || 'asc') as 'asc' | 'desc';

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Product>>({
        model_name: '',
        internal_name: '',
        product_family: 'A',
        product_line: '',
        firmware_version: '',
        description: '',
        is_active: true
    });

    const updateParams = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        setSearchParams({ ...current, ...newParams });
    };

    const setProductFamily = (family: string) => {
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

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`/api/v1/admin/products`, {
                params: {
                    product_family: productFamily === 'all' ? undefined : productFamily,
                    keyword: searchQuery,
                    page,
                    page_size: 20
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
    }, [token, productFamily, page, searchQuery]);

    const handleOpenModal = (product?: Product) => {
        if (product) {
            setEditingProduct(product);
            setFormData({
                model_name: product.model_name,
                internal_name: product.internal_name,
                product_family: product.product_family,
                product_line: product.product_line,
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
                product_line: '',
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

    const handleDelete = async (product: Product) => {
        setDeleteConfirm(product);
    };

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

    const totalPages = Math.ceil(total / 20);

    // Check if user has admin access
    const canManage = user?.role === 'Admin' || user?.role === 'Lead';

    return (
        <div className="h-full flex flex-col bg-[#f5f5f7]">
            {/* Header */}
            <div className="px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Package className="w-6 h-6 text-gray-700" />
                        <h1 className="text-xl font-semibold text-gray-900">产品管理</h1>
                        <span className="text-sm text-gray-500">({total} 个产品)</span>
                    </div>
                    {canManage && (
                        <button
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            添加产品
                        </button>
                    )}
                </div>
            </div>

            {/* Family Filter Tabs */}
            <div className="px-6 py-3 bg-white/60 border-b border-gray-200/50">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setProductFamily('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            productFamily === 'all'
                                ? 'bg-gray-900 text-white'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                        }`}
                    >
                        全部
                    </button>
                    {Object.entries(PRODUCT_FAMILY_MAP).map(([code, info]) => (
                        <button
                            key={code}
                            onClick={() => setProductFamily(code)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                productFamily === code
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            {info.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search Bar */}
            <div className="px-6 py-3 bg-white/40 border-b border-gray-200/50">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="搜索型号..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {/* Product Table */}
            <div className="flex-1 overflow-auto px-6 py-4">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Package className="w-12 h-12 mb-4 opacity-30" />
                        <p>暂无产品数据</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50/80 border-b border-gray-200">
                                <tr>
                                    <th
                                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => handleSort('model_name')}
                                    >
                                        <div className="flex items-center gap-1">
                                            型号
                                            {sortBy === 'model_name' && (
                                                sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        族群
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        产品线
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        固件版本
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        关联工单
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        状态
                                    </th>
                                    {canManage && (
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            操作
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {products.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900">{product.model_name}</div>
                                            {product.internal_name !== product.model_name && (
                                                <div className="text-xs text-gray-500">{product.internal_name}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                PRODUCT_FAMILY_MAP[product.product_family]?.color || 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {PRODUCT_FAMILY_MAP[product.product_family]?.label || product.product_family}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {product.product_line || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {product.firmware_version || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-medium text-gray-900">
                                                {product.ticket_count || 0}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                product.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {product.is_active ? '启用' : '停用'}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(product)}
                                                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="编辑"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(product)}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="删除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-gray-500">
                            第 {page} 页，共 {totalPages} 页
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(page - 1)}
                                disabled={page <= 1}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                上一页
                            </button>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-900">
                                {editingProduct ? '编辑产品' : '添加产品'}
                            </h2>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    型号名称 <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.model_name}
                                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="例如: MAVO Edge 8K"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    内部名称
                                </label>
                                <input
                                    type="text"
                                    value={formData.internal_name || ''}
                                    onChange={(e) => setFormData({ ...formData, internal_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="例如: MAVO Edge 8K (内部代号)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    产品族群 <span className="text-red-500">*</span>
                                </label>
                                <select
                                    required
                                    value={formData.product_family}
                                    onChange={(e) => setFormData({ ...formData, product_family: e.target.value as 'A' | 'B' | 'C' | 'D' })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                >
                                    {Object.entries(PRODUCT_FAMILY_MAP).map(([code, info]) => (
                                        <option key={code} value={code}>
                                            {code} - {info.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    产品线
                                </label>
                                <input
                                    type="text"
                                    value={formData.product_line || ''}
                                    onChange={(e) => setFormData({ ...formData, product_line: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="例如: Camera, EVF, Accessory"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    固件版本
                                </label>
                                <input
                                    type="text"
                                    value={formData.firmware_version || ''}
                                    onChange={(e) => setFormData({ ...formData, firmware_version: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    placeholder="例如: 8.0.123"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    描述
                                </label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                    placeholder="产品描述..."
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="is_active" className="text-sm text-gray-700">
                                    启用
                                </label>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 rounded-full">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">确认删除</h2>
                        </div>
                        <p className="text-gray-600 mb-6">
                            确定要删除产品 <span className="font-medium text-gray-900">{deleteConfirm.model_name}</span> 吗？
                            {deleteConfirm.ticket_count > 0 && (
                                <span className="block mt-2 text-red-600">
                                    注意：此产品有 {deleteConfirm.ticket_count} 个关联工单，无法删除。
                                </span>
                            )}
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleteLoading || deleteConfirm.ticket_count > 0}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
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
