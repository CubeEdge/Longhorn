import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Loader2, Package, List, Layers, AlertTriangle, ChevronDown, ChevronUp, Clock, AlertCircle, CheckCircle, HelpCircle, Users, ClipboardList } from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';
import { useTicketStore } from '../../store/useTicketStore';
import { useCachedTickets } from '../../hooks/useCachedTickets';
import { useListStateStore } from '../../store/useListStateStore';
import { KineSelect } from '../UI/KineSelect';
import { CustomDatePicker } from '../UI/CustomDatePicker';
import { SortDropdown } from '../UI/SortDropdown';
import { format, subDays, subMonths, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface RMATicket {
    id: number;
    ticket_number: string;
    channel_code: string;
    issue_type: string;
    issue_category: string;
    severity: number;
    // Account/Contact Info
    account_id?: number;
    contact_id?: number;
    account?: {
        id: number;
        name: string;
        account_type?: string;
        service_tier?: string;
    };
    contact?: {
        id: number;
        name: string;
    };
    // Dealer Info
    dealer_id?: number;
    dealer_name?: string;
    dealer_contact_name?: string;
    // Customer Info (backward compatible)
    customer_name: string;
    customer_contact?: string;
    product: { id: number; name: string } | null;
    serial_number: string;
    problem_description: string;
    reporter_name: string;
    status: string;
    assigned_to: { id: number; name: string } | null;
    created_at: string;
    updated_at: string;
}

// Status colors using Kine brand colors from context.md
// Kine Yellow: #FFD700, Kine Green: #10B981, Kine Red: #EF4444
const statusColors: Record<string, string> = {
    Pending: 'var(--accent-blue)',        // Kine Yellow - received/waiting
    Confirming: '#f59e0b',     // Amber - waiting for customer confirmation
    Diagnosing: '#8b5cf6',     // Purple - in diagnosis
    InRepair: '#3b82f6',       // Blue - in repair
    Repaired: '#10B981',       // Kine Green - repaired
    Shipped: '#06b6d4',        // Cyan - shipped
    Completed: '#10B981',      // Kine Green - completed
    Cancelled: '#6b7280'       // Gray - cancelled
};

const CollapsibleSection: React.FC<{
    title: string;
    count: number;
    icon: React.ElementType;
    color: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    sectionKey: string;
    onToggle?: (key: string, isOpen: boolean) => void;
    initialOpen?: boolean;
}> = ({ title, count, icon: Icon, color, children, defaultOpen = true, sectionKey, onToggle, initialOpen }) => {
    const [isOpen, setIsOpen] = useState(initialOpen !== undefined ? initialOpen : defaultOpen);

    const handleToggle = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        onToggle?.(sectionKey, newState);
    };

    return (
        <section style={{ marginBottom: '16px' }}>
            <div
                onClick={handleToggle}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    color: color,
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '8px 0'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <Icon size={18} />
                    <h2 style={{ fontSize: '0.95rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                        {title} ({count})
                    </h2>
                </div>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {children}
                </div>
            )}
        </section>
    );
};

const severityColors: Record<number, string> = {
    1: '#EF4444',  // Kine Red - critical
    2: '#f59e0b',  // Amber - warning
    3: '#6b7280'   // Gray - low
};

const RMATicketListPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const openModal = useTicketStore(state => state.openModal);

    // List state store for persisting view preferences
    const {
        rmaViewMode: savedViewMode,
        setRmaViewMode: saveViewMode,
        isRmaSectionCollapsed,
        setRmaSectionCollapsed,
        rmaScrollPosition: savedScrollPosition,
        setRmaScrollPosition: saveScrollPosition,
        setRmaFilters
    } = useListStateStore();

    // Ref for scroll container
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const [pageSize] = useState(20);

    // Filters
    const timeScope = searchParams.get('time_scope') || '30d';
    const productFamilyScope = searchParams.get('product_family') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const channelFilter = searchParams.get('channel_code') || 'all';
    const serviceTierFilter = searchParams.get('service_tier') || 'all';
    const searchTerm = searchParams.get('keyword') || '';
    const pageParam = searchParams.get('page');
    const page = pageParam ? parseInt(pageParam) : 1;

    // Local States - use saved view mode from store
    const [groupMode, setGroupMode] = useState<'grouped' | 'flat'>(savedViewMode);
    const [searchOpen, setSearchOpen] = useState(!!searchTerm);
    const [localSearch, setLocalSearch] = useState(searchTerm);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [customRange, setCustomRange] = useState({
        start: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    // Sort State
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== searchTerm) {
                updateFilter({ keyword: localSearch });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [localSearch]);

    // Save filters to store for detail page to use
    useEffect(() => {
        setRmaFilters({
            time_scope: timeScope,
            product_family: productFamilyScope,
            status: statusFilter,
            keyword: searchTerm
        });
    }, [timeScope, productFamilyScope, statusFilter, searchTerm, setRmaFilters]);

    // Restore scroll position on mount
    useEffect(() => {
        if (scrollContainerRef.current && savedScrollPosition > 0) {
            scrollContainerRef.current.scrollTop = savedScrollPosition;
        }
    }, []);

    // Save scroll position on scroll
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        saveScrollPosition(scrollTop);
    }, [saveScrollPosition]);

    // Build params
    const queryParams = useMemo(() => {
        const params: Record<string, string | number | undefined> = {
            page,
            page_size: pageSize,
            sort_by: sortBy,
            sort_order: sortOrder
        };

        if (timeScope === '7d') {
            params.created_from = format(subDays(new Date(), 7), 'yyyy-MM-dd');
        } else if (timeScope === '30d') {
            params.created_from = format(subDays(new Date(), 30), 'yyyy-MM-dd');
        } else if (timeScope === 'custom') {
            const start = searchParams.get('start_date');
            const end = searchParams.get('end_date');
            if (start) params.created_from = start;
            if (end) params.created_to = end;
        }

        if (productFamilyScope !== 'all') params.product_family = productFamilyScope;
        if (statusFilter !== 'all') params.status = statusFilter;
        if (channelFilter !== 'all') params.channel_code = channelFilter;
        if (searchTerm) params.keyword = searchTerm;
        if (serviceTierFilter !== 'all') params.service_tier = serviceTierFilter;

        return params;
    }, [page, pageSize, timeScope, productFamilyScope, statusFilter, channelFilter, searchTerm, searchParams, sortBy, sortOrder]);

    const { tickets, meta, isLoading } = useCachedTickets<RMATicket>('rma', queryParams);
    const total = meta.total;
    const totalPages = Math.ceil(total / pageSize);

    const updateFilter = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        if (!newParams.page) {
            newParams.page = '1';
        }
        setSearchParams({ ...current, ...newParams });
    };

    const handlePageChange = (newPage: number) => {
        updateFilter({ page: newPage.toString() });
    };

    const applyCustomDate = () => {
        if (customRange.start && customRange.end) {
            updateFilter({
                time_scope: 'custom',
                start_date: customRange.start,
                end_date: customRange.end
            });
            setShowDatePicker(false);
        }
    };

    const toggleGroupMode = (mode: 'grouped' | 'flat') => {
        setGroupMode(mode);
        saveViewMode(mode);
    };

    // Handle section toggle to persist collapsed state
    const handleSectionToggle = (sectionKey: string, isOpen: boolean) => {
        setRmaSectionCollapsed(sectionKey, !isOpen);
    };

    // 产品族群映射：前端显示名称 -> 数据库代码
    // A = 在售电影机 (Current Cine Cameras)
    // B = 历史机型 (Archived Cine Cameras)
    // C = 电子寻像器 (Eagle e-Viewfinder)
    // D = 通用配件 (Universal Accessories)
    const productFamilies = [
        { id: 'all', label: t('filter.all_products') },
        { id: 'A', label: '在售电影机' },
        { id: 'B', label: '历史机型' },
        { id: 'C', label: '电子寻像器' },
        { id: 'D', label: '通用配件' }
    ];

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            Pending: t('rma_ticket.status.pending' as any) || '已收货',
            Confirming: t('rma_ticket.status.confirming' as any) || '确认中',
            Diagnosing: t('rma_ticket.status.diagnosing' as any) || '检测中',
            InRepair: t('rma_ticket.status.in_repair' as any) || '维修中',
            Repaired: t('rma_ticket.status.repaired' as any) || '已修复',
            Shipped: t('rma_ticket.status.shipped' as any) || '已发货',
            Completed: t('rma_ticket.status.completed' as any) || '已完成',
            Cancelled: t('rma_ticket.status.cancelled' as any) || '已取消'
        };
        return labels[status] || status;
    };

    // Group tickets by status
    const groupedTickets = useMemo(() => {
        const groups: Record<string, RMATicket[]> = {
            Pending: [],
            Confirming: [],
            Diagnosing: [],
            InRepair: [],
            Repaired: [],
            Shipped: [],
            Completed: [],
            Cancelled: []
        };
        tickets.forEach(ticket => {
            if (groups[ticket.status]) {
                groups[ticket.status].push(ticket);
            }
        });
        return groups;
    }, [tickets]);

    const statusOrder = ['Pending', 'Confirming', 'Diagnosing', 'InRepair', 'Repaired', 'Shipped', 'Completed', 'Cancelled'];
    const statusIcons: Record<string, React.ElementType> = {
        Pending: Package,
        Confirming: HelpCircle,
        Diagnosing: Clock,
        InRepair: Clock,
        Repaired: CheckCircle,
        Shipped: Package,
        Completed: CheckCircle,
        Cancelled: AlertCircle
    };

    const TicketCard = ({ ticket }: { ticket: RMATicket }) => (
        <div
            onClick={() => navigate(`/service/rma-tickets/${ticket.id}`)}
            style={{
                background: 'var(--bg-card)', borderRadius: '12px', padding: '18px',
                border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s',
                position: 'relative', display: 'flex', gap: '24px'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Left Column - Main Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {/* Line 1: Ticket Number + Severity + Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{ticket.ticket_number}</span>
                    {ticket.severity && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600,
                            background: `${severityColors[ticket.severity]}20`, color: severityColors[ticket.severity]
                        }}>
                            <AlertTriangle size={11} /> P{ticket.severity}
                        </span>
                    )}
                    <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600,
                        background: `${statusColors[ticket.status] || '#6b7280'}20`, color: statusColors[ticket.status] || '#6b7280'
                    }}>
                        {getStatusLabel(ticket.status)}
                    </span>
                </div>

                {/* Line 2: Reporter/Contact Info + Service Tier */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {(() => {
                        // RMA-C (channel_code='C'): 客户名称 + 客户联系人
                        // RMA-D (channel_code='D'): 经销商名称 客户icon 客户名称 + 客户联系人
                        const isDealerChannel = ticket.channel_code === 'D';
                        const serviceTier = ticket.account?.service_tier || 'Standard';
                        const isVIP = serviceTier === 'VIP';
                        const isVVIP = serviceTier === 'VVIP';

                        if (isDealerChannel) {
                            // RMA-D: 经销商名称 客户icon 客户名称 + 客户联系人
                            const dealerName = ticket.dealer_name;
                            const accountName = ticket.account?.name || ticket.customer_name;
                            const contactName = ticket.contact?.name || ticket.customer_contact;

                            return (
                                <>
                                    {dealerName && (
                                        <span style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{dealerName}</span>
                                    )}
                                    {accountName && (
                                        <>
                                            <span style={{ marginLeft: '8px', marginRight: '4px' }}></span>
                                            <Users size={14} style={{ color: 'var(--text-secondary)' }} />
                                            <span style={{ fontWeight: 500 }}>{accountName}</span>
                                            {contactName && contactName !== accountName && (
                                                <>
                                                    <span>·</span>
                                                    <span>{contactName}</span>
                                                </>
                                            )}
                                        </>
                                    )}
                                    {/* Service Tier Badge */}
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        marginLeft: '8px',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        background: isVVIP ? 'rgba(239, 68, 68, 0.2)' : isVIP ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--glass-bg-hover)',
                                        color: isVVIP ? '#EF4444' : isVIP ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                                        border: isVVIP ? '1px solid rgba(239, 68, 68, 0.4)' : isVIP ? '1px solid rgba(var(--accent-rgb), 0.4)' : '1px solid var(--glass-border)'
                                    }}>
                                        {(isVIP || isVVIP) && '👑'}{serviceTier}
                                    </span>
                                </>
                            );
                        } else {
                            // RMA-C: 客户名称 + 客户联系人（保持不变）
                            const displayName = ticket.contact?.name || ticket.customer_contact || ticket.account?.name || ticket.customer_name || ticket.reporter_name || '匿名';
                            let contactPart = '';

                            if (ticket.contact?.name && ticket.contact.name !== displayName) {
                                contactPart = ticket.contact.name;
                            } else if (ticket.customer_contact && ticket.customer_contact !== displayName) {
                                contactPart = ticket.customer_contact;
                            }

                            return (
                                <>
                                    <span style={{ fontWeight: 500 }}>{displayName}</span>
                                    {contactPart && (
                                        <>
                                            <span>·</span>
                                            <span>{contactPart}</span>
                                        </>
                                    )}
                                    {/* Service Tier Badge */}
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        marginLeft: '8px',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        background: isVVIP ? 'rgba(239, 68, 68, 0.2)' : isVIP ? 'rgba(var(--accent-rgb), 0.2)' : 'var(--glass-bg-hover)',
                                        color: isVVIP ? '#EF4444' : isVIP ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                                        border: isVVIP ? '1px solid rgba(239, 68, 68, 0.4)' : isVIP ? '1px solid rgba(var(--accent-rgb), 0.4)' : '1px solid var(--glass-border)'
                                    }}>
                                        {(isVIP || isVVIP) && '👑'}{serviceTier}
                                    </span>
                                </>
                            );
                        }
                    })()}
                </div>

                {/* Line 3: Issue Category + Problem Description */}
                <p style={{
                    fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5',
                    display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', margin: 0
                }}>
                    {(ticket.issue_category || ticket.issue_type) && (
                        <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>
                            [{ticket.issue_category || ticket.issue_type}]
                        </span>
                    )}
                    {ticket.problem_description || '-'}
                </p>
            </div>

            {/* Right Column - Product Info + Time */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '200px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: zhCN })}
                </span>
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                    gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)'
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        📷 {ticket.product?.name || '-'}
                    </span>
                    <span>SN: {ticket.serial_number || '-'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        🔧 {ticket.assigned_to?.name || '-'}
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ padding: '24px', width: '100%', margin: '0', height: '100vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header - macOS26 Style */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}>
                        <ClipboardList size={28} color="#FFD700" />
                        RMA返修工单
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.9rem' }}>
                        管理返厂维修流程，从收货到发货的全流程跟踪
                    </p>
                </div>
                {/* Right: Search & New Ticket */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
                        {!searchOpen ? (
                            <button
                                onClick={() => setSearchOpen(true)}
                                style={{
                                    width: '40px', height: '40px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                                    background: 'var(--glass-bg-hover)', color: 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <Search size={18} />
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px', animation: 'fadeIn 0.2s ease-out' }}>
                                <div style={{ position: 'relative', width: '200px', height: '40px' }}>
                                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder={t('rma_ticket.search_placeholder')}
                                        style={{
                                            width: '100%', height: '100%', padding: '0 12px 0 32px',
                                            borderRadius: '8px', border: '1px solid #FFD700', background: 'var(--bg-sidebar)',
                                            color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                                        }}
                                        value={localSearch}
                                        onChange={(e) => setLocalSearch(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { updateFilter({ keyword: localSearch }); } }}
                                        onBlur={() => { if (!localSearch) setSearchOpen(false); }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => openModal('RMA')}
                        className="btn"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '40px',
                            padding: '0 16px', fontSize: '0.85rem', whiteSpace: 'nowrap',
                            background: 'rgba(var(--accent-rgb), 0.1)',
                            border: '1px solid rgba(var(--accent-rgb), 0.5)',
                            color: 'var(--accent-blue)',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.2)';
                            e.currentTarget.style.borderColor = 'var(--accent-blue)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb), 0.5)';
                        }}
                    >
                        <Plus size={16} />
                        {t('rma_ticket.title')}
                    </button>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    {/* Time Scope */}
                    <div style={{ minWidth: '150px' }}>
                        <KineSelect
                            value={timeScope}
                            onChange={(val) => {
                                if (val === 'custom') {
                                    setShowDatePicker(true);
                                } else {
                                    updateFilter({ time_scope: val, start_date: '', end_date: '' });
                                }
                            }}
                            options={[
                                { value: '7d', label: t('filter.last_7_days') },
                                { value: '30d', label: t('filter.last_30_days') },
                                {
                                    value: 'custom',
                                    label: (timeScope === 'custom' && searchParams.get('start_date') && searchParams.get('end_date'))
                                        ? `${searchParams.get('start_date')} ~ ${searchParams.get('end_date')}`
                                        : '自定义日期'
                                }
                            ]}
                        />
                    </div>

                    {/* Product Family */}
                    <div style={{ minWidth: '180px' }}>
                        <KineSelect
                            value={productFamilyScope}
                            onChange={(val) => updateFilter({ product_family: val })}
                            options={productFamilies.map(fam => ({ value: fam.id, label: fam.label }))}
                        />
                    </div>

                    {/* Advanced Filter Button - Moved here */}
                    <button
                        onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                        style={{
                            height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                            background: showAdvancedFilter ? 'rgba(var(--accent-rgb),0.2)' : 'var(--glass-bg-hover)',
                            color: showAdvancedFilter ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                            transition: 'all 0.2s', fontSize: '0.85rem'
                        }}
                    >
                        <Filter size={16} />
                        <span>筛选</span>
                    </button>

                </div>

                {/* Right: Group Mode & Sort */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Sort Dropdown - macOS26 Finder Style */}
                    <SortDropdown
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onChange={(field: string, order: 'asc' | 'desc') => {
                            setSortBy(field);
                            setSortOrder(order);
                        }}
                        options={[
                            { field: 'created_at', label: '创建时间' },
                            { field: 'updated_at', label: '更新时间' },
                            { field: 'ticket_number', label: '工单编号' },
                            { field: 'customer_name', label: '客户名称' },
                            { field: 'handler_name', label: '处理人' },
                            { field: 'severity', label: '严重程度' }
                        ]}
                    />

                    {/* Group Mode Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--glass-bg-hover)', borderRadius: '8px', padding: '2px', height: '40px' }}>
                        <button
                            onClick={() => toggleGroupMode('grouped')}
                            title="分组模式"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '6px', border: 'none',
                                background: groupMode === 'grouped' ? 'var(--glass-bg-hover)' : 'transparent',
                                color: groupMode === 'grouped' ? 'var(--text-main)' : 'var(--text-tertiary)',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <Layers size={16} />
                        </button>
                        <button
                            onClick={() => toggleGroupMode('flat')}
                            title="平铺模式"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '6px', border: 'none',
                                background: groupMode === 'flat' ? 'var(--glass-bg-hover)' : 'transparent',
                                color: groupMode === 'flat' ? 'var(--text-main)' : 'var(--text-tertiary)',
                                cursor: 'pointer', transition: 'all 0.2s'
                            }}
                        >
                            <List size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilter && (
                <div style={{
                    marginBottom: '16px', padding: '16px', background: 'var(--glass-bg-light)',
                    border: '1px solid var(--glass-border)', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '24px', animation: 'slideDown 0.2s ease-out'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>STATUS</span>
                        <KineSelect
                            value={statusFilter}
                            onChange={(val) => updateFilter({ status: val })}
                            options={[
                                { value: 'all', label: t('filter.all_status') },
                                { value: 'Pending', label: t('rma_ticket.status.pending' as any) || '已收货' },
                                { value: 'Confirming', label: t('rma_ticket.status.confirming' as any) || '确认中' },
                                { value: 'Diagnosing', label: t('rma_ticket.status.diagnosing' as any) || '检测中' },
                                { value: 'InRepair', label: t('rma_ticket.status.in_repair' as any) || '维修中' },
                                { value: 'Repaired', label: t('rma_ticket.status.repaired' as any) || '已修复' },
                                { value: 'Shipped', label: t('rma_ticket.status.shipped' as any) || '已发货' },
                                { value: 'Completed', label: t('rma_ticket.status.completed' as any) || '已完成' },
                                { value: 'Cancelled', label: t('rma_ticket.status.cancelled' as any) || '已取消' }
                            ]}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CHANNEL</span>
                        <KineSelect
                            value={channelFilter}
                            onChange={(val) => updateFilter({ channel_code: val })}
                            options={[
                                { value: 'all', label: 'All Channels' },
                                { value: 'D', label: t('rma_ticket.channel.dealer') },
                                { value: 'C', label: t('rma_ticket.channel.customer') },
                                { value: 'I', label: t('rma_ticket.channel.internal') }
                            ]}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('filter.service_tier')}</span>
                        <KineSelect
                            value={serviceTierFilter}
                            onChange={(val) => updateFilter({ service_tier: val })}
                            options={[
                                { value: 'all', label: t('filter.all_tiers') },
                                { value: 'VIP', label: t('service_tier.VIP') },
                                { value: 'VVIP', label: t('service_tier.VVIP') },
                                { value: 'STANDARD', label: t('service_tier.STANDARD') },
                                { value: 'BLACKLIST', label: t('service_tier.BLACKLIST') }
                            ]}
                        />
                    </div>
                </div>
            )}

            {/* Ticket List */}
            {isLoading && tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <p>{t('common.loading')}</p>
                </div>
            ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p>{t('rma_ticket.empty_hint')}</p>
                </div>
            ) : groupMode === 'grouped' ? (
                // Grouped Mode
                <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto' }}>
                    {statusOrder.map(status => {
                        const statusTickets = groupedTickets[status] || [];
                        if (statusTickets.length === 0) return null;
                        const Icon = statusIcons[status];
                        const defaultOpen = ['Pending', 'Confirming', 'Diagnosing', 'InRepair'].includes(status);
                        return (
                            <CollapsibleSection
                                key={status}
                                title={getStatusLabel(status)}
                                count={statusTickets.length}
                                icon={Icon}
                                color={statusColors[status] || '#6b7280'}
                                sectionKey={status}
                                defaultOpen={defaultOpen}
                                initialOpen={!isRmaSectionCollapsed(status, defaultOpen)}
                                onToggle={handleSectionToggle}
                            >
                                {statusTickets.map(ticket => (
                                    <TicketCard key={ticket.id} ticket={ticket} />
                                ))}
                            </CollapsibleSection>
                        );
                    })}
                </div>
            ) : (
                // Flat Mode
                <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {tickets.map(ticket => (
                        <TicketCard key={ticket.id} ticket={ticket} />
                    ))}
                </div>
            )}

            {/* Custom Date Modal */}
            {showDatePicker && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 2000,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setShowDatePicker(false)}>
                    <div style={{
                        width: '400px', background: 'var(--bg-sidebar)', borderRadius: '16px', padding: '24px',
                        border: '1px solid var(--glass-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '20px' }}>
                            {t('filter.custom_range')}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                            <CustomDatePicker
                                label={t('common.start_date')}
                                value={customRange.start}
                                onChange={v => setCustomRange(p => ({ ...p, start: v }))}
                            />
                            <CustomDatePicker
                                label={t('common.end_date')}
                                value={customRange.end}
                                onChange={v => setCustomRange(p => ({ ...p, end: v }))}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowDatePicker(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', color: 'var(--text-main)', cursor: 'pointer' }}>
                                {t('action.cancel')}
                            </button>
                            <button onClick={applyCustomDate} style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: 'var(--accent-blue)', color: 'var(--bg-main)', fontWeight: 600, cursor: 'pointer' }}>
                                {t('action.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '24px', paddingBottom: '24px' }}>
                    <button onClick={() => handlePageChange(Math.max(1, page - 1))} disabled={page === 1} className="btn btn-secondary btn-sm"><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: '0.875rem' }}>{page} / {totalPages}</span>
                    <button onClick={() => handlePageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="btn btn-secondary btn-sm"><ChevronRight size={16} /></button>
                </div>
            )}
        </div>
    );
};

export default RMATicketListPage;
