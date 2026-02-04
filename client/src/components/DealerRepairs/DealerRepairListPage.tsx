import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Loader2, Wrench, List, Layers } from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';
import { useTicketStore } from '../../store/useTicketStore';
import { useCachedTickets } from '../../hooks/useCachedTickets';
import { KineSelect } from '../UI/KineSelect';
import { CustomDatePicker } from '../UI/CustomDatePicker';
import { format, subDays, subMonths, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DealerRepair {
    id: number;
    ticket_number: string;
    repair_type: string;
    product: { id: number; name: string } | null;
    serial_number: string;
    customer_name: string;
    problem_description: string;
    status: string;
    technician: { id: number; name: string } | null;
    created_at: string;
    updated_at: string;
}

const statusColors: Record<string, string> = {
    Received: '#f59e0b',
    Diagnosing: '#3b82f6',
    AwaitingParts: '#8b5cf6',
    InRepair: '#06b6d4',
    Completed: '#22c55e',
    Returned: '#10b981',
    Cancelled: '#6b7280'
};

const DealerRepairListPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const openModal = useTicketStore(state => state.openModal);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);

    // Filters
    const timeScope = searchParams.get('time_scope') || '7d';
    const productFamilyScope = searchParams.get('product_family') || 'all';
    const statusFilter = searchParams.get('status') || 'all';
    const searchTerm = searchParams.get('keyword') || '';
    const viewModeParam = searchParams.get('view') || 'list';

    // Local States
    const [viewMode, setViewMode] = useState<'list' | 'card'>(viewModeParam as 'list' | 'card');
    const [searchOpen, setSearchOpen] = useState(false);
    const [localSearch, setLocalSearch] = useState(searchTerm);
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [customRange, setCustomRange] = useState({
        start: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localSearch !== searchTerm) {
                updateFilter({ keyword: localSearch });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [localSearch]);

    // Build params
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
        if (statusFilter !== 'all') params.status = statusFilter;
        if (searchTerm) params.keyword = searchTerm;

        return params;
    }, [page, pageSize, timeScope, productFamilyScope, statusFilter, searchTerm, searchParams]);

    const { tickets: repairs, meta, isLoading } = useCachedTickets<DealerRepair>('dealer', queryParams);
    const total = meta.total;
    const totalPages = Math.ceil(total / pageSize);

    const updateFilter = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        setSearchParams({ ...current, ...newParams });
        setPage(1);
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

    const toggleViewMode = (mode: 'list' | 'card') => {
        setViewMode(mode);
        updateFilter({ view: mode });
    };

    const productFamilies = [
        { id: 'all', label: t('filter.all_products') },
        { id: 'Current Cine Cameras', label: 'Current Cine Cameras' },
        { id: 'Archived Cine Cameras', label: 'Archived Cine Cameras' },
        { id: 'Eagle e-Viewfinder', label: 'Eagle e-Viewfinder' },
        { id: 'Universal Accessories', label: 'Universal Accessories' }
    ];

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            Received: t('dealer_repair.status.received'),
            Diagnosing: t('dealer_repair.status.diagnosing'),
            AwaitingParts: t('dealer_repair.status.awaiting_parts'),
            InRepair: t('dealer_repair.status.in_repair'),
            Completed: t('dealer_repair.status.completed'),
            Returned: t('dealer_repair.status.returned'),
            Cancelled: t('dealer_repair.status.cancelled')
        };
        return labels[status] || status;
    };

    const getRepairTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            InWarranty: t('dealer_repair.type.in_warranty'),
            OutOfWarranty: t('dealer_repair.type.out_of_warranty'),
            Upgrade: t('dealer_repair.type.upgrade'),
            Maintenance: t('dealer_repair.type.maintenance')
        };
        return labels[type] || type;
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
                                        : '自定义日期' // Fallback
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
                </div>

                {/* Right: Search & Actions */}
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* View Mode */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '2px', height: '40px' }}>
                        <button
                            onClick={() => toggleViewMode('list')}
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

                    {/* Expanding Search */}
                    <div style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
                        {!searchOpen ? (
                            <button
                                onClick={() => setSearchOpen(true)}
                                style={{
                                    width: '40px', height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
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
                                        placeholder={t('dealer_repair.search_placeholder')}
                                        style={{
                                            width: '100%', height: '100%', padding: '0 12px 0 32px',
                                            borderRadius: '8px', border: '1px solid #FFD700', background: '#1C1C1E',
                                            color: 'var(--text-primary)', fontSize: '0.85rem', outline: 'none',
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
                                >
                                    <Filter size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => openModal('DealerRepair')}
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
                        {t('dealer_repair.title')}
                    </button>
                </div>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvancedFilter && (
                <div style={{
                    marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                    display: 'flex', alignItems: 'center', gap: '24px', animation: 'slideDown 0.2s ease-out'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '200px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>STATUS</span>
                        <KineSelect
                            value={statusFilter}
                            onChange={(val) => updateFilter({ status: val })}
                            options={[
                                { value: 'all', label: t('filter.all_status') },
                                { value: 'Received', label: t('dealer_repair.status.received') },
                                { value: 'Diagnosing', label: t('dealer_repair.status.diagnosing') },
                                { value: 'AwaitingParts', label: t('dealer_repair.status.awaiting_parts') },
                                { value: 'InRepair', label: t('dealer_repair.status.in_repair') },
                                { value: 'Completed', label: t('dealer_repair.status.completed') },
                                { value: 'Returned', label: t('dealer_repair.status.returned') },
                                { value: 'Cancelled', label: t('dealer_repair.status.cancelled') }
                            ]}
                        />
                    </div>
                </div>
            )}

            {/* Repair List */}
            {isLoading && repairs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <p>{t('common.loading')}</p>
                </div>
            ) : repairs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    <Wrench size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p>{t('dealer_repair.empty_hint')}</p>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {repairs.map((repair) => (
                        <div
                            key={repair.id}
                            onClick={() => navigate(`/service/dealer-repairs/${repair.id}`)}
                            style={{
                                background: 'var(--bg-card)', borderRadius: '12px', padding: '16px',
                                border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.2s',
                                position: 'relative'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{repair.ticket_number}</span>
                                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, background: '#dbeafe', color: '#1d4ed8' }}>
                                            {getRepairTypeLabel(repair.repair_type)}
                                        </span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 500, background: `${statusColors[repair.status] || '#6b7280'}20`, color: statusColors[repair.status] || '#6b7280' }}>
                                            {getStatusLabel(repair.status)}
                                        </span>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        {repair.customer_name || '客户'}
                                    </p>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {formatDistanceToNow(new Date(repair.created_at), { addSuffix: true, locale: zhCN })}
                                </span>
                            </div>

                            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                {repair.problem_description}
                            </p>

                            {(repair.product || repair.technician) && (
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {repair.product && <span>📷 {repair.product.name}</span>}
                                    {repair.serial_number && <span>SN: {repair.serial_number}</span>}
                                    {repair.technician && <span>🔧 {repair.technician.name}</span>}
                                </div>
                            )}
                        </div>
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
                        width: '400px', background: '#1C1C1E', borderRadius: '16px', padding: '24px',
                        border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>
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
                            <button onClick={() => setShowDatePicker(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                                {t('action.cancel')}
                            </button>
                            <button onClick={applyCustomDate} style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', background: '#FFD700', color: '#000', fontWeight: 600, cursor: 'pointer' }}>
                                {t('action.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '24px', paddingBottom: '24px' }}>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-sm"><ChevronLeft size={16} /></button>
                    <span style={{ fontSize: '0.875rem' }}>{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary btn-sm"><ChevronRight size={16} /></button>
                </div>
            )}
        </div>
    );
};

export default DealerRepairListPage;
