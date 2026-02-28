import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../i18n/useLanguage';
import { Search, Plus, MapPin, Edit2, Building, ChevronUp, ChevronDown, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import CustomerFormModal from './CustomerFormModal';
import PermanentDeleteModal from './PermanentDeleteModal';

// Types
interface Dealer {
    id: number;
    account_type: 'Dealer';
    customer_name: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    country?: string;
    province?: string;
    city?: string;
    company_name?: string;
    notes?: string;
    service_tier: 'STANDARD' | 'VIP' | 'VVIP' | 'PARTNER' | 'FirstTier' | 'SecondTier' | 'ThirdTier';
    industry_tags?: string;
    parent_dealer_id?: number;
    dealer_level?: string;
    dealer_code?: string;
    created_at: string;
}

const DealerManagement: React.FC = () => {
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const searchQuery = searchParams.get('q') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const sortBy = searchParams.get('sort_by') || 'created_at';
    const sortOrder = (searchParams.get('sort_order') || 'desc') as 'asc' | 'desc';
    const statusFilter = searchParams.get('status') || 'active';

    const [dealers, setDealers] = useState<Dealer[]>([]);
    const [loading, setLoading] = useState(false);

    const updateParams = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        setSearchParams({ ...current, ...newParams });
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
    const [editingDealer, setEditingDealer] = useState<Dealer | null>(null);
    const [saving, setSaving] = useState(false);

    // More dropdown state
    const [isMoreDropdownOpen, setIsMoreDropdownOpen] = useState(false);
    const moreDropdownRef = useRef<HTMLDivElement>(null);

    // Form State - now handled by CustomerFormModal
    const [_formData, _setFormData] = useState<Partial<Dealer>>({});

    // Search expand state
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    // 彻底删除弹窗状态
    const [isPermanentDeleteModalOpen, setIsPermanentDeleteModalOpen] = useState(false);
    const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Dealer | null>(null);
    const [permanentDeleteLoading, setPermanentDeleteLoading] = useState(false);

    const fetchDealers = async () => {
        setLoading(true);
        setDealers([]);
        try {
            // 使用新的 accounts API 获取经销商（已包含主联系人信息）
            const res = await axios.get(`/api/v1/accounts`, {
                params: {
                    account_type: 'DEALER',
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
                const mappedDealers = accountsData.map((acc: any) => ({
                    id: acc.id,
                    customer_name: acc.name,
                    contact_person: acc.primary_contact_name || '-',
                    phone: acc.primary_contact_phone || '',
                    email: acc.primary_contact_email || '',
                    country: acc.country,
                    city: acc.city,
                    company_name: acc.name,
                    dealer_code: acc.dealer_code,
                    dealer_level: acc.dealer_level,
                    service_tier: acc.service_tier,
                    created_at: acc.created_at
                }));
                setDealers(mappedDealers);
            }
        } catch (err) {
            console.error('Failed to fetch dealers', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchDealers();
    }, [token, page, searchQuery, sortBy, sortOrder, statusFilter]);

    const handleOpenModal = async (dealer?: Dealer) => {
        if (dealer) {
            // 编辑时先从后端获取完整账户数据（包含 contacts 和所有字段）
            try {
                const res = await axios.get(`/api/v1/accounts/${dealer.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    const fullData = res.data.data;
                    // 合并完整数据
                    setEditingDealer({
                        ...dealer,
                        ...fullData,
                        customer_name: fullData.name,
                        contacts: fullData.contacts || []
                    });
                    _setFormData({
                        ...dealer,
                        ...fullData,
                        customer_name: fullData.name,
                        contacts: fullData.contacts || []
                    });
                } else {
                    // fallback to list data
                    setEditingDealer(dealer);
                    _setFormData(dealer);
                }
            } catch (err) {
                console.error('Failed to fetch account details', err);
                // fallback to list data
                setEditingDealer(dealer);
                _setFormData(dealer);
            }
        } else {
            setEditingDealer(null);
            _setFormData({
                account_type: 'Dealer',
                service_tier: 'STANDARD'
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent, formData: any) => {
        e.preventDefault();
        setSaving(true);
        try {
            // 转换表单数据为 accounts API 格式
            const accountData = {
                name: formData.name,
                account_type: 'DEALER',
                dealer_code: formData.dealer_code,
                dealer_level: formData.dealer_level,
                can_repair: !!formData.repair_level,
                repair_level: formData.repair_level,
                address: formData.address,
                country: formData.country,
                city: formData.city,
                notes: formData.notes,
                primary_contact: formData.contacts.find((c: any) => c.is_primary) || formData.contacts[0]
            };

            if (editingDealer) {
                // 1. Update account basic info
                await axios.patch(`/api/v1/accounts/${editingDealer.id}`, accountData, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                // 2. Sync contacts - Differential Sync
                const existingContactsRes = await axios.get(`/api/v1/accounts/${editingDealer.id}/contacts`, {
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
                        await axios.post(`/api/v1/accounts/${editingDealer.id}/contacts`, {
                            name: contact.name,
                            email: contact.email,
                            phone: contact.phone,
                            job_title: contact.job_title,
                            is_primary: contact.is_primary
                        }, { headers: { Authorization: `Bearer ${token}` } });
                    } catch (err) { console.error('Failed to create contact', err); }
                }
            } else {
                // 新增经销商
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
            fetchDealers();
        } catch (err) {
            console.error('Failed to save dealer', err);
            alert('Operation failed');
        } finally {
            setSaving(false);
        }
    };

    // 恢复账户（从已删除/已停用状态恢复）
    const handleRestore = async (dealer: Dealer) => {
        try {
            await axios.patch(`/api/v1/accounts/${dealer.id}`,
                { is_active: true, is_deleted: false },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchDealers();
        } catch (err) {
            console.error('Restore failed:', err);
            alert('恢复失败');
        }
    };

    // 彻底删除 - 打开弹窗
    const handlePermanentDelete = (dealer: Dealer) => {
        setPermanentDeleteTarget(dealer);
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
            fetchDealers();
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
                        <Building size={28} color="var(--accent-blue)" />
                        {t('sidebar.archives_dealers') || '渠道和经销商'}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{t('admin.manage_dealers_desc') || 'Manage Dealers and Channel Partners'}</p>
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
                        background: isSearchExpanded ? 'var(--glass-border)' : 'transparent',
                        border: isSearchExpanded ? '1px solid var(--glass-bg-hover)' : 'none',
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
                                placeholder="搜索经销商..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
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
                                background: 'var(--glass-border)',
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
                                background: 'var(--glass-bg)',
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
                                        color: statusFilter === 'active' ? '#10B981' : 'white',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    活跃经销商
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
                                        color: statusFilter === 'inactive' ? '#9ca3af' : 'white',
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
                                        color: statusFilter === 'deleted' ? '#ef4444' : 'white',
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

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto', background: 'var(--glass-border)', borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <th
                                style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('name')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    经销商
                                    {sortBy === 'name' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th
                                style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('dealer_code')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    代码
                                    {sortBy === 'dealer_code' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th
                                style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('country')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    地区
                                    {sortBy === 'country' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>联系人</th>
                            <th
                                style={{ padding: 16, textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleSort('dealer_level')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    经销商等级
                                    {sortBy === 'dealer_level' && (
                                        sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th style={{ padding: 16, textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    加载中...
                                </td>
                            </tr>
                        ) : dealers.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                                    暂无经销商数据
                                </td>
                            </tr>
                        ) : (
                            dealers.map((dealer) => (
                                <tr
                                    key={dealer.id}
                                    style={{ borderBottom: '1px solid var(--glass-border)', cursor: 'pointer' }}
                                    onClick={() => navigate(`/service/dealers/${dealer.id}?type=Dealer`)}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--glass-border)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontWeight: 600 }}>{dealer.customer_name}</div>
                                        {dealer.company_name && dealer.company_name !== dealer.customer_name && (
                                            <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{dealer.company_name}</div>
                                        )}
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        {dealer.dealer_code && (
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--accent-blue)' }}>
                                                {dealer.dealer_code}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.9rem' }}>
                                            <MapPin size={12} />
                                            {[dealer.city, dealer.country].filter(Boolean).join(', ') || '-'}
                                        </div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <div style={{ fontSize: '0.9rem' }}>{dealer.contact_person || '-'}</div>
                                    </td>
                                    <td style={{ padding: 16 }}>
                                        <span style={{
                                            padding: '4px 8px',
                                            borderRadius: 4,
                                            background: dealer.dealer_level?.toLowerCase().includes('tier1') || dealer.dealer_level?.toLowerCase().includes('first') ? 'rgba(255,215,0,0.15)' :
                                                dealer.dealer_level?.toLowerCase().includes('tier2') || dealer.dealer_level?.toLowerCase().includes('second') ? 'rgba(59,130,246,0.15)' :
                                                    dealer.dealer_level?.toLowerCase().includes('tier3') || dealer.dealer_level?.toLowerCase().includes('third') ? 'rgba(107,114,128,0.15)' :
                                                        'var(--glass-bg-hover)',
                                            color: dealer.dealer_level?.toLowerCase().includes('tier1') || dealer.dealer_level?.toLowerCase().includes('first') ? '#FFD700' :
                                                dealer.dealer_level?.toLowerCase().includes('tier2') || dealer.dealer_level?.toLowerCase().includes('second') ? '#60A5FA' :
                                                    dealer.dealer_level?.toLowerCase().includes('tier3') || dealer.dealer_level?.toLowerCase().includes('third') ? '#9CA3AF' :
                                                        'white',
                                            fontSize: '0.75rem',
                                            fontWeight: 600
                                        }}>
                                            {dealer.dealer_level?.replace('Tier', 'Tier ').replace('tier', 'Tier ') || '-'}
                                        </span>
                                    </td>
                                    <td style={{ padding: 16 }} onClick={e => e.stopPropagation()}>
                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                            <button
                                                onClick={() => handleOpenModal(dealer)}
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
                                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,215,0,0.1)'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            {/* 已停用/已删除列表显示恢复按钮 */}
                                            {(statusFilter === 'inactive' || statusFilter === 'deleted') && (
                                                <button
                                                    onClick={() => handleRestore(dealer)}
                                                    title="恢复"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: '8px',
                                                        color: 'var(--text-success)',
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
                                                    onClick={() => handlePermanentDelete(dealer)}
                                                    title="彻底删除"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        padding: '8px',
                                                        color: 'var(--text-danger)',
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
                    style={{ background: 'var(--glass-border)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: 8, cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                >
                    {t('common.prev') || 'Prev'}
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem', opacity: 0.8 }}>
                    {t('common.page') || 'Page'} {page}
                </span>
                <button
                    onClick={() => setPage(page + 1)}
                    className="btn-secondary"
                    style={{ background: 'var(--glass-border)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}
                >
                    {t('common.next') || 'Next'}
                </button>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <CustomerFormModal
                    isOpen={isModalOpen}
                    onClose={() => !saving && setIsModalOpen(false)}
                    onSubmit={handleSubmit}
                    initialData={editingDealer}
                    isEditing={!!editingDealer}
                    _user={{}}
                    mode="dealer"
                    saving={saving}
                />
            )}

            {/* 彻底删除弹窗 */}
            <PermanentDeleteModal
                isOpen={isPermanentDeleteModalOpen}
                account={permanentDeleteTarget ? {
                    id: permanentDeleteTarget.id,
                    name: permanentDeleteTarget.customer_name,
                    account_type: 'DEALER'
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

export default DealerManagement;
