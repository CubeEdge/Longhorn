import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import { Search, Plus, MapPin, Edit2, Users, ChevronUp, ChevronDown, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import CustomerFormModal from './CustomerFormModal';
import PermanentDeleteModal from './PermanentDeleteModal';


// Types
interface Customer {
    id: number;
    account_id?: number; // Reference to accounts table
    customer_type: 'EndUser' | 'Dealer' | 'Distributor' | 'Internal';
    customer_name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    country?: string;
    province?: string;
    city?: string;
    company_name?: string;
    notes?: string;
    account_type: 'Dealer' | 'Customer'; // Logical separation
    service_tier: 'STANDARD' | 'VIP' | 'VVIP' | 'PARTNER' | 'FirstTier' | 'SecondTier' | 'ThirdTier';
    industry_tags?: string;
    parent_dealer_id?: number;
    created_at: string;
}

const STORAGE_KEY = 'longhorn_customer_management_tab';

type CustomerType = 'ORGANIZATION' | 'INDIVIDUAL';

const CustomerManagement: React.FC = () => {
    const { token, user } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    // State
    const [searchParams, setSearchParams] = useSearchParams();

    // Get saved tab from localStorage or use default
    const getSavedTab = (): CustomerType => {
        const saved = localStorage.getItem(STORAGE_KEY) as CustomerType | null;
        if (saved === 'ORGANIZATION' || saved === 'INDIVIDUAL') return saved;
        return 'ORGANIZATION';
    };

    // State from URL with fallbacks (localStorage first, then URL, then default)
    const urlTab = searchParams.get('tab') as CustomerType | null;
    const activeTab = urlTab || getSavedTab();
    const searchQuery = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = (searchParams.get('sort_order') || 'desc') as 'asc' | 'desc';

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    // const [total, setTotal] = useState(0);

    const updateParams = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        setSearchParams({ ...current, ...newParams });
    };

    const setActiveTab = (tab: CustomerType) => {
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, tab);
        updateParams({ tab, page: '1' });
    };

    const setSearchQuery = (q: string) => {
        updateParams({ q, page: '1' });
    };

    const setPage = (p: number) => {
        updateParams({ page: p.toString() });
    };

    const handleSort = (field: string) => {
        const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
        updateParams({ sort_by: field, sort_order: newOrder, page: '1' });
    };

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [saving, setSaving] = useState(false);

    // More dropdown state
    const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
    const moreDropdownRef = useRef<HTMLDivElement>(null);

    // Status filter (active/inactive/deleted)
    const statusFilter = searchParams.get('status') || 'active';

    // Search expand state
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    // 彻底删除弹窗状态
    const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false);
    const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Customer | null>(null);
    const [permanentDeleteLoading, setPermanentDeleteLoading] = useState(false);

    // Form State - now handled by CustomerFormModal
    const [_formData, _setFormData] = useState<Partial<Customer>>({});

    const fetchCustomers = async () => {
        setLoading(true);
        setCustomers([]); // Clear stale data before fetching
        try {
            // 使用新的 accounts API，按 account_type 筛选（已包含主联系人信息）
            const res = await axios.get(`/api/v1/accounts`, {
                params: {
                    account_type: activeTab, // ORGANIZATION 或 INDIVIDUAL
                    name: searchQuery,
                    page,
                    page_size: 20,
                    sort_by: sortBy,
                    sort_order: sortOrder,
                    status: statusFilter // 使用 status 参数: active/inactive/deleted
                },
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                // 后端已返回 primary_contact_name，无需单独查询
                const accountsData = Array.isArray(res.data.data) ? res.data.data : (res.data.data.list || []);
                const mappedCustomers = accountsData.map((acc: any) => ({
                    id: acc.id,
                    customer_name: acc.name,
                    contact_person: acc.primary_contact_name || '-',
                    phone: acc.primary_contact_phone || '',
                    email: acc.primary_contact_email || '',
                    country: acc.country,
                    city: acc.city,
                    company_name: acc.account_type === 'ORGANIZATION' ? acc.name : undefined,
                    account_type: 'Customer',
                    service_tier: acc.service_tier,
                    created_at: acc.created_at
                }));
                setCustomers(mappedCustomers);
            }
        } catch (err) {
            console.error('Failed to fetch customers', err);
        } finally {
            setLoading(false);
        }
    };

    // Sync URL with saved tab on initial load if no tab in URL
    useEffect(() => {
        if (!urlTab) {
            const savedTab = getSavedTab();
            if (savedTab !== activeTab) {
                updateParams({ tab: savedTab, page: '1' });
            }
        }
    }, []);

    useEffect(() => {
        if (token) fetchCustomers();
    }, [token, activeTab, page, searchQuery, sortBy, sortOrder, statusFilter]);

    const handleOpenModal = async (customer?: Customer) => {
        if (customer) {
            // 编辑时先从后端获取完整账户数据（包含 contacts 和所有字段）
            try {
                const res = await axios.get(`/api/v1/accounts/${customer.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    const fullData = res.data.data;
                    // 合并完整数据
                    setEditingCustomer({
                        ...customer,
                        ...fullData,
                        customer_name: fullData.name,
                        contacts: fullData.contacts || []
                    });
                    _setFormData({
                        ...customer,
                        ...fullData,
                        customer_name: fullData.name,
                        contacts: fullData.contacts || []
                    });
                } else {
                    // fallback to list data
                    setEditingCustomer(customer);
                    _setFormData(customer);
                }
            } catch (err) {
                console.error('Failed to fetch account details', err);
                // fallback to list data
                setEditingCustomer(customer);
                _setFormData(customer);
            }
        } else {
            setEditingCustomer(null);
            _setFormData({
                account_type: 'Customer',
                customer_type: activeTab === 'ORGANIZATION' ? 'EndUser' : 'EndUser',
                service_tier: 'STANDARD'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent, formData: any) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Prepare data for accounts API
            const accountData = {
                name: formData.name,
                account_type: formData.account_type,
                dealer_level: formData.account_type === 'DEALER' ? formData.dealer_level : undefined,
                can_repair: formData.account_type === 'DEALER' ? !!formData.repair_level : undefined,
                repair_level: formData.account_type === 'DEALER' ? formData.repair_level : undefined,
                service_tier: formData.service_tier || 'STANDARD',
                address: formData.address,
                country: formData.country,
                city: formData.city,
                notes: formData.notes,
                primary_contact: formData.contacts.find((c: any) => c.is_primary) || formData.contacts[0]
            };

            if (editingCustomer) {
                // Use account_id if available, otherwise fall back to id
                const accountId = editingCustomer.account_id || editingCustomer.id;

                // 1. Update account basic info
                await axios.patch(`/api/v1/accounts/${accountId}`, accountData, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // 2. Sync contacts - Differential Sync
                const existingContactsRes = await axios.get(`/api/v1/accounts/${accountId}/contacts`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const existingContacts = existingContactsRes.data.data || [];

                const submittedContacts = formData.contacts;
                const submittedIds = submittedContacts.map((c: any) => c.id).filter(Boolean);

                const contactsToDelete = existingContacts.filter((ec: any) => !submittedIds.includes(ec.id));
                const contactsToUpdate = submittedContacts.filter((sc: any) => sc.id);
                const contactsToCreate = submittedContacts.filter((sc: any) => !sc.id);

                // Sequential deletions
                for (const contact of contactsToDelete) {
                    try {
                        await axios.delete(`/api/v1/contacts/${contact.id}`, { headers: { Authorization: `Bearer ${token}` } });
                    } catch (err) { console.error('Failed to delete contact', err); }
                }

                // Sequential updates
                for (const contact of contactsToUpdate) {
                    try {
                        await axios.patch(`/api/v1/contacts/${contact.id}`, {
                            name: contact.name,
                            email: contact.email,
                            phone: contact.phone,
                            job_title: contact.job_title,
                            is_primary: contact.is_primary
                        }, { headers: { Authorization: `Bearer ${token}` } });
                    } catch (err) { console.error('Failed to update contact', err); }
                }

                // Sequential creations
                for (const contact of contactsToCreate) {
                    try {
                        await axios.post(`/api/v1/accounts/${accountId}/contacts`, {
                            name: contact.name,
                            email: contact.email,
                            phone: contact.phone,
                            job_title: contact.job_title,
                            is_primary: contact.is_primary
                        }, { headers: { Authorization: `Bearer ${token}` } });
                    } catch (err) { console.error('Failed to create contact', err); }
                }
            } else {
                // 新增账户
                const createRes = await axios.post('/api/v1/accounts', accountData, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // 如果有额外的联系人（除了主联系人），也需要创建
                if (createRes.data.success && formData.contacts.length > 1) {
                    const newAccountId = createRes.data.data.id;
                    // 跳过第一个联系人（已通过 primary_contact 创建），创建其余联系人
                    const additionalContacts = formData.contacts.slice(1);
                    for (const contact of additionalContacts) {
                        try {
                            await axios.post(`/api/v1/accounts/${newAccountId}/contacts`, {
                                name: contact.name,
                                email: contact.email,
                                phone: contact.phone,
                                job_title: contact.job_title,
                                is_primary: contact.is_primary
                            }, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                        } catch (err) {
                            console.error('Failed to create additional contact', err);
                        }
                    }
                }
            }
            setIsModalOpen(false);
            fetchCustomers();
        } catch (err) {
            console.error('Failed to save customer', err);
            alert('Operation failed');
        } finally {
            setSaving(false);
        }
    };

    // 恢复账户（从已删除/已停用状态恢复）
    const handleRestore = async (customer: Customer) => {
        try {
            await axios.patch(`/api/v1/accounts/${customer.id}`,
                { is_active: true, is_deleted: false },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchCustomers();
        } catch (err) {
            console.error('Restore failed:', err);
            alert('恢复失败');
        }
    };

    // 彻底删除 - 打开弹窗
    const handlePermanentDelete = (customer: Customer) => {
        setPermanentDeleteTarget({
            ...customer,
            account_type: activeTab // ORGANIZATION 或 INDIVIDUAL
        } as any);
        setIsPermanentDeleteModalOpen(true);
    };

    // 彻底删除 - 确认执行
    const handleConfirmPermanentDelete = async () => {
        if (!permanentDeleteTarget) return;

        setPermanentDeleteLoading(true);
        try {
            await axios.delete(`/api/v1/accounts/${permanentDeleteTarget.id}?permanent=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsPermanentDeleteModalOpen(false);
            setPermanentDeleteTarget(null);
            fetchCustomers();
        } catch (err) {
            console.error('Permanent delete failed:', err);
            alert('删除失败');
        } finally {
            setPermanentDeleteLoading(false);
        }
    };

    const setStatusFilter = (status: string) => {
        updateParams({ status, page: '1' });
        setIsMoreDropdownOpen(false);
    };

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
                setIsMoreDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="fade-in" style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <Users size={28} color="var(--accent-blue)" />
                        {t('sidebar.archives_customers') || '客户档案'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{t('admin.manage_customers_desc') || 'Manage End-Users (Organizations & Individuals)'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Search Icon / Expandable Input */}
                    <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isSearchExpanded ? 'flex-start' : 'center',
                        width: isSearchExpanded ? 280 : 40,
                        height: 40,
                        background: isSearchExpanded ? 'var(--glass-bg-hover)' : 'transparent',
                        border: isSearchExpanded ? '1px solid var(--glass-border)' : 'none',
                        borderRadius: 8,
                        transition: 'all 0.3s ease',
                        overflow: 'hidden'
                    }}>
                        <button
                            onClick={() => {
                                setIsSearchExpanded(!isSearchExpanded);
                                if (!isSearchExpanded) {
                                    setTimeout(() => searchInputRef.current?.focus(), 100);
                                }
                            }}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}
                        >
                            <Search size={20} />
                        </button>
                        {isSearchExpanded && (
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="搜索客户..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onBlur={() => {
                                    if (!searchQuery) setIsSearchExpanded(false);
                                }}
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    padding: '0 8px'
                                }}
                            />
                        )}
                    </div>
                    <button className="btn-kine-lowkey" onClick={() => handleOpenModal()}>
                        <Plus size={18} /> {t('common.add_new')}
                    </button>
                    {/* More Dropdown */}
                    <div ref={moreDropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsMoreDropdownOpen(!isMoreDropdownOpen)}
                            style={{
                                background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                padding: '0 16px',
                                height: '40px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            <MoreHorizontal size={18} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>更多</span>
                        </button>
                        {isMoreDropdownOpen && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: 4,
                                background: 'var(--bg-sidebar)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 8,
                                padding: '4px 0',
                                minWidth: 140,
                                zIndex: 100,
                                boxShadow: '0 8px 32px var(--glass-shadow)'
                            }}>
                                <div style={{ padding: '6px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)' }}>
                                    查看列表
                                </div>
                                <button
                                    onClick={() => setStatusFilter('active')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: statusFilter === 'active' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                        border: 'none',
                                        color: statusFilter === 'active' ? '#10B981' : 'var(--text-main)',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    活跃客户
                                </button>
                                <button
                                    onClick={() => setStatusFilter('inactive')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: statusFilter === 'inactive' ? 'rgba(156, 163, 175, 0.1)' : 'transparent',
                                        border: 'none',
                                        color: statusFilter === 'inactive' ? 'var(--text-secondary)' : 'var(--text-main)',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    已停用
                                </button>
                                <button
                                    onClick={() => setStatusFilter('deleted')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        width: '100%',
                                        padding: '10px 12px',
                                        background: statusFilter === 'deleted' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                        border: 'none',
                                        color: statusFilter === 'deleted' ? '#ef4444' : 'var(--text-main)',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    已删除
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs - 机构客户和个人客户 */}
            <div style={{ marginBottom: 20 }}>
                <div className="tabs" style={{ display: 'flex', gap: 4, background: 'var(--glass-bg-hover)', padding: 4, borderRadius: 10, height: '48px', alignItems: 'center', width: 'fit-content' }}>
                    <button
                        className={`tab-btn ${activeTab === 'ORGANIZATION' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ORGANIZATION')}
                        style={{
                            padding: '0 24px',
                            height: '40px',
                            background: activeTab === 'ORGANIZATION' ? 'var(--glass-bg-hover)' : 'transparent',
                            color: activeTab === 'ORGANIZATION' ? 'var(--text-main)' : 'var(--text-secondary)',
                            borderRadius: 8,
                            fontWeight: activeTab === 'ORGANIZATION' ? 600 : 400,
                            fontSize: '1rem',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        机构客户
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'INDIVIDUAL' ? 'active' : ''}`}
                        onClick={() => setActiveTab('INDIVIDUAL')}
                        style={{
                            padding: '0 24px',
                            height: '40px',
                            background: activeTab === 'INDIVIDUAL' ? 'var(--glass-bg-hover)' : 'transparent',
                            color: activeTab === 'INDIVIDUAL' ? 'var(--text-main)' : 'var(--text-secondary)',
                            borderRadius: 8,
                            fontWeight: activeTab === 'INDIVIDUAL' ? 600 : 400,
                            fontSize: '1rem',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        个人客户
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', background: 'var(--glass-bg-light)', borderRadius: 16, border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('name')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {t('customer.name' as any) || 'Name'}
                                    {sortBy === 'name' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('country')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {t('customer.region' as any) || 'Region'}
                                    {sortBy === 'country' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>{t('customer.contact' as any) || 'Contact'}</th>
                            <th
                                style={{ padding: 16, color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('service_tier')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {t('customer.tier' as any) || 'Tier'}
                                    {sortBy === 'service_tier' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th style={{ padding: 16, color: 'var(--text-secondary)' }}>{t('common.actions' as any) || 'Actions'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center' }}>Loading...</td></tr>
                        ) : customers.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>No records found</td></tr>
                        ) : (
                            customers.map(c => (
                                <tr
                                    key={c.id}
                                    className="row-hover"
                                    style={{
                                        borderBottom: '1px solid var(--glass-border)',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => navigate(`/service/customers/${c.id}?type=${activeTab}`)}
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{c.customer_name}</div>
                                        {c.company_name && <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{c.company_name}</div>}
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <MapPin size={14} opacity={0.5} />
                                            {c.country || '-'} {c.city ? `/ ${c.city}` : ''}
                                        </div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.9rem' }}>{c.contact_person || '-'}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        {/* 终端客户显示 service_tier（STANDARD/VIP/VVIP等） */}
                                        {(() => {
                                            const isVIP = c.service_tier === 'VIP';
                                            const isVVIP = c.service_tier === 'VVIP';
                                            return (
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    padding: '4px 10px',
                                                    borderRadius: '10px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    background: isVVIP ? 'rgba(239, 68, 68, 0.2)' : isVIP ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--glass-bg-hover)',
                                                    color: isVVIP ? '#EF4444' : isVIP ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                                                    border: isVVIP ? '1px solid rgba(239, 68, 68, 0.4)' : isVIP ? '1px solid rgba(var(--accent-rgb), 0.4)' : '1px solid var(--glass-border)'
                                                }}>
                                                    {(isVIP || isVVIP) && '👑'}{c.service_tier}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td style={{ padding: 16 }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                onClick={() => handleOpenModal(c)}
                                                title="编辑"
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    padding: '8px',
                                                    color: 'var(--accent-blue)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.2s',
                                                    borderRadius: '6px'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            {/* 已停用/已删除列表显示恢复按钮 */}
                                            {(statusFilter === 'inactive' || statusFilter === 'deleted') && (
                                                <button
                                                    onClick={() => handleRestore(c)}
                                                    title="恢复"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: '8px',
                                                        color: '#10B981',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                        borderRadius: '6px'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(34,197,94,0.1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <RotateCcw size={18} />
                                                </button>
                                            )}
                                            {/* 已删除列表显示彻底删除按钮 */}
                                            {statusFilter === 'deleted' && (
                                                <button
                                                    onClick={() => handlePermanentDelete(c)}
                                                    title="彻底删除"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: '8px',
                                                        color: '#ef4444',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                        borderRadius: '6px'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 20, paddingBottom: 20 }}>
                <button
                    disabled={page === 1}
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className="btn-secondary"
                    style={{ background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: 8, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                    {t('common.prev' as any) || 'Prev'}
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', opacity: 0.8 }}>
                    {t('common.page' as any) || 'Page'} {page}
                </span>
                <button
                    onClick={() => setPage(page + 1)}
                    className="btn-secondary"
                    style={{ background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
                >
                    {t('common.next' as any) || 'Next'}
                </button>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <CustomerFormModal
                    isOpen={isModalOpen}
                    onClose={() => !saving && setIsModalOpen(false)}
                    onSubmit={handleSubmit}
                    initialData={editingCustomer}
                    isEditing={!!editingCustomer}
                    _user={user}
                    mode={activeTab === 'ORGANIZATION' ? 'organization' : 'individual'}
                    saving={saving}
                />
            )}

            {/* 彻底删除弹窗 */}
            <PermanentDeleteModal
                isOpen={isPermanentDeleteModalOpen}
                account={permanentDeleteTarget ? {
                    id: permanentDeleteTarget.id,
                    name: permanentDeleteTarget.customer_name,
                    account_type: (permanentDeleteTarget as any).account_type || 'ORGANIZATION'
                } : null}
                onClose={() => {
                    setIsPermanentDeleteModalOpen(false);
                    setPermanentDeleteTarget(null);
                }}
                onConfirmDelete={handleConfirmPermanentDelete}
                loading={permanentDeleteLoading}
            />

        </div>
    );
};

export default CustomerManagement;
