import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    ArrowLeft, Package, Wifi, ShoppingCart, User, Shield, History,
    Edit2, MoreHorizontal, ChevronDown, ChevronUp, Power, AlertCircle, Trash2
} from 'lucide-react';

interface ProductDetail {
    id: number;
    model_name: string;
    internal_name: string;
    serial_number: string;
    product_sku: string;
    product_type: string;
    product_family: string;
    production_date: string;
    is_iot_device: boolean;
    is_activated: boolean;
    activation_date: string;
    last_connected_at: string;
    firmware_version: string;
    ip_address: string;
    sales_channel: 'DIRECT' | 'DEALER';
    original_order_id: string;
    sold_to_dealer_id: number;
    sold_to_dealer_name: string;
    ship_to_dealer_date: string;
    current_owner_id: number;
    current_owner_name: string;
    registration_date: string;
    sales_invoice_date: string;
    sales_invoice_proof: string;
    warranty_source: string;
    warranty_start_date: string;
    warranty_months: number;
    warranty_end_date: string;
    warranty_status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
    inquiry_count: number;
    rma_count: number;
    repair_count: number;
}

const PRODUCT_FAMILY_MAP: Record<string, { label: string; color: string }> = {
    'A': { label: '在售电影机', color: '#3B82F6' },
    'B': { label: '历史机型', color: '#6B7280' },
    'C': { label: '电子寻像器', color: '#10B981' },
    'D': { label: '通用配件', color: '#8B5CF6' }
};

const WARRANTY_SOURCE_MAP: Record<string, string> = {
    'IOT_ACTIVATION': 'IoT激活',
    'INVOICE_PROOF': '发票凭证',
    'DIRECT_SHIPMENT': '直销发货',
    'DEALER_FALLBACK': '经销商兜底'
};

const SALES_CHANNEL_MAP: Record<string, string> = {
    'DIRECT': '直销',
    'DEALER': '经销商'
};

const ProductDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuthStore();

    const [product, setProduct] = useState<ProductDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['physical', 'iot', 'sales', 'ownership', 'warranty']));
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleStatusChange = async (newStatus: string) => {
        if (!product || !token) return;
        try {
            await axios.patch(`/api/v1/admin/products/${product.id}/status`,
                { status: newStatus },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchProductDetail();
        } catch (err) {
            console.error('Failed to update status:', err);
            alert('状态更新失败');
        }
    };

    const handleDelete = async () => {
        if (!product || !token) return;
        try {
            await axios.delete(`/api/v1/admin/products/${product.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/service/products');
        } catch (err) {
            console.error('Failed to delete product:', err);
            alert('删除失败');
        }
    };

    useEffect(() => {
        if (token && id) {
            fetchProductDetail();
        }
    }, [token, id]);

    const fetchProductDetail = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/admin/products/${id}/detail`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProduct(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch product detail:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: string) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('zh-CN');
    };

    const calculateRemainingDays = (endDate: string) => {
        if (!endDate) return 0;
        const end = new Date(endDate);
        const now = new Date();
        const diff = end.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const toggleSection = (section: string) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(section)) {
            newSet.delete(section);
        } else {
            newSet.add(section);
        }
        setExpandedSections(newSet);
    };

    const getWarrantyStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '#10B981';
            case 'EXPIRED': return '#EF4444';
            case 'PENDING': return '#F59E0B';
            default: return '#6B7280';
        }
    };

    const getWarrantyStatusText = (status: string) => {
        switch (status) {
            case 'ACTIVE': return '在保';
            case 'EXPIRED': return '已过保';
            case 'PENDING': return '待确认';
            default: return '未知';
        }
    };

    if (loading) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                加载中...
            </div>
        );
    }

    if (!product) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ color: '#EF4444' }}>产品不存在</div>
                <button onClick={() => navigate('/service/products')} style={{ marginTop: 16 }}>
                    返回列表
                </button>
            </div>
        );
    }

    const familyInfo = PRODUCT_FAMILY_MAP[product.product_family] || { label: '未知', color: '#6B7280' };
    const remainingDays = calculateRemainingDays(product.warranty_end_date);

    const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; section: string }> = ({ icon, title, section }) => (
        <div
            onClick={() => toggleSection(section)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: expandedSections.has(section) ? '1px solid var(--glass-border)' : 'none',
                cursor: 'pointer'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: '#3B82F6' }}>{icon}</span>
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>{title}</span>
            </div>
            {expandedSections.has(section) ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
        </div>
    );

    const InfoGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px', padding: 20 }}>
            {children}
        </div>
    );

    const InfoItem: React.FC<{ label: string; value: React.ReactNode; valueColor?: string }> = ({ label, value, valueColor }) => (
        <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 500, color: valueColor || 'var(--text-main)' }}>{value}</div>
        </div>
    );

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <button
                        onClick={() => navigate('/service/products')}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                            {product.model_name}
                        </h1>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                            <span style={{ fontFamily: 'monospace' }}>{product.serial_number}</span>
                            <span style={{ margin: '0 8px', color: 'var(--glass-border)' }}>|</span>
                            <span style={{ color: familyInfo.color }}>{familyInfo.label}</span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                    <button
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        style={{
                            background: 'var(--glass-bg-hover)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '50%',
                            width: 36,
                            height: 36,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)'
                        }}
                    >
                        <MoreHorizontal size={20} />
                    </button>

                    {/* Dropdown Menu */}
                    {showMoreMenu && (
                        <>
                            <div
                                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                onClick={() => setShowMoreMenu(false)}
                            />
                            <div
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    marginTop: 8,
                                    background: 'rgba(40, 40, 42, 0.98)',
                                    backdropFilter: 'blur(20px)',
                                    borderRadius: 12,
                                    border: '1px solid var(--glass-border)',
                                    boxShadow: '0 10px 40px var(--glass-shadow)',
                                    zIndex: 20,
                                    minWidth: 160,
                                    padding: '8px 0'
                                }}
                            >
                                <button
                                    onClick={() => { navigate('/service/product-models'); setShowMoreMenu(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        width: '100%',
                                        padding: '10px 16px',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-main)',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        textAlign: 'left'
                                    }}
                                >
                                    <Edit2 size={16} color="var(--accent-blue)" />
                                    编辑
                                </button>
                                {product?.warranty_status !== 'ACTIVE' && (
                                    <button
                                        onClick={() => { handleStatusChange('ACTIVE'); setShowMoreMenu(false); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#10B981',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <Power size={16} /> 设为在役
                                    </button>
                                )}
                                {product?.warranty_status !== 'EXPIRED' && (
                                    <button
                                        onClick={() => { handleStatusChange('EXPIRED'); setShowMoreMenu(false); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#F59E0B',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <AlertCircle size={16} /> 设为维修中
                                    </button>
                                )}
                                {product?.warranty_status !== 'PENDING' && (
                                    <button
                                        onClick={() => { handleStatusChange('PENDING'); setShowMoreMenu(false); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            width: '100%',
                                            padding: '10px 16px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#EF4444',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <AlertCircle size={16} /> 设为失窃
                                    </button>
                                )}
                                <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
                                <button
                                    onClick={() => { setIsDeleteModalOpen(true); setShowMoreMenu(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        width: '100%',
                                        padding: '10px 16px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#EF4444',
                                        cursor: 'pointer',
                                        fontSize: '0.9rem',
                                        textAlign: 'left'
                                    }}
                                >
                                    <Trash2 size={16} /> 删除
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Physical Identity */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<Package size={18} />} title="物理身份" section="physical" />
                        {expandedSections.has('physical') && (
                            <InfoGrid>
                                <InfoItem label="序列号" value={product.serial_number} />
                                <InfoItem label="产品SKU" value={product.product_sku || '-'} />
                                <InfoItem label="内部型号" value={product.internal_name || '-'} />
                                <InfoItem label="产品类型" value={product.product_type || 'CAMERA'} />
                                <InfoItem label="生产日期" value={formatDate(product.production_date)} />
                            </InfoGrid>
                        )}
                    </div>

                    {/* IoT Status */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<Wifi size={18} />} title="联网状态" section="iot" />
                        {expandedSections.has('iot') && (
                            <InfoGrid>
                                <InfoItem label="IoT设备" value={product.is_iot_device ? '是' : '否'} valueColor={product.is_iot_device ? '#10B981' : 'var(--text-secondary)'} />
                                <InfoItem label="激活状态" value={product.is_activated ? '已激活' : '未激活'} valueColor={product.is_activated ? '#10B981' : 'var(--text-secondary)'} />
                                <InfoItem label="激活日期" value={formatDate(product.activation_date)} />
                                <InfoItem label="最后连接" value={product.last_connected_at ? new Date(product.last_connected_at).toLocaleString('zh-CN') : '-'} />
                                <InfoItem label="固件版本" value={product.firmware_version || '-'} />
                                <InfoItem label="IP地址" value={product.ip_address || '-'} />
                            </InfoGrid>
                        )}
                    </div>

                    {/* Sales Trace */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<ShoppingCart size={18} />} title="销售溯源" section="sales" />
                        {expandedSections.has('sales') && (
                            <InfoGrid>
                                <InfoItem label="销售渠道" value={SALES_CHANNEL_MAP[product.sales_channel] || product.sales_channel || '-'} />
                                <InfoItem label="经销商" value={product.sold_to_dealer_name || '-'} />
                                <InfoItem label="发货日期" value={formatDate(product.ship_to_dealer_date)} />
                                <InfoItem label="订单号" value={product.original_order_id || '-'} />
                            </InfoGrid>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Ownership */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<User size={18} />} title="终端归属" section="ownership" />
                        {expandedSections.has('ownership') && (
                            <InfoGrid>
                                <InfoItem label="当前所有者" value={product.current_owner_name || '-'} />
                                <InfoItem label="注册日期" value={formatDate(product.registration_date)} />
                                <InfoItem label="发票日期" value={formatDate(product.sales_invoice_date)} />
                                {product.sales_invoice_proof && (
                                    <InfoItem
                                        label="发票凭证"
                                        value={<a href={product.sales_invoice_proof} target="_blank" style={{ color: '#3B82F6' }}>查看PDF</a>}
                                    />
                                )}
                            </InfoGrid>
                        )}
                    </div>

                    {/* Warranty */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<Shield size={18} />} title="保修信息" section="warranty" />
                        {expandedSections.has('warranty') && (
                            <div style={{ padding: 20 }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: 20,
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: 12,
                                    border: `2px solid ${getWarrantyStatusColor(product.warranty_status)}`
                                }}>
                                    <div style={{
                                        width: 60,
                                        height: 60,
                                        borderRadius: '50%',
                                        background: `${getWarrantyStatusColor(product.warranty_status)}20`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 20
                                    }}>
                                        <Shield size={28} color={getWarrantyStatusColor(product.warranty_status)} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: getWarrantyStatusColor(product.warranty_status) }}>
                                            {getWarrantyStatusText(product.warranty_status)}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                            剩余 {remainingDays > 0 ? remainingDays : 0} 天
                                        </div>
                                    </div>
                                </div>
                                <InfoGrid>
                                    <InfoItem label="保修依据" value={WARRANTY_SOURCE_MAP[product.warranty_source] || product.warranty_source || '-'} />
                                    <InfoItem label="保修时长" value={`${product.warranty_months || 24} 个月`} />
                                    <InfoItem label="起始日期" value={formatDate(product.warranty_start_date)} />
                                    <InfoItem label="结束日期" value={formatDate(product.warranty_end_date)} />
                                </InfoGrid>
                            </div>
                        )}
                    </div>

                    {/* Service History */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<History size={18} />} title="服务历史" section="history" />
                        {expandedSections.has('history') && (
                            <div style={{ display: 'flex', gap: 16, padding: 20 }}>
                                <div style={{ flex: 1, textAlign: 'center', padding: 16, background: 'rgba(59,130,246,0.1)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.3)' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#3B82F6' }}>{product.inquiry_count || 0}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>咨询工单</div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'center', padding: 16, background: 'rgba(245,158,11,0.1)', borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B' }}>{product.rma_count || 0}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>RMA返厂</div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'center', padding: 16, background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)' }}>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#EF4444' }}>{product.repair_count || 0}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>维修记录</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setIsDeleteModalOpen(false)}>
                    <div style={{
                        width: 400,
                        background: '#1c1c1e',
                        borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: 24,
                        textAlign: 'center'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: 12, color: '#EF4444' }}>
                            确认删除
                        </div>
                        <div style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                            确定要删除产品 <strong>{product?.model_name}</strong> ({product?.serial_number}) 吗？<br />
                            此操作不可撤销。
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: 8,
                                    border: '1px solid var(--glass-border)',
                                    background: 'transparent',
                                    color: 'var(--text-main)',
                                    cursor: 'pointer'
                                }}
                            >
                                取消
                            </button>
                            <button
                                onClick={handleDelete}
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#EF4444',
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

export default ProductDetailPage;
