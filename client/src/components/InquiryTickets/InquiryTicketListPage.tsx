import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Phone, Mail, MessageSquare, Clock, CheckCircle, ArrowUpCircle, Loader2, XCircle } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface InquiryTicket {
    id: number;
    ticket_number: string;
    service_type: string;
    channel: string;
    customer_name: string;
    problem_summary: string;
    status: string;
    handler: { id: number; name: string } | null;
    product: { id: number; name: string } | null;
    serial_number: string;
    created_at: string;
    updated_at: string;
}

const statusColors: Record<string, string> = {
    InProgress: '#3b82f6',
    AwaitingFeedback: '#8b5cf6',
    Resolved: '#10b981',
    AutoClosed: '#6b7280',
    Upgraded: '#06b6d4'
};

const channelIcons: Record<string, React.ReactNode> = {
    Phone: <Phone size={14} />,
    Email: <Mail size={14} />,
    WeChat: <MessageSquare size={14} />,
    WeCom: <MessageSquare size={14} />,
    Facebook: <MessageSquare size={14} />,
    Online: <MessageSquare size={14} />
};

const InquiryTicketListPage: React.FC = () => {
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [tickets, setTickets] = useState<InquiryTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);

    // Load saved filters from localStorage, default to 'all' for guaranteed display
    const FILTER_KEY = 'inquiry_ticket_filters';
    const savedFilters = localStorage.getItem(FILTER_KEY);
    const defaultFilters = savedFilters ? JSON.parse(savedFilters) : { status: 'all', serviceType: 'all' };

    // Filters with smart defaults
    const [statusFilter, setStatusFilter] = useState(defaultFilters.status);
    const [serviceTypeFilter, setServiceTypeFilter] = useState(defaultFilters.serviceType);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Persist filter changes to localStorage
    useEffect(() => {
        localStorage.setItem(FILTER_KEY, JSON.stringify({ status: statusFilter, serviceType: serviceTypeFilter }));
    }, [statusFilter, serviceTypeFilter]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('page_size', pageSize.toString());
            if (statusFilter !== 'all') params.append('status', statusFilter);
            if (serviceTypeFilter !== 'all') params.append('service_type', serviceTypeFilter);
            if (searchTerm) params.append('keyword', searchTerm);

            const res = await axios.get(`/api/v1/inquiry-tickets?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setTickets(res.data.data);
                setTotal(res.data.meta.total);
            }
        } catch (err) {
            console.error('Failed to fetch inquiry tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [page, statusFilter, serviceTypeFilter]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchTickets();
    };

    const totalPages = Math.ceil(total / pageSize);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'InProgress': return <Loader2 size={14} />;
            case 'AwaitingFeedback': return <Clock size={14} />;
            case 'Resolved': return <CheckCircle size={14} />;
            case 'AutoClosed': return <XCircle size={14} />;
            case 'Upgraded': return <ArrowUpCircle size={14} />;
            default: return <Clock size={14} />;
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            InProgress: t('inquiry_ticket.status.in_progress'),
            AwaitingFeedback: t('inquiry_ticket.status.awaiting_feedback'),
            Resolved: t('inquiry_ticket.status.resolved'),
            AutoClosed: t('inquiry_ticket.status.auto_closed'),
            Upgraded: t('inquiry_ticket.status.upgraded')
        };
        return labels[status] || status;
    };

    const getServiceTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            Consultation: t('inquiry_ticket.type.consultation'),
            Troubleshooting: t('inquiry_ticket.type.troubleshooting'),
            RemoteAssist: t('inquiry_ticket.type.remote_assist'),
            Complaint: t('inquiry_ticket.type.complaint')
        };
        return labels[type] || type;
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header with Create Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '4px' }}>{t('inquiry_ticket.title')}</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {t('inquiry_ticket.total_count', { count: total })}
                    </p>
                </div>
                <button
                    onClick={() => navigate('/service/inquiry-tickets/new')}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Plus size={18} />
                    {t('inquiry_ticket.create')}
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
                                placeholder={t('inquiry_ticket.search_placeholder')}
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
                        onClick={() => { setStatusFilter('InProgress'); setServiceTypeFilter('all'); setSearchTerm(''); setPage(1); }}
                        className={`btn btn-sm ${statusFilter === 'InProgress' ? 'btn-primary' : 'btn-ghost'}`}
                    >
                        {t('inquiry_ticket.status.in_progress')}
                    </button>
                    <button
                        onClick={() => { setStatusFilter('AwaitingFeedback'); setServiceTypeFilter('all'); setSearchTerm(''); setPage(1); }}
                        className={`btn btn-sm ${statusFilter === 'AwaitingFeedback' ? 'btn-primary' : 'btn-ghost'}`}
                    >
                        {t('inquiry_ticket.status.awaiting_feedback')}
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
                            <option value="InProgress">{t('inquiry_ticket.status.in_progress')}</option>
                            <option value="AwaitingFeedback">{t('inquiry_ticket.status.awaiting_feedback')}</option>
                            <option value="Resolved">{t('inquiry_ticket.status.resolved')}</option>
                            <option value="AutoClosed">{t('inquiry_ticket.status.auto_closed')}</option>
                            <option value="Upgraded">{t('inquiry_ticket.status.upgraded')}</option>
                        </select>
                        <select
                            value={serviceTypeFilter}
                            onChange={(e) => { setServiceTypeFilter(e.target.value); setPage(1); }}
                            className="form-control"
                            style={{ width: 'auto' }}
                        >
                            <option value="all">{t('filter.all_types')}</option>
                            <option value="Consultation">{t('inquiry_ticket.type.consultation')}</option>
                            <option value="Troubleshooting">{t('inquiry_ticket.type.troubleshooting')}</option>
                            <option value="RemoteAssist">{t('inquiry_ticket.type.remote_assist')}</option>
                            <option value="Complaint">{t('inquiry_ticket.type.complaint')}</option>
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
                    <MessageSquare size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p>{t('inquiry_ticket.empty_hint')}</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {tickets.map((ticket) => (
                        <div
                            key={ticket.id}
                            onClick={() => navigate(`/service/inquiry-tickets/${ticket.id}`)}
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
                                        {ticket.channel && channelIcons[ticket.channel]}
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
                                            {getStatusIcon(ticket.status)}
                                            {getStatusLabel(ticket.status)}
                                        </span>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        {ticket.customer_name || '匿名客户'} · {getServiceTypeLabel(ticket.service_type)}
                                    </p>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {formatDate(ticket.created_at)}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                {ticket.problem_summary}
                            </p>
                            {(ticket.product || ticket.handler) && (
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    {ticket.product && <span>📷 {ticket.product.name}</span>}
                                    {ticket.serial_number && <span>SN: {ticket.serial_number}</span>}
                                    {ticket.handler && <span>👤 {ticket.handler.name}</span>}
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

export default InquiryTicketListPage;
