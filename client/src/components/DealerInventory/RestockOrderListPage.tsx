/**
 * RestockOrderListPage
 * 补货订单列表页面
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/useLanguage';
import axios from 'axios';
import { 
    Package, Plus, ChevronRight, 
    Loader2, Clock, CheckCircle, Truck, XCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface RestockOrder {
    id: number;
    order_number: string;
    dealer: { id: number; name: string };
    status: string;
    total_amount: number;
    currency: string;
    submitted_at: string | null;
    shipped_at: string | null;
    created_by: string;
    created_at: string;
}

const statusConfig: Record<string, { color: string; bg: string; icon: any }> = {
    'Draft': { color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.15)', icon: Clock },
    'Submitted': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Clock },
    'Approved': { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: CheckCircle },
    'Shipped': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: Truck },
    'Delivered': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle },
    'Cancelled': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: XCircle }
};

const RestockOrderListPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { token, user } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [orders, setOrders] = useState<RestockOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const isDealer = user?.user_type === 'Dealer';

    useEffect(() => {
        fetchOrders();
    }, [statusFilter, page]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params: any = { page, page_size: 20 };
            if (statusFilter) params.status = statusFilter;

            const res = await axios.get('/api/v1/dealer-inventory/restock-orders', { headers, params });
            if (res.data?.success) {
                setOrders(res.data.data);
                setTotalPages(res.data.meta?.total_pages || 1);
            }
        } catch (err) {
            console.error('Failed to fetch restock orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    const formatAmount = (amount: number, currency: string) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD'
        }).format(amount);
    };

    const statuses = ['Draft', 'Submitted', 'Approved', 'Shipped', 'Delivered', 'Cancelled'];

    return (
        <div className="fade-in" style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
            {/* 页头 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>
                        {t('restock.title') || '补货订单'}
                    </h1>
                    <p className="hint">
                        {isDealer 
                            ? t('restock.dealer_desc') || '查看和管理您的补货订单'
                            : t('restock.admin_desc') || '审批和管理所有补货订单'
                        }
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button 
                        className="btn-glass"
                        onClick={() => navigate('/service/inventory')}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <Package size={16} />
                        {t('inventory.title') || '库存管理'}
                    </button>
                    <button 
                        className="btn-primary"
                        onClick={() => navigate('/service/inventory/restock/new')}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        <Plus size={16} />
                        {t('restock.create') || '创建补货订单'}
                    </button>
                </div>
            </div>

            {/* 状态筛选 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                <button
                    onClick={() => setStatusFilter('')}
                    style={{
                        padding: '8px 16px',
                        borderRadius: 20,
                        border: 'none',
                        background: !statusFilter ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                        color: !statusFilter ? '#FFD700' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem'
                    }}
                >
                    {t('common.all') || '全部'}
                </button>
                {statuses.map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 20,
                            border: 'none',
                            background: statusFilter === status 
                                ? statusConfig[status]?.bg || 'rgba(255,255,255,0.1)'
                                : 'rgba(255,255,255,0.05)',
                            color: statusFilter === status 
                                ? statusConfig[status]?.color || 'white'
                                : 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        {t(`restock.status.${status.toLowerCase()}`) || status}
                    </button>
                ))}
            </div>

            {/* 订单列表 */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 60 }}>
                    <Loader2 size={32} className="animate-spin" style={{ opacity: 0.5 }} />
                </div>
            ) : orders.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: 60,
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 16,
                    border: '1px solid var(--glass-border)'
                }}>
                    <Package size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                    <p className="hint">{t('restock.no_orders') || '暂无补货订单'}</p>
                    <button 
                        className="btn-primary" 
                        style={{ marginTop: 16 }}
                        onClick={() => navigate('/service/inventory/restock/new')}
                    >
                        <Plus size={16} /> {t('restock.create_first') || '创建第一个订单'}
                    </button>
                </div>
            ) : (
                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 16,
                    border: '1px solid var(--glass-border)',
                    overflow: 'hidden'
                }}>
                    {orders.map((order, idx) => {
                        const config = statusConfig[order.status] || statusConfig['Draft'];
                        const StatusIcon = config.icon;
                        
                        return (
                            <div 
                                key={order.id}
                                onClick={() => navigate(`/service/inventory/restock/${order.id}`)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '16px 24px',
                                    borderTop: idx > 0 ? '1px solid var(--glass-border)' : undefined,
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                {/* 订单号 */}
                                <div style={{ flex: 1, minWidth: 150 }}>
                                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                        {order.order_number}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {formatDate(order.created_at)}
                                    </div>
                                </div>

                                {/* 经销商 */}
                                {!isDealer && (
                                    <div style={{ flex: 1, minWidth: 150 }}>
                                        <div>{order.dealer.name}</div>
                                    </div>
                                )}

                                {/* 金额 */}
                                <div style={{ flex: 1, minWidth: 120, textAlign: 'right' }}>
                                    <div style={{ fontWeight: 600 }}>
                                        {formatAmount(order.total_amount, order.currency)}
                                    </div>
                                </div>

                                {/* 状态 */}
                                <div style={{ width: 120, textAlign: 'center' }}>
                                    <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '6px 12px',
                                        background: config.bg,
                                        color: config.color,
                                        borderRadius: 20,
                                        fontSize: '0.8rem',
                                        fontWeight: 500
                                    }}>
                                        <StatusIcon size={12} />
                                        {t(`restock.status.${order.status.toLowerCase()}`) || order.status}
                                    </span>
                                </div>

                                {/* 箭头 */}
                                <ChevronRight size={18} style={{ opacity: 0.4, marginLeft: 16 }} />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="btn-glass"
                        style={{ opacity: page === 1 ? 0.5 : 1 }}
                    >
                        {t('common.prev') || '上一页'}
                    </button>
                    <span style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>
                        {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="btn-glass"
                        style={{ opacity: page === totalPages ? 0.5 : 1 }}
                    >
                        {t('common.next') || '下一页'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default RestockOrderListPage;
