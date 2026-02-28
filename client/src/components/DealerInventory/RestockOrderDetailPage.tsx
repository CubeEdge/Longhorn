/**
 * RestockOrderDetailPage
 * 补货订单详情页面
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../i18n/useLanguage';
import axios from 'axios';
import { 
    ArrowLeft, Loader2, Clock, CheckCircle, 
    Truck, XCircle, FileText, Send, Check
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface RestockOrderDetail {
    id: number;
    order_number: string;
    dealer: { id: number; name: string; code: string };
    status: string;
    shipping_address: string | null;
    shipping_method: string | null;
    tracking_number: string | null;
    items: Array<{
        id: number;
        part: { id: number; number: string; name: string };
        quantity_requested: number;
        quantity_approved: number | null;
        quantity_shipped: number | null;
        unit_price: number;
        total_price: number;
    }>;
    pricing: {
        subtotal: number;
        shipping_cost: number;
        total_amount: number;
    };
    currency: string;
    pi_id: number | null;
    dealer_notes: string | null;
    internal_notes: string | null;
    submitted_at: string | null;
    approved_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    created_by: string;
    approved_by: string | null;
    created_at: string;
}

const statusFlow = ['Draft', 'Submitted', 'Approved', 'Shipped', 'Delivered'];

const statusConfig: Record<string, { color: string; bg: string; icon: any }> = {
    'Draft': { color: 'var(--text-secondary)', bg: 'rgba(156, 163, 175, 0.15)', icon: Clock },
    'Submitted': { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Clock },
    'Approved': { color: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle },
    'Shipped': { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: Truck },
    'Delivered': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle },
    'Cancelled': { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: XCircle }
};

const RestockOrderDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const { token, user } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [order, setOrder] = useState<RestockOrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const isDealer = user?.user_type === 'Dealer';
    const canApprove = user?.role === 'Admin' || user?.role === 'Lead';

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/dealer-inventory/restock-orders/${id}`, { headers });
            if (res.data?.success) {
                setOrder(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch order:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (newStatus: string, extras?: any) => {
        setActionLoading(true);
        try {
            await axios.patch(`/api/v1/dealer-inventory/restock-orders/${id}/status`, 
                { status: newStatus, ...extras },
                { headers }
            );
            fetchOrder();
        } catch (err) {
            console.error('Failed to update status:', err);
            alert(t('common.operationFailed') || '操作失败');
        } finally {
            setActionLoading(false);
        }
    };

    const generatePI = async () => {
        setActionLoading(true);
        try {
            const res = await axios.post(`/api/v1/proforma-invoices/from-restock-order/${id}`, {}, { headers });
            if (res.data?.success) {
                alert(t('restock.pi_generated') || 'PI已生成');
                fetchOrder();
            }
        } catch (err: any) {
            console.error('Failed to generate PI:', err);
            alert(err.response?.data?.error?.message || t('common.operationFailed'));
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: order?.currency || 'USD'
        }).format(amount);
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: 100 }}>
                <Loader2 size={32} className="animate-spin" style={{ opacity: 0.5 }} />
            </div>
        );
    }

    if (!order) {
        return (
            <div style={{ textAlign: 'center', padding: 100 }}>
                <p className="hint">{t('common.not_found') || '未找到订单'}</p>
            </div>
        );
    }

    const config = statusConfig[order.status] || statusConfig['Draft'];
    const StatusIcon = config.icon;
    const currentStatusIndex = statusFlow.indexOf(order.status);

    return (
        <div className="fade-in" style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
            {/* 返回按钮 */}
            <button
                onClick={() => navigate('/service/inventory/restock')}
                className="btn-glass"
                style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}
            >
                <ArrowLeft size={16} />
                {t('common.back') || '返回'}
            </button>

            {/* 头部 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 32
            }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8 }}>
                        {order.order_number}
                    </h1>
                    <p className="hint">
                        {t('restock.created_at') || '创建时间'}: {formatDate(order.created_at)}
                    </p>
                </div>
                <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 16px',
                    background: config.bg,
                    color: config.color,
                    borderRadius: 24,
                    fontSize: '0.9rem',
                    fontWeight: 600
                }}>
                    <StatusIcon size={16} />
                    {t(`restock.status.${order.status.toLowerCase()}`) || order.status}
                </span>
            </div>

            {/* 状态流程 */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
                border: '1px solid var(--glass-border)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {statusFlow.map((status, idx) => {
                        const isPast = idx < currentStatusIndex;
                        const isCurrent = idx === currentStatusIndex;
                        const sConfig = statusConfig[status];
                        
                        return (
                            <React.Fragment key={status}>
                                <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center',
                                    opacity: isPast || isCurrent ? 1 : 0.4
                                }}>
                                    <div style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: isCurrent ? sConfig.bg : isPast ? 'rgba(16, 185, 129, 0.2)' : 'var(--glass-bg-light)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: 8
                                    }}>
                                        {isPast ? (
                                            <Check size={16} style={{ color: '#10B981' }} />
                                        ) : (
                                            <sConfig.icon size={14} style={{ color: isCurrent ? sConfig.color : 'var(--text-secondary)' }} />
                                        )}
                                    </div>
                                    <span style={{ 
                                        fontSize: '0.75rem', 
                                        color: isCurrent ? sConfig.color : 'var(--text-secondary)',
                                        fontWeight: isCurrent ? 600 : 400
                                    }}>
                                        {t(`restock.status.${status.toLowerCase()}`) || status}
                                    </span>
                                </div>
                                {idx < statusFlow.length - 1 && (
                                    <div style={{
                                        flex: 1,
                                        height: 2,
                                        background: isPast ? 'rgba(16, 185, 129, 0.4)' : 'var(--glass-bg-hover)',
                                        margin: '0 8px'
                                    }} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* 经销商信息 */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
                border: '1px solid var(--glass-border)'
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>
                    {t('restock.dealer_info') || '经销商信息'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div>
                        <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 4 }}>{t('common.name') || '名称'}</div>
                        <div style={{ fontWeight: 500 }}>{order.dealer.name}</div>
                    </div>
                    <div>
                        <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 4 }}>{t('common.code') || '编码'}</div>
                        <div>{order.dealer.code || '-'}</div>
                    </div>
                    {order.shipping_address && (
                        <div style={{ gridColumn: 'span 2' }}>
                            <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 4 }}>{t('restock.shipping_address') || '收货地址'}</div>
                            <div>{order.shipping_address}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* 配件明细 */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
                border: '1px solid var(--glass-border)'
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>
                    {t('restock.items') || '配件明细'}
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '12px 0', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                {t('inventory.part') || '配件'}
                            </th>
                            <th style={{ padding: '12px 0', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                {t('restock.quantity_requested') || '申请数量'}
                            </th>
                            <th style={{ padding: '12px 0', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                {t('restock.unit_price') || '单价'}
                            </th>
                            <th style={{ padding: '12px 0', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, opacity: 0.6 }}>
                                {t('restock.total') || '小计'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.items.map(item => (
                            <tr key={item.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <td style={{ padding: '14px 0' }}>
                                    <div style={{ fontWeight: 500 }}>{item.part.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{item.part.number}</div>
                                </td>
                                <td style={{ padding: '14px 0', textAlign: 'center' }}>
                                    {item.quantity_requested}
                                </td>
                                <td style={{ padding: '14px 0', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                    {formatAmount(item.unit_price)}
                                </td>
                                <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: 500 }}>
                                    {formatAmount(item.total_price)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={3} style={{ padding: '14px 0', textAlign: 'right', fontWeight: 600 }}>
                                {t('restock.total_amount') || '合计'}
                            </td>
                            <td style={{ padding: '14px 0', textAlign: 'right', fontWeight: 700, fontSize: '1.1rem', color: '#FFD700' }}>
                                {formatAmount(order.pricing.total_amount)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                {/* 经销商：草稿状态可提交 */}
                {isDealer && order.status === 'Draft' && (
                    <button
                        className="btn-primary"
                        onClick={() => updateStatus('Submitted')}
                        disabled={actionLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        {t('restock.submit') || '提交订单'}
                    </button>
                )}

                {/* 管理员：已提交可审批 */}
                {canApprove && order.status === 'Submitted' && (
                    <>
                        <button
                            className="btn-glass"
                            onClick={() => updateStatus('Cancelled')}
                            disabled={actionLoading}
                        >
                            {t('common.reject') || '拒绝'}
                        </button>
                        <button
                            className="btn-primary"
                            onClick={() => updateStatus('Approved')}
                            disabled={actionLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                            {t('restock.approve') || '批准'}
                        </button>
                    </>
                )}

                {/* 管理员：已批准可生成PI和发货 */}
                {canApprove && order.status === 'Approved' && (
                    <>
                        {!order.pi_id && (
                            <button
                                className="btn-glass"
                                onClick={generatePI}
                                disabled={actionLoading}
                                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <FileText size={16} />
                                {t('restock.generate_pi') || '生成PI'}
                            </button>
                        )}
                        <button
                            className="btn-primary"
                            onClick={() => {
                                const tracking = prompt(t('restock.enter_tracking') || '请输入物流单号');
                                if (tracking) {
                                    updateStatus('Shipped', { tracking_number: tracking });
                                }
                            }}
                            disabled={actionLoading}
                            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                            <Truck size={16} />
                            {t('restock.ship') || '发货'}
                        </button>
                    </>
                )}

                {/* 确认收货 */}
                {order.status === 'Shipped' && (
                    <button
                        className="btn-primary"
                        onClick={() => updateStatus('Delivered')}
                        disabled={actionLoading}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                        {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        {t('restock.confirm_received') || '确认收货'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default RestockOrderDetailPage;
