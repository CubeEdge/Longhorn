import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import {
    X, Package, Wifi, ShoppingCart, User, Shield, History,
    CheckCircle, AlertCircle, MessageSquare, Wrench, Calculator, AlertTriangle
} from 'lucide-react';
import { TicketCard } from './TicketCard';

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
    const [tickets, setTickets] = useState<any[]>([]);
    const [expandedTicketSection, setExpandedTicketSection] = useState<string | null>(null);
    const [warrantyCalc, setWarrantyCalc] = useState<any>(null);
    const [showCalculationModal, setShowCalculationModal] = useState(false);

    useEffect(() => {
        fetchProductDetail();
        if (token && productId) {
            axios.get(`/api/v1/warranty/product/${productId}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then(res => {
                if (res.data.success) {
                    setWarrantyCalc(res.data.data);
                }
            }).catch(console.error);
        }
    }, [productId, token]);

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

    // Use true calculated warranty engine logic
    const remainingDays = calculateRemainingDays(warrantyCalc ? warrantyCalc.end_date : product.warranty_end_date);
    const isWarrantyValid = warrantyCalc ? warrantyCalc.final_warranty_status === 'warranty_valid' : product.warranty_status === 'ACTIVE';
    const activeColor = isWarrantyValid ? '#10B981' : '#EF4444';
    const activeText = isWarrantyValid ? '保内' : '过保';

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



                    {/* Warranty */}
                    <Section icon={<Shield size={18} />} title="保修信息">
                        <div style={warrantyCardStyle}>
                            <div style={{ ...warrantyStatusStyle, borderColor: activeColor, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <CheckCircle size={32} color={activeColor} />
                                    <div style={{ marginLeft: 16 }}>
                                        <div style={{ fontSize: 20, fontWeight: 700, color: activeColor, letterSpacing: '-0.02em' }}>
                                            {activeText}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#888', marginTop: 4, letterSpacing: '-0.01em' }}>
                                            剩余 {remainingDays > 0 ? remainingDays : 0} 天
                                        </div>
                                    </div>
                                </div>
                                {warrantyCalc && (
                                    <button
                                        onClick={() => setShowCalculationModal(true)}
                                        style={{
                                            padding: '8px 12px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 8,
                                            color: '#888',
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
                            <InfoGrid style={{ marginTop: 16 }}>
                                <InfoItem label="保修依据" value={WARRANTY_SOURCE_MAP[warrantyCalc?.calculation_basis?.toUpperCase()] || warrantyCalc?.calculation_basis || WARRANTY_SOURCE_MAP[product.warranty_source] || product.warranty_source || '-'} />
                                <InfoItem label="保修时长" value={`${product.warranty_months || 24} 个月`} />
                                <InfoItem label="起始日期" value={formatDate(warrantyCalc ? warrantyCalc.start_date : product.warranty_start_date)} />
                                <InfoItem label="结束日期" value={formatDate(warrantyCalc ? warrantyCalc.end_date : product.warranty_end_date)} />
                            </InfoGrid>
                        </div>
                    </Section>

                    {/* Service History */}
                    <Section icon={<History size={18} />} title="关联服务工单">
                        <div style={serviceHistoryStyle}>
                            <button onClick={() => setExpandedTicketSection(expandedTicketSection === 'inquiry' ? null : 'inquiry')} style={{ flex: 1, padding: '12px 8px', background: expandedTicketSection === 'inquiry' ? 'rgba(59,130,246,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: 8, border: expandedTicketSection === 'inquiry' ? '2px solid #3B82F6' : '2px solid transparent', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#3B82F6', lineHeight: 1.2 }}>{tickets.filter(t => t.type === 'inquiry').length}</div>
                                <div style={{ fontSize: 11, color: '#888', marginTop: 4, letterSpacing: '-0.01em' }}>咨询工单</div>
                            </button>
                            <button onClick={() => setExpandedTicketSection(expandedTicketSection === 'rma' ? null : 'rma')} style={{ flex: 1, padding: '12px 8px', background: expandedTicketSection === 'rma' ? 'rgba(245,158,11,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: 8, border: expandedTicketSection === 'rma' ? '2px solid #FFD200' : '2px solid transparent', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#FFD200', lineHeight: 1.2 }}>{tickets.filter(t => t.type === 'rma').length}</div>
                                <div style={{ fontSize: 11, color: '#888', marginTop: 4, letterSpacing: '-0.01em' }}>RMA返厂</div>
                            </button>
                            <button onClick={() => setExpandedTicketSection(expandedTicketSection === 'repair' ? null : 'repair')} style={{ flex: 1, padding: '12px 8px', background: expandedTicketSection === 'repair' ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.2)', borderRadius: 8, border: expandedTicketSection === 'repair' ? '2px solid #EF4444' : '2px solid transparent', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', outline: 'none' }}>
                                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', color: '#EF4444', lineHeight: 1.2 }}>{tickets.filter(t => t.type === 'dealer_repair').length}</div>
                                <div style={{ fontSize: 11, color: '#888', marginTop: 4, letterSpacing: '-0.01em' }}>维修记录</div>
                            </button>
                        </div>


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
                        {/* Expanded Ticket List */}
                        {expandedTicketSection && ['inquiry', 'rma', 'repair'].includes(expandedTicketSection) && (
                            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <h3 style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {expandedTicketSection === 'inquiry' && <MessageSquare size={16} color="#3B82F6" />}
                                    {expandedTicketSection === 'rma' && <Wrench size={16} color="#FFD200" />}
                                    {expandedTicketSection === 'repair' && <Package size={16} color="#EF4444" />}
                                    {expandedTicketSection === 'inquiry' && '咨询工单'}
                                    {expandedTicketSection === 'rma' && 'RMA返厂记录'}
                                    {expandedTicketSection === 'repair' && '维修记录'}
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {tickets
                                        .filter(t => {
                                            if (expandedTicketSection === 'inquiry') return t.type === 'inquiry';
                                            if (expandedTicketSection === 'rma') return t.type === 'rma';
                                            if (expandedTicketSection === 'repair') return t.type === 'dealer_repair';
                                            return true;
                                        })
                                        .map(ticket => (
                                            <TicketCard
                                                key={ticket.id}
                                                ticketNumber={ticket.ticket_number}
                                                ticketType={ticket.type}
                                                title={ticket.problem_summary || '无标题'}
                                                status={ticket.status}
                                                productModel={ticket.product_name}
                                                customerName={ticket.customer_name}
                                                contactName={ticket.contact_name}
                                                onClick={() => window.open(`/service/${ticket.type === 'inquiry' ? 'inquiry-tickets' : ticket.type === 'rma' ? 'rma-tickets' : 'dealer-repairs'}/${ticket.id}`, '_blank')}
                                            />
                                        ))}
                                    {tickets.filter(t => {
                                        if (expandedTicketSection === 'inquiry') return t.type === 'inquiry';
                                        if (expandedTicketSection === 'rma') return t.type === 'rma';
                                        if (expandedTicketSection === 'repair') return t.type === 'dealer_repair';
                                        return true;
                                    }).length === 0 && (
                                            <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
                                                暂无相关工单
                                            </div>
                                        )}
                                </div>
                            </div>
                        )}
                    </Section>
                </div>
                {showCalculationModal && warrantyCalc && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCalculationModal(false)}>
                        <div style={{ background: '#1c1c1e', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', width: 500, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                                {/* Rules Section */}
                                <div style={{ padding: '0 4px' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#aaa', fontWeight: 600 }}>保修计算说明</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: '#888' }}>
                                        {[
                                            { p: 1, label: 'IoT', detail: '若 activation_date 存在，以此为准' },
                                            { p: 2, label: '人工', detail: '若 sales_invoice_date 存在（有发票），以此为准' },
                                            { p: 3, label: '注册', detail: '若 registration_date 存在，以此为准' },
                                            { p: 4, label: '直销', detail: '若为 DIRECT，按 ship_date + 7 天' },
                                            { p: 5, label: '兜底', detail: '按 ship_to_dealer_date + 90 天' }
                                        ].map((rule) => (
                                            <div key={rule.p} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                <span style={{ color: '#FFD200', fontWeight: 700, whiteSpace: 'nowrap' }}>{rule.p}.</span>
                                                <div>
                                                    <span style={{ color: '#ccc', fontWeight: 600, marginRight: 4 }}>优先级 {rule.p} ({rule.label}):</span>
                                                    {rule.detail}
                                                </div>
                                            </div>
                                        ))}
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
                                            { label: '计算依据', value: warrantyCalc.calculation_basis || '-', fullWidth: true }
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
                )}
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

// StatCard removed as it's no longer used

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
    fontSize: 17,
    fontWeight: 600,
    color: '#fff',
    letterSpacing: '-0.01em'
};

const subtitleStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    letterSpacing: '-0.01em'
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
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    letterSpacing: '-0.01em'
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
    fontSize: 11,
    color: '#666',
    letterSpacing: '-0.01em'
};

const infoValueStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: '-0.01em'
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

// removed unused status styles

const closeButtonStyle: React.CSSProperties = {
    padding: '10px 24px',
    background: '#3B82F6',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer'
};

export default ProductDetailModal;
