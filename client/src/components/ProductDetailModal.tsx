import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    X, Package, Wifi, ShoppingCart, User, Shield, History,
    CheckCircle, AlertCircle
} from 'lucide-react';

interface ProductDetail {
    // Physical Identity
    id: number;
    model_name: string;
    internal_name: string;
    serial_number: string;
    product_sku: string;
    product_type: string;
    product_family: string;
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
    sold_to_dealer_name: string;
    ship_to_dealer_date: string;

    // Ownership
    current_owner_id: number;
    current_owner_name: string;
    registration_date: string;
    sales_invoice_date: string;
    sales_invoice_proof: string;

    // Warranty
    warranty_source: string;
    warranty_start_date: string;
    warranty_months: number;
    warranty_end_date: string;
    warranty_status: 'ACTIVE' | 'EXPIRED' | 'PENDING';

    // Stats
    inquiry_count: number;
    rma_count: number;
    repair_count: number;
}

interface ProductDetailModalProps {
    productId: number;
    onClose: () => void;
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

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ productId, onClose }) => {
    const { token } = useAuthStore();
    const [product, setProduct] = useState<ProductDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchProductDetail();
    }, [productId]);

    const fetchProductDetail = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/admin/products/${productId}/detail`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProduct(res.data.data);
            }
        } catch (err: any) {
            setError(err.response?.data?.error?.message || '获取设备详情失败');
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
            <div style={modalOverlayStyle}>
                <div style={{ ...modalContentStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
                    <div style={{ color: '#888' }}>加载中...</div>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div style={modalOverlayStyle}>
                <div style={{ ...modalContentStyle, padding: 40, textAlign: 'center' }}>
                    <AlertCircle size={48} color="#EF4444" style={{ marginBottom: 16 }} />
                    <div style={{ color: '#EF4444', marginBottom: 16 }}>{error || '设备不存在'}</div>
                    <button onClick={onClose} style={closeButtonStyle}>关闭</button>
                </div>
            </div>
        );
    }

    const familyInfo = PRODUCT_FAMILY_MAP[product.product_family] || { label: '未知', color: '#6B7280' };
    const remainingDays = calculateRemainingDays(product.warranty_end_date);

    return (
        <div style={modalOverlayStyle} onClick={onClose}>
            <div style={modalContentStyle} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={headerStyle}>
                    <div style={headerLeftStyle}>
                        <Package size={24} color="#3B82F6" />
                        <div>
                            <h2 style={titleStyle}>{product.model_name}</h2>
                            <div style={subtitleStyle}>
                                <span style={{ fontFamily: 'monospace', color: '#fff' }}>{product.serial_number}</span>
                                <span style={{ margin: '0 8px', color: '#444' }}>|</span>
                                <span style={{ color: familyInfo.color }}>{familyInfo.label}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}>
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={bodyStyle}>
                    {/* Physical Identity */}
                    <Section icon={<Package size={18} />} title="物理身份">
                        <InfoGrid>
                            <InfoItem label="序列号" value={product.serial_number} />
                            <InfoItem label="产品SKU" value={product.product_sku || '-'} />
                            <InfoItem label="内部型号" value={product.internal_name || '-'} />
                            <InfoItem label="产品类型" value={product.product_type || 'CAMERA'} />
                            <InfoItem label="生产日期" value={formatDate(product.production_date)} />
                        </InfoGrid>
                    </Section>

                    {/* IoT Status */}
                    <Section icon={<Wifi size={18} />} title="联网状态">
                        <InfoGrid>
                            <InfoItem
                                label="IoT设备"
                                value={product.is_iot_device ? '是' : '否'}
                                valueColor={product.is_iot_device ? '#10B981' : '#888'}
                            />
                            <InfoItem
                                label="激活状态"
                                value={product.is_activated ? '已激活' : '未激活'}
                                valueColor={product.is_activated ? '#10B981' : '#888'}
                            />
                            <InfoItem label="激活日期" value={formatDate(product.activation_date)} />
                            <InfoItem label="最后连接" value={product.last_connected_at ? new Date(product.last_connected_at).toLocaleString('zh-CN') : '-'} />
                            <InfoItem label="固件版本" value={product.firmware_version || '-'} />
                            <InfoItem label="IP地址" value={product.ip_address || '-'} />
                        </InfoGrid>
                    </Section>

                    {/* Sales Trace */}
                    <Section icon={<ShoppingCart size={18} />} title="销售溯源">
                        <InfoGrid>
                            <InfoItem label="销售渠道" value={SALES_CHANNEL_MAP[product.sales_channel] || product.sales_channel || '-'} />
                            <InfoItem label="经销商" value={product.sold_to_dealer_name || '-'} />
                            <InfoItem label="发货日期" value={formatDate(product.ship_to_dealer_date)} />
                            <InfoItem label="订单号" value={product.original_order_id || '-'} />
                        </InfoGrid>
                    </Section>

                    {/* Ownership */}
                    <Section icon={<User size={18} />} title="终端归属">
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
                    </Section>

                    {/* Warranty */}
                    <Section icon={<Shield size={18} />} title="保修信息">
                        <div style={warrantyCardStyle}>
                            <div style={{ ...warrantyStatusStyle, borderColor: getWarrantyStatusColor(product.warranty_status) }}>
                                <CheckCircle size={32} color={getWarrantyStatusColor(product.warranty_status)} />
                                <div style={{ marginLeft: 16 }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: getWarrantyStatusColor(product.warranty_status) }}>
                                        {getWarrantyStatusText(product.warranty_status)}
                                    </div>
                                    <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                                        剩余 {remainingDays > 0 ? remainingDays : 0} 天
                                    </div>
                                </div>
                            </div>
                            <InfoGrid style={{ marginTop: 16 }}>
                                <InfoItem label="保修依据" value={WARRANTY_SOURCE_MAP[product.warranty_source] || product.warranty_source || '-'} />
                                <InfoItem label="保修时长" value={`${product.warranty_months || 24} 个月`} />
                                <InfoItem label="起始日期" value={formatDate(product.warranty_start_date)} />
                                <InfoItem label="结束日期" value={formatDate(product.warranty_end_date)} />
                            </InfoGrid>
                        </div>
                    </Section>

                    {/* Service History */}
                    <Section icon={<History size={18} />} title="服务历史">
                        <div style={serviceHistoryStyle}>
                            <StatCard label="咨询工单" value={product.inquiry_count || 0} color="#3B82F6" />
                            <StatCard label="RMA返厂" value={product.rma_count || 0} color="#F59E0B" />
                            <StatCard label="维修记录" value={product.repair_count || 0} color="#EF4444" />
                        </div>
                    </Section>
                </div>
            </div>
        </div>
    );
};

// Sub-components
const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>
            <span style={sectionIconStyle}>{icon}</span>
            <span style={sectionTitleStyle}>{title}</span>
        </div>
        <div style={sectionContentStyle}>{children}</div>
    </div>
);

const InfoGrid: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <div style={{ ...infoGridStyle, ...style }}>{children}</div>
);

const InfoItem: React.FC<{ label: string; value: React.ReactNode; valueColor?: string }> = ({ label, value, valueColor }) => (
    <div style={infoItemStyle}>
        <div style={infoLabelStyle}>{label}</div>
        <div style={{ ...infoValueStyle, color: valueColor || '#fff' }}>{value}</div>
    </div>
);

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
    <div style={{ ...statCardStyle, borderColor: color }}>
        <div style={{ ...statValueStyle, color }}>{value}</div>
        <div style={statLabelStyle}>{label}</div>
    </div>
);

// Styles
const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(10px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20
};

const modalContentStyle: React.CSSProperties = {
    width: 720,
    maxHeight: '90vh',
    background: '#1c1c1e',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
};

const headerStyle: React.CSSProperties = {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(0,0,0,0.2)'
};

const headerLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16
};

const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: '#fff'
};

const subtitleStyle: React.CSSProperties = {
    fontSize: 13,
    color: '#888',
    marginTop: 4
};

const closeBtnStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const bodyStyle: React.CSSProperties = {
    padding: 24,
    overflowY: 'auto',
    flex: 1
};

const sectionStyle: React.CSSProperties = {
    marginBottom: 24,
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden'
};

const sectionHeaderStyle: React.CSSProperties = {
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    alignItems: 'center',
    gap: 8
};

const sectionIconStyle: React.CSSProperties = {
    color: '#3B82F6'
};

const sectionTitleStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff'
};

const sectionContentStyle: React.CSSProperties = {
    padding: 16
};

const infoGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 16
};

const infoItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 4
};

const infoLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#666'
};

const infoValueStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500
};

const warrantyCardStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: 8,
    padding: 16
};

const warrantyStatusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: 16,
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    border: '2px solid transparent'
};

const serviceHistoryStyle: React.CSSProperties = {
    display: 'flex',
    gap: 16
};

const statCardStyle: React.CSSProperties = {
    flex: 1,
    padding: 16,
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    border: '2px solid transparent',
    textAlign: 'center'
};

const statValueStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 700
};

const statLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#888',
    marginTop: 4
};

const closeButtonStyle: React.CSSProperties = {
    padding: '10px 24px',
    background: '#3B82F6',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer'
};

export default ProductDetailModal;
