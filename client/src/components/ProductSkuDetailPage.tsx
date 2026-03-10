import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import {
    ArrowLeft, Package, Layers, Info, Tag,
    Edit2, ChevronDown, ChevronUp, AlertCircle,
    CheckCircle2, XCircle, Box
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
    const { t } = useLanguage();
    const { token, user } = useAuthStore();

    const [sku, setSku] = useState<ProductSku | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'model']));

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
                    {isInternalStaff && (
                        <button className="btn-kine-lowkey" style={{ gap: 8 }}>
                            <Edit2 size={16} /> 编辑SKU
                        </button>
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

                            <h3 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>{sku.display_name}</h3>
                            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: 24 }}>{sku.display_name_en || '-'}</p>

                            <div style={{ display: 'flex', gap: 40 }}>
                                <div>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{sku.instance_count || 0}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>在役设备数量</div>
                                </div>
                                <Link
                                    to={`/service/product-models/${sku.model_id}`}
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                >
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
        </div>
    );
};

export default ProductSkuDetailPage;
