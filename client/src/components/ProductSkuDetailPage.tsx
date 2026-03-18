import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    ArrowLeft, Package, Layers, Info, Tag,
    Edit2, ChevronDown, ChevronUp, AlertCircle, Box,
    X, Save, Plus, MoreHorizontal, Trash2, Power
} from 'lucide-react';

interface ProductSku {
    id: number;
    model_id: number;
    sku_code: string;
    display_name: string;
    display_name_en: string;
    material_id: string;
    spec_label: string;
    sku_image: string;
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
    updated_at: string;
    // Joined
    name_zh: string;
    product_family: string;
    instance_count: number;
}

const ProductSkuDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token, user } = useAuthStore();

    const [sku, setSku] = useState<ProductSku | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'model']));
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<ProductSku>>({});
    const [models, setModels] = useState<{id: number; name_zh: string}[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const fetchSkuDetail = async () => {
        if (!id || !token) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/admin/product-skus/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setSku(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch SKU details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSkuDetail();
        fetchModels();
    }, [id, token]);

    const fetchModels = async () => {
        try {
            const res = await axios.get('/api/v1/admin/product-models', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setModels(res.data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch models', err);
        }
    };

    useEffect(() => {
        if (sku) {
            setEditFormData({
                model_id: sku.model_id,
                sku_code: sku.sku_code,
                material_id: sku.material_id,
                display_name: sku.display_name,
                display_name_en: sku.display_name_en,
                spec_label: sku.spec_label,
                sku_image: sku.sku_image,
                is_active: sku.is_active,
                weight_kg: sku.weight_kg,
                volume_cum: sku.volume_cum,
                length_cm: sku.length_cm,
                width_cm: sku.width_cm,
                depth_cm: sku.depth_cm,
                is_dangerous_goods: sku.is_dangerous_goods,
                upc: sku.upc,
                sn_prefix: sku.sn_prefix
            });
        }
    }, [sku]);

    const toggleSection = (section: string) => {
        const next = new Set(expandedSections);
        if (next.has(section)) next.delete(section);
        else next.add(section);
        setExpandedSections(next);
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
                setEditFormData(prev => ({ ...prev, sku_image: res.data.file.url }));
            }
        } catch (err: any) {
            alert('上传图片失败');
        }
    };

    const handleSaveEdit = async () => {
        if (!sku || !id) return;
        setSaving(true);
        try {
            await axios.put(`/api/v1/admin/product-skus/${id}`, editFormData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditModalOpen(false);
            fetchSkuDetail();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const isInternalStaff = user?.role === 'Admin' || user?.role === 'Exec' ||
        (user?.role === 'Lead' && user?.department_code === 'MS');

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-main)' }}>
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!sku) {
        return (
            <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-main)', height: '100vh' }}>
                <AlertCircle size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
                <h3>未找到SKU信息</h3>
                <button className="btn-kine-lowkey" onClick={() => navigate('/service/product-skus')} style={{ marginTop: 20 }}>
                    返回列表
                </button>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
            {/* Header Sticky Bar */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-main)',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button onClick={() => navigate(-1)} style={{
                        width: 36, height: 36, borderRadius: '50%', background: 'var(--glass-bg-hover)',
                        border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer'
                    }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{sku.display_name}</h2>
                            <span style={{
                                fontSize: '0.75rem', padding: '2px 8px', borderRadius: 12,
                                background: sku.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                color: sku.is_active ? '#10B981' : '#EF4444',
                                border: `1px solid ${sku.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                            }}>
                                {sku.is_active ? '在售' : '下架'}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>SKU: {sku.sku_code} | {sku.name_zh}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {isInternalStaff && sku && (
                        <div ref={moreMenuRef} style={{ position: 'relative' }}>
                            <button
                                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
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
                            {isMoreMenuOpen && (
                                <>
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                                        onClick={() => setIsMoreMenuOpen(false)}
                                    />
                                    <div style={{
                                        position: 'absolute', top: '100%', right: 0, marginTop: 8,
                                        background: 'var(--bg-sidebar)', border: '1px solid var(--glass-border)',
                                        borderRadius: 12, padding: '8px 0', minWidth: 160, zIndex: 100,
                                        boxShadow: '0 8px 32px var(--glass-shadow)'
                                    }}>
                                        <button
                                            onClick={() => {
                                                setIsMoreMenuOpen(false);
                                                setEditFormData({
                                                    model_id: sku.model_id,
                                                    sku_code: sku.sku_code,
                                                    material_id: sku.material_id,
                                                    display_name: sku.display_name,
                                                    display_name_en: sku.display_name_en,
                                                    spec_label: sku.spec_label,
                                                    sku_image: sku.sku_image,
                                                    is_active: sku.is_active,
                                                    weight_kg: sku.weight_kg,
                                                    volume_cum: sku.volume_cum,
                                                    length_cm: sku.length_cm,
                                                    width_cm: sku.width_cm,
                                                    depth_cm: sku.depth_cm,
                                                    is_dangerous_goods: sku.is_dangerous_goods,
                                                    upc: sku.upc,
                                                    sn_prefix: sku.sn_prefix
                                                });
                                                setIsEditModalOpen(true);
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                width: '100%', padding: '10px 16px', background: 'transparent',
                                                border: 'none', color: 'var(--text-main)', fontSize: '0.9rem',
                                                cursor: 'pointer', textAlign: 'left'
                                            }}
                                        >
                                            <Edit2 size={16} color="#FFD700" /> 编辑
                                        </button>
                                        <button
                                            onClick={async () => {
                                                setIsMoreMenuOpen(false);
                                                if (!confirm(`确定要${sku.is_active ? '下架' : '上架'}此SKU吗？`)) return;
                                                try {
                                                    await axios.put(`/api/v1/admin/product-skus/${sku.id}`, {
                                                        ...sku,
                                                        is_active: !sku.is_active
                                                    }, { headers: { Authorization: `Bearer ${token}` } });
                                                    fetchSkuDetail();
                                                } catch (err: any) {
                                                    alert(err.response?.data?.error?.message || '操作失败');
                                                }
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                width: '100%', padding: '10px 16px', background: 'transparent',
                                                border: 'none', color: sku.is_active ? '#EF4444' : '#10B981', fontSize: '0.9rem',
                                                cursor: 'pointer', textAlign: 'left'
                                            }}
                                        >
                                            <Power size={16} /> {sku.is_active ? '下架' : '上架'}
                                        </button>
                                        <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
                                        <button
                                            onClick={async () => {
                                                setIsMoreMenuOpen(false);
                                                if (sku.instance_count > 0) {
                                                    alert('此SKU有关联的设备实例，无法删除');
                                                    return;
                                                }
                                                if (!confirm(`确定要删除SKU "${sku.display_name}" 吗？此操作不可撤销。`)) return;
                                                try {
                                                    await axios.delete(`/api/v1/admin/product-skus/${sku.id}`, {
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });
                                                    navigate('/service/product-skus');
                                                } catch (err: any) {
                                                    alert(err.response?.data?.error?.message || '删除失败');
                                                }
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                width: '100%', padding: '10px 16px', background: 'transparent',
                                                border: 'none', color: '#EF4444', fontSize: '0.9rem',
                                                cursor: 'pointer', textAlign: 'left'
                                            }}
                                        >
                                            <Trash2 size={16} /> 删除
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
                <div style={{ maxWidth: 1000, margin: '0 auto' }}>

                    {/* Top Section */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(250px, 1fr) 2fr',
                        gap: 32,
                        marginBottom: 40,
                        background: 'var(--glass-bg-light)',
                        padding: 32,
                        borderRadius: 20,
                        border: '1px solid var(--glass-border)'
                    }}>
                        <div style={{
                            borderRadius: 16,
                            overflow: 'hidden',
                            background: 'var(--glass-bg-hover)',
                            border: '1px solid var(--glass-border)',
                            aspectRatio: '1/1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {sku.sku_image ? (
                                <img src={sku.sku_image} alt={sku.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <Package size={64} opacity={0.1} />
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                                    background: 'var(--glass-bg-hover)', color: 'var(--text-secondary)',
                                    border: '1px solid var(--glass-border)',
                                    textTransform: 'uppercase'
                                }}>
                                    SKU
                                </span>
                                {sku.spec_label && (
                                    <span style={{
                                        fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                                        background: '#3B82F620', color: '#3B82F6',
                                        border: '1px solid #3B82F640',
                                        textTransform: 'uppercase'
                                    }}>
                                        {sku.spec_label}
                                    </span>
                                )}
                            </div>

                            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>{sku.display_name}</h3>
                            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 24 }}>{sku.display_name_en || '-'}</p>

                            <div style={{ display: 'flex', gap: 40 }}>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{sku.instance_count || 0}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>在役设备</div>
                                </div>
                                <Link
                                    to={`/service/product-models/${sku.model_id}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        {sku.name_zh}
                                        <Layers size={18} />
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>所属产品型号</div>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Basic Info Section */}
                    <div className="detail-section" style={{ marginBottom: 32 }}>
                        <div className="section-header" onClick={() => toggleSection('basic')} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', cursor: 'pointer', borderRadius: 12,
                            background: expandedSections.has('basic') ? 'var(--glass-bg-hover)' : 'transparent',
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Info size={20} color="#FFD700" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>SKU规格参数</span>
                            </div>
                            {expandedSections.has('basic') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>

                        {expandedSections.has('basic') && (
                            <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>SKU代码 (SKU Code)</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--accent-blue)', fontFamily: 'monospace' }}>{sku.sku_code}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>物料号 (Material ID)</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{sku.material_id || '-'}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>规格标签</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{sku.spec_label || '-'}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>创建时间</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{new Date(sku.created_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Physical Info Section - New */}
                    <div className="detail-section" style={{ marginBottom: 32 }}>
                        <div className="section-header" onClick={() => toggleSection('logistics')} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', cursor: 'pointer', borderRadius: 12,
                            background: expandedSections.has('logistics') ? 'var(--glass-bg-hover)' : 'transparent',
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Box size={20} color="#10B981" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>物理与物流属性</span>
                            </div>
                            {expandedSections.has('logistics') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>

                        {expandedSections.has('logistics') && (
                            <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>重量 (Weight)</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{sku.weight_kg ? `${sku.weight_kg} kg` : '-'}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>体积 (Volume)</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{sku.volume_cum ? `${sku.volume_cum} m³` : '-'}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>外箱尺寸 (Dimensions)</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>
                                        {sku.length_cm || sku.width_cm || sku.depth_cm 
                                            ? `${sku.length_cm || 0} x ${sku.width_cm || 0} x ${sku.depth_cm || 0} cm` 
                                            : '-'}
                                    </div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>UPC 条码</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{sku.upc || '-'}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>SN 前缀</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{sku.sn_prefix || '-'}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>危险品标识</div>
                                    <div className="value" style={{ 
                                        fontWeight: 600, fontSize: '1rem',
                                        color: sku.is_dangerous_goods ? '#EF4444' : 'var(--text-main)'
                                    }}>
                                        {sku.is_dangerous_goods ? '⚠️ 危险品 (Dangerous)' : '普通品'}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Model Info Section */}
                    <div className="detail-section" style={{ marginBottom: 32 }}>
                        <div className="section-header" onClick={() => toggleSection('model')} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', cursor: 'pointer', borderRadius: 12,
                            background: expandedSections.has('model') ? 'var(--glass-bg-hover)' : 'transparent',
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Layers size={20} color="#8B5CF6" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>所属型号详细信息</span>
                            </div>
                            {expandedSections.has('model') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>

                        {expandedSections.has('model') && (
                            <div style={{ padding: '20px 16px' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 24,
                                    padding: 24, background: 'var(--glass-bg-light)',
                                    borderRadius: 16, border: '1px solid var(--glass-border)'
                                }}>
                                    <div style={{
                                        width: 80, height: 80, borderRadius: 12, background: 'var(--glass-bg-hover)',
                                        border: '1px solid var(--glass-border)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                    }}>
                                        <Layers size={32} opacity={0.2} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>{sku.name_zh}</h4>
                                            <span style={{
                                                fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                                                background: 'var(--glass-bg-hover)', color: 'var(--text-secondary)',
                                                border: '1px solid var(--glass-border)'
                                            }}>{sku.product_family}</span>
                                        </div>
                                        <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: 16 }}>
                                            父级产品型号，定义了该SKU的所有基础硬件和工程特征。
                                        </p>
                                        <Link
                                            to={`/service/product-models/${sku.model_id}`}
                                            className="btn-kine-lowkey"
                                            style={{ display: 'inline-flex', padding: '6px 16px', fontSize: '0.85rem' }}
                                        >
                                            <Layers size={14} style={{ marginRight: 8 }} />
                                            查看型号详情
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Related Instances - Placeholder or minimal list */}
                    <div className="detail-section" style={{ marginBottom: 32 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                            <Box size={20} color="#10B981" />
                            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>关联在役设备</span>
                        </div>
                        <div style={{ padding: '16px 20px' }}>
                            <p style={{ fontSize: '0.9rem', opacity: 0.6, marginBottom: 20 }}>
                                共有 {sku.instance_count || 0} 台设备关联了此 SKU。
                            </p>
                            <button
                                onClick={() => navigate(`/service/products?sku=${sku.sku_code}`)}
                                className="btn-kine-lowkey"
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                <Tag size={16} style={{ marginRight: 8 }} />
                                在设备台账中查看所有关联设备
                            </button>
                        </div>
                    </div>

                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && sku && (
                <>
                    <div
                        onClick={() => setIsEditModalOpen(false)}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
                            zIndex: 9999
                        }}
                    />
                    <div style={{
                        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                        width: 800, maxHeight: '85vh', background: 'var(--modal-bg)', borderRadius: 16,
                        boxShadow: 'var(--glass-shadow-lg)', border: '1px solid var(--glass-border)',
                        display: 'flex', flexDirection: 'column', zIndex: 10000,
                        overflow: 'hidden'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '20px 24px', borderBottom: '1px solid var(--glass-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            flexShrink: 0
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: 'rgba(59,130,246,0.15)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <Edit2 size={22} color="#3B82F6" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 18, color: 'var(--text-main)' }}>
                                        编辑SKU
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                                        {sku.display_name}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={22} />
                            </button>
                        </div>

                        {/* Body - 左右分栏 */}
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                            {/* 左侧表单 */}
                            <div className="custom-scroll" style={{ flex: 1, padding: 24, overflowY: 'auto', borderRight: '1px solid var(--glass-border)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {/* 所属型号 */}
                                    <div style={{ padding: 20, background: 'var(--glass-bg-light)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 12, display: 'block' }}>
                                            所属产品型号 *
                                        </label>
                                        <select
                                            value={editFormData.model_id || sku.model_id}
                                            onChange={e => setEditFormData({ ...editFormData, model_id: parseInt(e.target.value) })}
                                            style={{ width: '100%', padding: '12px', borderRadius: 8, background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.95rem' }}
                                        >
                                            {models.map(m => (
                                                <option key={m.id} value={m.id}>{m.name_zh}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* SKU代码和物料号 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SKU代码 *</label>
                                            <input
                                                type="text" value={editFormData.sku_code || ''}
                                                onChange={e => setEditFormData({ ...editFormData, sku_code: e.target.value.toUpperCase() })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder="例: A010-001-01"
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>物料号</label>
                                            <input
                                                type="text" value={editFormData.material_id || ''}
                                                onChange={e => setEditFormData({ ...editFormData, material_id: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder="例: 9-010-001-01"
                                            />
                                        </div>
                                    </div>

                                    {/* 显示名称 */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>显示名称 *</label>
                                        <input
                                            type="text" value={editFormData.display_name || ''}
                                            onChange={e => setEditFormData({ ...editFormData, display_name: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                            placeholder="例如: MAVO Edge 8K 标准套装"
                                        />
                                    </div>

                                    {/* 规格标签 */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>规格标签</label>
                                        <input
                                            type="text" value={editFormData.spec_label || ''}
                                            onChange={e => setEditFormData({ ...editFormData, spec_label: e.target.value })}
                                            placeholder="例: RF Mount, Professional Kit"
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                        />
                                    </div>

                                    {/* 物理属性 - 新增 */}
                                    <div style={{ padding: 16, background: 'var(--glass-bg-hover)', borderRadius: 12, border: '1px solid var(--glass-border)', marginTop: 8 }}>
                                        <h5 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 600 }}>物理属性 (Physical Attributes)</h5>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>重量 (kg)</label>
                                                <input
                                                    type="number" step="0.001" value={editFormData.weight_kg ?? ''}
                                                    onChange={e => setEditFormData({ ...editFormData, weight_kg: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>体积 (m³)</label>
                                                <input
                                                    type="number" step="0.000001" value={editFormData.volume_cum ?? ''}
                                                    onChange={e => setEditFormData({ ...editFormData, volume_cum: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>外箱尺寸 (L x W x D cm)</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                                <input
                                                    type="number" placeholder="L" value={editFormData.length_cm ?? ''}
                                                    onChange={e => setEditFormData({ ...editFormData, length_cm: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                                <input
                                                    type="number" placeholder="W" value={editFormData.width_cm ?? ''}
                                                    onChange={e => setEditFormData({ ...editFormData, width_cm: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                                                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--bg-main)', color: 'var(--text-main)', fontSize: '0.85rem' }}
                                                />
                                                <input
                                                    type="number" placeholder="D" value={editFormData.depth_cm ?? ''}
                                                    onChange={e => setEditFormData({ ...editFormData, depth_cm: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
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
                                                type="text" value={editFormData.upc || ''}
                                                onChange={e => setEditFormData({ ...editFormData, upc: e.target.value })}
                                                placeholder="Universal Product Code"
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>SN 前缀</label>
                                            <input
                                                type="text" value={editFormData.sn_prefix || ''}
                                                onChange={e => setEditFormData({ ...editFormData, sn_prefix: e.target.value.toUpperCase() })}
                                                placeholder="例: KE8"
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 右侧图片和状态 */}
                            <div style={{ width: 280, padding: 24, overflowY: 'auto', background: 'var(--glass-bg-light)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)', fontWeight: 600 }}>SKU图片</h4>
                                    
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, border: '2px dashed var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', background: 'var(--glass-bg)' }}
                                        >
                                            {editFormData.sku_image ? (
                                                <img src={editFormData.sku_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            ) : (
                                                <Plus size={32} opacity={0.3} />
                                            )}
                                        </div>
                                        <input type="file" ref={fileInputRef} hidden onChange={handleUploadImage} />
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                            建议透明背景 PNG
                                        </p>
                                        {editFormData.sku_image && (
                                            <button onClick={() => setEditFormData({ ...editFormData, sku_image: '' })} style={{ fontSize: '0.75rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                移除图片
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ padding: 16, background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                            <input
                                                type="checkbox" id="sku_active_edit" checked={editFormData.is_active}
                                                onChange={e => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                                                style={{ width: 18, height: 18, accentColor: '#10B981' }}
                                            />
                                            <label htmlFor="sku_active_edit" style={{ fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer' }}>
                                                在售状态
                                            </label>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <input
                                                type="checkbox" id="sku_dangerous_edit" checked={editFormData.is_dangerous_goods}
                                                onChange={e => setEditFormData({ ...editFormData, is_dangerous_goods: e.target.checked })}
                                                style={{ width: 18, height: 18, accentColor: '#EF4444' }}
                                            />
                                            <label htmlFor="sku_dangerous_edit" style={{ fontSize: '0.9rem', color: 'var(--text-main)', cursor: 'pointer' }}>
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

                        {/* Footer */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 }}>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                style={{ padding: '10px 20px', borderRadius: 10, fontWeight: 600, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', cursor: 'pointer', fontSize: '0.88rem' }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={saving}
                                style={{ padding: '10px 24px', borderRadius: 10, fontWeight: 600, background: 'var(--accent-blue)', color: '#000', border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}
                            >
                                <Save size={15} /> {saving ? '保存中...' : '保存'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductSkuDetailPage;
