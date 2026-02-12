import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Smartphone, Award, Package, X, MapPin, Building, Calendar, Info, ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
// import { useLanguage } from '../../i18n/useLanguage';

interface CustomerContextSidebarProps {
    customerId?: number;
    customerName?: string;
    accountId?: number;
    accountName?: string;
    serialNumber?: string;
    dealerId?: number;
    onClose?: () => void;
}

const CustomerContextSidebar: React.FC<CustomerContextSidebarProps> = ({
    customerId, customerName, accountId, accountName, serialNumber, onClose
}) => {
    // const { t } = useLanguage();
    const { token } = useAuthStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'customer' | 'device'>('customer');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchContext();
    }, [customerId, customerName, accountId, accountName, serialNumber, activeTab]);

    const fetchContext = async () => {
        setLoading(true);
        try {
            let url = '';
            if (activeTab === 'customer') {
                // 优先使用新架构的 account_id
                if (accountId) url = `/api/v1/context/by-account?account_id=${accountId}`;
                else if (customerId) url = `/api/v1/context/by-customer?customer_id=${customerId}`;
                else if (accountName) url = `/api/v1/context/by-account?account_name=${encodeURIComponent(accountName)}`;
                else if (customerName) url = `/api/v1/context/by-customer?customer_name=${encodeURIComponent(customerName)}`;
            } else {
                if (serialNumber) url = `/api/v1/context/by-serial-number?serial_number=${serialNumber}`;
            }

            if (!url) {
                setLoading(false);
                return;
            }

            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();

            if (json.success) {
                setData(json.data);
            }
        } catch (err) {
            console.error('Failed to fetch context', err);
        } finally {
            setLoading(false);
        }
    };

    // --- Premium Styles ---
    const sidebarStyle: React.CSSProperties = {
        background: 'rgba(28, 28, 30, 0.95)', // Darker, less transparent for readability
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.3)'
    };

    const headerStyle: React.CSSProperties = {
        padding: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.02)'
    };

    const tabContainerStyle: React.CSSProperties = {
        display: 'flex',
        padding: '12px 20px',
        gap: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
    };

    const tabStyle = (isActive: boolean): React.CSSProperties => ({
        flex: 1,
        padding: '8px 0',
        textAlign: 'center',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: 600,
        color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.4)',
        background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
        borderRadius: '8px',
        transition: 'all 0.2s ease',
        border: isActive ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid transparent'
    });

    const contentStyle: React.CSSProperties = {
        flex: 1,
        overflowY: 'auto',
        padding: '24px'
    };

    const sectionTitleStyle: React.CSSProperties = {
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'rgba(255, 255, 255, 0.4)',
        marginBottom: '12px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    const cardStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        marginBottom: '20px'
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '12px',
        fontSize: '0.9rem',
        lineHeight: '1.4'
    };

    const iconColStyle: React.CSSProperties = {
        width: '24px',
        color: 'rgba(255, 255, 255, 0.4)',
        paddingTop: '2px'
    };

    const textColStyle: React.CSSProperties = {
        flex: 1,
        color: 'rgba(255, 255, 255, 0.9)'
    };

    if (loading) {
        return (
            <div style={sidebarStyle}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                    <div className="loading-spinner" style={{ width: 24, height: 24 }} />
                </div>
            </div>
        );
    }

    return (
        <div style={sidebarStyle} className="customer-context-sidebar">
            {/* ... (Header and Tabs) */}
            {/* Header */}
            <div style={headerStyle}>
                <div style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={18} style={{ color: '#FFD200' }} />
                    客户上下文
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#666', padding: 4 }}
                    >
                        <X size={18} />
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div style={tabContainerStyle}>
                <div onClick={() => setActiveTab('customer')} style={tabStyle(activeTab === 'customer')}>
                    客户概览
                </div>
                <div onClick={() => setActiveTab('device')} style={tabStyle(activeTab === 'device')}>
                    设备详情
                </div>
            </div>

            {/* Content */}
            <div style={contentStyle}>
                {activeTab === 'customer' && data?.account && (
                    <div className="fade-in">
                        {/* Avatar / Identity */}
                        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                            <div style={{
                                width: '72px', height: '72px', margin: '0 auto 16px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #FFD200, #F5A623)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '2rem', fontWeight: 800, color: '#000',
                                boxShadow: '0 8px 24px rgba(255, 210, 0, 0.2)'
                            }}>
                                {data.account.name?.charAt(0) || 'A'}
                            </div>
                            <h2 
                                style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', marginBottom: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => data.account?.id && navigate(`/service/customers/${data.account.id}?type=${data.account.account_type}`)}
                            >
                                {data.account.name}
                                <ExternalLink size={14} style={{ opacity: 0.5 }} />
                            </h2>
                            <div style={{ fontSize: '0.85rem', color: '#888' }}>
                                {data.account.account_type === 'DEALER' ? '经销商' : data.account.account_type === 'ORGANIZATION' ? '机构客户' : '个人客户'}
                                {data.account.dealer_code && ` · ${data.account.dealer_code}`}
                            </div>
                        </div>

                        {/* Customer Info Card - Clickable with hover effect */}
                        {data.ai_profile && (data.ai_profile.tags?.length > 0 || data.ai_profile.ticket_count > 0) && (
                            <div 
                                style={{ 
                                    ...cardStyle, 
                                    marginBottom: '20px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                className="insight-card-hover"
                                onClick={() => data.account?.id && navigate(`/service/customers/${data.account.id}?type=${data.account.account_type}`)}
                            >
                                {data.ai_profile.tags?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: data.ai_profile.ticket_count > 0 ? '12px' : 0 }}>
                                        {data.ai_profile.tags?.map((tag: string, i: number) => (
                                            <span key={i} style={{
                                                background: tag.includes('Verification') || tag.includes('Verified') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 210, 0, 0.1)',
                                                color: tag.includes('Verification') || tag.includes('Verified') ? '#10b981' : '#FFD200',
                                                padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 500
                                            }}>
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {/* Ticket Stats */}
                                {data.ai_profile.ticket_count > 0 && (
                                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>
                                        工单统计: 总计 <span style={{ color: '#FFD200', fontWeight: 600 }}>{data.ai_profile.ticket_count}</span>
                                        {data.ai_profile.inquiry_count > 0 && ` (咨询 ${data.ai_profile.inquiry_count}`}
                                        {data.ai_profile.rma_count > 0 && `, RMA ${data.ai_profile.rma_count}`}
                                        {data.ai_profile.repair_count > 0 && `, 维修 ${data.ai_profile.repair_count}`}
                                        {(data.ai_profile.inquiry_count > 0 || data.ai_profile.rma_count > 0 || data.ai_profile.repair_count > 0) && ')'}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Contacts List */}
                        {data.contacts && data.contacts.length > 0 && (
                            <>
                                <div style={sectionTitleStyle}>
                                    <User size={14} /> 联系人 ({data.contacts.length})
                                </div>
                                <div style={{ ...cardStyle, padding: '12px' }}>
                                    {data.contacts.slice(0, 3).map((contact: any, idx: number) => (
                                        <div key={contact.id} style={{ 
                                            marginBottom: idx < data.contacts.slice(0, 3).length - 1 ? '12px' : 0,
                                            paddingBottom: idx < data.contacts.slice(0, 3).length - 1 ? '12px' : 0,
                                            borderBottom: idx < data.contacts.slice(0, 3).length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 600, color: '#fff' }}>{contact.name}</span>
                                                {contact.status === 'PRIMARY' && (
                                                    <span style={{ 
                                                        fontSize: '0.7rem', color: '#FFD200', 
                                                        background: 'rgba(255, 210, 0, 0.15)',
                                                        padding: '2px 6px', borderRadius: '4px'
                                                    }}>主要</span>
                                                )}
                                                {contact.status === 'INACTIVE' && (
                                                    <span style={{ 
                                                        fontSize: '0.7rem', color: '#9ca3af', 
                                                        background: 'rgba(156, 163, 175, 0.15)',
                                                        padding: '2px 6px', borderRadius: '4px'
                                                    }}>已离职</span>
                                                )}
                                            </div>
                                            {(contact.job_title || contact.department) && (
                                                <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '4px' }}>
                                                    {contact.job_title}{contact.job_title && contact.department && ' · '}{contact.department}
                                                </div>
                                            )}
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                                {contact.email || contact.phone || '无联系方式'}
                                            </div>
                                        </div>
                                    ))}
                                    {data.contacts.length > 3 && (
                                        <div style={{ fontSize: '0.8rem', color: '#666', textAlign: 'center', marginTop: '8px' }}>
                                            还有 {data.contacts.length - 3} 个联系人
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Location Info */}
                        {(data.account.city || data.account.country) && (
                            <>
                                <div style={sectionTitleStyle}>
                                    <MapPin size={14} /> 地区
                                </div>
                                <div style={cardStyle}>
                                    <div style={{ ...rowStyle, marginBottom: 0 }}>
                                        <div style={textColStyle}>
                                            {[data.account.city, data.account.country].filter(Boolean).join(', ')}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Parent Dealer Info */}
                        {data.account.parent_dealer_name && (
                            <>
                                <div style={sectionTitleStyle}>
                                    <Building size={14} /> 所属经销商
                                </div>
                                <div style={cardStyle}>
                                    <div style={{ fontWeight: 600, marginBottom: '4px', color: '#fff' }}>{data.account.parent_dealer_name}</div>
                                    {data.account.parent_dealer_code && (
                                        <div style={{ fontSize: '0.85rem', color: '#888' }}>{data.account.parent_dealer_code}</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'device' && data?.device && (
                    <div className="fade-in">
                        {/* Device Header */}
                        <div style={{ ...cardStyle, textAlign: 'center', padding: '24px 16px' }}>
                            <div style={{
                                fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: '8px'
                            }}>
                                {data.device.model_name}
                            </div>
                            <div style={{
                                display: 'inline-block',
                                fontFamily: 'Monaco, monospace',
                                fontSize: '0.9rem',
                                color: '#FFD200',
                                background: 'rgba(255, 210, 0, 0.1)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                letterSpacing: '0.05em'
                            }}>
                                {data.device.serial_number}
                            </div>
                        </div>

                        <div style={sectionTitleStyle}>
                            <Smartphone size={14} /> 设备概览
                        </div>
                        <div style={cardStyle}>
                            <div style={rowStyle}>
                                <div style={iconColStyle}><Info size={14} /></div>
                                <div style={textColStyle}>
                                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>固件版本</div>
                                    {data.device.firmware_version}
                                </div>
                            </div>
                            <div style={rowStyle}>
                                <div style={iconColStyle}><Calendar size={14} /></div>
                                <div style={textColStyle}>
                                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>购买日期</div>
                                    {data.device.purchase_date || 'N/A'}
                                </div>
                            </div>
                            <div style={{ ...rowStyle, marginBottom: 0 }}>
                                <div style={iconColStyle}><Award size={14} /></div>
                                <div style={textColStyle}>
                                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '2px' }}>保修状态</div>
                                    <span style={{
                                        color: data.device.warranty_status === 'Active' ? '#10b981' : '#ef4444',
                                        fontWeight: 600
                                    }}>
                                        {data.device.warranty_status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {data.parts_catalog?.length > 0 && (
                            <>
                                <div style={sectionTitleStyle}>
                                    <Package size={14} /> 注册附件
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {data.parts_catalog.map((part: any) => (
                                        <div key={part.id} style={{
                                            ...cardStyle, marginBottom: 0, padding: '12px',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}>
                                            <span style={{ fontSize: '0.85rem', color: '#ddd' }}>{part.part_name}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#666', fontFamily: 'monospace' }}>
                                                {part.part_number}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerContextSidebar;
