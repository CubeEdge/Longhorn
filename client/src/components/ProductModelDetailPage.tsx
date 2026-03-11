import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    ArrowLeft, Layers, Package, Info,
    Edit2, ChevronDown, ChevronUp, AlertCircle,
    CheckCircle2, XCircle
} from 'lucide-react';

interface ProductModel {
    id: number;
    name_zh: string;
    name_en: string;
    brand: string;
    model_code: string;
    material_id_prefix: string;
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
    'B': { label: '历史机型', color: '#6B7280' },
    'C': { label: '电子寻像器', color: '#10B981' },
    'D': { label: '通用配件', color: '#8B5CF6' }
};

const ProductModelDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token, user } = useAuthStore();

    const [model, setModel] = useState<ProductModel | null>(null);
    const [skus, setSkus] = useState<ProductSku[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'skus']));

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
                    {isInternalStaff && (
                        <button className="btn-kine-lowkey" style={{ gap: 8 }}>
                            <Edit2 size={16} /> 编辑型号
                        </button>
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
                                    {model.product_type}
                                </span>
                            </div>

                            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>{model.name_zh}</h3>
                            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 24 }}>{model.name_en || '-'}</p>

                            <div style={{ display: 'flex', gap: 40 }}>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{model.sku_count || 0}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SKU数量</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{model.instance_count || 0}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>在役设备</div>
                                </div>
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
                                    <div className="label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>物料号前缀</div>
                                    <div className="value" style={{ fontWeight: 600, fontSize: '1rem' }}>{model.material_id_prefix || '-'}</div>
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
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
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
        </div>
    );
};

export default ProductModelDetailPage;
