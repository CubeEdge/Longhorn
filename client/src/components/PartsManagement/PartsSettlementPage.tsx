/**
 * PartsSettlementPage
 * 经销商配件结算管理页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Calculator,
    Plus,
    Search,
    Loader2,
    AlertCircle,
    CheckCircle,
    Clock,
    DollarSign,
    Building,
    FileText,
    XCircle,
    RotateCcw,
    Eye
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface Settlement {
    id: number;
    settlement_number: string;
    dealer_id: number;
    dealer_name: string;
    dealer_code: string;
    settlement_type: 'monthly' | 'quarterly' | 'custom';
    period_start: string;
    period_end: string;
    total_amount_cny: number;
    total_quantity: number;
    status: 'draft' | 'confirmed' | 'paid' | 'cancelled';
    consumption_count: number;
    created_by_name?: string;
    created_at: string;
    confirmed_at?: string;
    paid_at?: string;
    payment_method?: string;
}

interface SettlementSummary {
    overall: {
        total_settlements: number;
        draft_count: number;
        confirmed_count: number;
        paid_count: number;
        cancelled_count: number;
        total_amount: number;
        paid_amount: number;
        pending_amount: number;
    };
    by_dealer: Array<{
        dealer_id: number;
        dealer_name: string;
        dealer_code: string;
        settlement_count: number;
        total_amount: number;
        paid_amount: number;
    }>;
}

interface PendingConsumption {
    id: number;
    ticket_number: string;
    part_sku: string;
    part_name: string;
    part_category: string;
    quantity: number;
    unit_price_cny: number;
    total_price_cny: number;
    source_type: string;
    dealer_name?: string;
    created_at: string;
}

const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    draft: { label: '草稿', color: '#6B7280', icon: <FileText size={14} /> },
    confirmed: { label: '已确认', color: '#3B82F6', icon: <CheckCircle size={14} /> },
    paid: { label: '已付款', color: '#10B981', icon: <DollarSign size={14} /> },
    cancelled: { label: '已取消', color: '#EF4444', icon: <XCircle size={14} /> }
};

const typeMap: Record<string, string> = {
    monthly: '月度结算',
    quarterly: '季度结算',
    custom: '自定义'
};

const PartsSettlementPage: React.FC = () => {
    const { token, user } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [settlements, setSettlements] = useState<Settlement[]>([]);
    const [summary, setSummary] = useState<SettlementSummary | null>(null);
    const [pendingConsumptions, setPendingConsumptions] = useState<PendingConsumption[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [selectedType, setSelectedType] = useState<string>('');
    const [, setShowCreateModal] = useState(false);
    const [, setSelectedSettlement] = useState<Settlement | null>(null);

    const isAdmin = ['Admin', 'Lead', 'Exec', 'MS'].includes(user?.role || '');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page_size: 100 };
            if (selectedStatus) params.status = selectedStatus;
            if (selectedType) params.settlement_type = selectedType;

            const [settlementsRes, summaryRes, pendingRes] = await Promise.all([
                axios.get('/api/v1/parts-settlements', { headers, params }),
                axios.get('/api/v1/parts-settlements/summary', { headers }),
                axios.get('/api/v1/parts-settlements/pending-consumptions', { headers })
            ]);

            if (settlementsRes.data?.success) {
                setSettlements(settlementsRes.data.data);
            }
            if (summaryRes.data?.success) {
                setSummary(summaryRes.data.data);
            }
            if (pendingRes.data?.success) {
                setPendingConsumptions(pendingRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch settlements:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedStatus, selectedType, headers]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleConfirm = async (id: number) => {
        try {
            await axios.patch(`/api/v1/parts-settlements/${id}/confirm`, {}, { headers });
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '确认失败');
        }
    };

    const handlePay = async (id: number) => {
        const method = prompt('请输入付款方式 (如: 银行转账/支付宝):');
        if (!method) return;
        const reference = prompt('请输入付款参考号:');

        try {
            await axios.patch(`/api/v1/parts-settlements/${id}/pay`,
                { payment_method: method, payment_reference: reference },
                { headers }
            );
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '标记付款失败');
        }
    };

    const handleCancel = async (settlement: Settlement) => {
        const reason = prompt('请输入取消原因:');
        if (reason === null) return;

        try {
            await axios.patch(`/api/v1/parts-settlements/${settlement.id}/cancel`,
                { reason },
                { headers }
            );
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '取消失败');
        }
    };

    const handleDelete = async (settlement: Settlement) => {
        if (!confirm(`确定要删除结算单 ${settlement.settlement_number} 吗？\n相关消耗记录将恢复为待结算状态。`)) {
            return;
        }
        try {
            await axios.delete(`/api/v1/parts-settlements/${settlement.id}`, { headers });
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '删除失败');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: 'CNY',
            minimumFractionDigits: 2
        }).format(amount);
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('zh-CN');
    };

    const filteredSettlements = settlements.filter(s =>
        searchTerm === '' ||
        s.settlement_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.dealer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.dealer_code?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
            }}>
                <div>
                    <h1 style={{
                        fontSize: '24px',
                        fontWeight: 600,
                        color: '#111827',
                        margin: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <Calculator size={28} color="#8B5CF6" />
                        经销商配件结算
                    </h1>
                    <p style={{ color: '#6B7280', margin: '4px 0 0 0' }}>
                        管理经销商配件消耗的月度/季度结算
                    </p>
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px',
                            background: '#8B5CF6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500
                        }}
                    >
                        <Plus size={18} />
                        创建结算单
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            {summary && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#F3E8FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <FileText size={20} color="#8B5CF6" />
                            </div>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}>结算单总数</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {summary.overall.total_settlements}
                        </div>
                    </div>

                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#F0FDF4',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <DollarSign size={20} color="#10B981" />
                            </div>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}>已付款金额</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {formatCurrency(summary.overall.paid_amount)}
                        </div>
                    </div>

                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#FFFBEB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Clock size={20} color="#F59E0B" />
                            </div>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}>待付款金额</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {formatCurrency(summary.overall.pending_amount)}
                        </div>
                    </div>

                    <div style={{
                        background: 'white',
                        borderRadius: '12px',
                        padding: '20px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#EFF6FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <AlertCircle size={20} color="#3B82F6" />
                            </div>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}>待结算记录</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {pendingConsumptions.length}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                    <input
                        type="text"
                        placeholder="搜索结算单号或经销商..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 40px',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            fontSize: '14px'
                        }}
                    />
                </div>

                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    style={{
                        padding: '10px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                    }}
                >
                    <option value="">所有状态</option>
                    <option value="draft">草稿</option>
                    <option value="confirmed">已确认</option>
                    <option value="paid">已付款</option>
                    <option value="cancelled">已取消</option>
                </select>

                <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    style={{
                        padding: '10px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                    }}
                >
                    <option value="">所有类型</option>
                    <option value="monthly">月度结算</option>
                    <option value="quarterly">季度结算</option>
                    <option value="custom">自定义</option>
                </select>

                <button
                    onClick={fetchData}
                    style={{
                        padding: '10px 16px',
                        background: '#F3F4F6',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <RotateCcw size={16} />
                    刷新
                </button>
            </div>

            {/* Settlements Table */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>结算单号</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>经销商</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>类型</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>结算期间</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>记录数</th>
                            <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#374151' }}>总金额</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>状态</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={8} style={{ padding: '40px', textAlign: 'center' }}>
                                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', color: '#8B5CF6' }} />
                                </td>
                            </tr>
                        ) : filteredSettlements.length === 0 ? (
                            <tr>
                                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                                    <Calculator size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                    <p>暂无结算单</p>
                                </td>
                            </tr>
                        ) : (
                            filteredSettlements.map((settlement) => (
                                <tr key={settlement.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ fontWeight: 600, color: '#111827' }}>{settlement.settlement_number}</div>
                                        <div style={{ fontSize: '12px', color: '#6B7280' }}>{formatDate(settlement.created_at)}</div>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Building size={16} color="#6B7280" />
                                            <div>
                                                <div style={{ fontWeight: 500, color: '#111827' }}>{settlement.dealer_name}</div>
                                                <div style={{ fontSize: '12px', color: '#6B7280' }}>{settlement.dealer_code}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            background: '#F3F4F6',
                                            color: '#374151'
                                        }}>
                                            {typeMap[settlement.settlement_type]}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', color: '#6B7280' }}>
                                        {formatDate(settlement.period_start)} ~ {formatDate(settlement.period_end)}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        <span style={{ fontWeight: 600, color: '#111827' }}>{settlement.consumption_count}</span>
                                        <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '4px' }}>笔</span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: '#111827' }}>
                                        {formatCurrency(settlement.total_amount_cny)}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '4px 10px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            background: `${statusMap[settlement.status].color}15`,
                                            color: statusMap[settlement.status].color
                                        }}>
                                            {statusMap[settlement.status].icon}
                                            {statusMap[settlement.status].label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <button
                                                onClick={() => setSelectedSettlement(settlement)}
                                                style={{
                                                    padding: '6px',
                                                    background: '#F3F4F6',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer'
                                                }}
                                                title="查看详情"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {isAdmin && settlement.status === 'draft' && (
                                                <button
                                                    onClick={() => handleConfirm(settlement.id)}
                                                    style={{
                                                        padding: '6px',
                                                        background: '#3B82F6',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        color: 'white'
                                                    }}
                                                    title="确认"
                                                >
                                                    <CheckCircle size={16} />
                                                </button>
                                            )}
                                            {isAdmin && settlement.status === 'confirmed' && (
                                                <button
                                                    onClick={() => handlePay(settlement.id)}
                                                    style={{
                                                        padding: '6px',
                                                        background: '#10B981',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        color: 'white'
                                                    }}
                                                    title="标记付款"
                                                >
                                                    <DollarSign size={16} />
                                                </button>
                                            )}
                                            {isAdmin && settlement.status === 'draft' && (
                                                <button
                                                    onClick={() => handleDelete(settlement)}
                                                    style={{
                                                        padding: '6px',
                                                        background: '#EF4444',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        color: 'white'
                                                    }}
                                                    title="删除"
                                                >
                                                    <XCircle size={16} />
                                                </button>
                                            )}
                                            {isAdmin && settlement.status !== 'draft' && settlement.status !== 'paid' && (
                                                <button
                                                    onClick={() => handleCancel(settlement)}
                                                    style={{
                                                        padding: '6px',
                                                        background: '#6B7280',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer',
                                                        color: 'white'
                                                    }}
                                                    title="取消"
                                                >
                                                    <RotateCcw size={16} />
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

            {/* Dealer Summary */}
            {summary && summary.by_dealer.length > 0 && (
                <div style={{
                    marginTop: '24px',
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0' }}>
                        经销商结算统计
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '12px'
                    }}>
                        {summary.by_dealer.map((dealer) => (
                            <div key={dealer.dealer_id} style={{
                                padding: '16px',
                                background: '#F9FAFB',
                                borderRadius: '8px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontWeight: 600, color: '#111827' }}>{dealer.dealer_name}</span>
                                    <span style={{ fontSize: '12px', color: '#6B7280' }}>{dealer.dealer_code}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: '#6B7280' }}>{dealer.settlement_count} 笔结算</span>
                                    <span style={{ fontWeight: 500, color: '#111827' }}>{formatCurrency(dealer.total_amount)}</span>
                                </div>
                                <div style={{ marginTop: '8px', fontSize: '12px', color: '#10B981' }}>
                                    已付款: {formatCurrency(dealer.paid_amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default PartsSettlementPage;
