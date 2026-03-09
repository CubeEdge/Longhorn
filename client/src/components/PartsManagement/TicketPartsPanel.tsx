/**
 * TicketPartsPanel
 * 工单配件使用记录面板
 * 集成到 UnifiedTicketDetail 中显示和管理工单的配件消耗
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Package,
    Plus,
    Trash2,
    Loader2,
    Search
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface PartConsumption {
    id: number;
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
    notes?: string;
    created_by_name?: string;
    created_at: string;
}

interface PartOption {
    id: number;
    sku: string;
    name: string;
    category: string;
    price_cny: number;
    price_usd: number;
}

interface Props {
    ticketId: number;
    dealerId?: number;
    isWarranty?: boolean;
}

const sourceTypeMap: Record<string, { label: string; color: string }> = {
    hq_inventory: { label: '总部库存', color: '#3B82F6' },
    dealer_inventory: { label: '经销商库存', color: '#10B981' },
    external_purchase: { label: '外部采购', color: '#F59E0B' },
    warranty_free: { label: '保修免费', color: '#8B5CF6' }
};

const settlementStatusMap: Record<string, { label: string; color: string }> = {
    pending: { label: '待结算', color: '#F59E0B' },
    included: { label: '已结算', color: '#10B981' },
    waived: { label: '已豁免', color: '#6B7280' },
    disputed: { label: '有争议', color: '#EF4444' }
};

const TicketPartsPanel: React.FC<Props> = ({ ticketId, dealerId, isWarranty }) => {
    const { token, user } = useAuthStore();
    const headers = { Authorization: `Bearer ${token}` };

    const [consumptions, setConsumptions] = useState<PartConsumption[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [parts, setParts] = useState<PartOption[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedPart, setSelectedPart] = useState<PartOption | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [sourceType, setSourceType] = useState<string>('hq_inventory');
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const isAdmin = ['Admin', 'Lead', 'Exec', 'MS', 'OP'].includes(user?.role || '');

    const fetchConsumptions = useCallback(async () => {
        try {
            const res = await axios.get('/api/v1/parts-consumption', {
                headers,
                params: { ticket_id: ticketId, page_size: 100 }
            });
            if (res.data?.success) {
                setConsumptions(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch consumptions:', err);
        } finally {
            setLoading(false);
        }
    }, [ticketId, headers]);

    useEffect(() => {
        fetchConsumptions();
    }, [fetchConsumptions]);

    const fetchParts = useCallback(async () => {
        if (!searchTerm || searchTerm.length < 2) return;
        try {
            const res = await axios.get('/api/v1/parts-master', {
                headers,
                params: { search: searchTerm, status: 'active', page_size: 20 }
            });
            if (res.data?.success) {
                setParts(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch parts:', err);
        }
    }, [searchTerm, headers]);

    useEffect(() => {
        const timer = setTimeout(fetchParts, 300);
        return () => clearTimeout(timer);
    }, [fetchParts]);

    const handleSubmit = async () => {
        if (!selectedPart || quantity < 1) return;

        setSubmitting(true);
        try {
            await axios.post('/api/v1/parts-consumption', {
                ticket_id: ticketId,
                part_id: selectedPart.id,
                quantity,
                source_type: sourceType,
                dealer_id: sourceType === 'dealer_inventory' ? dealerId : undefined,
                notes: notes || undefined
            }, { headers });

            setShowAddForm(false);
            setSelectedPart(null);
            setQuantity(1);
            setNotes('');
            fetchConsumptions();
        } catch (err: any) {
            alert(err.response?.data?.error?.message || '添加失败');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (consumption: PartConsumption) => {
        if (!confirm(`确定要删除这条配件记录吗？\n${consumption.part_name} x ${consumption.quantity}`)) {
            return;
        }
        try {
            await axios.delete(`/api/v1/parts-consumption/${consumption.id}`, { headers });
            fetchConsumptions();
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

    const totalAmount = consumptions.reduce((sum, c) => sum + c.total_price_cny, 0);
    const totalQuantity = consumptions.reduce((sum, c) => sum + c.quantity, 0);

    return (
        <div style={{
            background: 'var(--glass-bg)',
            borderRadius: '12px',
            border: '1px solid var(--glass-border)',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Package size={20} color="#FFD700" />
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>配件使用记录</span>
                    {consumptions.length > 0 && (
                        <span style={{
                            padding: '2px 8px',
                            background: 'rgba(255,215,0,0.2)',
                            borderRadius: '10px',
                            fontSize: '12px',
                            color: '#FFD700'
                        }}>
                            {consumptions.length} 项
                        </span>
                    )}
                </div>
                {isAdmin && (
                    <button
                        onClick={() => setShowAddForm(!showAddForm)}
                        style={{
                            padding: '6px 12px',
                            background: showAddForm ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: showAddForm ? '#EF4444' : '#3B82F6',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {showAddForm ? '取消' : <><Plus size={14} /> 添加</>}
                    </button>
                )}
            </div>

            {/* Stats */}
            {consumptions.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1px',
                    background: 'var(--glass-border)'
                }}>
                    <div style={{ padding: '12px 16px', background: 'var(--glass-bg)' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>总数量</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#FFD700' }}>{totalQuantity}</div>
                    </div>
                    <div style={{ padding: '12px 16px', background: 'var(--glass-bg)' }}>
                        <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>总金额</div>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: '#10B981' }}>{formatCurrency(totalAmount)}</div>
                    </div>
                </div>
            )}

            {/* Add Form */}
            {showAddForm && (
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--glass-border)',
                    background: 'rgba(59,130,246,0.05)'
                }}>
                    {/* Part Search */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'block' }}>搜索配件</label>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="输入SKU或配件名称..."
                                style={{
                                    width: '100%',
                                    padding: '8px 10px 8px 34px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    color: '#fff'
                                }}
                            />
                        </div>
                        {parts.length > 0 && !selectedPart && (
                            <div style={{
                                marginTop: '4px',
                                maxHeight: '150px',
                                overflow: 'auto',
                                background: 'rgba(30,30,30,0.95)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '6px'
                            }}>
                                {parts.map(part => (
                                    <div
                                        key={part.id}
                                        onClick={() => {
                                            setSelectedPart(part);
                                            setParts([]);
                                            setSearchTerm('');
                                        }}
                                        style={{
                                            padding: '10px 12px',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid var(--glass-border)',
                                            fontSize: '13px'
                                        }}
                                    >
                                        <div style={{ fontWeight: 500 }}>{part.name}</div>
                                        <div style={{ fontSize: '11px', color: '#888' }}>{part.sku} · {formatCurrency(part.price_cny)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {selectedPart && (
                        <>
                            <div style={{
                                padding: '10px 12px',
                                background: 'rgba(255,215,0,0.1)',
                                borderRadius: '6px',
                                marginBottom: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '13px' }}>{selectedPart.name}</div>
                                    <div style={{ fontSize: '11px', color: '#888' }}>{selectedPart.sku}</div>
                                </div>
                                <button
                                    onClick={() => setSelectedPart(null)}
                                    style={{
                                        padding: '4px 8px',
                                        background: 'rgba(239,68,68,0.2)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '11px',
                                        color: '#EF4444',
                                        cursor: 'pointer'
                                    }}
                                >
                                    更换
                                </button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'block' }}>数量</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={quantity}
                                        onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            color: '#fff'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'block' }}>来源</label>
                                    <select
                                        value={sourceType}
                                        onChange={(e) => setSourceType(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            color: '#fff'
                                        }}
                                    >
                                        <option value="hq_inventory">总部库存</option>
                                        {dealerId && <option value="dealer_inventory">经销商库存</option>}
                                        <option value="external_purchase">外部采购</option>
                                        {isWarranty && <option value="warranty_free">保修免费</option>}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '12px' }}>
                                <label style={{ fontSize: '12px', color: '#888', marginBottom: '4px', display: 'block' }}>备注</label>
                                <input
                                    type="text"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="可选：添加备注信息"
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        color: '#fff'
                                    }}
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: '#3B82F6',
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    opacity: submitting ? 0.7 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                确认添加
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Consumptions List */}
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: '#888' }} />
                    </div>
                ) : consumptions.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                        <Package size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                        <p style={{ fontSize: '13px' }}>暂无配件使用记录</p>
                    </div>
                ) : (
                    consumptions.map((consumption) => (
                        <div
                            key={consumption.id}
                            style={{
                                padding: '14px 20px',
                                borderBottom: '1px solid var(--glass-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start'
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                    <span style={{ fontWeight: 500, fontSize: '14px' }}>{consumption.part_name}</span>
                                    <span style={{
                                        padding: '2px 6px',
                                        background: `${sourceTypeMap[consumption.source_type]?.color}20`,
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        color: sourceTypeMap[consumption.source_type]?.color
                                    }}>
                                        {sourceTypeMap[consumption.source_type]?.label}
                                    </span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
                                    {consumption.part_sku} · {consumption.part_category}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
                                    <span style={{ color: '#FFD700' }}>x{consumption.quantity}</span>
                                    <span style={{ color: '#10B981', fontFamily: 'monospace' }}>
                                        {formatCurrency(consumption.total_price_cny)}
                                    </span>
                                    <span style={{
                                        padding: '1px 6px',
                                        background: `${settlementStatusMap[consumption.settlement_status]?.color}20`,
                                        borderRadius: '4px',
                                        fontSize: '10px',
                                        color: settlementStatusMap[consumption.settlement_status]?.color
                                    }}>
                                        {settlementStatusMap[consumption.settlement_status]?.label}
                                    </span>
                                </div>
                                {consumption.notes && (
                                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                                        备注: {consumption.notes}
                                    </div>
                                )}
                            </div>
                            {isAdmin && consumption.settlement_status === 'pending' && (
                                <button
                                    onClick={() => handleDelete(consumption)}
                                    style={{
                                        padding: '6px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        color: '#EF4444'
                                    }}
                                    title="删除"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default TicketPartsPanel;
