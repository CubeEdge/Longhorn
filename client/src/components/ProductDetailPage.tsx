import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
    ArrowLeft, Edit2, Trash2, Shield, Calendar, Package, 
    Link as LinkIcon, Activity, CheckCircle, AlertTriangle, 
    MoreVertical, Power, Clock, Settings, User, Hash, 
    Cpu, Globe, Calculator, X, Info, HelpCircle, AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import ProductModal from './Workspace/ProductModal';
import ProductWarrantyRegistrationModal from './Service/ProductWarrantyRegistrationModal';

interface Product {
    id: number;
    model_name: string;
    internal_name: string;
    serial_number: string;
    product_sku: string;
    product_type: string;
    product_line: string;
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
    ship_to_dealer_date: string;
    current_owner_id: number;
    current_owner_name?: string;
    registration_date: string;
    sales_invoice_date: string;
    sales_invoice_proof: string;
    warranty_start_date: string;
    warranty_months: number;
    warranty_end_date: string;
    warranty_status: 'ACTIVE' | 'EXPIRED' | 'PENDING';
    status: 'ACTIVE' | 'IN_REPAIR' | 'STOLEN' | 'SCRAPPED';
    description: string;
    owner_info?: {
        name: string;
        company?: string;
        phone?: string;
    };
    snapshot_info?: {
        customer_name?: string;
        contact_name?: string;
        contact_phone?: string;
    };
}

interface WarrantyCalc {
    serial_number: string;
    calculation_basis: string;
    start_date: string;
    end_date: string;
    warranty_months: number;
    final_warranty_status: 'warranty_valid' | 'warranty_expired' | 'no_basis';
    basis_details: Record<string, string>;
}

const ProductDetailPage: React.FC = () => {
    const { serialNumber } = useParams<{ serialNumber: string }>();
    const navigate = useNavigate();
    const { token } = useAuthStore();
    
    const [product, setProduct] = useState<Product | null>(null);
    const [warrantyCalc, setWarrantyCalc] = useState<WarrantyCalc | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showCalculationModal, setShowCalculationModal] = useState(false);
    const [isWarrantyRegistrationOpen, setIsWarrantyRegistrationOpen] = useState(false);

    useEffect(() => {
        if (serialNumber) {
            fetchProductDetail();
            fetchWarrantyCalc();
        }
    }, [serialNumber]);

    const fetchProductDetail = async () => {
        try {
            const res = await axios.get(`/api/v1/products/sn/${serialNumber}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setProduct(res.data.data);
            }
        } catch (err: any) {
            setError(err.response?.data?.error?.message || '获取产品详情失败');
        } finally {
            setLoading(false);
        }
    };

    const fetchWarrantyCalc = async () => {
        try {
            const res = await axios.get(`/api/v1/products/sn/${serialNumber}/warranty-calc`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setWarrantyCalc(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch warranty calculation', err);
        }
    };

    const handleDelete = async () => {
        if (!product) return;
        try {
            const res = await axios.delete(`/api/v1/admin/products/${product.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                navigate('/products');
            }
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '删除失败');
        }
    };

    const handleStatusChange = async (status: string) => {
        if (!product) return;
        try {
            const res = await axios.put(`/api/v1/admin/products/${product.id}`, 
                { status }, 
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.data.success) {
                fetchProductDetail();
            }
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '更新状态失败');
        }
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</div>;
    if (error || !product) return <div style={{ padding: 40, textAlign: 'center', color: '#EF4444' }}>{error || '未找到产品'}</div>;

    const StatusBadge = ({ status }: { status: string }) => {
        const config: Record<string, { label: string, color: string, bg: string }> = {
            'ACTIVE': { label: '在役', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
            'IN_REPAIR': { label: '维修中', color: '#FFD200', bg: 'rgba(255,210,0,0.1)' },
            'STOLEN': { label: '失窃', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
            'SCRAPPED': { label: '报废', color: '#6B7280', bg: 'rgba(107,114,128,0.1)' }
        };
        const s = config[status] || { label: status, color: '#888', bg: 'rgba(255,255,255,0.05)' };
        return (
            <div style={{ padding: '4px 10px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 12, fontWeight: 700 }}>
                {s.label}
            </div>
        );
    };

    const WarrantyBadge = ({ status }: { status: string }) => {
        const config: Record<string, { label: string, color: string, bg: string, icon: any }> = {
            'ACTIVE': { label: '保修中', color: '#10B981', bg: 'rgba(16,185,129,0.1)', icon: CheckCircle },
            'EXPIRED': { label: '已过保', color: '#EF4444', bg: 'rgba(239,68,68,0.1)', icon: AlertTriangle },
            'PENDING': { label: '待生效', color: '#FFD200', bg: 'rgba(255,210,0,0.1)', icon: Clock }
        };
        const s = config[status] || { label: status, color: '#888', bg: 'rgba(255,255,255,0.05)', icon: HelpCircle };
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: s.bg, color: s.color, fontSize: 12, fontWeight: 700 }}>
                <s.icon size={14} />
                {s.label}
            </div>
        );
    };

    const InfoGrid = ({ children }: { children: React.ReactNode }) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {children}
        </div>
    );

    const InfoCard = ({ icon: Icon, label, value, color = 'var(--text-main)', subValue }: { icon: any, label: string, value: string, color?: string, subValue?: string }) => (
        <div style={{ 
            background: 'var(--glass-bg-light)', borderRadius: 12, border: '1px solid var(--glass-border)', 
            padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14, transition: 'transform 0.2s',
            cursor: 'default'
        }}>
            <div style={{ 
                width: 36, height: 36, borderRadius: 10, background: 'var(--glass-bg-hover)', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' 
            }}>
                <Icon size={18} />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: color }}>{value}</div>
                {subValue && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{subValue}</div>}
            </div>
        </div>
    );

    const SectionHeader = ({ title, icon: Icon }: { title: string, icon: any }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ color: '#FFD200' }}><Icon size={20} /></div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-main)' }}>{title}</h3>
            <div style={{ flex: 1, height: 1, background: 'var(--glass-border)', marginLeft: 10 }} />
        </div>
    );

    return (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px 60px' }}>
            {/* Top Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <button 
                    onClick={() => navigate(-1)} 
                    style={{ 
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 8,
                        background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                        color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 14, fontWeight: 500
                    }}
                >
                    <ArrowLeft size={16} /> 返回列表
                </button>
                <div style={{ position: 'relative' }}>
                    <button 
                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                        style={{ 
                            width: 36, height: 36, borderRadius: 8, background: 'var(--glass-bg-light)',
                            border: '1px solid var(--glass-border)', cursor: 'pointer', color: 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <MoreVertical size={20} />
                    </button>
                    {showMoreMenu && (
                        <>
                            <div 
                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
                                onClick={() => setShowMoreMenu(false)}
                            />
                            <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: 8,
                                width: 160,
                                background: 'var(--modal-bg, #1c1c1e)',
                                borderRadius: 12,
                                border: '1px solid var(--glass-border)',
                                boxShadow: 'var(--glass-shadow-lg, 0 10px 30px rgba(0,0,0,0.5))',
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
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                        background: 'transparent', border: 'none', borderRadius: 8, color: 'var(--text-main)',
                                        fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left'
                                    }}
                                >
                                    <Edit2 size={16} color="#3B82F6" />
                                    <span>编辑产品</span>
                                </button>
                                {product.status !== 'ACTIVE' && (
                                    <button
                                        onClick={() => { handleStatusChange('ACTIVE'); setShowMoreMenu(false); }}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                            background: 'transparent', border: 'none', borderRadius: 8, color: '#10B981',
                                            fontSize: '0.9rem', cursor: 'pointer', textAlign: 'left'
                                        }}
                                    >
                                        <Power size={16} /> 设为在役
                                    </button>
                                )}
                                {product.status !== 'IN_REPAIR' && (
                                    <button
                                        onClick={() => { handleStatusChange('IN_REPAIR'); setShowMoreMenu(false); }}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                            background: 'none', border: 'none', borderRadius: 8, color: '#FFD200',
                                            cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', fontWeight: 600
                                        }}
                                    >
                                        <AlertCircle size={16} /> 设为维修中
                                    </button>
                                )}
                                <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />
                                <button
                                    onClick={() => { setIsDeleteModalOpen(true); setShowMoreMenu(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px',
                                        background: 'none', border: 'none', borderRadius: 8, color: '#EF4444',
                                        cursor: 'pointer', fontSize: '0.9rem', textAlign: 'left', fontWeight: 600
                                    }}
                                >
                                    <Trash2 size={16} /> 删除
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Header Content */}
            <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                    <div style={{ 
                        width: 80, height: 80, borderRadius: 20, background: 'linear-gradient(135deg, #FFD200, #FFA500)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000',
                        boxShadow: '0 8px 24px rgba(255,210,0,0.2)'
                    }}>
                        <Package size={40} strokeWidth={1.5} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                            <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                                {product.model_name}
                            </h1>
                            <StatusBadge status={product.status} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: 'var(--text-secondary)', fontSize: 15 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Hash size={16} /> {product.serial_number}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LinkIcon size={16} /> SKU: {product.product_sku || '-'}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Globe size={16} /> {product.product_line}</div>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <WarrantyBadge status={product.warranty_status} />
                </div>
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {/* Left Column: Basic Info & IoT */}
                <div style={{ flex: '1 1 600px', display: 'flex', flexDirection: 'column', gap: 40 }}>
                    {/* Basic Info */}
                    <section>
                        <SectionHeader title="基础信息" icon={Info} />
                        <InfoGrid>
                            <InfoCard icon={Cpu} label="产品类型/家族" value={`${product.product_type} / Family ${product.product_family}`} />
                            <InfoCard icon={Calendar} label="生产日期" value={product.production_date || '-'} />
                            <InfoCard icon={Activity} label="固件版本" value={product.firmware_version || '-'} />
                            <InfoCard icon={Settings} label="销售渠道" value={product.sales_channel === 'DIRECT' ? '直销' : '经销商'} />
                        </InfoGrid>
                    </section>

                    {/* IoT Status */}
                    <section>
                        <SectionHeader title="IoT 联网状态" icon={Globe} />
                        <div style={{ background: 'var(--glass-bg-light)', borderRadius: 16, border: '1px solid var(--glass-border)', padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <div style={{ 
                                        width: 12, height: 12, borderRadius: '50%', 
                                        background: product.is_iot_device ? (product.is_activated ? '#10B981' : '#3B82F6') : '#6B7280',
                                        marginTop: 4, boxShadow: `0 0 10px ${product.is_iot_device ? (product.is_activated ? '#10B981' : '#3B82F6') : 'transparent'}`
                                    }} />
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>
                                            {product.is_iot_device ? (product.is_activated ? '已激活' : '未激活 (IoT设备)') : '非 IoT 设备'}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                            {product.is_iot_device ? '支持云端保修校验与远程诊断' : '需通过纸质发票维护保修信息'}
                                        </div>
                                    </div>
                                </div>
                                {product.is_iot_device && (
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>IP 地址</div>
                                        <div style={{ fontSize: 14, fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-main)' }}>{product.ip_address || '未接入'}</div>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, paddingTop: 20, borderTop: '1px solid var(--glass-border)' }}>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>首次联网激活</div>
                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>{product.activation_date || '-'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>最后心跳上报</div>
                                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>{product.last_connected_at || '-'}</div>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Right Column: Warranty & Owner */}
                <div style={{ flex: '1 1 380px', display: 'flex', flexDirection: 'column', gap: 32 }}>
                    {/* Warranty Calculation */}
                    <div style={{ background: 'var(--glass-bg-light)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Shield size={20} color="#FFD200" />
                                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>保修详情</h3>
                            </div>
                            <button 
                                onClick={() => setShowCalculationModal(true)}
                                style={{ 
                                    padding: '6px 14px', borderRadius: 8, background: 'rgba(255,210,0,0.1)',
                                    border: '1px solid rgba(255,210,0,0.3)', color: '#FFD200', fontSize: 12,
                                    fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                查看计算依据
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: 'var(--glass-bg-hover)' }}>
                                <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>生效日期</span>
                                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>{product.warranty_start_date || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: 'var(--glass-bg-hover)' }}>
                                <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>截止日期</span>
                                <span style={{ fontSize: 15, fontWeight: 600, color: product.warranty_status === 'EXPIRED' ? '#EF4444' : 'var(--text-main)' }}>{product.warranty_end_date || '-'}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: 'var(--glass-bg-hover)' }}>
                                <span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>保修时长</span>
                                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-main)' }}>{product.warranty_months} 个月</span>
                            </div>
                        </div>
                        {(!product.warranty_start_date || !product.is_activated) && (
                            <button 
                                onClick={() => setIsWarrantyRegistrationOpen(true)}
                                style={{ 
                                    width: '100%', marginTop: 20, padding: '12px', borderRadius: 12,
                                    background: '#FFD200', color: '#000', border: 'none', fontWeight: 700,
                                    cursor: 'pointer', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                维护/修正保修信息
                            </button>
                        )}
                    </div>

                    {/* Owner Info */}
                    <div style={{ background: 'var(--glass-bg-light)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                            <User size={20} color="#FFD200" />
                            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-main)' }}>客户归属</h3>
                        </div>
                        {product.owner_info || product.snapshot_info ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>当前所有人</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#3B82F6' }}>
                                        {product.owner_info?.name || product.snapshot_info?.customer_name || '未知客户'}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4 }}>{product.owner_info?.company || product.snapshot_info?.contact_name || '-'}</div>
                                </div>
                                <div style={{ height: 1, background: 'var(--glass-border)' }} />
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>联系方式</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>{product.owner_info?.phone || product.snapshot_info?.contact_phone || '-'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>所属经销商</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>{product.sold_to_dealer_id || '直销'}</div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
                                暂无归属信息
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setIsDeleteModalOpen(false)}
                >
                    <div style={{ width: 400, background: 'var(--modal-bg, #1c1c1e)', borderRadius: 20, border: '1px solid var(--glass-border)', padding: 32, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <Trash2 size={32} color="#EF4444" />
                        </div>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-main)', marginBottom: 12 }}>确认删除产品</h3>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 32 }}>
                            确定要删除产品 <strong>{product.model_name}</strong> ({product.serial_number}) 吗？<br />此操作不可撤销。
                        </p>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setIsDeleteModalOpen(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--glass-bg-light)', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>取消</button>
                            <button onClick={handleDelete} style={{ flex: 1, padding: '12px', borderRadius: 12, background: '#EF4444', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>确认删除</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Warranty Calculation Modal - 同步 ProductModal 样式 */}
            {showCalculationModal && warrantyCalc && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: 'var(--modal-bg, #1c1c1e)', borderRadius: 20, border: '1px solid var(--glass-border)', width: 500, overflow: 'hidden', boxShadow: 'var(--glass-shadow-lg, 0 30px 60px rgba(0,0,0,0.6))' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg-light)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255, 210, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Calculator size={20} color="#FFD200" />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>产品保修计算引擎</h3>
                                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>序列号：{product.serial_number}</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCalculationModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ padding: '0 4px' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>保修计算说明</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                    {[
                                        { p: 1, basis: 'IOT_ACTIVATION', label: 'IoT', detail: '联网激活日期' },
                                        { p: 2, basis: 'INVOICE_PROOF', label: '发票', detail: '人工发票日期' },
                                        { p: 3, basis: 'REGISTRATION', label: '注册', detail: '人工注册日期' },
                                        { p: 4, basis: 'DIRECT_SHIPMENT', label: '直销', detail: '直销出库+7天' },
                                        { p: 5, basis: 'DEALER_FALLBACK', label: '兜底', detail: '代理发货+90天' }
                                    ].map((rule) => {
                                        const isActive = warrantyCalc?.calculation_basis?.toUpperCase() === rule.basis;
                                        return (
                                            <div key={rule.p} style={{
                                                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
                                                background: isActive ? 'rgba(255, 210, 0, 0.1)' : 'var(--glass-bg-light)',
                                                borderRadius: 6, border: isActive ? '1px solid rgba(255, 210, 0, 0.3)' : '1px solid var(--glass-border)',
                                                gridColumn: rule.p === 5 ? 'span 2' : 'auto'
                                            }}>
                                                <span style={{ color: isActive ? '#FFD200' : 'var(--text-tertiary)', fontWeight: 700 }}>{rule.p}.</span>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ color: isActive ? 'var(--text-main)' : 'var(--text-secondary)', fontWeight: 600 }}>{rule.label}</span>
                                                    <span style={{ fontSize: 11, opacity: 0.7 }}>{rule.detail}</span>
                                                </div>
                                                {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFD200' }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ height: 1, background: 'var(--glass-border)', margin: '4px 0' }} />

                            {/* Result Section */}
                            <div style={{
                                padding: 16, borderRadius: 12,
                                background: warrantyCalc.final_warranty_status === 'warranty_valid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444'}`,
                                display: 'flex', flexDirection: 'column', gap: 12
                            }}>
                                <h4 style={{ margin: 0, fontSize: 12, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444', opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>本机计算结果</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {warrantyCalc.final_warranty_status === 'warranty_valid' ? <CheckCircle size={22} color="#10B981" /> : <AlertTriangle size={22} color="#EF4444" />}
                                    <span style={{ fontSize: 18, fontWeight: 700, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444' }}>
                                        {warrantyCalc.final_warranty_status === 'warranty_valid' ? '在保期内 - 免费维修' : '已过保 - 付费维修'}
                                    </span>
                                </div>
                                <div style={{ height: 1, background: 'var(--glass-border)' }} />
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
                                                    'registration': '人工注册日期',
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
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>{item.label}</div>
                                            <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px', background: 'var(--glass-bg-light)', borderTop: '1px solid var(--glass-border)', textAlign: 'right' }}>
                            <button onClick={() => setShowCalculationModal(false)} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--glass-border)', background: 'var(--glass-bg-hover)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 600 }}>确认关闭</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Edit Modal */}
            {product && (
                <ProductModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSuccess={() => {
                        fetchProductDetail();
                    }}
                    editingProduct={product as any}
                />
            )}

            {/* Warranty Registration Modal */}
            {product && (
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
            )}
        </div>
    );
};

export default ProductDetailPage;
