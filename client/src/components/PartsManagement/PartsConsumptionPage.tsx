/**
 * PartsConsumptionPage
 * 配件消耗记录页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    ClipboardList,
    Plus,
    Search,
    Loader2,
    AlertCircle,
    CheckCircle,
    XCircle,
    Clock,
    Package,
    Ticket,
    DollarSign,
    RotateCcw
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface ConsumptionRecord {
    id: number;
    ticket_id: number;
    ticket_number: string;
    part_id: number;
    part_sku: string;
    part_name: string;
    part_category: string;
    quantity: number;
    unit_price_cny: number;
    total_price_cny: number;
    source_type: 'hq_inventory' | 'dealer_inventory' | 'external_purchase' | 'warranty_free';
    dealer_id?: number;
    dealer_name?: string;
    settlement_status: 'pending' | 'included' | 'waived' | 'disputed';
    settlement_date?: string;
    notes?: string;
    created_by_name?: string;
    created_at: string;
}

interface ConsumptionSummary {
    overall: {
        total_records: number;
        total_quantity: number;
        total_amount_cny: number;
    };
    by_source: Array<{
        source_type: string;
        count: number;
        total_quantity: number;
        total_amount_cny: number;
    }>;
    by_settlement: Array<{
        settlement_status: string;
        count: number;
        total_quantity: number;
        total_amount_cny: number;
    }>;
    by_category: Array<{
        category: string;
        count: number;
        total_quantity: number;
        total_amount_cny: number;
    }>;
}

const sourceTypeMap: Record<string, { label: string; color: string }> = {
    hq_inventory: { label: '总部库存', color: '#3B82F6' },
    dealer_inventory: { label: '经销商库存', color: '#10B981' },
    external_purchase: { label: '外部采购', color: '#FFD200' },
    warranty_free: { label: '保修免费', color: '#8B5CF6' }
};

const settlementStatusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: '待结算', color: '#FFD200', icon: <Clock size={14} /> },
    included: { label: '已结算', color: '#10B981', icon: <CheckCircle size={14} /> },
    waived: { label: '已豁免', color: '#6B7280', icon: <XCircle size={14} /> },
    disputed: { label: '有争议', color: '#EF4444', icon: <AlertCircle size={14} /> }
};

const PartsConsumptionPage: React.FC = () => {
    const { token, user } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [records, setRecords] = useState<ConsumptionRecord[]>([]);
    const [summary, setSummary] = useState<ConsumptionSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSource, setSelectedSource] = useState<string>('');
    const [selectedStatus, setSelectedStatus] = useState<string>('');
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const isAdmin = ['Admin', 'Lead', 'Exec'].includes(user?.role || '');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page_size: 100 };
            if (searchTerm) params.search = searchTerm;
            if (selectedSource) params.source_type = selectedSource;
            if (selectedStatus) params.settlement_status = selectedStatus;
            if (dateFrom) params.date_from = dateFrom;
            if (dateTo) params.date_to = dateTo;

            const [recordsRes, summaryRes] = await Promise.all([
                axios.get('/api/v1/parts-consumption', { headers, params }),
                axios.get('/api/v1/parts-consumption/summary', { headers })
            ]);

            if (recordsRes.data?.success) {
                setRecords(recordsRes.data.data);
            }
            if (summaryRes.data?.success) {
                setSummary(summaryRes.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch consumption records:', err);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, selectedSource, selectedStatus, dateFrom, dateTo, headers]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSettlementUpdate = async (id: number, status: string) => {
        try {
            await axios.patch(`/api/v1/parts-consumption/${id}/settlement`,
                { settlement_status: status },
                { headers }
            );
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '更新失败');
        }
    };

    const handleDelete = async (record: ConsumptionRecord) => {
        if (!confirm(`确定要撤销这条消耗记录吗？\n配件: ${record.part_name}\n数量: ${record.quantity}\n这将恢复库存。`)) {
            return;
        }
        try {
            await axios.delete(`/api/v1/parts-consumption/${record.id}`, { headers });
            fetchData();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '撤销失败');
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
                        <ClipboardList size={28} color="#3B82F6" />
                        配件消耗记录
                    </h1>
                    <p style={{ color: '#6B7280', margin: '4px 0 0 0' }}>
                        记录和追踪维修过程中的配件使用情况
                    </p>
                </div>
                <button
                    onClick={() => alert('请通过维修工单记录配件消耗')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        background: '#3B82F6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 500
                    }}
                >
                    <Plus size={18} />
                    记录消耗
                </button>
            </div>

            {/* Stats Cards */}
            {summary && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
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
                                background: '#EFF6FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <ClipboardList size={20} color="#3B82F6" />
                            </div>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}>总记录数</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {summary.overall.total_records}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                            {summary.overall.total_quantity} 件配件
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
                            <span style={{ color: '#6B7280', fontSize: '14px' }}>总金额</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {formatCurrency(summary.overall.total_amount_cny)}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                            消耗配件总价值
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
                                <Clock size={20} color="#FFD200" />
                            </div>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}>待结算</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {summary.by_settlement.find(s => s.settlement_status === 'pending')?.count || 0}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                            笔待结算记录
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
                                background: '#F3E8FF',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Package size={20} color="#8B5CF6" />
                            </div>
                            <span style={{ color: '#6B7280', fontSize: '14px' }}>保修免费</span>
                        </div>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: '#111827' }}>
                            {summary.by_source.find(s => s.source_type === 'warranty_free')?.count || 0}
                        </div>
                        <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                            保修期内免费更换
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
                        placeholder="搜索工单号、配件SKU或名称..."
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
                    value={selectedSource}
                    onChange={(e) => setSelectedSource(e.target.value)}
                    style={{
                        padding: '10px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                    }}
                >
                    <option value="">所有来源</option>
                    <option value="hq_inventory">总部库存</option>
                    <option value="dealer_inventory">经销商库存</option>
                    <option value="external_purchase">外部采购</option>
                    <option value="warranty_free">保修免费</option>
                </select>

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
                    <option value="">所有结算状态</option>
                    <option value="pending">待结算</option>
                    <option value="included">已结算</option>
                    <option value="waived">已豁免</option>
                    <option value="disputed">有争议</option>
                </select>

                <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{
                        padding: '10px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '14px'
                    }}
                />
                <span style={{ color: '#6B7280' }}>至</span>
                <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={{
                        padding: '10px 12px',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '14px'
                    }}
                />

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

            {/* Records Table */}
            <div style={{
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#F9FAFB' }}>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>工单</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>配件</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>数量</th>
                            <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#374151' }}>单价</th>
                            <th style={{ padding: '14px 16px', textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#374151' }}>总价</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>来源</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>结算状态</th>
                            <th style={{ padding: '14px 16px', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: '#374151' }}>记录时间</th>
                            <th style={{ padding: '14px 16px', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#374151' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={9} style={{ padding: '40px', textAlign: 'center' }}>
                                    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', margin: '0 auto', color: '#3B82F6' }} />
                                </td>
                            </tr>
                        ) : records.length === 0 ? (
                            <tr>
                                <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                                    <ClipboardList size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                                    <p>暂无消耗记录</p>
                                </td>
                            </tr>
                        ) : (
                            records.map((record) => (
                                <tr key={record.id} style={{ borderTop: '1px solid #E5E7EB' }}>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Ticket size={16} color="#3B82F6" />
                                            <span style={{ fontWeight: 500, color: '#111827' }}>{record.ticket_number}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 16px' }}>
                                        <div>
                                            <div style={{ fontWeight: 500, color: '#111827' }}>{record.part_name}</div>
                                            <div style={{ fontSize: '12px', color: '#6B7280' }}>{record.part_sku}</div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '28px',
                                            height: '28px',
                                            borderRadius: '6px',
                                            background: '#F3F4F6',
                                            fontWeight: 600,
                                            fontSize: '14px'
                                        }}>
                                            {record.quantity}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'monospace' }}>
                                        {formatCurrency(record.unit_price_cny)}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace', color: '#111827' }}>
                                        {formatCurrency(record.total_price_cny)}
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
                                            background: `${sourceTypeMap[record.source_type]?.color}15`,
                                            color: sourceTypeMap[record.source_type]?.color
                                        }}>
                                            {sourceTypeMap[record.source_type]?.label}
                                        </span>
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        <select
                                            value={record.settlement_status}
                                            onChange={(e) => handleSettlementUpdate(record.id, e.target.value)}
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                border: `1px solid ${settlementStatusMap[record.settlement_status]?.color}40`,
                                                background: `${settlementStatusMap[record.settlement_status]?.color}10`,
                                                color: settlementStatusMap[record.settlement_status]?.color,
                                                fontSize: '12px',
                                                fontWeight: 500,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="pending">待结算</option>
                                            <option value="included">已结算</option>
                                            <option value="waived">已豁免</option>
                                            <option value="disputed">有争议</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280' }}>
                                        {formatDate(record.created_at)}
                                    </td>
                                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleDelete(record)}
                                                style={{
                                                    padding: '6px',
                                                    background: 'transparent',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    color: '#EF4444'
                                                }}
                                                title="撤销记录"
                                            >
                                                <RotateCcw size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Category Breakdown */}
            {summary && summary.by_category.length > 0 && (
                <div style={{
                    marginTop: '24px',
                    background: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: '0 0 16px 0' }}>
                        按配件分类统计
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '12px'
                    }}>
                        {summary.by_category.map((cat) => (
                            <div key={cat.category} style={{
                                padding: '12px 16px',
                                background: '#F9FAFB',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontWeight: 500, color: '#374151' }}>{cat.category}</span>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                                        {cat.count} 笔
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                        {formatCurrency(cat.total_amount_cny)}
                                    </div>
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

export default PartsConsumptionPage;
