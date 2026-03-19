import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    ArrowLeft, Layers, Package, Info,
    Edit2, ChevronDown, ChevronUp, AlertCircle,
    CheckCircle2, XCircle, X, Save, Image as ImageIcon,
    MoreHorizontal, Trash2, Power, Plus
} from 'lucide-react';

interface ProductModel {
    id: number;
    name_zh: string;
    name_en: string;
    brand: string;
    model_code: string;
    material_id: string;
    sn_prefix?: string;
    product_family: string;
    product_type: string;
    description: string;
    hero_image: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
    instance_count: number;
    sku_count: number;
}

interface ProductSku {
    id: number;
    sku_code: string;
    display_name: string;
    material_id: string;
    spec_label: string;
    sku_image: string;
    is_active: boolean;
}

const PRODUCT_FAMILY_MAP: Record<string, { label: string; color: string }> = {
    'A': { label: '在售电影机', color: '#3B82F6' },
    'B': { label: '广播摄像机', color: '#F59E0B' },
    'C': { label: '电子寻像器', color: '#10B981' },
    'D': { label: '历史产品', color: '#6B7280' },
    'E': { label: '通用配件', color: '#8B5CF6' }
};

// 产品类型映射：英文值 -> 显示标签
const PRODUCT_TYPE_LABELS: Record<string, string> = {
    'RIG': 'Rig',
    'BATTERY': '电池',
    'ACCESSORY': '周边',
    'RIG_MONITOR': 'Rig;监视器',
    'POWER': '电源',
    'CABLE_POWER': '线缆;电源',
    'CABLE_STORAGE': '线缆;存储卡',
    'MOVCAM': 'Movcam',
    'MONITOR': '监视器',
    'CABLE': '线缆',
    'VIEWFINDER': '电子寻像器',
    'STORAGE': '存储卡',
    'CAMERA': '摄影机',
    'LENS': '镜头',
    'CHARGER': '充电器',
    'MOUNT': '卡口/转接环',
    'OTHER': '其他'
};

// 获取产品类型的显示标签
function getProductTypeLabel(productType: string): string {
    return PRODUCT_TYPE_LABELS[productType] || productType || '其他';
}

const ProductModelDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token, user } = useAuthStore();

    const [model, setModel] = useState<ProductModel | null>(null);
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'skus']));
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editFormData, setEditFormData] = useState<Partial<ProductModel>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    const fetchModelDetail = async () => {
        if (!id || !token) return;
        setLoading(true);
        try {
            const [modelRes, skusRes] = await Promise.all([
                axios.get(`/api/v1/admin/product-models/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`/api/v1/admin/product-models/${id}/skus`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            if (modelRes.data.success) {
                setModel(modelRes.data.data);
            }
            if (skusRes.data.success) {
                setSkus(skusRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch model details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchModelDetail();
    }, [id, token]);



    const toggleSection = (section: string) => {
        const next = new Set(expandedSections);
        if (next.has(section)) next.delete(section);
        else next.add(section);
        setExpandedSections(next);
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

    if (!model) {
        return (
            <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-main)', height: '100vh' }}>
                <AlertCircle size={48} color="#EF4444" style={{ margin: '0 auto 16px' }} />
                <h3>未找到产品型号</h3>
                <button className="btn-kine-lowkey" onClick={() => navigate('/service/product-models')} style={{ marginTop: 20 }}>
                    返回列表
                </button>
            </div>
        );
    }

    const familyInfo = PRODUCT_FAMILY_MAP[model.product_family] || { label: model.product_family, color: '#6B7280' };

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        formDataUpload.append('type', 'product_photo');

        try {
            const res = await axios.post('/api/v1/upload', formDataUpload, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.data.success) {
                setEditFormData(prev => ({ ...prev, hero_image: res.data.file.url }));
            }
        } catch (err: any) {
            alert('上传图片失败: ' + (err.response?.data?.error?.message || err.message));
        }
    };

    const handleSaveEdit = async () => {
        if (!model || !id) return;
        setSaving(true);
        try {
            await axios.put(`/api/v1/admin/product-models/${id}`, editFormData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsEditModalOpen(false);
            fetchModelDetail();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '保存失败');
        } finally {
            setSaving(false);
        }
    };

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
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{model.name_zh}</h2>
                            <span style={{
                                fontSize: '0.75rem', padding: '2px 8px', borderRadius: 12,
                                background: model.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                color: model.is_active ? '#10B981' : '#EF4444',
                                border: `1px solid ${model.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
                            }}>
                                {model.is_active ? '已激活' : '已停用'}
                            </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{model.model_code} | {model.brand}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {isInternalStaff && model && (
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
                                                // 确保使用最新的 model 数据
                                                setEditFormData({
                                                    name_zh: model.name_zh,
                                                    name_en: model.name_en,
                                                    brand: model.brand,
                                                    model_code: model.model_code,
                                                    material_id: model.material_id,
                                                    product_family: model.product_family,
                                                    product_type: model.product_type,
                                                    description: model.description,
                                                    hero_image: model.hero_image,
                                                    is_active: model.is_active
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
                                                if (!confirm(`确定要${model.is_active ? '停用' : '启用'}此型号吗？`)) return;
                                                try {
                                                    await axios.put(`/api/v1/admin/product-models/${model.id}`, {
                                                        ...model,
                                                        is_active: !model.is_active
                                                    }, { headers: { Authorization: `Bearer ${token}` } });
                                                    fetchModelDetail();
                                                } catch (err: any) {
                                                    alert(err.response?.data?.error?.message || '操作失败');
                                                }
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 10,
                                                width: '100%', padding: '10px 16px', background: 'transparent',
                                                border: 'none', color: model.is_active ? '#EF4444' : '#10B981', fontSize: '0.9rem',
                                                cursor: 'pointer', textAlign: 'left'
                                            }}
                                        >
                                            <Power size={16} /> {model.is_active ? '停用' : '启用'}
                                        </button>
                                        <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
                                        <button
                                            onClick={async () => {
                                                setIsMoreMenuOpen(false);
                                                if (model.instance_count > 0) {
                                                    alert('此型号有关联的设备实例，无法删除');
                                                    return;
                                                }
                                                if (!confirm(`确定要删除产品型号 "${model.name_zh}" 吗？此操作不可撤销。`)) return;
                                                try {
                                                    await axios.delete(`/api/v1/admin/product-models/${model.id}`, {
                                                        headers: { Authorization: `Bearer ${token}` }
                                                    });
                                                    navigate('/service/product-models');
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

                    {/* Top Hero Section */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(300px, 1fr) 2fr',
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
                            aspectRatio: '4/3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            {model.hero_image ? (
                                <img src={model.hero_image} alt={model.name_zh} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <Layers size={64} opacity={0.1} />
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                                    background: familyInfo.color + '20', color: familyInfo.color,
                                    border: `1px solid ${familyInfo.color}40`,
                                    textTransform: 'uppercase'
                                }}>
                                    {familyInfo.label}
                                </span>
                                <span style={{
                                    fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 4,
                                    background: 'var(--glass-bg-hover)', color: 'var(--text-secondary)',
                                    border: '1px solid var(--glass-border)',
                                    textTransform: 'uppercase'
                                }}>
                                    {getProductTypeLabel(model.product_type)}
                                </span>
                            </div>

                            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>{model.name_zh}</h3>
                            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 24 }}>{model.name_en || '-'}</p>

                            {model.sn_prefix && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>序列号前缀</div>
                                    <div style={{ fontSize: '1rem', fontVariantNumeric: 'tabular-nums', color: 'var(--text-main)' }}>{model.sn_prefix}</div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 40 }}>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{model.sku_count || 0}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SKU数量</div>
                                </div>
                                {model.sn_prefix && (
                                    <div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{model.instance_count || 0}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>在役设备</div>
                                    </div>
                                )}
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
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>基本规格参数</span>
                            </div>
                            {expandedSections.has('basic') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>

                        {expandedSections.has('basic') && (
                            <div style={{ padding: '20px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>型号代码 (Model Code)</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{model.model_code}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>物料号 (Material ID)</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{model.material_id || '-'}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>品牌 (Brand)</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{model.brand}</div>
                                </div>
                                <div className="info-item">
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>创建时间</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{new Date(model.created_at).toLocaleDateString()}</div>
                                </div>
                                <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>描述说明</div>
                                    <div className="value" style={{ fontSize: '0.95rem', opacity: 0.8, lineHeight: 1.6 }}>{model.description || '暂无描述信息'}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* SKUs Section */}
                    <div className="detail-section" style={{ marginBottom: 32 }}>
                        <div className="section-header" onClick={() => toggleSection('skus')} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', cursor: 'pointer', borderRadius: 12,
                            background: expandedSections.has('skus') ? 'var(--glass-bg-hover)' : 'transparent',
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Package size={20} color="#3B82F6" />
                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>关联商品规格 (SKUs)</span>
                            </div>
                            {expandedSections.has('skus') ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>

                        {expandedSections.has('skus') && (
                            <div style={{ padding: '16px 0' }}>
                                {skus.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, background: 'var(--glass-bg-light)', borderRadius: 16 }}>
                                        <p style={{ color: 'var(--text-secondary)' }}>暂无关联的SKU</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                        {skus.map(sku => (
                                            <Link
                                                key={sku.id}
                                                to={`/service/product-skus/${sku.id}`}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 16,
                                                    padding: 16, background: 'var(--glass-bg-light)',
                                                    borderRadius: 12, border: '1px solid var(--glass-border)',
                                                    textDecoration: 'none', color: 'inherit',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--accent-blue)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--glass-border)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                                                    background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {sku.sku_image ? (
                                                        <img src={sku.sku_image} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <Package size={20} opacity={0.2} />
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {sku.display_name}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>
                                                        {sku.sku_code}
                                                    </div>
                                                </div>
                                                {!sku.is_active && (
                                                    <XCircle size={14} color="#EF4444" opacity={0.5} />
                                                )}
                                                {sku.is_active && (
                                                    <CheckCircle2 size={14} color="#10B981" opacity={0.5} />
                                                )}
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && model && (
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
                        width: 900, maxHeight: '85vh', background: 'var(--modal-bg)', borderRadius: 16,
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
                                        编辑产品型号
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
                                        {model.name_zh}
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
                                    {/* 主图 */}
                                    <div style={{ padding: 20, background: 'var(--glass-bg-light)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 12, display: 'block' }}>
                                            主视觉图片
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div
                                                onClick={() => fileInputRef.current?.click()}
                                                style={{
                                                    width: 120, height: 120, borderRadius: 12, background: 'var(--glass-bg-hover)',
                                                    border: '2px dashed var(--glass-border)', cursor: 'pointer', overflow: 'hidden',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                }}
                                            >
                                                {editFormData.hero_image ? (
                                                    <img src={editFormData.hero_image} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <ImageIcon size={32} opacity={0.3} />
                                                )}
                                                <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleUploadImage} />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                                                    建议尺寸: 800x600, 支持 JPG/PNG/WEBP.
                                                </p>
                                                {editFormData.hero_image && (
                                                    <button onClick={() => setEditFormData(p => ({ ...p, hero_image: '' }))} style={{ fontSize: '0.75rem', color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer' }}>
                                                        移除图片
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 名称 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>产品名称 (中文) *</label>
                                            <input
                                                type="text" value={editFormData.name_zh || ''}
                                                onChange={(e) => setEditFormData({ ...editFormData, name_zh: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder="例如: MAVO Edge 8K"
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>产品名称 (英文)</label>
                                            <input
                                                type="text" value={editFormData.name_en || ''}
                                                onChange={(e) => setEditFormData({ ...editFormData, name_en: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder="Model Name (EN)"
                                            />
                                        </div>
                                    </div>

                                    {/* 代码 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>型号代码 *</label>
                                            <input
                                                type="text" value={editFormData.model_code || ''}
                                                onChange={(e) => setEditFormData({ ...editFormData, model_code: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder="例如: C181"
                                            />
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>物料ID</label>
                                            <input
                                                type="text" value={editFormData.material_id || ''}
                                                onChange={(e) => setEditFormData({ ...editFormData, material_id: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                                placeholder="例如: 9-010-001"
                                            />
                                        </div>
                                    </div>

                                    {/* 分类 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>产品族群 *</label>
                                            <select
                                                value={editFormData.product_family || 'A'}
                                                onChange={(e) => setEditFormData({ ...editFormData, product_family: e.target.value as any })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                            >
                                                <option value="A">A - 在售电影机</option>
                                                <option value="B">B - 历史机型</option>
                                                <option value="C">C - 电子寻像器</option>
                                                <option value="D">D - 通用配件</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>产品类型 *</label>
                                            <select
                                                value={editFormData.product_type || 'OTHER'}
                                                onChange={(e) => setEditFormData({ ...editFormData, product_type: e.target.value })}
                                                style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                            >
                                                {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* 品牌和描述 */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>品牌</label>
                                        <input
                                            type="text" value={editFormData.brand || 'Kinefinity'}
                                            onChange={(e) => setEditFormData({ ...editFormData, brand: e.target.value })}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem' }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>描述说明</label>
                                        <textarea
                                            value={editFormData.description || ''}
                                            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                            rows={3}
                                            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', fontSize: '0.9rem', resize: 'none' }}
                                            placeholder="输入产品描述..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 右侧SKU体系 */}
                            <div style={{ width: 280, padding: 24, overflowY: 'auto', background: 'var(--glass-bg-light)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h4 style={{ margin: 0, fontSize: 15, color: 'var(--text-main)', fontWeight: 600 }}>SKU体系</h4>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{skus.length} 个SKU</span>
                                    </div>

                                    {skus.length === 0 ? (
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
                                                        <div style={{ fontSize: '0.7rem', opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{sku.sku_code}</div>
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
                        </div>

                        {/* Footer */}
                        <div style={{ 
                            padding: '16px 24px', borderTop: '1px solid var(--glass-border)', 
                            display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0 
                        }}>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
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
                                onClick={handleSaveEdit}
                                disabled={saving}
                                style={{
                                    padding: '10px 24px', borderRadius: 10, fontWeight: 600,
                                    background: 'var(--accent-blue)', color: '#000',
                                    border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '0.88rem',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    opacity: saving ? 0.7 : 1
                                }}
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

export default ProductModelDetailPage;
