import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User, Smartphone, Package, MapPin, Building, ChevronDown, ChevronUp, Ticket, Hash, ChevronRight, Search, UserPlus, Trash2
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
// import ContactCleaningModal from './ContactCleaningModal'; // 已整合到 UnifiedCustomerModal
import UnifiedCustomerModal from './UnifiedCustomerModal';
import ConfirmModal from './ConfirmModal';
import LinkCorporateModal from './LinkCorporateModal';
import { ProductWarrantyRegistrationModal } from './ProductWarrantyRegistrationModal';

interface CustomerContextSidebarProps {
    ticketId?: number;
    accountId?: number;
    contactId?: number;
    reporterSnapshot?: any;
    serialNumber?: string;
    customerName?: string;
    contactName?: string;
    dealerId?: number;
    dealerName?: string;
    dealerCode?: string;
    dealerContactName?: string;
    dealerContactTitle?: string;
    onCleanComplete?: () => void;
    onClose?: () => void;
    ticketProductName?: string;
    onRequestEdit?: (correctModelName: string) => void;
    hideDeviceCard?: boolean;
    collapsed?: boolean;
    onToggleCollapse?: () => void;
}

const CustomerContextSidebar: React.FC<CustomerContextSidebarProps> = ({
    ticketId, accountId, contactId, reporterSnapshot,
    serialNumber, customerName, contactName,
    dealerId, dealerName, dealerCode, dealerContactName, dealerContactTitle,
    onCleanComplete, onClose, ticketProductName, onRequestEdit, hideDeviceCard
}) => {
    // const { t } = useLanguage();
    const { token } = useAuthStore();
    const navigate = useNavigate();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [partsExpanded, setPartsExpanded] = useState(false);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [contactsExpanded, setContactsExpanded] = useState(false);
    const [showCleanModal, setShowCleanModal] = useState(false);
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [showSpamModal, setShowSpamModal] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [dealerExpanded, setDealerExpanded] = useState(true);
    const [customerExpanded, setCustomerExpanded] = useState(true);
    const [deviceExpanded, setDeviceExpanded] = useState(true);
    const [unknownIdentityExpanded, setUnknownIdentityExpanded] = useState(true);
    // 存储账户联系人列表（用于编辑模态框）
    const [accountContacts, setAccountContacts] = useState<any[]>([]);

    useEffect(() => {
        fetchContext();
    }, [accountId, serialNumber]);

    const fetchContext = async () => {
        setLoading(true);
        try {
            const result: any = {};
            const promises = [];

            console.log('[CustomerContext] Fetching context:', { accountId, serialNumber, dealerId });

            // 1. Fetch customer info if accountId exists
            if (accountId) {
                const customerUrl = `/api/v1/context/by-account?account_id=${accountId}`;
                console.log('[CustomerContext] Fetching customer:', customerUrl);
                promises.push(axios.get(customerUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then((res) => {
                    const json = res.data;
                    console.log('[CustomerContext] Customer response:', json);
                    if (json.success) {
                        result.account = json.data.account;
                        result.contacts = json.data.contacts;
                        result.ai_profile = json.data.ai_profile;
                        result.devices = json.data.devices;
                        console.log('[CustomerContext] Set account and devices:', {
                            account: result.account,
                            devicesCount: result.devices?.length
                        });
                    }
                }));
            }

            // 2. Fetch dealer info if dealerId exists
            if (dealerId) {
                const dealerUrl = `/api/v1/context/by-account?account_id=${dealerId}`;
                promises.push(axios.get(dealerUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then((res) => {
                    const json = res.data;
                    if (json.success) {
                        result.dealerRecord = json.data.account;
                        result.dealer_ai_profile = json.data.ai_profile;
                    }
                }));
            }

            // 3. Fetch product info by serial number (independent!)
            if (serialNumber) {
                const productUrl = `/api/v1/context/by-serial-number?serial_number=${serialNumber}`;
                console.log('[CustomerContext] Fetching product:', productUrl);
                promises.push(axios.get(productUrl, {
                    headers: { Authorization: `Bearer ${token}` }
                }).then((res) => {
                    const json = res.data;
                    console.log('[CustomerContext] Product response:', json);
                    if (json.success) {
                        result.device = json.data.device;
                        result.service_history = json.data.service_history;
                        result.parts_catalog = json.data.parts_catalog;
                        console.log('[CustomerContext] Set device:', result.device);
                    }
                }).catch((err) => {
                    console.error('[CustomerContext] Failed to fetch product:', err);
                    // Create a placeholder device even if API fails
                    result.device = {
                        id: null,
                        serial_number: serialNumber,
                        model_name: '未知型号 (查询失败)',
                        product_family: null,
                        firmware_version: null,
                        warranty_status: 'Unknown',
                        is_unregistered: true
                    };
                }));
            }

            await Promise.allSettled(promises);

            // If we have devices from account AND serial number lookup, merge them
            if (result.devices && result.device) {
                // Device from serial number takes precedence
                const existingIdx = result.devices.findIndex((d: any) => d.serial_number === serialNumber);
                if (existingIdx >= 0) {
                    result.devices[existingIdx] = result.device;
                } else {
                    result.devices.unshift(result.device);
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
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible'
    };



    const contentStyle: React.CSSProperties = {
        flex: 1,
        overflowY: 'auto',
        padding: '16px'
    };

    const cardStyle: React.CSSProperties = {
        background: 'var(--glass-bg-light)',
        borderRadius: '12px',
        padding: '16px',
        border: '1px solid var(--glass-border)',
        marginBottom: '12px'
    };

    const cardTitleStyle: React.CSSProperties = {
        fontSize: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-tertiary)',
        marginBottom: '10px',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    };

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'flex-start',
        marginBottom: '8px',
        fontSize: '0.8rem',
        lineHeight: '1.4'
    };

    const iconColStyle: React.CSSProperties = {
        width: '20px',
        color: 'var(--text-tertiary)',
        paddingTop: '2px',
        flexShrink: 0
    };

    const textColStyle: React.CSSProperties = {
        flex: 1,
        color: 'var(--text-main)'
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '0.65rem',
        color: 'var(--text-tertiary)',
        marginBottom: '2px'
    };

    if (loading) {
        return (
            <div style={sidebarStyle}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
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

    const handleMarkSpam = async () => {
        if (!ticketId) return;
        setIsActionLoading(true);
        try {
            const token = useAuthStore.getState().token;
            const response = await axios.post(`/api/v1/tickets/${ticketId}/mark-spam`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data.success && onCleanComplete) {
                setShowSpamModal(false);
                onCleanComplete();
            }
        } catch (err: any) {
            console.error('Failed to mark spam:', err);
            alert(err.response?.data?.error || '标记垃圾工单失败');
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <div style={sidebarStyle} className="customer-context-sidebar">

            {/* Content - Cards Layout (removed standalone header per UI spec) */}
            <div style={{ ...contentStyle, padding: onClose ? '0 16px 16px' : '16px 0' }}>
                {/* ===== Card 1: 经销商卡片 ===== */}
                {(dealerId || dealerName) && (
                    <div style={{
                        ...cardStyle,
                        background: 'var(--bg-sidebar)',
                        border: '1px solid var(--accent-subtle)',
                        overflow: 'hidden',
                    }}>
                        <div
                            onClick={() => setDealerExpanded(!dealerExpanded)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                marginBottom: dealerExpanded ? '10px' : 0,
                                cursor: 'pointer',
                            }}
                        >
                            <div style={{ ...cardTitleStyle, marginBottom: 0, color: 'var(--accent-blue)' }}>
                                <Building size={12} /> 经销商
                            </div>
                            {dealerExpanded ? <ChevronDown size={14} style={{ color: 'var(--accent-blue)' }} /> : <ChevronRight size={14} style={{ color: 'var(--accent-blue)' }} />}
                        </div>

                        {dealerExpanded && (
                            <>
                                <div
                                    style={{ cursor: dealerId ? 'pointer' : 'default' }}
                                    onClick={() => dealerId && navigate(`/service/dealers/${dealerId}?type=Dealer`)}
                                >
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                                        {dealerName || '未知经销商'}
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
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

                                {/* 经销商工单统计 */}
                                {data?.dealer_ai_profile && data.dealer_ai_profile.ticket_count > 0 && (
                                    <div style={{
                                        background: 'var(--accent-subtle)',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        marginTop: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <Ticket size={12} style={{ color: 'var(--accent-blue)' }} />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600 }}>工单统计</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                            总计 <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{data.dealer_ai_profile.ticket_count}</span>
                                            {data.dealer_ai_profile.inquiry_count > 0 && <span style={{ marginLeft: '8px' }}>咨询 {data.dealer_ai_profile.inquiry_count}</span>}
                                            {data.dealer_ai_profile.rma_count > 0 && <span style={{ marginLeft: '8px' }}>RMA {data.dealer_ai_profile.rma_count}</span>}
                                            {data.dealer_ai_profile.repair_count > 0 && <span style={{ marginLeft: '8px' }}>维修 {data.dealer_ai_profile.repair_count}</span>}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* ===== Card 2: 客户卡片 ===== */}
                {/* Status 4: Ghost / Unregistered */}
                {!data?.account && (reporterSnapshot || contactName || customerName) && (
                    <div style={{ ...cardStyle, border: '1px solid var(--status-red-subtle)' }}>
                        <div
                            onClick={() => setUnknownIdentityExpanded(!unknownIdentityExpanded)}
                            style={{ ...cardTitleStyle, color: 'var(--status-red)', justifyContent: 'space-between', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                未知身份
                            </div>
                            {unknownIdentityExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>

                        {unknownIdentityExpanded && (<>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--card-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                来源: <span style={{ color: 'var(--text-main)' }}>{reporterSnapshot?.source || 'Email / 电话接入'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>原始信息:</span>
                                <span style={{ color: 'var(--text-main)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                                    {reporterSnapshot ? `${reporterSnapshot.name || ''} ${reporterSnapshot.email ? `<${reporterSnapshot.email}>` : ''} ${reporterSnapshot.phone || ''}` : (contactName || customerName)}
                                </span>
                            </div>
                        </div>

                        {/* Action Required Section - Only visible to MS department */}
                        {(() => {
                            const user = useAuthStore.getState().user as any;
                            const deptName = user?.department_name || user?.department_code || '';
                            const isMsDept = deptName === 'MS' || deptName === '市场部' || deptName.includes('市场') ||
                                user?.role === 'Admin' || user?.role === 'Exec';
                            if (!isMsDept) return null;
                            return (
                                <div style={{ background: 'var(--status-red-subtle)', padding: '10px 12px', borderRadius: 8 }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--status-red)', fontWeight: 600, marginBottom: 10 }}>
                                        建议操作
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <button
                                            onClick={() => setShowLinkModal(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                                background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                                                borderRadius: 6, color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500
                                            }}
                                        >
                                            <Search size={14} /> 关联到已知客户
                                        </button>
                                        <button
                                            onClick={() => setShowConvertModal(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                                background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                                                borderRadius: 6, color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500
                                            }}
                                        >
                                            <UserPlus size={14} /> 添加为新客户
                                        </button>
                                        <button
                                            onClick={() => setShowSpamModal(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                                                background: 'var(--status-red-subtle)', border: '1px solid rgba(239, 68, 68, 0.4)',
                                                borderRadius: 6, color: 'var(--status-red)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
                                            }}
                                        >
                                            <Trash2 size={14} /> 标记为垃圾
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                        </>)}
                    </div>
                )}

                {/* Status 2: Corporate + Temp */}
                {data?.account && !contactId && reporterSnapshot && (
                    <div style={{ ...cardStyle, border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        <div style={{ ...cardTitleStyle, color: '#FFD200' }}>
                            <Building size={12} /> 客户信息 (临时对接)
                        </div>
                        <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                            {data.account.name}
                        </h3>
                        <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 8 }}>
                            <div style={{ fontSize: '0.75rem', color: '#FFD200', fontWeight: 600, marginBottom: 8 }}>
                                ⚠️ 未归档联系人
                            </div>
                            <div style={rowStyle}>
                                <User size={14} style={iconColStyle} color="#FFD200" />
                                <div style={{ ...textColStyle, color: '#ddd' }}>{reporterSnapshot.name}</div>
                            </div>
                            {reporterSnapshot.phone && (
                                <div style={rowStyle}>
                                    <Smartphone size={14} style={iconColStyle} color="#FFD200" />
                                    <div style={{ ...textColStyle, color: '#ddd' }}>{reporterSnapshot.phone}</div>
                                </div>
                            )}
                            <button
                                onClick={async () => {
                                    // 先加载账户联系人
                                    if (data?.account?.id) {
                                        try {
                                            const response = await axios.get(`/api/v1/accounts/${data.account.id}/contacts`, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            if (response.data?.success) {
                                                setAccountContacts(response.data.data || []);
                                            }
                                        } catch (err) {
                                            console.error('Failed to load contacts:', err);
                                            setAccountContacts([]);
                                        }
                                    }
                                    setShowCleanModal(true);
                                }}
                                style={{
                                    marginTop: 10, width: '100%', padding: '6px 0',
                                    background: 'var(--accent-gold)', border: '1px solid var(--accent-gold)',
                                    borderRadius: 6, color: '#000', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600
                                }}
                            >
                                + 入库联系人并清洗
                            </button>
                        </div>
                    </div>
                )}

                {/* Status 1 & 3: Standard Corporate or Individual */}
                {data?.account && (!reporterSnapshot || contactId) && (
                    <div
                        style={{
                            ...cardStyle,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onClick={() => data.account?.id && navigate(`/service/customers/${data.account.id}?type=${data.account.account_type}`)}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--glass-border)';
                            e.currentTarget.style.borderColor = 'rgba(255, 210, 0, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--glass-border)';
                            e.currentTarget.style.borderColor = 'var(--glass-border)';
                        }}
                    >
                        <div
                            onClick={(e) => { e.stopPropagation(); setCustomerExpanded(!customerExpanded); }}
                            style={{ ...cardTitleStyle, cursor: 'pointer', justifyContent: 'space-between' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <User size={12} /> 客户信息
                            </div>
                            {customerExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />}
                        </div>

                        {/* 客户名称和类型 - 始终显示 */}
                        <div style={{ marginBottom: '10px' }}>
                            <h3
                                style={{
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    color: 'var(--text-main)',
                                    marginBottom: '4px'
                                }}
                            >
                                {data.account.name}
                            </h3>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                {getAccountTypeLabel(data.account.account_type)}
                                {data.account.dealer_code && ` · ${data.account.dealer_code}`}
                            </div>
                        </div>

                        {/* 关联工单统计 - 排除当前工单 */}
                        {customerExpanded && data.ai_profile && (data.ai_profile.ticket_count - (data.ai_profile.tickets?.some((t: any) => t.id === ticketId) ? 1 : 0)) > 0 && (
                            <div style={{
                                background: 'rgba(255, 210, 0, 0.08)',
                                borderRadius: '8px',
                                padding: '10px 12px',
                                marginBottom: '12px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                    <Ticket size={12} style={{ color: 'var(--accent-blue)' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-blue)', fontWeight: 600 }}>工单统计</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                    总计 <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{data.ai_profile.ticket_count - (data.ai_profile.tickets?.some((t: any) => t.id === ticketId) ? 1 : 0)}</span>
                                    {data.ai_profile.inquiry_count > 0 && <span style={{ marginLeft: '8px' }}>咨询 {data.ai_profile.inquiry_count}</span>}
                                    {data.ai_profile.rma_count > 0 && <span style={{ marginLeft: '8px' }}>RMA {data.ai_profile.rma_count}</span>}
                                    {data.ai_profile.repair_count > 0 && <span style={{ marginLeft: '8px' }}>维修 {data.ai_profile.repair_count}</span>}
                                </div>
                            </div>
                        )}

                        {/* 主要联系人 - 默认只显示1个，多个时可展开 */}
                        {/* 个人客户且联系人同名时不重复显示 */}
                        {customerExpanded && data.contacts && data.contacts.length > 0 && !(
                            data.account.account_type?.toUpperCase() === 'INDIVIDUAL' &&
                            data.contacts.length === 1 &&
                            data.contacts[0].name === data.account.name
                        ) && (
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
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)' }}>
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
                                                                    color: 'var(--accent-blue)',
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
                                                        borderTop: idx === 0 ? '1px solid var(--glass-border)' : 'none'
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
                        {customerExpanded && (data.account.city || data.account.country) && (
                            <div style={rowStyle}>
                                <div style={iconColStyle}><MapPin size={12} /></div>
                                <div style={textColStyle}>
                                    <div style={labelStyle}>地区</div>
                                    {[data.account.city, data.account.country].filter(Boolean).join(', ')}
                                </div>
                            </div>
                        )}

                        {/* 所属经销商 */}
                        {customerExpanded && data?.account?.parent_dealer_name && (
                            <div style={rowStyle}>
                                <div style={iconColStyle}><Building size={12} /></div>
                                <div style={textColStyle}>
                                    <div style={labelStyle}>所属经销商</div>
                                    <div style={{ fontWeight: 500 }}>{data.account.parent_dealer_name}</div>
                                    {data.account.parent_dealer_code && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{data.account.parent_dealer_code}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}



                {/* ===== Card 3: 设备详情卡片 ===== */}
                {data?.device && !hideDeviceCard && (
                    <div
                        style={{
                            ...cardStyle,
                            cursor: data.device.is_unregistered ? 'default' : 'pointer',
                            transition: 'all 0.2s ease',
                            border: data.device.is_unregistered ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid var(--glass-border)'
                        }}
                        onClick={() => !data.device.is_unregistered && data.device?.serial_number && navigate(`/service/products?search=${data.device.serial_number}`)}
                        onMouseEnter={(e) => {
                            if (data.device.is_unregistered) return;
                            e.currentTarget.style.background = 'var(--glass-border)';
                            e.currentTarget.style.borderColor = 'rgba(255, 210, 0, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'var(--glass-border)';
                            e.currentTarget.style.borderColor = data.device.is_unregistered ? 'rgba(255, 215, 0, 0.3)' : 'var(--glass-border)';
                        }}
                    >
                        <div
                            onClick={(e) => { e.stopPropagation(); setDeviceExpanded(!deviceExpanded); }}
                            style={{ ...cardTitleStyle, cursor: 'pointer', justifyContent: 'space-between' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Smartphone size={12} /> 实物设备 / Device
                                {data.device.is_unregistered && (
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: 'rgba(255, 215, 0, 0.15)',
                                        color: '#FFD700',
                                        fontWeight: 500
                                    }}>未入库</span>
                                )}
                            </div>
                            {deviceExpanded ? <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-tertiary)' }} />}
                        </div>

                        {deviceExpanded && (
                            <>

                                {/* 设备型号和SN */}
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{
                                        fontWeight: 600,
                                        color: data.device.is_unregistered ? '#FFD700' : 'var(--text-main)',
                                        marginBottom: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        {data.device.model_name}
                                        {!data.device.is_unregistered && ticketProductName && ticketProductName === data.device.model_name && (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                padding: '1px 6px',
                                                borderRadius: '4px',
                                                background: 'rgba(16, 185, 129, 0.15)',
                                                color: '#10B981',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '2px'
                                            }}>
                                                ✓ 已核验
                                            </span>
                                        )}
                                    </div>
                                    <div style={{
                                        display: 'inline-block',
                                        fontFamily: 'Monaco, monospace',
                                        fontSize: '0.85rem',
                                        color: data.device.is_unregistered ? '#FFD700' : 'var(--accent-blue)',
                                        background: data.device.is_unregistered ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 210, 0, 0.1)',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        letterSpacing: '0.05em'
                                    }}>
                                        {data.device.serial_number}
                                    </div>
                                </div>

                                {/* 未入库设备提示及建议操作 */}
                                {data.device.is_unregistered && (
                                    <div style={{
                                        background: 'rgba(255, 215, 0, 0.08)',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        marginBottom: '12px',
                                        border: '1px solid rgba(255, 215, 0, 0.15)'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: '#FFD700', marginBottom: '4px' }}>
                                            此设备尚未录入产品库
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                            该序列号未在系统中找到匹配的产品信息，可能是新设备或序列号录入有误。
                                        </div>
                                        {/* 建议操作 - 仅对MS部门可见 */}
                                        {(() => {
                                            const user = useAuthStore.getState().user as any;
                                            const deptName = user?.department_name || user?.department_code || '';
                                            const isMsDept = deptName === 'MS' || deptName === '市场部' || deptName.includes('市场') ||
                                                user?.role === 'Admin' || user?.role === 'Exec';
                                            if (!isMsDept) return null;
                                            return (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,215,0,0.1)' }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#FFD700', fontWeight: 500 }}>建议操作</div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setIsRegisterModalOpen(true);
                                                        }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                                            background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.4)',
                                                            borderRadius: 8, color: '#FFD700', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 215, 0, 0.2)'}
                                                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)'}
                                                    >
                                                        <Package size={14} /> 录入新产品 / Register Product
                                                    </button>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* discrepancy check */}
                                {!data.device.is_unregistered && ticketProductName && ticketProductName !== data.device.model_name && (
                                    <div style={{
                                        background: 'rgba(245, 158, 11, 0.08)',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        marginBottom: '12px',
                                        border: '1px solid rgba(245, 158, 11, 0.3)'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: '#FFD200', marginBottom: '8px', fontWeight: 500, lineHeight: 1.4 }}>
                                            ⚠️ 声明型号 ({ticketProductName}) 与实物型号 ({data.device.model_name}) 不符
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onRequestEdit && onRequestEdit(data.device.model_name); }}
                                            style={{
                                                width: '100%', padding: '6px 0',
                                                background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
                                                borderRadius: 6, color: '#FFD200', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                                            }}
                                        >
                                            一键修正型号
                                        </button>
                                    </div>
                                )}

                                {/* 设备关联工单统计 - 排除当前工单 */}
                                {data.service_history && data.service_history.filter((h: any) => h.ticket_id !== ticketId).length > 0 && (
                                    <div style={{
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        marginBottom: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <Ticket size={12} style={{ color: 'var(--text-main)' }} />
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>关联工单</span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                                            总计 <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{data.service_history.filter((h: any) => h.ticket_id !== ticketId).length}</span>
                                        </div>
                                    </div>
                                )}

                                {/* 设备信息 - 仅对已注册设备显示 */}
                                {!data.device.is_unregistered && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <div>
                                            <div style={labelStyle}>固件版本</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{data.device.firmware_version || '-'}</div>
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
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>{data.device.purchase_date || '-'}</div>
                                        </div>
                                    </div>
                                )}

                                {/* 注册附件 - 可折叠 */}
                                {data.parts_catalog && data.parts_catalog.length > 0 && (
                                    <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
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
                                                <Package size={12} style={{ color: 'var(--text-tertiary)' }} />
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    注册附件 ({data.parts_catalog.length})
                                                </span>
                                            </div>
                                            {partsExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
                                        </div>
                                        {partsExpanded && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {data.parts_catalog.map((part: any) => (
                                                    <div key={part.id} style={{
                                                        background: 'var(--glass-bg-light)',
                                                        borderRadius: '6px',
                                                        padding: '8px 10px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}>
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{part.part_name}</span>
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                                                            {part.part_number}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>)}
                    </div>
                )}

                {/* No data state */}
                {!data?.account && !data?.device && !loading && (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '40px 20px' }}>
                        <User size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
                        <div style={{ fontSize: '0.85rem' }}>暂无上下文信息</div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {/* 联系人入库整合到 UnifiedCustomerModal - 编辑模式 */}
            {showCleanModal && ticketId && data?.account && reporterSnapshot && (
                <UnifiedCustomerModal
                    isOpen={showCleanModal}
                    onClose={() => setShowCleanModal(false)}
                    onSuccess={() => {
                        setShowCleanModal(false);
                        if (onCleanComplete) onCleanComplete();
                    }}
                    ticketId={ticketId}
                    isEditing={true}
                    editData={{
                        ...data.account,
                        // 使用从API加载的联系人列表，并将访客信息作为新联系人添加到末尾
                        contacts: [
                            ...accountContacts,
                            {
                                name: reporterSnapshot.name || '',
                                email: reporterSnapshot.email || '',
                                phone: reporterSnapshot.phone || '',
                                job_title: '',
                                is_primary: accountContacts.length === 0 // 如果没有联系人，设为 primary
                            }
                        ]
                    }}
                    defaultLifecycleStage="ACTIVE"
                />
            )}

            {/* 新增的未知访客操作弹窗 */}
            {showConvertModal && ticketId && (
                <UnifiedCustomerModal
                    isOpen={showConvertModal}
                    onClose={() => setShowConvertModal(false)}
                    onSuccess={() => {
                        setShowConvertModal(false);
                        if (onCleanComplete) onCleanComplete();
                    }}
                    ticketId={ticketId}
                    prefillData={{
                        name: reporterSnapshot?.name || customerName || contactName,
                        email: reporterSnapshot?.email,
                        phone: reporterSnapshot?.phone
                    }}
                    defaultLifecycleStage="ACTIVE"
                />
            )}

            {showLinkModal && ticketId && (
                <LinkCorporateModal
                    ticketId={ticketId}
                    reporterSnapshot={reporterSnapshot || { name: customerName || contactName }}
                    onClose={() => setShowLinkModal(false)}
                    onSuccess={() => {
                        setShowLinkModal(false);
                        if (onCleanComplete) onCleanComplete();
                    }}
                />
            )}

            {showSpamModal && (
                <ConfirmModal
                    title="标记为垃圾工单"
                    message="确定要将此工单标记为垃圾吗？该操作会将工单状态变更为已关闭，并移除无关任务。"
                    confirmText="标记垃圾"
                    isDanger={true}
                    loading={isActionLoading}
                    onConfirm={handleMarkSpam}
                    onCancel={() => setShowSpamModal(false)}
                    countdown={5}
                />
            )}
            {/* 注册保修模态框 */}
            <ProductWarrantyRegistrationModal
                isOpen={isRegisterModalOpen}
                onClose={() => setIsRegisterModalOpen(false)}
                serialNumber={data?.device?.serial_number || serialNumber}
                productName={ticketProductName}
                onRegistered={() => {
                    setIsRegisterModalOpen(false);
                    fetchContext(); // 刷新设备信息
                    onCleanComplete && onCleanComplete(); // 同步上层
                }}
            />
        </div>
    );
};

export default CustomerContextSidebar;
