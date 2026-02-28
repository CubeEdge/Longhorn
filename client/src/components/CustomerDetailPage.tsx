import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import { ArrowLeft, MapPin, Phone, Mail, Package, User, ChevronDown, ChevronUp, History, Wrench, MessageSquare, Edit2, Trash2, MoreHorizontal, PowerOff, RotateCcw } from 'lucide-react';
import CustomerFormModal from './CustomerFormModal';
import DeleteAccountModal from './DeleteAccountModal';
import { TicketCard } from './TicketCard';
import { ProductCard } from './ProductCard';
import { useDetailStore } from '../store/useDetailStore';

interface Customer {
    id: number;
    customer_name: string;
    customer_type: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    country?: string;
    province?: string;
    city?: string;
    company_name?: string;
    service_tier: string;
    notes?: string;
    created_at: string;
    dealer_code?: string;
    dealer_level?: string;
    address?: string;
}

interface Contact {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    job_title?: string;
    department?: string;
    status: 'PRIMARY' | 'ACTIVE' | 'INACTIVE';
    is_primary: boolean;
}

interface CustomerStats {
    total_tickets: number;
    inquiry_tickets: number;
    rma_tickets: number;
    dealer_repair_tickets: number;
}

interface Ticket {
    id: number;
    ticket_number: string;
    type: 'inquiry' | 'rma' | 'dealer_repair';
    status: string;
    problem_summary: string;
    created_at: string;
    product_name?: string;
    customer_name?: string;
    contact_name?: string;
}

interface Device {
    id: number;
    serial_number: string;
    product_name: string;
    warranty_status: string;
    purchase_date?: string;
    product_family?: string;
}

const CustomerDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { token, user } = useAuthStore();

    // 根据URL路径判断是否为经销商 - /service/dealers/:id 或 ?type=Dealer
    const isDealer = location.pathname.includes('/dealers/') || searchParams.get('type') === 'Dealer';
    const customerType = isDealer ? 'Dealer' : (searchParams.get('type') || 'Customer');
    const isAdmin = user?.role === 'Admin';
    const canManageDealerStatus = user?.role === 'Admin' || user?.role === 'Lead';
    const { t } = useLanguage();
    const tc = (key: string, defaultText: string) => {
        const text = (t as any)(key);
        return text === key ? defaultText : text;
    };

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [stats, setStats] = useState<CustomerStats | null>(null);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [devices, setDevices] = useState<Device[]>([]);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);

    // Persistent UI states from detail store
    const {
        setExpandedSection: setPersistentExpanded,
        setShowAllContacts: setPersistentShowContacts,
        expandedSections,
        showAllContacts: persistentShowContactsMap
    } = useDetailStore();

    const expandedSection = id ? (expandedSections[id] || null) : null;
    const showAllContacts = id ? (persistentShowContactsMap[id] || false) : false;

    const setExpandedSection = (section: string | null) => {
        if (id) setPersistentExpanded(id, section);
    };

    const setShowAllContacts = (show: boolean) => {
        if (id) setPersistentShowContacts(id, show);
    };

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    // Delete/Deactivate modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteHasRelatedData, setDeleteHasRelatedData] = useState(false);
    const [deleteCounts, setDeleteCounts] = useState<{ tickets: number; inquiry_tickets?: number; rma_tickets?: number; dealer_repairs?: number; devices: number } | undefined>();
    const [accountStatus, setAccountStatus] = useState<'active' | 'inactive'>('active');

    useEffect(() => {
        if (token && id) {
            fetchCustomerDetail();
        }
    }, [token, id, isDealer]);

    const fetchCustomerDetail = async () => {
        setLoading(true);
        try {
            let queryId: number | null = null;

            if (isDealer) {
                // Fetch dealer info from accounts table (new architecture)
                const dealerRes = await axios.get(`/api/v1/accounts/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (dealerRes.data.success) {
                    const dealer = dealerRes.data.data;
                    queryId = dealer.id;
                    // Transform dealer data to customer format
                    setCustomer({
                        id: dealer.id,
                        customer_name: dealer.name,
                        customer_type: 'Dealer',
                        contact_person: dealer.primary_contact_name || dealer.contact_person,
                        phone: dealer.primary_contact_phone || dealer.phone,
                        email: dealer.primary_contact_email || dealer.email,
                        country: dealer.country,
                        province: dealer.province,
                        city: dealer.city,
                        company_name: dealer.dealer_code || dealer.name,
                        service_tier: dealer.service_tier || 'FirstTier',
                        notes: dealer.notes,
                        created_at: dealer.created_at,
                        dealer_code: dealer.dealer_code,
                        dealer_level: dealer.dealer_level,
                        address: dealer.address
                    });

                    // Fetch contacts for this dealer
                    const contactsRes = await axios.get(`/api/v1/accounts/${dealer.id}/contacts`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (contactsRes.data.success) {
                        setContacts(contactsRes.data.data);
                    }
                }
            } else {
                // Fetch customer info from accounts table (new architecture)
                const accountRes = await axios.get(`/api/v1/accounts/${id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (accountRes.data.success) {
                    const account = accountRes.data.data;
                    queryId = account.id;

                    // Transform account data to customer format
                    const primaryContact = account.contacts?.find((c: any) => c.is_primary) || account.contacts?.[0];
                    setCustomer({
                        id: account.id,
                        customer_name: account.name,
                        customer_type: account.account_type === 'ORGANIZATION' ? 'EndUser' : 'Individual',
                        contact_person: primaryContact?.name,
                        phone: primaryContact?.phone,
                        email: primaryContact?.email,
                        country: account.country,
                        province: account.province,
                        city: account.city,
                        company_name: account.account_type === 'ORGANIZATION' ? account.name : undefined,
                        service_tier: account.service_tier || 'STANDARD',
                        notes: account.notes,
                        created_at: account.created_at,
                        address: account.address
                    });

                    // Set contacts
                    if (account.contacts) {
                        setContacts(account.contacts);
                    }
                }
            }

            // 如果没有获取到 queryId，说明账户查询失败，直接返回
            if (!queryId) {
                console.log('[CustomerDetail] No queryId, skipping ticket fetch');
                return;
            }

            // Fetch real tickets data from all three types
            // 经销商工单通过 dealer_id 关联（经销商提交的工单）
            // 客户工单通过 account_id 关联
            // 注意：不使用 keyword 过滤，因为经销商提交的工单 customer_name 是终端客户，不是经销商名称

            // 经销商查询 dealer_id（自己提交的工单），客户查询 account_id
            const idParam = isDealer ? `dealer_id=${queryId}` : `account_id=${queryId}`;

            const [inquiryRes, rmaRes, dealerRepairRes] = await Promise.all([
                axios.get(`/api/v1/inquiry-tickets?${idParam}&page_size=100`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`/api/v1/rma-tickets?${idParam}&page_size=100`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`/api/v1/dealer-repairs?${idParam}&page_size=100`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            // Process inquiry tickets
            const inquiryTickets: Ticket[] = (inquiryRes.data.data || []).map((t: any) => ({
                id: t.id,
                ticket_number: t.ticket_number,
                type: 'inquiry' as const,
                status: t.status,
                problem_summary: t.problem_summary,
                created_at: t.created_at,
                product_name: t.product?.name
            }));

            // Process RMA tickets
            const rmaTickets: Ticket[] = (rmaRes.data.data || []).map((t: any) => ({
                id: t.id,
                ticket_number: t.ticket_number,
                type: 'rma' as const,
                status: t.status,
                problem_summary: t.problem_description,
                created_at: t.created_at,
                product_name: t.product?.name
            }));

            // Process dealer repair tickets
            const dealerRepairTickets: Ticket[] = (dealerRepairRes.data.data || []).map((t: any) => ({
                id: t.id,
                ticket_number: t.ticket_number,
                type: 'dealer_repair' as const,
                status: t.status,
                problem_summary: t.problem_description || t.repair_content,
                created_at: t.created_at,
                product_name: t.product?.name || t.product_name,
                customer_name: isDealer ? t.account?.name || t.account_name : t.dealer?.name || t.dealer_name,
                contact_name: isDealer ? t.contact?.name || t.contact_name : t.dealer_contact_name
            }));

            // Combine all tickets and sort by date
            const allTickets = [...inquiryTickets, ...rmaTickets, ...dealerRepairTickets]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            setTickets(allTickets);

            // Calculate stats
            setStats({
                total_tickets: allTickets.length,
                inquiry_tickets: inquiryTickets.length,
                rma_tickets: rmaTickets.length,
                dealer_repair_tickets: dealerRepairTickets.length
            });

            // Fetch devices from tickets (unique products)
            const uniqueDevices = new Map();
            allTickets.forEach(t => {
                if (t.product_name && !uniqueDevices.has(t.product_name)) {
                    // Determine product family based on product name
                    const productName = t.product_name;
                    let productFamily = 'A'; // Default to A类

                    // A类: 在售电影摄影机 (Current Cinema Cameras)
                    if (/MAVO Edge|TERRA 4K|TERRA 6K/i.test(productName)) {
                        productFamily = 'A';
                    }
                    // B类: 历史机型 (Legacy Cameras)
                    else if (/MAVO LF|TERRA 4K.*legacy|历史机型/i.test(productName)) {
                        productFamily = 'B';
                    }
                    // C类: 电子寻像器 (Viewfinders)
                    else if (/KineMON|寻像器|Viewfinder|e-Viewfinder/i.test(productName)) {
                        productFamily = 'C';
                    }
                    // D类: 通用配件 (Accessories)
                    else if (/配件|电池|充电器|手柄|线缆|Accessory/i.test(productName)) {
                        productFamily = 'D';
                    }

                    uniqueDevices.set(t.product_name, {
                        id: uniqueDevices.size + 1,
                        serial_number: 'N/A', // Would need actual device data
                        product_name: t.product_name,
                        product_family: productFamily,
                        warranty_status: '未知',
                        purchase_date: undefined
                    });
                }
            });
            setDevices(Array.from(uniqueDevices.values()));
        } catch (err) {
            console.error('Failed to fetch customer detail', err);
        } finally {
            setLoading(false);
        }
    };

    const getTierLabel = (tier: string) => {
        const map: Record<string, string> = {
            'STANDARD': '标准',
            'VIP': 'VIP',
            'VVIP': 'VVIP',
            'PARTNER': '合作伙伴'
        };
        return map[tier] || tier;
    };

    const getDealerLevelLabel = (level: string | undefined) => {
        const map: Record<string, string> = {
            'TIER1': '一级经销商',
            'TIER2': '二级经销商',
            'TIER3': '三级经销商',
            'Tier1': '一级经销商',
            'Tier2': '二级经销商',
            'Tier3': '三级经销商',
            'tier1': '一级经销商',
            'tier2': '二级经销商',
            'tier3': '三级经销商',
            'FirstTier': '一级经销商',
            'SecondTier': '二级经销商',
            'ThirdTier': '三级经销商'
        };
        return map[level || ''] || level || '标准';
    };

    // 删除账户处理 - 点击显示确认弹窗
    const handleDeleteClick = () => {
        setShowMoreMenu(false);
        setDeleteHasRelatedData(false);
        setDeleteCounts(undefined);
        setIsDeleteModalOpen(true);
    };

    // 确认删除（调用 API 执行软删除）
    const handleConfirmDelete = async () => {
        setDeleteLoading(true);
        try {
            const res = await axios.delete(`/api/v1/accounts/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                // 软删除成功，返回列表
                navigate(isDealer ? '/service/dealers' : '/service/customers');
            }
        } catch (err: any) {
            if (err.response?.status === 409) {
                // 有关联数据，显示建议停用
                setDeleteHasRelatedData(true);
                setDeleteCounts(err.response.data.counts);
            } else {
                alert('删除失败: ' + (err.response?.data?.error?.message || err.message));
                setIsDeleteModalOpen(false);
            }
        } finally {
            setDeleteLoading(false);
        }
    };

    // 确认停用（有关联数据时）
    const handleConfirmDeactivate = async () => {
        setDeleteLoading(true);
        try {
            await axios.patch(`/api/v1/accounts/${id}`,
                { is_active: false },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAccountStatus('inactive');
            setIsDeleteModalOpen(false);
            fetchCustomerDetail(); // 刷新数据
        } catch (err: any) {
            alert('停用失败: ' + (err.response?.data?.error?.message || err.message));
        } finally {
            setDeleteLoading(false);
        }
    };

    // 恢复账户
    const handleReactivate = async () => {
        setShowMoreMenu(false);
        try {
            await axios.patch(`/api/v1/accounts/${id}`,
                { is_active: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAccountStatus('active');
            fetchCustomerDetail();
        } catch (err: any) {
            alert('恢复失败: ' + (err.response?.data?.error?.message || err.message));
        }
    };

    if (loading) {
        return (
            <div className="fade-in" style={{ padding: '40px', textAlign: 'center' }}>
                <div className="loading-spinner" style={{ margin: '0 auto' }} />
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="fade-in" style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>客户不存在</p>
            </div>
        );
    }

    return (
        <div className="fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', height: '100vh', overflow: 'auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <button
                    onClick={() => {
                        if (isDealer) {
                            navigate('/service/dealers');
                        } else {
                            navigate(`/service/customers?tab=${customerType}`);
                        }
                    }}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: 16,
                        padding: '8px'
                    }}
                >
                    <ArrowLeft size={18} />
                    {isDealer ? '返回经销商列表' : '返回客户列表'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>
                            {customer.customer_name}
                        </h1>
                        <span
                            style={{
                                padding: '6px 12px',
                                borderRadius: 6,
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                background: isDealer ? 'rgba(var(--accent-rgb), 0.15)' : (customer.service_tier === 'VIP' ? 'rgba(255, 165, 0, 0.2)' : 'var(--glass-bg-hover)'),
                                color: isDealer ? 'var(--accent-blue)' : (customer.service_tier === 'VIP' ? 'orange' : 'var(--text-main)')
                            }}
                        >
                            {isDealer ? getDealerLevelLabel(customer.dealer_level) : getTierLabel(customer.service_tier)}
                        </span>
                    </div>

                    {/* More Actions Menu */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowMoreMenu(!showMoreMenu)}
                            style={{
                                background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'var(--glass-bg-hover)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'var(--glass-bg-hover)';
                            }}
                        >
                            <MoreHorizontal size={18} />
                            <span style={{ fontSize: '0.85rem' }}>更多</span>
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
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
                                        zIndex: 20,
                                        minWidth: 160,
                                        padding: '8px 0'
                                    }}
                                >
                                    <button
                                        onClick={() => { setIsEditModalOpen(true); setShowMoreMenu(false); }}
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

                                    {(isAdmin || user?.role === 'Lead') && (
                                        <button
                                            onClick={handleDeleteClick}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                width: '100%',
                                                padding: '10px 16px',
                                                background: 'none',
                                                border: 'none',
                                                color: '#ff4d4f',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <Trash2 size={16} />
                                            删除
                                        </button>
                                    )}

                                    {/* 已停用状态显示恢复按钮 */}
                                    {accountStatus === 'inactive' && (
                                        <button
                                            onClick={handleReactivate}
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
                                            <RotateCcw size={16} />
                                            恢复账户
                                        </button>
                                    )}

                                    {/* 经销商停用按钮 - 仅经销商显示 */}
                                    {isDealer && canManageDealerStatus && (
                                        <button
                                            onClick={() => { setShowMoreMenu(false); alert('停用经销商功能开发中'); }}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                width: '100%',
                                                padding: '10px 16px',
                                                background: 'none',
                                                border: 'none',
                                                color: '#ff4d4f',
                                                cursor: 'pointer',
                                                fontSize: '0.9rem',
                                                textAlign: 'left'
                                            }}
                                        >
                                            <PowerOff size={16} />
                                            停用经销商
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: 8 }}>
                    {isDealer ? '经销商' : '终端客户'} · {customer.company_name || (isDealer ? '' : '个人用户')}
                </p>
            </div>

            {/* Basic Info Card with Integrated Contacts */}
            <div
                style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: 24,
                    border: '1px solid var(--glass-border)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>基本信息</h2>
                    {contacts.length > 1 && (
                        <button
                            onClick={() => setShowAllContacts(!showAllContacts)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--accent-blue)',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                            }}
                        >
                            {showAllContacts ? '收起' : `查看全部 ${contacts.length} 个联系人`}
                            {showAllContacts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                    )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <MapPin size={16} color="var(--accent-blue)" />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>地区</span>
                        </div>
                        <p style={{ fontSize: '1rem', fontWeight: 500 }}>
                            {customer.country || '-'} {customer.city ? `/ ${customer.city}` : ''}
                        </p>
                    </div>

                    {/* Primary Contact - Always Visible */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <User size={16} color="var(--accent-blue)" />
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>联系人</span>
                        </div>
                        {contacts.length > 0 ? (
                            (() => {
                                const primaryContact = contacts.find(c => c.status === 'PRIMARY') || contacts[0];
                                return (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontSize: '1rem', fontWeight: 500 }}>{primaryContact.name}</span>
                                            {primaryContact.status === 'PRIMARY' && (
                                                <span style={{
                                                    padding: '2px 6px',
                                                    borderRadius: 4,
                                                    fontSize: '0.7rem',
                                                    background: 'rgba(var(--accent-rgb), 0.15)',
                                                    color: 'var(--accent-blue)',
                                                    fontWeight: 600
                                                }}>
                                                    主要对接人
                                                </span>
                                            )}
                                        </div>
                                        {(primaryContact.job_title || primaryContact.department) && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {primaryContact.job_title}{primaryContact.job_title && primaryContact.department && ' · '}{primaryContact.department}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.8rem', marginTop: 4 }}>
                                            {primaryContact.phone && (
                                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Phone size={10} /> {primaryContact.phone}
                                                </span>
                                            )}
                                            {primaryContact.email && (
                                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Mail size={10} /> {primaryContact.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <p style={{ fontSize: '1rem', fontWeight: 500 }}>{customer.contact_person || '-'}</p>
                        )}
                    </div>

                    {customer.phone && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Phone size={16} color="var(--accent-blue)" />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>电话</span>
                            </div>
                            <p style={{ fontSize: '1rem', fontWeight: 500 }}>{customer.phone}</p>
                        </div>
                    )}

                    {customer.email && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                <Mail size={16} color="var(--accent-blue)" />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>邮箱</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', fontWeight: 500, wordBreak: 'break-all' }}>{customer.email}</p>
                        </div>
                    )}
                </div>

                {/* Expandable Contacts Section */}
                {contacts.length > 1 && showAllContacts && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {contacts.map(contact => (
                                <div
                                    key={contact.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: 12,
                                        padding: '12px',
                                        background: contact.status === 'PRIMARY' ? 'rgba(var(--accent-rgb), 0.05)' : 'var(--glass-bg-light)',
                                        borderRadius: '10px',
                                        border: contact.status === 'PRIMARY' ? '1px solid rgba(var(--accent-rgb), 0.2)' : '1px solid var(--glass-border)'
                                    }}
                                >
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: contact.status === 'PRIMARY' ? 'rgba(var(--accent-rgb), 0.15)' : 'var(--glass-bg-hover)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <User size={14} color={contact.status === 'PRIMARY' ? 'var(--accent-blue)' : 'var(--text-secondary)'} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{contact.name}</span>
                                            {contact.status === 'PRIMARY' && (
                                                <span style={{
                                                    padding: '1px 6px',
                                                    borderRadius: 4,
                                                    fontSize: '0.7rem',
                                                    background: 'rgba(var(--accent-rgb), 0.15)',
                                                    color: 'var(--accent-blue)',
                                                    fontWeight: 600
                                                }}>
                                                    主要对接人
                                                </span>
                                            )}
                                            {contact.status === 'INACTIVE' && (
                                                <span style={{
                                                    padding: '1px 6px',
                                                    borderRadius: 4,
                                                    fontSize: '0.7rem',
                                                    background: 'rgba(156, 163, 175, 0.15)',
                                                    color: '#9ca3af',
                                                    fontWeight: 600
                                                }}>
                                                    已离职
                                                </span>
                                            )}
                                        </div>
                                        {(contact.job_title || contact.department) && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                                                {contact.job_title}{contact.job_title && contact.department && ' · '}{contact.department}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: '0.8rem' }}>
                                            {contact.phone && (
                                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Phone size={10} /> {contact.phone}
                                                </span>
                                            )}
                                            {contact.email && (
                                                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Mail size={10} /> {contact.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {customer.notes && (
                    <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--glass-border)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>备注</span>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
                            {customer.notes}
                        </p>
                    </div>
                )}
            </div>

            {/* Service Dashboard - Interactive */}
            {stats && (
                <div
                    style={{
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(20px)',
                        borderRadius: '16px',
                        padding: '24px',
                        marginBottom: 24,
                        border: '1px solid var(--glass-border)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Service Dashboard</h2>
                        {tickets.length > 0 && (
                            <button
                                onClick={() => setExpandedSection(expandedSection === 'tickets' ? null : 'tickets')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--accent-blue)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                            >
                                {expandedSection === 'tickets' ? '收起' : '查看全部'}
                                {expandedSection === 'tickets' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                    </div>

                    {/* Stats Grid - Clickable */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                        <button
                            onClick={() => setExpandedSection(expandedSection === 'tickets' ? null : 'tickets')}
                            style={{
                                background: 'var(--glass-bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                                {stats.total_tickets}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{tc('dashboard.total_tickets', '总工单')}</div>
                        </button>
                        <button
                            onClick={() => setExpandedSection(expandedSection === 'inquiry' ? null : 'inquiry')}
                            style={{
                                background: 'var(--glass-bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#60a5fa' }}>
                                {stats.inquiry_tickets}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{tc('dashboard.inquiry_tickets', '咨询工单')}</div>
                        </button>
                        <button
                            onClick={() => setExpandedSection(expandedSection === 'rma' ? null : 'rma')}
                            style={{
                                background: 'var(--glass-bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>
                                {stats.rma_tickets}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{tc('dashboard.rma_tickets', 'RMA返厂')}</div>
                        </button>
                        <button
                            onClick={() => setExpandedSection(expandedSection === 'repair' ? null : 'repair')}
                            style={{
                                background: 'var(--glass-bg-light)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '12px',
                                padding: '16px',
                                cursor: 'pointer',
                                textAlign: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981' }}>
                                {stats.dealer_repair_tickets}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{tc('dashboard.dealer_repairs', '经销商维修')}</div>
                        </button>
                    </div>

                    {/* Expanded Ticket List */}
                    {expandedSection && ['tickets', 'inquiry', 'rma', 'repair'].includes(expandedSection) && (
                        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--glass-border)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {expandedSection === 'tickets' && <History size={16} color="var(--accent-blue)" />}
                                {expandedSection === 'inquiry' && <MessageSquare size={16} color="#60a5fa" />}
                                {expandedSection === 'rma' && <Wrench size={16} color="#f59e0b" />}
                                {expandedSection === 'repair' && <Package size={16} color="#10b981" />}
                                {expandedSection === 'tickets' && tc('dashboard.all_service_records', '全部服务记录')}
                                {expandedSection === 'inquiry' && tc('dashboard.inquiry_tickets', '咨询工单')}
                                {expandedSection === 'rma' && tc('dashboard.rma_records', 'RMA返修记录')}
                                {expandedSection === 'repair' && tc('dashboard.dealer_repair_records', '经销商维修记录')}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                {tickets
                                    .filter(t => {
                                        if (expandedSection === 'tickets') return true;
                                        if (expandedSection === 'inquiry') return t.type === 'inquiry';
                                        if (expandedSection === 'rma') return t.type === 'rma';
                                        if (expandedSection === 'repair') return t.type === 'dealer_repair';
                                        return true;
                                    })
                                    .slice(0, 12) // Show up to 12 cards (3 rows)
                                    .map(ticket => (
                                        <TicketCard
                                            key={ticket.id}
                                            ticketNumber={ticket.ticket_number}
                                            ticketType={ticket.type}
                                            title={ticket.problem_summary || tc('common.untitled', '无标题')}
                                            status={ticket.status}
                                            productModel={ticket.product_name}
                                            customerName={ticket.customer_name || (customer ? customer.customer_name : '')}
                                            contactName={ticket.contact_name || (customer ? customer.contact_person : '')}
                                            onClick={() => window.open(`/service/${ticket.type === 'inquiry' ? 'inquiry-tickets' : ticket.type === 'rma' ? 'rma-tickets' : 'dealer-repairs'}/${ticket.id}`, '_blank')}
                                        />
                                    ))}
                                {tickets.filter(t => {
                                    if (expandedSection === 'tickets') return true;
                                    if (expandedSection === 'inquiry') return t.type === 'inquiry';
                                    if (expandedSection === 'rma') return t.type === 'rma';
                                    if (expandedSection === 'repair') return t.type === 'dealer_repair';
                                    return true;
                                }).length === 0 && (
                                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                                            {tc('common.no_records', '暂无相关记录')}
                                        </div>
                                    )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Device Assets by Product Family */}
            <div
                style={{
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(20px)',
                    borderRadius: '16px',
                    padding: '24px',
                    marginBottom: 24,
                    border: '1px solid var(--glass-border)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>设备资产</h2>
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'family_all' ? null : 'family_all')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-blue)',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--glass-bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                        }}
                    >
                        共 {devices.length} 台设备
                        {expandedSection === 'family_all' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                </div>

                {/* Product Family Dashboard */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                        { key: 'A', name: tc('device.family_a', '在售电影摄影机'), color: 'var(--accent-blue)' },
                        { key: 'B', name: tc('device.family_b', '历史机型'), color: '#60a5fa' },
                        { key: 'C', name: tc('device.family_c', '电子寻像器'), color: '#f59e0b' },
                        { key: 'D', name: tc('device.family_d', '通用配件'), color: '#10b981' }
                    ].map(family => {
                        const familyDevices = devices.filter(d => d.product_family === family.key);
                        const isExpanded = expandedSection === `family_${family.key}`;
                        return (
                            <button
                                key={family.key}
                                onClick={() => setExpandedSection(isExpanded ? null : `family_${family.key}`)}
                                style={{
                                    background: isExpanded ? 'var(--glass-bg-hover)' : 'var(--glass-bg-light)',
                                    border: `1px solid ${isExpanded ? family.color : 'var(--glass-bg-hover)'}`,
                                    borderRadius: '12px',
                                    padding: '16px 12px',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: family.color }}>
                                    {familyDevices.length}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                    {family.name}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Expanded Device List by Family */}
                {expandedSection?.startsWith('family_') && (
                    <div style={{ paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
                        {(() => {
                            const familyKey = expandedSection.replace('family_', '');
                            const familyDevices = devices.filter(d => d.product_family === familyKey);
                            const familyInfo = {
                                'A': { label: tc('device.family_a', '在售电影摄影机'), color: 'var(--accent-blue)' },
                                'B': { label: tc('device.family_b', '历史机型'), color: '#60a5fa' },
                                'C': { label: tc('device.family_c', '电子寻像器'), color: '#f59e0b' },
                                'D': { label: tc('device.family_d', '通用配件'), color: '#10b981' }
                            }[familyKey];

                            return (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: familyInfo?.color }}>
                                            {familyInfo?.label}
                                        </h3>
                                        <button
                                            onClick={() => setExpandedSection(null)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--text-tertiary)',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem'
                                            }}
                                        >
                                            收起
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                        {familyDevices.map(device => (
                                            <ProductCard
                                                key={device.id}
                                                productName={device.product_name}
                                                serialNumber={device.serial_number}
                                                warrantyStatus={device.warranty_status}
                                                familyColor={familyInfo?.color}
                                                onClick={() => navigate(`/tech-hub/wiki?serial_number=${device.serial_number}`)}
                                            />
                                        ))}
                                        {familyDevices.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>
                                                {tc('device.no_devices', '该分类暂无设备')}
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* Show all devices if no family expanded, or show all devices list when family_all is selected */}
                {(!expandedSection?.startsWith('family_') || expandedSection === 'family_all') && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        {(expandedSection === 'family_all' ? devices : devices.slice(0, 3)).map(device => {
                            const familyInfo = {
                                'A': { color: 'var(--accent-blue)' },
                                'B': { color: '#60a5fa' },
                                'C': { color: '#f59e0b' },
                                'D': { color: '#10b981' }
                            }[device.product_family || 'A'];

                            return (
                                <ProductCard
                                    key={device.id}
                                    productName={device.product_name}
                                    serialNumber={device.serial_number}
                                    warrantyStatus={device.warranty_status}
                                    familyColor={familyInfo?.color}
                                />
                            );
                        })}
                        {expandedSection !== 'family_all' && devices.length > 3 && (
                            <button
                                onClick={() => setExpandedSection('family_all')}
                                style={{
                                    background: 'none',
                                    border: '1px dashed rgba(255,255,255,0.2)',
                                    borderRadius: '8px',
                                    color: 'var(--accent-blue)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    padding: '12px',
                                    textAlign: 'center',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                                查看全部 {devices.length} 台设备
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Quick Tips */}
            <div
                style={{
                    background: 'rgba(var(--accent-rgb), 0.05)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    border: '1px solid rgba(var(--accent-rgb), 0.15)',
                    marginTop: 8
                }}
            >
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>提示：</span>
                    点击 Service Dashboard 中的统计卡片可展开查看详细服务记录；点击设备资产中的产品族可查看该分类下的设备详情。
                </p>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && customer && (
                <CustomerFormModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSubmit={async (e, formData) => {
                        e.preventDefault();
                        try {
                            const accountId = customer.id;
                            const accountData = {
                                name: formData.name,
                                account_type: formData.account_type,
                                dealer_code: formData.dealer_code,
                                dealer_level: formData.dealer_level,
                                address: formData.address,
                                country: formData.country,
                                city: formData.city,
                                notes: formData.notes,
                                service_tier: formData.service_tier,
                                primary_contact: formData.contacts.find((c: any) => c.is_primary) || formData.contacts[0]
                            };

                            // Update account
                            await axios.patch(`/api/v1/accounts/${accountId}`, accountData, {
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            // Sync contacts - delete existing and recreate
                            const existingContactsRes = await axios.get(`/api/v1/accounts/${accountId}/contacts`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const existingContacts = existingContactsRes.data.data || [];

                            // Delete all existing contacts
                            for (const contact of existingContacts) {
                                await axios.delete(`/api/v1/contacts/${contact.id}`, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                            }

                            // Create new contacts
                            for (const contact of formData.contacts) {
                                await axios.post(`/api/v1/accounts/${accountId}/contacts`, {
                                    name: contact.name,
                                    email: contact.email,
                                    phone: contact.phone,
                                    job_title: contact.job_title,
                                    is_primary: contact.is_primary
                                }, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                            }

                            setIsEditModalOpen(false);
                            fetchCustomerDetail(); // Refresh data
                        } catch (err) {
                            console.error('Failed to save customer', err);
                            alert('保存失败');
                        }
                    }}
                    initialData={{
                        id: customer.id,
                        customer_name: customer.customer_name,
                        name: customer.customer_name,
                        account_type: isDealer ? 'DEALER' : (customer.customer_type === 'EndUser' ? 'ORGANIZATION' : 'INDIVIDUAL'),
                        dealer_code: (customer as any).dealer_code || '',
                        dealer_level: (customer as any).dealer_level || '',
                        service_tier: customer.service_tier,
                        address: (customer as any).address || '',
                        country: customer.country || '',
                        city: customer.city || '',
                        notes: customer.notes || '',
                        contacts: contacts.map(c => ({
                            id: c.id,
                            name: c.name,
                            email: c.email || '',
                            phone: c.phone || '',
                            job_title: c.job_title || '',
                            is_primary: c.is_primary
                        }))
                    }}
                    isEditing={true}
                    _user={user}
                    mode={isDealer ? 'dealer' : (customer.customer_type === 'EndUser' ? 'organization' : 'individual')}
                />
            )}

            {/* Delete/Deactivate Modal */}
            <DeleteAccountModal
                isOpen={isDeleteModalOpen}
                account={customer ? { id: customer.id, name: customer.customer_name, account_type: isDealer ? 'DEALER' : 'CUSTOMER' } : null}
                onClose={() => !deleteLoading && setIsDeleteModalOpen(false)}
                onConfirmDelete={handleConfirmDelete}
                onConfirmDeactivate={handleConfirmDeactivate}
                loading={deleteLoading}
                hasRelatedData={deleteHasRelatedData}
                counts={deleteCounts}
            />
        </div>
    );
};

export default CustomerDetailPage;
