import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, ChevronLeft, ChevronRight, Phone, Mail, MessageSquare, Clock, CheckCircle, ArrowUpCircle, Loader2, XCircle, AlertCircle, AlertTriangle, Calendar, Package } from 'lucide-react';
import axios from 'axios';
import { formatDistanceToNow, differenceInHours, subDays, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useTicketStore } from '../../store/useTicketStore';

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
}

interface Product {
    id: number;
    name: string;
    type: string;
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
    const [searchParams, setSearchParams] = useSearchParams();
    const openModal = useTicketStore(state => state.openModal);

    const [tickets, setTickets] = useState<InquiryTicket[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(50);

    // Scope Filters
    const [timeScope, setTimeScope] = useState(searchParams.get('time_scope') || '7d');
    const [productScope, setProductScope] = useState(searchParams.get('product_scope') || 'all');
    const [searchTerm, setSearchTerm] = useState(searchParams.get('keyword') || '');

    // Derived Filters
    const statusFilter = searchParams.get('status') || 'all'; // Keep url param support but generic

    useEffect(() => {
        // Sync URL to State if URL changes externally
        setTimeScope(searchParams.get('time_scope') || '7d');
        setProductScope(searchParams.get('product_scope') || 'all');
        setSearchTerm(searchParams.get('keyword') || '');
    }, [searchParams]);

    // Fetch Products
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await axios.get('/api/v1/products', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setProducts(res.data.data);
                }
            } catch (err) {
                console.error('Failed to fetch products', err);
            }
        };
        fetchProducts();
    }, [token]);

    const updateFilter = (newParams: Record<string, string>) => {
        const current = Object.fromEntries(searchParams.entries());
        setSearchParams({ ...current, ...newParams });
        setPage(1);
    };

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('page_size', pageSize.toString());



            // Apply Scope Logic
            let createdFrom;
            if (timeScope === '7d') createdFrom = format(subDays(new Date(), 7), 'yyyy-MM-dd');
            else if (timeScope === '30d') createdFrom = format(subDays(new Date(), 30), 'yyyy-MM-dd');

            if (createdFrom) params.append('created_from', createdFrom);

            if (productScope !== 'all') params.append('product_id', productScope);
            if (searchTerm) params.append('keyword', searchTerm);
            if (statusFilter !== 'all') params.append('status', statusFilter);

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
    }, [page, timeScope, productScope, searchTerm, statusFilter]);

    // Smart Grouping Logic ("Pulse")
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

            if (hoursSinceUpdate > 72) { // 3 days
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

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'InProgress': return <Loader2 size={14} className="animate-spin-slow" />;
            case 'AwaitingFeedback': return <Clock size={14} />;
            case 'Resolved': return <CheckCircle size={14} />;
            case 'AutoClosed': return <XCircle size={14} />;
            case 'Upgraded': return <ArrowUpCircle size={14} />;
            default: return <Clock size={14} />;
        }
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

    const TicketCard = ({ ticket }: { ticket: InquiryTicket }) => {
        const isUrgent = !['Resolved', 'AutoClosed', 'Upgraded'].includes(ticket.status) && differenceInHours(new Date(), new Date(ticket.updated_at)) > 72;

        return (
            <div
                onClick={() => navigate(`/service/inquiry-tickets/${ticket.id}`)}
                className="group"
                style={{
                    background: 'var(--bg-card)',
                    borderRadius: '8px',
                    padding: '16px 20px',
                    borderLeft: isUrgent ? '4px solid #ef4444' : '4px solid transparent',
                    borderTop: '1px solid var(--border-color)',
                    borderRight: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {/* Main Content */}
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '20px' }}>
                        {/* Title Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <h3 style={{
                                fontSize: '1rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}>
                                {ticket.problem_summary}
                            </h3>
                            {ticket.product && (
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {ticket.product.name}
                                </span>
                            )}
                        </div>

                        {/* Subtitle Row: Dealer · Customer */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            {ticket.dealer_name && (
                                <span style={{ color: 'var(--primary)', fontWeight: 500 }}>
                                    {ticket.dealer_name}
                                </span>
                            )}
                            {ticket.dealer_name && <span>·</span>}
                            <span>{ticket.customer_name || '匿名客户'}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-tertiary)' }}>
                                {ticket.channel && channelIcons[ticket.channel]}
                                #{ticket.ticket_number}
                            </span>
                            {ticket.handler && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
                                    Op: {ticket.handler.name}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Right Info: Status & Pulse Time */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                            <span
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    background: `${statusColors[ticket.status] || '#6b7280'}15`,
                                    color: statusColors[ticket.status] || '#6b7280'
                                }}
                            >
                                {getStatusIcon(ticket.status)}
                                {getStatusLabel(ticket.status)}
                            </span>

                            <span style={{
                                fontSize: '0.75rem',
                                color: isUrgent ? '#ef4444' : 'var(--text-tertiary)',
                                fontWeight: isUrgent ? 600 : 400,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                {isUrgent && <AlertCircle size={12} />}
                                {formatDistanceToNow(new Date(ticket.updated_at), { addSuffix: true, locale: zhCN })}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Scope Bar (Constraint Entry) */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                background: 'var(--bg-secondary)',
                padding: '12px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {/* Time Scope */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-tertiary)' }} />
                        <select
                            value={timeScope}
                            onChange={(e) => updateFilter({ time_scope: e.target.value })}
                            style={{
                                padding: '8px 12px 8px 32px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-card)',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                appearance: 'none',
                                paddingRight: '32px',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="7d">最近 7 天</option>
                            <option value="30d">最近 30 天</option>
                            <option value="all">所有时间</option>
                        </select>
                        <ChevronLeft size={16} style={{ position: 'absolute', right: '10px', transform: 'rotate(-90deg)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
                    </div>

                    {/* Product Scope */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Package size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-tertiary)' }} />
                        <select
                            value={productScope}
                            onChange={(e) => updateFilter({ product_scope: e.target.value })}
                            style={{
                                padding: '8px 12px 8px 32px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-card)',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                appearance: 'none',
                                paddingRight: '32px',
                                cursor: 'pointer',
                                maxWidth: '200px'
                            }}
                        >
                            <option value="all">所有产品</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ChevronLeft size={16} style={{ position: 'absolute', right: '10px', transform: 'rotate(-90deg)', pointerEvents: 'none', color: 'var(--text-tertiary)' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && updateFilter({ keyword: searchTerm })}
                            placeholder="搜索客户/单号..."
                            style={{
                                padding: '8px 12px 8px 32px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-card)',
                                fontSize: '0.875rem',
                                width: '200px'
                            }}
                        />
                    </div>
                    <button
                        onClick={() => openModal('Inquiry')}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Plus size={16} />
                        {t('inquiry_ticket.create')}
                    </button>
                </div>
            </div>

            {/* Grouped Lists */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}>
                    <Loader2 size={32} className="animate-spin text-primary" style={{ margin: '0 auto' }} />
                </div>
            ) : tickets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
                    <MessageSquare size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    <p>{t('inquiry_ticket.empty_hint')}</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '8px', opacity: 0.7 }}>
                        (当前视图受限于顶部的时间和产品筛选，请尝试调整筛选条件)
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    {/* Urgent Group */}
                    {groupedTickets.urgent.length > 0 && (
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#ef4444' }}>
                                <AlertCircle size={18} />
                                <h2 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Urgent - 停滞超过3天 ({groupedTickets.urgent.length})
                                </h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {groupedTickets.urgent.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </div>
                        </section>
                    )}

                    {/* Attention Group */}
                    {groupedTickets.attention.length > 0 && (
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#f59e0b' }}>
                                <AlertTriangle size={18} />
                                <h2 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Need Review - 超过24小时未更新 ({groupedTickets.attention.length})
                                </h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {groupedTickets.attention.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </div>
                        </section>
                    )}

                    {/* Active Group */}
                    {groupedTickets.active.length > 0 && (
                        <section>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--primary)' }}>
                                <Clock size={18} />
                                <h2 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Active - 今日活跃 ({groupedTickets.active.length})
                                </h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {groupedTickets.active.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </div>
                        </section>
                    )}

                    {/* Done Group */}
                    {groupedTickets.done.length > 0 && (
                        <section style={{ opacity: 0.6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--text-tertiary)' }}>
                                <CheckCircle size={18} />
                                <h2 style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Completed ({groupedTickets.done.length})
                                </h2>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {groupedTickets.done.map(t => <TicketCard key={t.id} ticket={t} />)}
                            </div>
                        </section>
                    )}
                </div>
            )}
            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '40px', paddingBottom: '40px' }}>
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
