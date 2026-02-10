import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, MessageSquare, Clock, CheckCircle, Loader2, AlertCircle, AlertTriangle, List, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { KineSelect } from '../UI/KineSelect';
import { CustomDatePicker } from '../UI/CustomDatePicker';
import { formatDistanceToNow, differenceInHours, subDays, format, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useLanguage } from '../../i18n/useLanguage';
import { useTicketStore } from '../../store/useTicketStore';
import { useCachedTickets } from '../../hooks/useCachedTickets';

interface InquiryTicket {
    id: number;
    ticket_number: string;
    service_type: string;
    channel: string;
    customer_name: string;
    dealer_name?: string;
    problem_summary: string;
    status: string;
    handler: { id: number; name: string } | null;
    product: { id: number; name: string } | null;
    serial_number: string;
    created_at: string;
    updated_at: string;
    product_family?: string;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    InProgress: { bg: 'rgba(59, 130, 246, 0.1)', text: '#60a5fa', border: 'transparent' },
    AwaitingFeedback: { bg: 'rgba(192, 132, 252, 0.1)', text: '#c084fc', border: 'transparent' },
    Resolved: { bg: 'rgba(52, 211, 153, 0.1)', text: '#34d399', border: 'transparent' },
    AutoClosed: { bg: 'rgba(156, 163, 175, 0.1)', text: '#9ca3af', border: 'transparent' },
    Upgraded: { bg: 'rgba(34, 211, 238, 0.1)', text: '#22d3ee', border: 'transparent' }
};

const CollapsibleSection: React.FC<{
    title: string;
    count: number;
    icon: React.ElementType;
    color: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}> = ({ title, count, icon: Icon, color, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <section style={{ marginBottom: '16px' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
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

    const [pageSize] = useState(50);

    // Scope Filters
    const timeScope = searchParams.get('time_scope') || '7d';
    const productFamilyScope = searchParams.get('product_family') || 'all';
    const searchTerm = searchParams.get('keyword') || '';
    const statusFilter = searchParams.get('status') || 'all';
    const viewModeParam = searchParams.get('view') || 'list';
    const pageParam = searchParams.get('page');
    const page = pageParam ? parseInt(pageParam) : 1;

    // Local States
    const [viewMode, setViewMode] = useState<'list' | 'card'>(viewModeParam as 'list' | 'card'); // 'list' is Grouped, 'card' is Flat List
    const [customFamilyOpen, setCustomFamilyOpen] = useState(false);
    const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);

    // Real-time Search State
    const [localSearch, setLocalSearch] = useState(searchTerm);
    const [searchOpen, setSearchOpen] = useState(false);
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

    // Build params for SWR hook
    const queryParams = useMemo(() => {
        const params: Record<string, string | number | undefined> = {
            page,
            page_size: pageSize
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

        return params;
    }, [page, pageSize, timeScope, productFamilyScope, searchTerm, statusFilter, searchParams]);

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

    const productFamilies = [
        { id: 'all', label: t('filter.all_products') },
        { id: 'Current Cine Cameras', label: 'Current Cine Cameras' },
        { id: 'Archived Cine Cameras', label: 'Archived Cine Cameras' },
        { id: 'Eagle e-Viewfinder', label: 'Eagle e-Viewfinder' },
        { id: 'Universal Accessories', label: 'Universal Accessories' }
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
        updateFilter({ view: mode });
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
        const channelLabel = ticket.channel === 'Dealer' ? t('rma_ticket.channel.dealer') :
            ticket.channel === 'Internal' ? t('rma_ticket.channel.internal') :
                t('rma_ticket.channel.customer');
        const family = ticket.product_family || (ticket.product ? 'Unknown' : null);

        return (
            <div
                onClick={() => navigate(`/service/inquiry-tickets/${ticket.id}`)}
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    padding: '16px',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 600, fontSize: '1rem' }}>{ticket.ticket_number}</span>
                            <span style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                background: '#e5e7eb',
                                color: '#374151'
                            }}>
                                {channelLabel}
                            </span>

                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    background: statusColors[ticket.status]?.bg || 'rgba(59, 130, 246, 0.1)',
                                    color: statusColors[ticket.status]?.text || 'var(--text-secondary)'
                                }}
                            >
                                {statusLabel}
                            </span>
                            {/* Product Family Badge */}
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
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {ticket.customer_name || 'Anonymous'} · {ticket.service_type}
                        </p>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: zhCN })}
                    </span>
                </div>

                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {ticket.problem_summary}
                </p>

                {(ticket.product || ticket.serial_number || ticket.handler) && (
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {ticket.product && <span>📷 {ticket.product.name}</span>}
                        {ticket.serial_number && <span>SN: {ticket.serial_number}</span>}
                        {ticket.handler && <span>🔧 {ticket.handler.name}</span>}
                        {ticket.dealer_name && <span style={{ color: 'var(--primary)' }}>🏢 {ticket.dealer_name}</span>}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>

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
                </div>

                {/* Right: Search & Actions */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* View Mode */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', height: '40px' }}>
                        {/* Grouped View (formerly List) */}
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
                        {/* Flat Card View */}
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
                                <Search size={16} />
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px', animation: 'fadeIn 0.2s ease-out' }}>
                                <div style={{ position: 'relative', width: '240px', height: '40px' }}>
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
                                            border: '1px solid #FFD700',
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
                                <button
                                    onClick={() => updateFilter({ keyword: localSearch })}
                                    style={{
                                        height: '40px', padding: '0 16px', borderRadius: '8px', border: 'none',
                                        background: '#FFD700', color: '#000', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer'
                                    }}
                                >
                                    {t('action.confirm')}
                                </button>
                                <button
                                    onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                                    style={{
                                        width: '40px', height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                                        background: showAdvancedFilter ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)',
                                        color: showAdvancedFilter ? '#FFD700' : 'var(--text-secondary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Advanced Filter"
                                >
                                    <Filter size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => openModal('Inquiry')}
                        className="btn"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '40px',
                            padding: '0 16px', fontSize: '0.85rem', whiteSpace: 'nowrap',
                            background: 'rgba(255, 215, 0, 0.1)',
                            border: '1px solid rgba(255, 215, 0, 0.5)',
                            color: '#FFD700',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 215, 0, 0.2)';
                            e.currentTarget.style.borderColor = '#FFD700';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)';
                        }}
                    >
                        <Plus size={16} />
                        {t('inquiry_ticket.title')}
                    </button>
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
                                { value: 'all', label: 'All Statuses' },
                                { value: 'New', label: 'New' },
                                { value: 'Open', label: 'Open' },
                                { value: 'Pending', label: 'Pending' },
                                { value: 'Resolved', label: 'Resolved' },
                                { value: 'Closed', label: 'Closed' }
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
            <div style={{ flex: 1, overflowY: 'auto' }}>
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
                            <CollapsibleSection title={t('dashboard.urgent_attention')} count={groupedTickets.urgent.length} icon={AlertTriangle} color="#ef4444">
                                {groupedTickets.urgent.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </CollapsibleSection>
                        )}
                        {/* Attention Section */}
                        {groupedTickets.attention.length > 0 && (
                            <CollapsibleSection title="Needs Follow-up" count={groupedTickets.attention.length} icon={AlertCircle} color="#f59e0b">
                                {groupedTickets.attention.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </CollapsibleSection>
                        )}
                        {/* Active Section */}
                        {groupedTickets.active.length > 0 && (
                            <CollapsibleSection title={t('dashboard.active_tickets')} count={groupedTickets.active.length} icon={Clock} color="var(--primary)">
                                {groupedTickets.active.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </CollapsibleSection>
                        )}
                        {/* Done Section */}
                        {groupedTickets.done.length > 0 && (
                            <CollapsibleSection title={t('inquiry_ticket.status.resolved')} count={groupedTickets.done.length} icon={CheckCircle} color="var(--text-tertiary)" defaultOpen={false}>
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
