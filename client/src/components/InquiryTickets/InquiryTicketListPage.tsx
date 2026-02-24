import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, MessageSquare, Clock, CheckCircle, Loader2, AlertCircle, AlertTriangle, List, Layers, ChevronDown, ChevronUp, Users, MessageCircleQuestion } from 'lucide-react';
import { KineSelect } from '../UI/KineSelect';
import { CustomDatePicker } from '../UI/CustomDatePicker';
import { SortDropdown } from '../UI/SortDropdown';
import { formatDistanceToNow, differenceInHours, subDays, format, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useLanguage } from '../../i18n/useLanguage';
import { useTicketStore } from '../../store/useTicketStore';
import { useCachedTickets } from '../../hooks/useCachedTickets';
import { useListStateStore } from '../../store/useListStateStore';

interface InquiryTicket {
    id: number;
    ticket_number: string;
    service_type: string;
    channel: string;
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
    // Customer Info
    customer_name: string;
    customer_contact?: string;
    problem_summary: string;
    status: string;
    handler: { id: number; name: string } | null;
    product: { id: number; name: string } | null;
    serial_number: string;
    created_at: string;
    updated_at: string;
    product_family?: string;
}

// Status colors using Kine brand colors from context.md
// Kine Yellow: #FFD700, Kine Green: #4CAF50, Kine Red: #EF4444
const statusColors: Record<string, string> = {
    Pending: '#EF4444',        // Kine Red - urgent attention
    InProgress: '#3b82f6',     // Blue - in progress
    AwaitingFeedback: '#d946ef', // Purple - waiting
    Resolved: '#4CAF50',       // Kine Green - completed
    AutoClosed: '#9ca3af',     // Gray - closed
    Upgraded: '#22d3ee'        // Cyan - upgraded
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
                    userSelect: 'none'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <Icon size={18} />
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                        {title} ({count})
                    </h2>
                </div>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {children}
                </div>
            )}
        </section>
    );
};



// ... existing code ...



const InquiryTicketListPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const openModal = useTicketStore(state => state.openModal);

    // List state store for persisting view preferences
    const {
        inquiryViewMode: savedViewMode,
        setInquiryViewMode: saveViewMode,
        isInquirySectionCollapsed,
        setInquirySectionCollapsed,
        inquiryScrollPosition: savedScrollPosition,
        setInquiryScrollPosition: saveScrollPosition,
        setInquiryFilters
    } = useListStateStore();

    // Ref for scroll container
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const [pageSize] = useState(50);

    // Scope Filters
    const timeScope = searchParams.get('time_scope') || '30d';
    const productFamilyScope = searchParams.get('product_family') || 'all';
    const searchTerm = searchParams.get('keyword') || '';
    const statusFilter = searchParams.get('status') || 'all';
    const serviceTierFilter = searchParams.get('service_tier') || 'all';
    const pageParam = searchParams.get('page');
    const page = pageParam ? parseInt(pageParam) : 1;

    // Local States - use saved view mode from store
    const [viewMode, setViewMode] = useState<'list' | 'card'>(savedViewMode === 'grouped' ? 'list' : 'card');
    const [customFamilyOpen, setCustomFamilyOpen] = useState(false);
    const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
    const [searchOpen, setSearchOpen] = useState(!!searchTerm);

    // Sort State
    const [sortBy, setSortBy] = useState<string>('created_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Real-time Search State
    const [localSearch, setLocalSearch] = useState(searchTerm);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    // Initialize with default range: Start = 3 months ago, End = Today
    const [customRange, setCustomRange] = useState({
        start: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    // Debounce Search Effect
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== searchTerm) {
                updateFilter({ keyword: localSearch });
            }
        }, 500); // 500ms debounce
        return () => clearTimeout(timer);
    }, [localSearch]);

    // Save filters to store for detail page to use
    React.useEffect(() => {
        setInquiryFilters({
            time_scope: timeScope,
            product_family: productFamilyScope,
            status: statusFilter,
            keyword: searchTerm
        });
    }, [timeScope, productFamilyScope, statusFilter, searchTerm, setInquiryFilters]);

    // Restore scroll position on mount
    React.useEffect(() => {
        if (scrollContainerRef.current && savedScrollPosition > 0) {
            scrollContainerRef.current.scrollTop = savedScrollPosition;
        }
    }, []);

    // Save scroll position on scroll
    const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const scrollTop = e.currentTarget.scrollTop;
        saveScrollPosition(scrollTop);
    }, [saveScrollPosition]);

    // Build params for SWR hook
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
        if (searchTerm) params.keyword = searchTerm;
        if (statusFilter !== 'all') params.status = statusFilter;
        if (serviceTierFilter !== 'all') params.service_tier = serviceTierFilter;

        return params;
    }, [page, pageSize, timeScope, productFamilyScope, searchTerm, statusFilter, searchParams, sortBy, sortOrder]);

    const { tickets, meta, isLoading } = useCachedTickets<InquiryTicket>('inquiry', queryParams);
    const total = meta.total;

    const updateFilter = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        // Reset page to 1 when filter changes, unless page is explicitly set in newParams
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

    const handleFamilySelect = (val: string) => {
        if (val === 'custom') {
            setCustomFamilyOpen(true);
        } else {
            updateFilter({ product_family: val });
        }
    };

    const applyCustomFamilies = () => {
        updateFilter({ product_family: selectedFamilies.join(',') });
        setCustomFamilyOpen(false);
    };

    const toggleViewMode = (mode: 'list' | 'card') => {
        setViewMode(mode);
        // Save to store: 'list' = grouped, 'card' = flat
        saveViewMode(mode === 'list' ? 'grouped' : 'flat');
        updateFilter({ view: mode });
    };

    // Handle section toggle to persist collapsed state
    const handleSectionToggle = (sectionKey: string, isOpen: boolean) => {
        setInquirySectionCollapsed(sectionKey, !isOpen);
    };

    // Calculate groups for specific display logic
    const groupedTickets = useMemo(() => {
        const groups = {
            urgent: [] as InquiryTicket[],
            attention: [] as InquiryTicket[],
            active: [] as InquiryTicket[],
            done: [] as InquiryTicket[]
        };

        const now = new Date();

        tickets.forEach(ticket => {
            const isDone = ['Resolved', 'AutoClosed', 'Upgraded'].includes(ticket.status);
            if (isDone) {
                groups.done.push(ticket);
                return;
            }

            const hoursSinceUpdate = differenceInHours(now, new Date(ticket.updated_at));
            if (hoursSinceUpdate > 72) {
                groups.urgent.push(ticket);
            } else if (hoursSinceUpdate > 24) {
                groups.attention.push(ticket);
            } else {
                groups.active.push(ticket);
            }
        });

        return groups;
    }, [tickets]);

    const totalPages = Math.ceil(total / pageSize);

    const TicketCard = ({ ticket }: { ticket: InquiryTicket }) => {
        const statusLabel = t(`inquiry_ticket.status.${ticket.status.replace(/([A-Z])/g, '_$1').toLowerCase().slice(1)}` as any) || ticket.status;
        const family = ticket.product_family || (ticket.product ? 'Unknown' : null);

        return (
            <div
                onClick={() => navigate(`/service/inquiry-tickets/${ticket.id}`)}
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    padding: '18px',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    display: 'flex',
                    gap: '24px'
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
                    {/* Line 1: Ticket Number + Status + Family */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{ticket.ticket_number}</span>
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: `${statusColors[ticket.status] || '#6b7280'}20`,
                            color: statusColors[ticket.status] || '#6b7280'
                        }}>
                            {statusLabel}
                        </span>
                        {family && family !== 'Unknown' && (
                            <span style={{
                                fontSize: '0.70rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(234, 179, 8, 0.1)',
                                color: '#eab308',
                                fontWeight: 600,
                                textTransform: 'uppercase'
                            }}>
                                {family}
                            </span>
                        )}
                    </div>

                    {/* Line 2: Customer + Contact (with Dealer if applicable) + Service Tier */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '10px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {(() => {
                            // 如果有经销商：经销商名称 👤 客户名称 + 客户联系人
                            // 如果没有经销商：客户名称 + 客户联系人
                            const accountName = ticket.account?.name || ticket.customer_name || 'Anonymous';
                            const contactName = ticket.contact?.name || ticket.customer_contact;
                            const dealerName = ticket.dealer_name;
                            const serviceTier = ticket.account?.service_tier || 'Standard';
                            const isVIP = serviceTier === 'VIP';
                            const isVVIP = serviceTier === 'VVIP';

                            if (dealerName) {
                                // 有经销商：经销商名称 👤 客户名称 + 客户联系人
                                return (
                                    <>
                                        <span style={{ color: '#FFD700', fontWeight: 500 }}>{dealerName}</span>
                                        <span style={{ marginLeft: '8px', marginRight: '4px' }}></span>
                                        <Users size={14} style={{ color: 'var(--text-secondary)' }} />
                                        <span style={{ fontWeight: 500 }}>{accountName}</span>
                                        {contactName && contactName !== accountName && (
                                            <>
                                                <span>·</span>
                                                <span>{contactName}</span>
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
                                            background: isVVIP ? 'rgba(239, 68, 68, 0.2)' : isVIP ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.1)',
                                            color: isVVIP ? '#EF4444' : isVIP ? '#FFD700' : 'var(--text-tertiary)',
                                            border: isVVIP ? '1px solid rgba(239, 68, 68, 0.4)' : isVIP ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            {(isVIP || isVVIP) && '👑'}{serviceTier}
                                        </span>
                                    </>
                                );
                            } else {
                                // 无经销商：客户名称 + 客户联系人
                                return (
                                    <>
                                        <span style={{ fontWeight: 500 }}>{accountName}</span>
                                        {contactName && contactName !== accountName && (
                                            <>
                                                <span>·</span>
                                                <span>{contactName}</span>
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
                                            background: isVVIP ? 'rgba(239, 68, 68, 0.2)' : isVIP ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.1)',
                                            color: isVVIP ? '#EF4444' : isVIP ? '#FFD700' : 'var(--text-tertiary)',
                                            border: isVVIP ? '1px solid rgba(239, 68, 68, 0.4)' : isVIP ? '1px solid rgba(255, 215, 0, 0.4)' : '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            {(isVIP || isVVIP) && '👑'}{serviceTier}
                                        </span>
                                    </>
                                );
                            }
                        })()}
                    </div>

                    {/* Line 3: Service Type + Problem Summary */}
                    <p style={{
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        margin: 0
                    }}>
                        {ticket.service_type && (
                            <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>
                                [{ticket.service_type}]
                            </span>
                        )}
                        {ticket.problem_summary || '-'}
                    </p>
                </div>

                {/* Right Column - Product Info + Time */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', minWidth: '200px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: zhCN })}
                    </span>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '4px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)'
                    }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            📷 {ticket.product?.name || '-'}
                        </span>
                        <span>SN: {ticket.serial_number || '-'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🔧 {ticket.handler?.name || '-'}
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '24px', width: '100%', margin: '0', height: '100vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header - macOS26 Style */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}>
                        <MessageCircleQuestion size={28} color="#3B82F6" />
                        咨询工单
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.9rem' }}>
                        处理客户技术咨询、故障排查和使用问题
                    </p>
                </div>
                {/* Right: Search & New Ticket */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
                        {!searchOpen ? (
                            <button
                                onClick={() => { setSearchOpen(true); }}
                                style={{
                                    width: '40px', height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                title={t('action.search')}
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
                                        placeholder={t('action.search')}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            padding: '0 12px 0 32px',
                                            borderRadius: '8px',
                                            border: '1px solid #3B82F6',
                                            background: '#1C1C1E',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.85rem',
                                            outline: 'none',
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
                        onClick={() => openModal('Inquiry')}
                        className="btn"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '40px',
                            padding: '0 16px', fontSize: '0.85rem', whiteSpace: 'nowrap',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.5)',
                            color: '#3B82F6',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                            e.currentTarget.style.borderColor = '#3B82F6';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                        }}
                    >
                        <Plus size={16} />
                        {t('inquiry_ticket.title')}
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
                                        : t('filter.custom_range')
                                }
                            ]}
                        />
                    </div>

                    {/* Product Family Filter */}
                    <div style={{ minWidth: '180px' }}>
                        <KineSelect
                            value={productFamilyScope.includes(',') ? 'custom' : productFamilyScope}
                            onChange={(val) => handleFamilySelect(val)}
                            options={[
                                ...productFamilies.map(fam => ({ value: fam.id, label: fam.label })),
                                { value: 'custom', label: t('filter.custom_selection') + '...' }
                            ]}
                        />
                    </div>

                    {/* Advanced Filter Button - Moved here */}
                    <button
                        onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                        style={{
                            height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                            background: showAdvancedFilter ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                            color: showAdvancedFilter ? '#3B82F6' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                            transition: 'all 0.2s', fontSize: '0.85rem'
                        }}
                        title="Advanced Filter"
                    >
                        <Filter size={16} />
                        <span>筛选</span>
                    </button>
                </div>

                {/* Right: View Mode & Sort */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Sort Dropdown - macOS26 Finder Style */}
                    <SortDropdown
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onChange={(field, order) => {
                            setSortBy(field);
                            setSortOrder(order);
                        }}
                        options={[
                            { field: 'created_at', label: '创建时间' },
                            { field: 'updated_at', label: '更新时间' },
                            { field: 'ticket_number', label: '工单编号' },
                            { field: 'customer_name', label: '客户名称' },
                            { field: 'handler_name', label: '处理人' }
                        ]}
                    />

                    {/* View Mode */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', height: '40px' }}>
                        <button
                            onClick={() => toggleViewMode('list')}
                            title="Group View"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '6px', border: 'none',
                                background: viewMode === 'list' ? 'var(--glass-bg-hover)' : 'transparent',
                                color: viewMode === 'list' ? '#fff' : 'var(--text-tertiary)',
                                cursor: 'pointer'
                            }}
                        >
                            <Layers size={16} />
                        </button>
                        <button
                            onClick={() => toggleViewMode('card')}
                            title="List View"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '6px', border: 'none',
                                background: viewMode === 'card' ? 'var(--glass-bg-hover)' : 'transparent',
                                color: viewMode === 'card' ? '#fff' : 'var(--text-tertiary)',
                                cursor: 'pointer'
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
                    marginBottom: '16px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '24px',
                    animation: 'slideDown 0.2s ease-out'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>STATUS</span>
                        <KineSelect
                            value={statusFilter}
                            onChange={(val) => updateFilter({ status: val })}
                            options={[
                                { value: 'all', label: t('filter.all_status') },
                                { value: 'Pending', label: t('inquiry_ticket.status.pending' as any) || '待处理' },
                                { value: 'InProgress', label: t('inquiry_ticket.status.in_progress' as any) || '处理中' },
                                { value: 'AwaitingFeedback', label: t('inquiry_ticket.status.awaiting_feedback' as any) || '待客户反馈' },
                                { value: 'Resolved', label: t('inquiry_ticket.status.resolved' as any) || '已解决' },
                                { value: 'AutoClosed', label: t('inquiry_ticket.status.auto_closed' as any) || '自动关闭' },
                                { value: 'Upgraded', label: t('inquiry_ticket.status.upgraded' as any) || '已升级' }
                            ]}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{t('filter.service_tier')}</span>
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


            {/* Custom Family Modal */}
            {
                customFamilyOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.5)', zIndex: 9999,
                        display: 'flex', justifyContent: 'center', alignItems: 'center'
                    }}>
                        <div style={{
                            background: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
                            width: '400px', border: '1px solid var(--border-color)'
                        }}>
                            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Select Product Families</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '16px 0', maxHeight: '300px', overflowY: 'auto' }}>
                                {productFamilies.filter(f => f.id !== 'all').map(fam => (
                                    <label key={fam.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedFamilies.includes(fam.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedFamilies([...selectedFamilies, fam.id]);
                                                else setSelectedFamilies(selectedFamilies.filter(f => f !== fam.id));
                                            }}
                                            style={{ width: '16px', height: '16px' }}
                                        />
                                        {fam.label}
                                    </label>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button onClick={() => setCustomFamilyOpen(false)} className="btn btn-ghost">Cancel</button>
                                <button onClick={applyCustomFamilies} className="btn btn-primary">Apply</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Date Picker Modal */}
            {
                showDatePicker && (
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                        onClick={() => setShowDatePicker(false)}
                    >
                        <div
                            onClick={e => e.stopPropagation()}
                            className="glass-panel"
                            style={{
                                padding: '24px',
                                borderRadius: '16px',
                                width: '360px',
                                background: 'rgba(30, 30, 30, 0.75)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        >
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)', marginBottom: '24px', letterSpacing: '-0.01em' }}>
                                {t('filter.custom_range')}
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <CustomDatePicker
                                    label={t('common.start_date') || 'Start Date'}
                                    value={customRange.start}
                                    onChange={val => setCustomRange(prev => ({ ...prev, start: val }))}
                                />
                                <CustomDatePicker
                                    label={t('common.end_date') || 'End Date'}
                                    value={customRange.end}
                                    onChange={val => setCustomRange(prev => ({ ...prev, end: val }))}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
                                <button
                                    onClick={() => setShowDatePicker(false)}
                                    className="btn"
                                    style={{
                                        background: 'transparent',
                                        color: 'rgba(255, 255, 255, 0.6)',
                                        border: 'none',
                                        padding: '0 16px',
                                        height: '36px',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer',
                                        fontWeight: 500
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
                                >
                                    {t('action.cancel')}
                                </button>
                                <button
                                    onClick={applyCustomDate}
                                    disabled={!customRange.start || !customRange.end}
                                    className="btn btn-primary"
                                    style={{
                                        background: '#FFD700', // Kine Yellow
                                        color: '#000',
                                        border: 'none',
                                        padding: '0 20px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 10px rgba(255, 215, 0, 0.3)',
                                        opacity: (!customRange.start || !customRange.end) ? 0.5 : 1
                                    }}
                                >
                                    {t('action.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* List Content */}
            <div ref={scrollContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto' }}>
                {isLoading && tickets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px' }}>
                        <Loader2 size={32} className="animate-spin text-primary" style={{ margin: '0 auto' }} />
                    </div>
                ) : tickets.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                        <MessageSquare size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                        <p>{t('inquiry_ticket.empty_hint')}</p>
                    </div>
                ) : viewMode === 'card' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {tickets.map(ticket => (
                            <TicketCard key={ticket.id} ticket={ticket} />
                        ))}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                        {/* Urgent Section */}
                        {groupedTickets.urgent.length > 0 && (
                            <CollapsibleSection
                                title={t('dashboard.urgent_attention')}
                                count={groupedTickets.urgent.length}
                                icon={AlertTriangle}
                                color="#EF4444"
                                sectionKey="urgent"
                                defaultOpen={true}
                                initialOpen={!isInquirySectionCollapsed('urgent', true)}
                                onToggle={handleSectionToggle}
                            >
                                {groupedTickets.urgent.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </CollapsibleSection>
                        )}
                        {/* Attention Section */}
                        {groupedTickets.attention.length > 0 && (
                            <CollapsibleSection
                                title="Needs Follow-up"
                                count={groupedTickets.attention.length}
                                icon={AlertCircle}
                                color="#FFD700"
                                sectionKey="attention"
                                defaultOpen={true}
                                initialOpen={!isInquirySectionCollapsed('attention', true)}
                                onToggle={handleSectionToggle}
                            >
                                {groupedTickets.attention.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </CollapsibleSection>
                        )}
                        {/* Active Section */}
                        {groupedTickets.active.length > 0 && (
                            <CollapsibleSection
                                title={t('dashboard.active_tickets')}
                                count={groupedTickets.active.length}
                                icon={Clock}
                                color="var(--primary)"
                                sectionKey="active"
                                defaultOpen={true}
                                initialOpen={!isInquirySectionCollapsed('active', true)}
                                onToggle={handleSectionToggle}
                            >
                                {groupedTickets.active.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </CollapsibleSection>
                        )}
                        {/* Done Section */}
                        {groupedTickets.done.length > 0 && (
                            <CollapsibleSection
                                title={t('inquiry_ticket.status.resolved')}
                                count={groupedTickets.done.length}
                                icon={CheckCircle}
                                color="#4CAF50"
                                sectionKey="done"
                                defaultOpen={false}
                                initialOpen={!isInquirySectionCollapsed('done', false)}
                                onToggle={handleSectionToggle}
                            >
                                {groupedTickets.done.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </CollapsibleSection>
                        )}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {
                totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px', paddingBottom: '24px' }}>
                        <button
                            onClick={() => handlePageChange(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="btn btn-secondary btn-sm"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span style={{ fontSize: '0.875rem' }}>
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                            disabled={page === totalPages}
                            className="btn btn-secondary btn-sm"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )
            }
        </div >
    );
};

export default InquiryTicketListPage;
