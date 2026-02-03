import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Package } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface RMATicket {
    id: number;
    ticket_number: string;
    channel_code: string;
    issue_type: string;
    issue_category: string;
    severity: number;
    product: { id: number; name: string } | null;
    serial_number: string;
    problem_description: string;
    reporter_name: string;
    status: string;
    assigned_to: { id: number; name: string } | null;
    created_at: string;
    updated_at: string;
}

const statusColors: Record<string, string> = {
    Pending: '#f59e0b',
    Assigned: '#3b82f6',
    InRepair: '#8b5cf6',
    Repaired: '#10b981',
    Shipped: '#06b6d4',
    Completed: '#22c55e',
    Cancelled: '#6b7280'
};

const severityColors: Record<number, string> = {
    1: '#ef4444',
    2: '#f59e0b',
    3: '#6b7280'
};

const RMATicketListPage: React.FC = () => {
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [tickets, setTickets] = useState<RMATicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);

    // Filters
    const [statusFilter, setStatusFilter] = useState('all');
    const [channelFilter, setChannelFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('page_size', pageSize.toString());
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (channelFilter !== 'all') params.append('channel_code', channelFilter);
            if (searchTerm) params.append('keyword', searchTerm);

            const res = await axios.get(`/api/v1/rma-tickets?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setTickets(res.data.data);
                setTotal(res.data.meta.total);
            }
        } catch (err) {
            console.error('Failed to fetch RMA tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [page, statusFilter, channelFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchTickets();
    };

    const totalPages = Math.ceil(total / pageSize);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            Pending: t('rma_ticket.status.pending'),
            Assigned: t('rma_ticket.status.assigned'),
            InRepair: t('rma_ticket.status.in_repair'),
            Repaired: t('rma_ticket.status.repaired'),
            Shipped: t('rma_ticket.status.shipped'),
            Completed: t('rma_ticket.status.completed'),
            Cancelled: t('rma_ticket.status.cancelled')
        };
        return labels[status] || status;
    };

    const getChannelLabel = (code: string) => {
        const labels: Record<string, string> = {
            D: t('rma_ticket.channel.dealer'),
            C: t('rma_ticket.channel.customer'),
            I: t('rma_ticket.channel.internal')
        };
        return labels[code] || code;
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '4px' }}>{t('rma_ticket.title')}</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {t('rma_ticket.total_count', { count: total })}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/service/rma-tickets/new')}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={18} />
                    {t('rma_ticket.create')}
                </button>
            </div>

            {/* Search & Filters */}
            <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <form onSubmit={handleSearch} style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('rma_ticket.search_placeholder')}
                                className="form-control"
                                style={{ paddingLeft: '40px' }}
                            />
                        </div>
                        <button type="submit" className="btn btn-secondary">{t('action.search')}</button>
                    </form>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Filter size={16} />
                        {t('action.filter')}
                    </button>
                </div>

                {/* Quick Filters */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginTop: '12px' }}>
                    <button
                        onClick={() => { setStatusFilter('Pending'); setChannelFilter('all'); setSearchTerm(''); setPage(1); }}
                        className={`btn btn-sm ${statusFilter === 'Pending' ? 'btn-primary' : 'btn-ghost'}`}
                    >
                        {t('rma_ticket.status.pending')}
                    </button>
                    <button
                        onClick={() => { setStatusFilter('InRepair'); setChannelFilter('all'); setSearchTerm(''); setPage(1); }}
                        className={`btn btn-sm ${statusFilter === 'InRepair' ? 'btn-primary' : 'btn-ghost'}`}
                    >
                        {t('rma_ticket.status.in_repair')}
                    </button>
                </div>

                {showFilters && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="form-control"
                            style={{ width: 'auto' }}
                        >
                            <option value="all">{t('filter.all_status')}</option>
                            <option value="Pending">{t('rma_ticket.status.pending')}</option>
                            <option value="Assigned">{t('rma_ticket.status.assigned')}</option>
                            <option value="InRepair">{t('rma_ticket.status.in_repair')}</option>
                            <option value="Repaired">{t('rma_ticket.status.repaired')}</option>
                            <option value="Shipped">{t('rma_ticket.status.shipped')}</option>
                            <option value="Completed">{t('rma_ticket.status.completed')}</option>
                        </select>
                        <select
                            value={channelFilter}
                            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
                            className="form-control"
                            style={{ width: 'auto' }}
                        >
                            <option value="all">{t('filter.all_channels')}</option>
                            <option value="D">{t('rma_ticket.channel.dealer')}</option>
                            <option value="C">{t('rma_ticket.channel.customer')}</option>
                            <option value="I">{t('rma_ticket.channel.internal')}</option>
                        </select>
                    </div>
                )}
            </div>

            {/* Ticket List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <p>{t('common.loading')}</p>
                </div>
            ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p>{t('rma_ticket.empty_hint')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {tickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            onClick={() => navigate(`/service/rma-tickets/${ticket.id}`)}
                            style={{
                                background: 'var(--bg-card)',
                                borderRadius: '12px',
                                padding: '16px',
                                border: '1px solid var(--border-color)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{ticket.ticket_number}</span>
                                        <span style={{
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: '#e5e7eb',
                                            color: '#374151'
                                        }}>
                                            {getChannelLabel(ticket.channel_code)}
                                        </span>
                                        {ticket.severity && (
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '2px',
                                                padding: '2px 6px',
                                                borderRadius: '4px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                background: `${severityColors[ticket.severity]}20`,
                                                color: severityColors[ticket.severity]
                                            }}>
                                                <AlertTriangle size={10} />
                                                P{ticket.severity}
                                            </span>
                                        )}
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                background: `${statusColors[ticket.status] || '#6b7280'}20`,
                                                color: statusColors[ticket.status] || '#6b7280'
                                            }}
                                        >
                                            {getStatusLabel(ticket.status)}
                                        </span>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        {ticket.reporter_name || '匿名'} · {ticket.issue_category || ticket.issue_type}
                                    </p>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {formatDate(ticket.created_at)}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                {ticket.problem_description}
                            </p>
                            {(ticket.product || ticket.assigned_to) && (
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {ticket.product && <span>📷 {ticket.product.name}</span>}
                                    {ticket.serial_number && <span>SN: {ticket.serial_number}</span>}
                                    {ticket.assigned_to && <span>🔧 {ticket.assigned_to.name}</span>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '24px' }}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="btn btn-secondary btn-sm"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: '0.875rem' }}>
                        {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="btn btn-secondary btn-sm"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default RMATicketListPage;
