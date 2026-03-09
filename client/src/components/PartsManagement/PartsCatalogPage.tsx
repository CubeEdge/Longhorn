/**
 * PartsCatalogPage
 * 配件目录管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Package,
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface Part {
    id: number;
    sku: string;
    name: string;
    name_en?: string;
    category: string;
    description?: string;
    specifications?: Record<string, any>;
    price_cny: number;
    price_usd: number;
    price_eur: number;
    cost_cny?: number;
    status: 'active' | 'discontinued' | 'pending';
    compatible_models?: string[];
    min_stock_level: number;
    reorder_point: number;
    created_by_name?: string;
    created_at?: string;
}

const categories = ['主板', '接口', '传感器', '显示', '电源', '外壳', '线缆', '其他'];

const PartsCatalogPage: React.FC = () => {
    const { token, user } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [parts, setParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingPart, setEditingPart] = useState<Part | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<Part | null>(null);

    const isAdmin = ['Admin', 'Lead', 'Exec'].includes(user?.role || '');

    const fetchParts = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page_size: 100 };
            if (searchTerm) params.search = searchTerm;
            if (selectedCategory) params.category = selectedCategory;

            const res = await axios.get('/api/v1/parts-master', { headers, params });
            if (res.data?.success) {
                setParts(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch parts:', err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, selectedCategory, headers]);

    useEffect(() => {
        fetchParts();
    }, [fetchParts]);

    const handleDelete = async (part: Part) => {
        try {
            await axios.delete(`/api/v1/parts-master/${part.id}`, { headers });
            setDeleteConfirm(null);
            fetchParts();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '删除失败');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#10B981';
            case 'discontinued': return '#EF4444';
            case 'pending': return '#F59E0B';
            default: return '#888';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return '在售';
            case 'discontinued': return '停产';
            case 'pending': return '待定';
            default: return status;
        }
    };

    return (
        <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Package size={24} color="#3B82F6" />
                        配件目录
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 13 }}>
                        管理配件SKU、价格及兼容性信息
                    </p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowAddModal(true)}
                        style={{
                            padding: '10px 20px',
                            background: '#3B82F6',
                            border: 'none',
                            borderRadius: 8,
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                        }}
                    >
                        <Plus size={18} /> 新增配件
                    </button>
                )}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
                    <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="搜索SKU或配件名称..."
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 40px',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: 8,
                            color: 'var(--text-main)',
                            fontSize: 14
                        }}
                    />
                </div>
                <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    style={{
                        padding: '10px 16px',
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 8,
                        color: 'var(--text-main)',
                        fontSize: 14,
                        minWidth: 120
                    }}
                >
                    <option value="">全部分类</option>
                    {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div style={{
                flex: 1,
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 12,
                overflow: 'auto'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>SKU</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>配件名称</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>分类</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>价格(CNY)</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>价格(USD)</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>状态</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 40, textAlign: 'center' }}>
                                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto' }} />
                                </td>
                            </tr>
                        ) : parts.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    暂无配件数据
                                </td>
                            </tr>
                        ) : (
                            parts.map(part => (
                                <tr key={part.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.15s' }}>
                                    <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: '#3B82F6' }}>{part.sku}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                                        <div>{part.name}</div>
                                        {part.name_en && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{part.name_en}</div>}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            background: 'rgba(59,130,246,0.15)',
                                            borderRadius: 4,
                                            fontSize: 12,
                                            color: '#3B82F6'
                                        }}>{part.category}</span>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }}>
                                        ¥{part.price_cny?.toFixed(2) || '0.00'}
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'right', fontFamily: 'monospace' }}>
                                        ${part.price_usd?.toFixed(2) || '0.00'}
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: 4,
                                            fontSize: 11,
                                            fontWeight: 600,
                                            background: `${getStatusColor(part.status)}20`,
                                            color: getStatusColor(part.status)
                                        }}>{getStatusText(part.status)}</span>
                                    </td>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                            <button
                                                onClick={() => setEditingPart(part)}
                                                style={{
                                                    padding: 6,
                                                    background: 'transparent',
                                                    border: 'none',
                                                    borderRadius: 4,
                                                    cursor: 'pointer',
                                                    color: '#3B82F6'
                                                }}
                                                title="编辑"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => setDeleteConfirm(part)}
                                                    style={{
                                                        padding: 6,
                                                        background: 'transparent',
                                                        border: 'none',
                                                        borderRadius: 4,
                                                        cursor: 'pointer',
                                                        color: '#EF4444'
                                                    }}
                                                    title="删除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal - Simplified placeholder */}
            {(showAddModal || editingPart) && (
                <PartModal
                    part={editingPart}
                    onClose={() => {
                        setShowAddModal(false);
                        setEditingPart(null);
                    }}
                    onSuccess={fetchParts}
                    headers={headers}
                />
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirm && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        width: 400,
                        background: 'var(--glass-bg)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 12,
                        padding: 24
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                            <AlertCircle size={24} color="#EF4444" />
                            <h3 style={{ margin: 0, fontSize: 16 }}>确认删除</h3>
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
                </div>
            )}
        </div>
    );
};

// Simplified Part Modal Component
const PartModal: React.FC<{
    part: Part | null;
    onClose: () => void;
    onSuccess: () => void;
    headers: any;
}> = ({ part, onClose, onSuccess, headers }) => {
    const [formData, setFormData] = useState({
        sku: part?.sku || '',
        name: part?.name || '',
        name_en: part?.name_en || '',
        category: part?.category || '主板',
        description: part?.description || '',
        price_cny: part?.price_cny || 0,
        price_usd: part?.price_usd || 0,
        price_eur: part?.price_eur || 0,
        min_stock_level: part?.min_stock_level || 5,
        reorder_point: part?.reorder_point || 10,
        status: part?.status || 'active'
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (part) {
                await axios.patch(`/api/v1/parts-master/${part.id}`, formData, { headers });
            } else {
                await axios.post('/api/v1/parts-master', formData, { headers });
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div style={{
                width: 500,
                maxHeight: '90vh',
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                borderRadius: 12,
                overflow: 'auto'
            }}>
                <form onSubmit={handleSubmit}>
                    <div style={{ padding: 24, borderBottom: '1px solid var(--glass-border)' }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{part ? '编辑配件' : '新增配件'}</h3>
                    </div>
                    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>SKU *</label>
                            <input
                                type="text"
                                value={formData.sku}
                                onChange={e => setFormData({ ...formData, sku: e.target.value })}
                                disabled={!!part}
                                required
                                style={{
                                    width: '100%',
                                    padding: 10,
                                    background: 'var(--glass-bg-hover)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 6,
                                    color: 'var(--text-main)'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>名称 *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: 10,
                                    background: 'var(--glass-bg-hover)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 6,
                                    color: 'var(--text-main)'
                                }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>分类 *</label>
                                <select
                                    value={formData.category}
                                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        background: 'var(--glass-bg-hover)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 6,
                                        color: 'var(--text-main)'
                                    }}
                                >
                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>状态</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        background: 'var(--glass-bg-hover)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 6,
                                        color: 'var(--text-main)'
                                    }}
                                >
                                    <option value="active">在售</option>
                                    <option value="discontinued">停产</option>
                                    <option value="pending">待定</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>价格(CNY)</label>
                                <input
                                    type="number"
                                    value={formData.price_cny}
                                    onChange={e => setFormData({ ...formData, price_cny: parseFloat(e.target.value) || 0 })}
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        background: 'var(--glass-bg-hover)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 6,
                                        color: 'var(--text-main)'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>价格(USD)</label>
                                <input
                                    type="number"
                                    value={formData.price_usd}
                                    onChange={e => setFormData({ ...formData, price_usd: parseFloat(e.target.value) || 0 })}
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        background: 'var(--glass-bg-hover)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 6,
                                        color: 'var(--text-main)'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>价格(EUR)</label>
                                <input
                                    type="number"
                                    value={formData.price_eur}
                                    onChange={e => setFormData({ ...formData, price_eur: parseFloat(e.target.value) || 0 })}
                                    style={{
                                        width: '100%',
                                        padding: 10,
                                        background: 'var(--glass-bg-hover)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: 6,
                                        color: 'var(--text-main)'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <div style={{ padding: 24, borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                padding: '10px 20px',
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
                            type="submit"
                            disabled={saving}
                            style={{
                                padding: '10px 20px',
                                background: '#3B82F6',
                                border: 'none',
                                borderRadius: 6,
                                color: '#fff',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                opacity: saving ? 0.6 : 1
                            }}
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : '保存'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PartsCatalogPage;
