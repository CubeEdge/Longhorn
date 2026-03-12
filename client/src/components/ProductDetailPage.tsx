import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ArrowLeft, Edit2, MoreHorizontal, User, Shield, Calculator, CheckCircle, AlertTriangle, Trash2, History, Package, Wifi, ShoppingCart, ChevronDown, ChevronUp, Power, AlertCircle, X } from 'lucide-react';
import ProductModal from './Workspace/ProductModal';
import ProductSummaryCard from './Workspace/ProductSummaryCard';
import ProductWarrantyRegistrationModal from './Service/ProductWarrantyRegistrationModal';

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
    // Joined fields
    sku_name?: string;
    sku_code?: string;
    model_display_name?: string;
}

// Redundant map removed

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
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['physical', 'iot', 'sales', 'ownership', 'warranty', 'history']));
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [tickets, setTickets] = useState<any[]>([]);
    const [warrantyCalc, setWarrantyCalc] = useState<any>(null);
    const [showCalculationModal, setShowCalculationModal] = useState(false);
    const [isWarrantyRegistrationOpen, setIsWarrantyRegistrationOpen] = useState(false);
    const [selectedTicketType, setSelectedTicketType] = useState<string | null>(null);

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
            axios.get(`/api/v1/warranty/product/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                if (res.data.success) {
                    setWarrantyCalc(res.data.data);
                }
            }).catch(console.error);
        }
    }, [token, id]);

    useEffect(() => {
        if (token && product?.serial_number) {
            const fetchTickets = async () => {
                try {
                    const res = await axios.get(`/api/v1/context/by-serial-number?serial_number=${product.serial_number}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const allTicketsRaw = res.data.data?.service_history || [];

                    const formattedTickets = allTicketsRaw.map((t: any) => ({
                        id: t.id,
                        ticket_number: t.ticket_number,
                        type: t.type === 'DealerRepair' ? 'dealer_repair' : (t.type || t.ticket_type || '').toLowerCase(),
                        status: t.status,
                        problem_summary: t.problem_summary || t.problem_description || t.repair_content,
                        created_at: t.created_at,
                        product_name: t.product_name,
                        customer_name: t.account_name || t.dealer_name,
                        contact_name: t.contact_name
                    })).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    setTickets(formattedTickets);
                } catch (err) {
                    console.error('Failed to fetch tickets', err);
                }
            };
            fetchTickets();
        }
    }, [token, product?.serial_number]);

    const fetchWarrantyCalc = async () => {
        try {
            const res = await axios.get(`/api/v1/warranty/product/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setWarrantyCalc(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch warranty calc:', err);
        }
    };

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

    const toggleSection = (section: string) => {
        const newSet = new Set(expandedSections);
        if (newSet.has(section)) {
            newSet.delete(section);
        } else {
            newSet.add(section);
        }
        setExpandedSections(newSet);
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

    // Use true calculated warranty engine logic
    const isWarrantyUnknown = warrantyCalc?.final_warranty_status === 'warranty_unknown';
    const isWarrantyValid = warrantyCalc ? warrantyCalc.final_warranty_status === 'warranty_valid' : product.warranty_status === 'ACTIVE';
    const activeColor = isWarrantyUnknown ? '#F59E0B' : (isWarrantyValid ? '#10B981' : '#EF4444');
    const activeText = isWarrantyUnknown ? '保修待确认' : (isWarrantyValid ? '保内' : '过保');

    const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; section: string }> = ({ icon, title, section }) => (
        <div
            onClick={() => toggleSection(section)}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: expandedSections.has(section) ? '1px solid var(--glass-border)' : 'none',
                cursor: 'pointer'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ color: '#3B82F6' }}>{React.cloneElement(icon as React.ReactElement<any>, { size: 24 })}</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{title}</span>
            </div>
            {expandedSections.has(section) ? <ChevronUp size={24} color="var(--text-secondary)" /> : <ChevronDown size={24} color="var(--text-secondary)" />}
        </div>
    );

    const InfoGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px 32px', padding: 24 }}>
            {children}
        </div>
    );

    const InfoItem: React.FC<{ label: string; value: React.ReactNode; valueColor?: string }> = ({ label, value, valueColor }) => (
        <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: valueColor || 'var(--text-main)', letterSpacing: '-0.01em' }}>{value}</div>
        </div>
    );

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>
            {/* Action Buttons Top Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
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

                <div style={{ position: 'relative' }}>
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

                    {showMoreMenu && (
                        <>
                            <div
                                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                onClick={() => setShowMoreMenu(false)}
                            />
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: 8,
                                width: 160,
                                background: '#1c1c1e',
                                borderRadius: 12,
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                                zIndex: 11,
                                padding: 6,
                                overflow: 'hidden'
                            }}>
                                <button
                                    onClick={() => {
                                        setIsEditModalOpen(true);
                                        setShowMoreMenu(false);
                                    }}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '10px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: 8,
                                        color: '#fff',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <Edit2 size={16} color="#3B82F6" />
                                    <span>编辑产品</span>
                                </button>
                                {product?.warranty_status !== 'ACTIVE' && (
                                    <button
                                        onClick={() => { handleStatusChange('ACTIVE'); setShowMoreMenu(false); }}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '10px 12px',
                                            background: 'transparent',
                                            border: 'none',
                                            borderRadius: 8,
                                            color: '#10B981',
                                            fontSize: '0.9rem',
                                            cursor: 'pointer',
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
                                            padding: '10px 16px',
                                            background: 'none',
                                            border: 'none',
                                            color: '#FFD200',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            textAlign: 'left',
                                            fontWeight: 600
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
                                            fontSize: '1rem',
                                            textAlign: 'left',
                                            fontWeight: 600
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
                                        fontSize: '1rem',
                                        textAlign: 'left',
                                        fontWeight: 600
                                    }}
                                >
                                    <Trash2 size={16} /> 删除
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ProductSummaryCard
                product={{
                    model_name: product.model_name,
                    serial_number: product.serial_number,
                    product_family: product.product_family,
                    warranty_status: product.warranty_status,
                    is_iot_device: product.is_iot_device
                }}
                isWarrantyValid={isWarrantyValid}
                hideBadges={true}
            />

            {/* Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Basic Information */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<Package size={18} />} title="基本信息" section="physical" />
                        {expandedSections.has('physical') && (
                            <InfoGrid>
                                <InfoItem label="序列号" value={product.serial_number} />
                                <InfoItem label="型号名称" value={product.model_display_name || product.model_name || '-'} />
                                <InfoItem label="产品SKU" value={product.sku_name || product.product_sku || '-'} />
                                <InfoItem label="内部型号" value={product.internal_name || '-'} />
                                <InfoItem label="产品族群" value={product.product_family || '-'} />
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


                    {/* Warranty */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<Shield size={18} />} title="保修信息" section="warranty" />
                        {expandedSections.has('warranty') && (
                            <div style={{ padding: 20 }}>
                                {/* Warranty Status Header - Simplified without rectangular box */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: 20
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <Shield size={24} color={activeColor} />
                                        <span style={{ fontSize: '1.1rem', fontWeight: 600, color: activeColor }}>
                                            {activeText}
                                        </span>
                                    </div>
                                    {warrantyCalc && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {/* One-click register button for unknown warranty */}
                                            {isWarrantyUnknown ? (
                                                <button
                                                    onClick={() => setIsWarrantyRegistrationOpen(true)}
                                                    style={{
                                                        padding: '8px 14px',
                                                        background: 'rgba(255,210,0,0.15)',
                                                        border: '1px solid rgba(255,210,0,0.4)',
                                                        borderRadius: 8,
                                                        color: '#FFD200',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        fontSize: '0.85rem',
                                                        fontWeight: 600,
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,210,0,0.25)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,210,0,0.15)'; }}
                                                >
                                                    <Shield size={14} /> 一键注册保修
                                                </button>
                                            ) : (
                                                /* Only show "View Calculation" when warranty status is determined */
                                                <button
                                                    onClick={() => setShowCalculationModal(true)}
                                                    style={{
                                                        padding: '8px 12px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: 8,
                                                        color: 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 8,
                                                        fontSize: '0.85rem'
                                                    }}
                                                >
                                                    <Calculator size={16} /> 查看计算
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <InfoGrid>
                                    <InfoItem label="保修依据" value={WARRANTY_SOURCE_MAP[warrantyCalc?.calculation_basis?.toUpperCase()] || warrantyCalc?.calculation_basis || WARRANTY_SOURCE_MAP[product.warranty_source] || product.warranty_source || '-'} />
                                    <InfoItem label="保修时长" value={`${product.warranty_months || 24} 个月`} />
                                    <InfoItem label="起始日期" value={formatDate(warrantyCalc ? warrantyCalc.start_date : product.warranty_start_date)} />
                                </InfoGrid>
                            </div>
                        )}
                    </div>

                    {/* Service History */}
                    <div style={{ background: 'var(--glass-bg)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                        <SectionHeader icon={<History size={18} />} title="关联服务工单" section="history" />
                        {expandedSections.has('history') && (
                            <div style={{ padding: 20 }}>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <button 
                                        onClick={() => setSelectedTicketType(selectedTicketType === 'inquiry' ? null : 'inquiry')} 
                                        style={{ 
                                            flex: 1, textAlign: 'center', padding: '16px 12px', 
                                            background: selectedTicketType === 'inquiry' ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.1)', 
                                            borderRadius: 12, 
                                            border: selectedTicketType === 'inquiry' ? '2px solid #3B82F6' : '1px solid rgba(59,130,246,0.3)', 
                                            cursor: 'pointer', transition: 'all 0.2s' 
                                        }}
                                    >
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3B82F6', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{product.inquiry_count}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6, fontWeight: 600 }}>咨询工单</div>
                                    </button>
                                    <button 
                                        onClick={() => setSelectedTicketType(selectedTicketType === 'rma' ? null : 'rma')} 
                                        style={{ 
                                            flex: 1, textAlign: 'center', padding: '16px 12px', 
                                            background: selectedTicketType === 'rma' ? 'rgba(255,210,0,0.2)' : 'rgba(255,210,0,0.1)', 
                                            borderRadius: 12, 
                                            border: selectedTicketType === 'rma' ? '2px solid #FFD200' : '1px solid rgba(255,210,0,0.3)', 
                                            cursor: 'pointer', transition: 'all 0.2s' 
                                        }}
                                    >
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#FFD200', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{product.rma_count}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6, fontWeight: 600 }}>RMA返厂</div>
                                    </button>
                                    <button 
                                        onClick={() => setSelectedTicketType(selectedTicketType === 'dealer_repair' ? null : 'dealer_repair')} 
                                        style={{ 
                                            flex: 1, textAlign: 'center', padding: '16px 12px', 
                                            background: selectedTicketType === 'dealer_repair' ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)', 
                                            borderRadius: 12, 
                                            border: selectedTicketType === 'dealer_repair' ? '2px solid #EF4444' : '1px solid rgba(239,68,68,0.3)', 
                                            cursor: product.repair_count > 0 ? 'pointer' : 'default', 
                                            opacity: product.repair_count > 0 ? 1 : 0.6 
                                        }}
                                    >
                                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#EF4444', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{product.repair_count}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6, fontWeight: 600 }}>维修记录</div>
                                    </button>
                                </div>

                                {/* Ticket Cards */}
                                {selectedTicketType && (
                                    <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                        {tickets.filter(t => t.type === selectedTicketType).length === 0 ? (
                                            <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                                                暂无{selectedTicketType === 'inquiry' ? '咨询' : selectedTicketType === 'rma' ? 'RMA' : '维修'}工单
                                            </div>
                                        ) : (
                                            tickets.filter(t => t.type === selectedTicketType).map((ticket: any) => (
                                                <div
                                                    key={ticket.id}
                                                    onClick={() => window.open(`/service/${selectedTicketType === 'inquiry' ? 'inquiry-tickets' : 'rma-tickets'}/${ticket.id}`, '_blank')}
                                                    style={{
                                                        padding: 16,
                                                        background: 'rgba(255,255,255,0.02)',
                                                        border: '1px solid rgba(255,255,255,0.08)',
                                                        borderRadius: 10,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        borderLeft: `3px solid ${selectedTicketType === 'inquiry' ? '#3B82F6' : selectedTicketType === 'rma' ? '#FFD200' : '#EF4444'}`
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                                >
                                                    {/* Header: Ticket Number + Status */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                                                {ticket.ticket_number}
                                                            </span>
                                                        </div>
                                                        <span style={{ 
                                                            fontSize: '0.7rem', 
                                                            padding: '3px 10px', 
                                                            borderRadius: 12, 
                                                            background: ticket.status === 'resolved' || ticket.status === 'closed' ? 'rgba(16,185,129,0.15)' : 'rgba(255,210,0,0.15)',
                                                            color: ticket.status === 'resolved' || ticket.status === 'closed' ? '#10B981' : '#FFD200',
                                                            fontWeight: 500,
                                                            textTransform: 'lowercase'
                                                        }}>
                                                            {ticket.status}
                                                        </span>
                                                    </div>

                                                    {/* Problem Description */}
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: 12, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {ticket.problem_summary || ticket.problem_description || '无描述'}
                                                    </div>

                                                    {/* Footer: Product | Customer | Contact */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                                        {ticket.product_name && (
                                                            <span style={{ color: '#888' }}>{ticket.product_name}</span>
                                                        )}
                                                        {ticket.product_name && ticket.account_name && (
                                                            <span style={{ color: '#555' }}>|</span>
                                                        )}
                                                        {ticket.account_name && (
                                                            <span>{ticket.account_name}</span>
                                                        )}
                                                        {(ticket.product_name || ticket.account_name) && ticket.contact_name && (
                                                            <span style={{ color: '#555' }}>|</span>
                                                        )}
                                                        {ticket.contact_name && (
                                                            <span>{ticket.contact_name}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}

                            </div>
                        )}
                    </div>

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
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {
                isDeleteModalOpen && (
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
                )
            }
            {
                showCalculationModal && warrantyCalc && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ background: '#1c1c1e', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', width: 500, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255, 210, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Calculator size={20} color="#FFD200" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>产品保修计算引擎</h3>
                                        <p style={{ margin: 0, fontSize: 12, color: '#888', marginTop: 4 }}>序列号：{product.serial_number}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowCalculationModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                                    <X size={24} />
                                </button>
                            </div>
                            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                                <div style={{ padding: '0 4px' }}>
                                    <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#aaa', fontWeight: 600 }}>保修计算说明</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#888' }}>
                                        {[
                                            { p: 1, basis: 'IOT_ACTIVATION', label: 'IoT', detail: '联网激活日期' },
                                            { p: 2, basis: 'INVOICE_PROOF', label: '发票', detail: '人工发票日期' },
                                            { p: 3, basis: 'REGISTRATION', label: '注册', detail: '用户注册日期' },
                                            { p: 4, basis: 'DIRECT_SHIPMENT', label: '直销', detail: '直销出库+7天' },
                                            { p: 5, basis: 'DEALER_FALLBACK', label: '兜底', detail: '代理发货+90天' }
                                        ].map((rule) => {
                                            const isActive = warrantyCalc?.calculation_basis?.toUpperCase() === rule.basis;
                                            return (
                                                <div key={rule.p} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    padding: '6px 10px',
                                                    background: isActive ? 'rgba(255, 210, 0, 0.1)' : 'rgba(255,255,255,0.02)',
                                                    borderRadius: 6,
                                                    border: isActive ? '1px solid rgba(255, 210, 0, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                                                    gridColumn: rule.p === 5 ? 'span 2' : 'auto'
                                                }}>
                                                    <span style={{ color: isActive ? '#FFD200' : '#888', fontWeight: 700 }}>{rule.p}.</span>
                                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <span style={{ color: isActive ? '#fff' : '#ccc', fontWeight: 600 }}>{rule.label}</span>
                                                        <span style={{ fontSize: 11, opacity: 0.7 }}>{rule.detail}</span>
                                                    </div>
                                                    {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFD200' }} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

                                {/* Result Section */}
                                <div style={{
                                    padding: 16, borderRadius: 12,
                                    background: warrantyCalc.final_warranty_status === 'warranty_valid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                    border: `1px solid ${warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444'}`,
                                    display: 'flex', flexDirection: 'column', gap: 12
                                }}>
                                    <h4 style={{ margin: 0, fontSize: 12, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444', opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>本机计算结果</h4>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        {warrantyCalc.final_warranty_status === 'warranty_valid'
                                            ? <CheckCircle size={22} color="#10B981" />
                                            : <AlertTriangle size={22} color="#EF4444" />}
                                        <span style={{ fontSize: 18, fontWeight: 700, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444' }}>
                                            {warrantyCalc.final_warranty_status === 'warranty_valid' ? '在保期内 - 免费维修' : '已过保 - 付费维修'}
                                        </span>
                                    </div>
                                    <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                                        {[
                                            { label: '生效日期', value: warrantyCalc.start_date || '-' },
                                            { label: '截止日期', value: warrantyCalc.end_date || '-' },
                                            {
                                                label: '计算依据',
                                                value: (() => {
                                                    const map: Record<string, string> = {
                                                        'iot_activation': 'IoT激活日期',
                                                        'invoice': '销售发票日期',
                                                        'registration': '官网注册日期',
                                                        'direct_ship': '直销发货日期+7天',
                                                        'dealer_fallback': '经销商发货日期+90天',
                                                        'damage_void': '人为损坏（保修失效）',
                                                        'ticket_created': '保修依据缺失',
                                                        'unknown': '保修依据缺失'
                                                    };
                                                    return map[warrantyCalc.calculation_basis?.toLowerCase()] || warrantyCalc.calculation_basis || '-';
                                                })(),
                                                fullWidth: true
                                            }
                                        ].map((item, idx) => (
                                            <div key={idx} style={{ gridColumn: item.fullWidth ? '1/-1' : 'span 1' }}>
                                                <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{item.label}</div>
                                                <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{item.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>
                                <button onClick={() => setShowCalculationModal(false)} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>确认关闭</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Product Edit Modal */}
            {
                product && (
                    <ProductModal
                        isOpen={isEditModalOpen}
                        onClose={() => setIsEditModalOpen(false)}
                        onSuccess={() => {
                            fetchProductDetail();
                        }}
                        editingProduct={product as any}
                    />
                )
            }
            {/* Warranty Registration Modal */}
            {
                product && (
                    <ProductWarrantyRegistrationModal
                        isOpen={isWarrantyRegistrationOpen}
                        onClose={() => setIsWarrantyRegistrationOpen(false)}
                        serialNumber={product.serial_number || ''}
                        productName={product.model_name || ''}
                        onRegistered={() => {
                            setIsWarrantyRegistrationOpen(false);
                            fetchProductDetail(); // Refresh product info
                            fetchWarrantyCalc(); // Refresh warranty calc status
                        }}
                    />
                )
            }
        </div >
    );
};

export default ProductDetailPage;
