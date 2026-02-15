import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Smartphone, Package, X, MapPin, Building, ChevronDown, ChevronUp, Ticket, Info, Hash, ChevronRight
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
    dealerName?: string;
    dealerCode?: string;
    dealerContactName?: string;
    dealerContactTitle?: string;
    onClose?: () => void;
}

const CustomerContextSidebar: React.FC<CustomerContextSidebarProps> = ({
    customerId, customerName, accountId, accountName, serialNumber, 
    dealerId, dealerName, dealerCode, dealerContactName, dealerContactTitle,
    onClose
}) => {
    // const { t } = useLanguage();
    const { token } = useAuthStore();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [partsExpanded, setPartsExpanded] = useState(false);
    const [contactsExpanded, setContactsExpanded] = useState(false);

    useEffect(() => {
        fetchContext();
    }, [customerId, customerName, accountId, accountName, serialNumber]);

    const fetchContext = async () => {
        setLoading(true);
        try {
            // Fetch customer data
            let customerUrl = '';
            if (accountId) customerUrl = `/api/v1/context/by-account?account_id=${accountId}`;
            else if (customerId) customerUrl = `/api/v1/context/by-customer?customer_id=${customerId}`;
            else if (accountName) customerUrl = `/api/v1/context/by-account?account_name=${encodeURIComponent(accountName)}`;
            else if (customerName) customerUrl = `/api/v1/context/by-customer?customer_name=${encodeURIComponent(customerName)}`;

            // Fetch device data
            let deviceUrl = '';
            if (serialNumber) deviceUrl = `/api/v1/context/by-serial-number?serial_number=${serialNumber}`;

            const result: any = {};

            if (customerUrl) {
                const customerRes = await fetch(customerUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const customerJson = await customerRes.json();
                if (customerJson.success) {
                    result.account = customerJson.data.account;
                    result.contacts = customerJson.data.contacts;
                    result.ai_profile = customerJson.data.ai_profile;
                }
            }

            if (deviceUrl) {
                const deviceRes = await fetch(deviceUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const deviceJson = await deviceRes.json();
                if (deviceJson.success) {
                    result.device = deviceJson.data.device;
                    result.parts_catalog = deviceJson.data.parts_catalog;
                    // Device might also have ai_profile with ticket stats
                    if (deviceJson.data.ai_profile) {
                        result.device_ai_profile = deviceJson.data.ai_profile;
                    }
                }
            }

            setData(result);
        } catch (err) {
            console.error('Failed to fetch context', err);
        } finally {
            setLoading(false);
        }
    };

    // --- Premium Styles ---
    const sidebarStyle: React.CSSProperties = {
        background: 'transparent',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
    };

    const headerStyle: React.CSSProperties = {
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
    };

    const contentStyle: React.CSSProperties = {
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
    };

    const cardStyle: React.CSSProperties = {
        background: 'rgba(255, 255, 255, 0.04)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        marginBottom: '12px'
    };

    const cardTitleStyle: React.CSSProperties = {
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(255, 255, 255, 0.4)',
        marginBottom: '12px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '8px',
        fontSize: '0.85rem',
        lineHeight: '1.4'
    };

    const iconColStyle: React.CSSProperties = {
        width: '20px',
        color: 'rgba(255, 255, 255, 0.4)',
        paddingTop: '2px',
        flexShrink: 0
    };

    const textColStyle: React.CSSProperties = {
        flex: 1,
        color: 'rgba(255, 255, 255, 0.9)'
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '0.7rem',
        color: 'rgba(255, 255, 255, 0.4)',
        marginBottom: '2px'
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

    // Helper function to get account type label
    const getAccountTypeLabel = (type: string) => {
        switch (type?.toUpperCase()) {
            case 'DEALER': return '经销商';
            case 'ORGANIZATION': return '机构客户';
            case 'INDIVIDUAL': return '个人';
            default: return type || '客户';
        }
    };

    return (
        <div style={sidebarStyle} className="customer-context-sidebar">
            {/* Header - 标题放在顶部 */}
            <div style={headerStyle}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Info size={16} style={{ color: '#FFD200' }} />
                    本工单关联的信息
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

            {/* Content - Three Cards Layout */}
            <div style={contentStyle}>
                {/* ===== Card 1: 经销商卡片 ===== */}
                {(dealerId || dealerName) && (
                    <div 
                        style={{
                            ...cardStyle,
                            background: 'rgba(255, 215, 0, 0.06)',
                            border: '1px solid rgba(255, 215, 0, 0.15)',
                            cursor: dealerId ? 'pointer' : 'default',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => dealerId && navigate(`/service/dealers/${dealerId}?type=Dealer`)}
                        onMouseEnter={(e) => {
                            if (dealerId) {
                                e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.25)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 215, 0, 0.06)';
                            e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.15)';
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                            <div style={{ ...cardTitleStyle, marginBottom: 0, color: 'rgba(255, 215, 0, 0.7)' }}>
                                <Building size={12} /> 经销商
                            </div>
                            {dealerId && <ChevronRight size={14} style={{ color: 'rgba(255, 215, 0, 0.5)' }} />}
                        </div>
                        
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                            {dealerName || '未知经销商'}
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                            {dealerCode && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Hash size={11} />
                                    <span>{dealerCode}</span>
                                </div>
                            )}
                            {dealerContactName && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={11} />
                                    <span>
                                        {dealerContactName}
                                        {dealerContactTitle && <span style={{ opacity: 0.7 }}> · {dealerContactTitle}</span>}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== Card 2: 客户卡片 ===== */}
                {data?.account && (
                    <div 
                        style={{
                            ...cardStyle,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => data.account?.id && navigate(`/service/customers/${data.account.id}?type=${data.account.account_type}`)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.borderColor = 'rgba(255, 210, 0, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        }}
                    >
                        <div style={cardTitleStyle}>
                            <User size={12} /> 客户信息
                        </div>

                        {/* 客户名称和类型 */}
                        <div style={{ marginBottom: '12px' }}>
                            <h3
                                style={{
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    color: '#fff',
                                    marginBottom: '4px'
                                }}
                            >
                                {data.account.name}
                            </h3>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                {getAccountTypeLabel(data.account.account_type)}
                                {data.account.dealer_code && ` · ${data.account.dealer_code}`}
                            </div>
                        </div>

                        {/* 关联工单统计 */}
                        {data.ai_profile && data.ai_profile.ticket_count > 0 && (
                            <div style={{
                                background: 'rgba(255, 210, 0, 0.08)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                marginBottom: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <Ticket size={12} style={{ color: '#FFD200' }} />
                                    <span style={{ fontSize: '0.75rem', color: '#FFD200', fontWeight: 600 }}>工单统计</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                                    总计 <span style={{ color: '#FFD200', fontWeight: 600 }}>{data.ai_profile.ticket_count}</span>
                                    {data.ai_profile.inquiry_count > 0 && <span style={{ marginLeft: '8px' }}>咨询 {data.ai_profile.inquiry_count}</span>}
                                    {data.ai_profile.rma_count > 0 && <span style={{ marginLeft: '8px' }}>RMA {data.ai_profile.rma_count}</span>}
                                    {data.ai_profile.repair_count > 0 && <span style={{ marginLeft: '8px' }}>维修 {data.ai_profile.repair_count}</span>}
                                </div>
                            </div>
                        )}

                        {/* 主要联系人 - 默认只显示1个，多个时可展开 */}
                        {data.contacts && data.contacts.length > 0 && (
                            <div style={{ marginBottom: '12px' }}>
                                {/* 找到主要联系人 */}
                                {(() => {
                                    const primaryContact = data.contacts.find((c: any) => c.status === 'PRIMARY' || c.is_primary) || data.contacts[0];
                                    const otherContacts = data.contacts.filter((c: any) => c.id !== primaryContact.id);
                                    
                                    return (
                                        <>
                                            {/* 标题行 - 如果有多个联系人则可点击展开 */}
                                            <div 
                                                style={{
                                                    ...labelStyle,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    cursor: otherContacts.length > 0 ? 'pointer' : 'default'
                                                }}
                                                onClick={() => otherContacts.length > 0 && setContactsExpanded(!contactsExpanded)}
                                            >
                                                <span>联系人</span>
                                                {otherContacts.length > 0 && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'rgba(255,255,255,0.4)' }}>
                                                        <span style={{ fontSize: '0.65rem' }}>
                                                            {contactsExpanded ? '收起' : `展开其他${otherContacts.length}个`}
                                                        </span>
                                                        {contactsExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* 主要联系人 - 始终显示，只显示姓名 */}
                                            <div style={{ ...rowStyle, marginBottom: contactsExpanded && otherContacts.length > 0 ? '8px' : 0 }}>
                                                <div style={iconColStyle}><User size={12} /></div>
                                                <div style={textColStyle}>
                                                    <div style={{ fontWeight: 500 }}>
                                                        {primaryContact.name}
                                                        {(primaryContact.status === 'PRIMARY' || primaryContact.is_primary) && (
                                                            <span style={{
                                                                fontSize: '0.65rem',
                                                                color: '#FFD200',
                                                                background: 'rgba(255, 210, 0, 0.15)',
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                marginLeft: '6px'
                                                            }}>主要</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* 其他联系人 - 展开时显示，只显示姓名 */}
                                            {contactsExpanded && otherContacts.map((contact: any, idx: number) => (
                                                <div key={contact.id} style={{
                                                    ...rowStyle,
                                                    marginBottom: idx < otherContacts.length - 1 ? '8px' : 0,
                                                    paddingTop: '8px',
                                                    borderTop: idx === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                                                }}>
                                                    <div style={iconColStyle}><User size={12} /></div>
                                                    <div style={textColStyle}>
                                                        <div style={{ fontWeight: 500 }}>
                                                            {contact.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* 地区 */}
                        {(data.account.city || data.account.country) && (
                            <div style={rowStyle}>
                                <div style={iconColStyle}><MapPin size={12} /></div>
                                <div style={textColStyle}>
                                    <div style={labelStyle}>地区</div>
                                    {[data.account.city, data.account.country].filter(Boolean).join(', ')}
                                </div>
                            </div>
                        )}

                        {/* 所属经销商 */}
                        {data.account.parent_dealer_name && (
                            <div style={rowStyle}>
                                <div style={iconColStyle}><Building size={12} /></div>
                                <div style={textColStyle}>
                                    <div style={labelStyle}>所属经销商</div>
                                    <div style={{ fontWeight: 500 }}>{data.account.parent_dealer_name}</div>
                                    {data.account.parent_dealer_code && (
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{data.account.parent_dealer_code}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ===== Card 3: 设备详情卡片 ===== */}
                {data?.device && (
                    <div 
                        style={{
                            ...cardStyle,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => data.device?.id && navigate(`/service/devices/${data.device.id}`)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.borderColor = 'rgba(255, 210, 0, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        }}
                    >
                        <div style={cardTitleStyle}>
                            <Smartphone size={12} /> 设备详情
                        </div>

                        {/* 设备型号和SN */}
                        <div style={{ marginBottom: '12px' }}>
                            <div style={{ fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                                {data.device.model_name}
                            </div>
                            <div style={{
                                display: 'inline-block',
                                fontFamily: 'Monaco, monospace',
                                fontSize: '0.85rem',
                                color: '#FFD200',
                                background: 'rgba(255, 210, 0, 0.1)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                letterSpacing: '0.05em'
                            }}>
                                {data.device.serial_number}
                            </div>
                        </div>

                        {/* 设备关联工单统计 */}
                        {data.device_ai_profile && data.device_ai_profile.ticket_count > 0 && (
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                marginBottom: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <Ticket size={12} style={{ color: '#60a5fa' }} />
                                    <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600 }}>关联工单</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>
                                    总计 <span style={{ color: '#60a5fa', fontWeight: 600 }}>{data.device_ai_profile.ticket_count}</span>
                                    {data.device_ai_profile.inquiry_count > 0 && <span style={{ marginLeft: '8px' }}>咨询 {data.device_ai_profile.inquiry_count}</span>}
                                    {data.device_ai_profile.rma_count > 0 && <span style={{ marginLeft: '8px' }}>RMA {data.device_ai_profile.rma_count}</span>}
                                    {data.device_ai_profile.repair_count > 0 && <span style={{ marginLeft: '8px' }}>维修 {data.device_ai_profile.repair_count}</span>}
                                </div>
                            </div>
                        )}

                        {/* 设备信息 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                            <div>
                                <div style={labelStyle}>固件版本</div>
                                <div style={{ fontSize: '0.85rem', color: '#fff' }}>{data.device.firmware_version || '-'}</div>
                            </div>
                            <div>
                                <div style={labelStyle}>保修状态</div>
                                <div style={{
                                    fontSize: '0.85rem',
                                    color: data.device.warranty_status === 'Active' ? '#10b981' : '#ef4444',
                                    fontWeight: 600
                                }}>
                                    {data.device.warranty_status === 'Active' ? '有效' : data.device.warranty_status || '-'}
                                </div>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                                <div style={labelStyle}>购买日期</div>
                                <div style={{ fontSize: '0.85rem', color: '#fff' }}>{data.device.purchase_date || '-'}</div>
                            </div>
                        </div>

                        {/* 注册附件 - 可折叠 */}
                        {data.parts_catalog && data.parts_catalog.length > 0 && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                <div
                                    onClick={() => setPartsExpanded(!partsExpanded)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        marginBottom: partsExpanded ? '8px' : 0
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Package size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                            注册附件 ({data.parts_catalog.length})
                                        </span>
                                    </div>
                                    {partsExpanded ? <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.4)' }} /> : <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                                </div>
                                {partsExpanded && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {data.parts_catalog.map((part: any) => (
                                            <div key={part.id} style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                borderRadius: '6px',
                                                padding: '8px 10px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}>
                                                <span style={{ fontSize: '0.8rem', color: '#ddd' }}>{part.part_name}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                                    {part.part_number}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* No data state */}
                {!data?.account && !data?.device && !loading && (
                    <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '40px 20px' }}>
                        <User size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                        <div style={{ fontSize: '0.85rem' }}>暂无上下文信息</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerContextSidebar;
