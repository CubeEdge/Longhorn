import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    Plus, Package, Search,
    Edit2, X, ArrowLeft,
    Image as ImageIcon
} from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';

const TOP_BAR_HEIGHT = 64;

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
    created_at: string;
    // Joined fields
    name_zh?: string;
    brand?: string;
}

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
    const [filterModelId, setFilterModelId] = useState<string>(initialModelId || 'ALL');

    // Drawer State
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
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
        is_active: true
    });

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [skusRes, modelsRes] = await Promise.all([
                axios.get('/api/v1/admin/product-skus', {
                    params: {
                        model_id: filterModelId === 'ALL' ? undefined : filterModelId,
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
        } catch (err: any) {
            console.error('Failed to fetch data', err);
            setError(err.response?.data?.error?.message || 'Failed to fetch data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token, filterModelId, searchQuery]);

    const handleOpenDrawer = (sku?: ProductSku) => {
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
                is_active: !!sku.is_active
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
                is_active: true
            });
        }
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setEditingSku(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
            handleCloseDrawer();
            fetchData();
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
        } catch (err: any) {
            alert('上传图片失败');
        }
    };

    const canManage = user?.role === 'Admin' || user?.role === 'Exec' ||
        (user?.role === 'Lead' && user?.department_code === 'MS');

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
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
                    <div style={{ position: 'relative' }}>
                        <input
                            type="text"
                            placeholder={_t('product.search_sku')}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                padding: '8px 12px', paddingLeft: '32px', borderRadius: 8, background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--glass-border)', color: 'var(--text-main)', width: 200, outline: 'none'
                            }}
                        />
                        <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                            <Search size={14} />
                        </div>
                    </div>
                    <select
                        value={filterModelId}
                        onChange={e => setFilterModelId(e.target.value)}
                        style={{
                            padding: '8px 12px', borderRadius: 8, background: 'var(--glass-bg-hover)',
                            border: '1px solid var(--glass-border)', color: 'var(--text-main)', outline: 'none'
                        }}
                    >
                        <option value="ALL">{_t('common.all')}</option>
                        {models.map(m => (
                            <option key={m.id} value={m.id}>{m.name_zh}</option>
                        ))}
                    </select>
                    {canManage && (
                        <button className="btn-kine-lowkey" onClick={() => handleOpenDrawer()}>
                            <Plus size={18} /> {_t('product.add_sku')}
                        </button>
                    )}
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
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>商品规格 (SKU)</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>{_t('product.model_code')}</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>{_t('product.sku_id')}</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>规格标签</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>状态</th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center' }}>{_t('product.loading')}</td></tr>
                        ) : skus.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>{_t('product.no_records')}</td></tr>
                        ) : (
                            skus.map(sku => (
                                <tr
                                    key={sku.id}
                                    className="row-hover"
                                    style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
                                    onClick={() => navigate(`/service/product-skus/${sku.id}`)}
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 6, background: 'var(--bg-main)', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                                                {sku.sku_image ? <img src={sku.sku_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={16} opacity={0.2} style={{ margin: '12px' }} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{sku.display_name}</div>
                                                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{sku.display_name_en}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-blue)' }}>{sku.sku_code.split('-')[0]}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontWeight: 600 }}>{sku.sku_code}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{ fontSize: '0.85rem', background: 'var(--glass-bg-hover)', padding: '2px 8px', borderRadius: 4 }}>
                                            {sku.spec_label || '标准'}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        <span style={{
                                            fontSize: '0.75rem', padding: '2px 8px', borderRadius: 10,
                                            background: sku.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)',
                                            color: sku.is_active ? '#10B981' : '#9CA3AF'
                                        }}>
                                            {sku.is_active ? _t('product.on_sale') : _t('product.off_shelf')}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16, textAlign: 'center' }}>
                                        <button
                                            onClick={() => handleOpenDrawer(sku)}
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

            {/* Drawer */}
            {isDrawerOpen && (
                <>
                    <div onClick={handleCloseDrawer} style={{ position: 'fixed', top: TOP_BAR_HEIGHT, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }} />
                    <div style={{
                        position: 'fixed', top: TOP_BAR_HEIGHT, right: 0, bottom: 0, width: 400,
                        background: '#0a0a0a', borderLeft: '1px solid var(--glass-border)',
                        zIndex: 1001, display: 'flex', flexDirection: 'column'
                    }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700 }}>{editingSku ? `${_t('action.edit')} SKU` : _t('product.add_sku')}</span>
                            <button onClick={handleCloseDrawer} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><X size={20} /></button>
                        </div>

                        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('parts.model')} *</label>
                                <select
                                    value={formData.model_id}
                                    onChange={e => setFormData({ ...formData, model_id: parseInt(e.target.value) })}
                                    style={{ padding: '10px', borderRadius: 8, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
                                >
                                    {models.map(m => (
                                        <option key={m.id} value={m.id}>{m.name_zh}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.sku_id')} *</label>
                                    <input
                                        type="text" value={formData.sku_code}
                                        onChange={e => setFormData({ ...formData, sku_code: e.target.value.toUpperCase() })}
                                        style={{ padding: '10px', borderRadius: 8, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
                                        placeholder="例: A010-001-01"
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.material_id')}</label>
                                    <input
                                        type="text" value={formData.material_id}
                                        onChange={e => setFormData({ ...formData, material_id: e.target.value })}
                                        style={{ padding: '10px', borderRadius: 8, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
                                        placeholder="例: 9-010-001-01"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('common.name')} *</label>
                                <input
                                    type="text" value={formData.display_name}
                                    onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                                    style={{ padding: '10px', borderRadius: 8, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
                                />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{_t('product.sku_image')}</label>
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        style={{ width: 80, height: 80, borderRadius: 8, border: '1px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}
                                    >
                                        {formData.sku_image ? <img src={formData.sku_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Plus size={20} opacity={0.3} />}
                                    </div>
                                    <input type="file" ref={fileInputRef} hidden onChange={handleUploadImage} />
                                    <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>{_t('product.image_hint')}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>规格标签</label>
                                <input
                                    type="text" value={formData.spec_label}
                                    onChange={e => setFormData({ ...formData, spec_label: e.target.value })}
                                    placeholder="例: RF Mount, Professional Kit"
                                    style={{ padding: '10px', borderRadius: 8, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input
                                    type="checkbox" id="sku_active" checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                />
                                <label htmlFor="sku_active">{_t('product.on_sale')}</label>
                            </div>
                        </div>

                        <div style={{ padding: 24, borderTop: '1px solid var(--glass-border)' }}>
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                style={{ width: '100%', padding: 12, borderRadius: 10, background: 'var(--accent-blue)', color: '#000', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                            >
                                {saving ? _t('product.saving') : (editingSku ? _t('action.save') : _t('action.confirm'))}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductSkusManagement;
