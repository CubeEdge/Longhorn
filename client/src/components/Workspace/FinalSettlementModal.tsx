import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save, FileText, Loader2, Calculator, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface FinalSettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    onSuccess: () => void;
}

interface WarrantyCalculation {
    final_warranty_status: 'warranty_valid' | 'warranty_void_damage' | 'warranty_expired';
}

interface MSReviewData {
    estimated_cost_min?: number;
    estimated_cost_max?: number;
}

interface SettlementData {
    actual_parts_cost?: number;
    actual_labor_cost?: number;
    actual_other_cost?: number;
    final_pi_number?: string;
}

export const FinalSettlementModal: React.FC<FinalSettlementModalProps> = ({
    isOpen, onClose, ticketId, ticketNumber, onSuccess
}) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Data from previous stages
    const [warrantyCalc, setWarrantyCalc] = useState<WarrantyCalculation | null>(null);
    const [msReview, setMSReview] = useState<MSReviewData | null>(null);
    const [, setExistingSettlement] = useState<SettlementData | null>(null);

    // Form state
    const [partsCost, setPartsCost] = useState('');
    const [laborCost, setLaborCost] = useState('');
    const [otherCost, setOtherCost] = useState('');
    const [piNumber, setPiNumber] = useState('');

    useEffect(() => {
        if (isOpen && ticketId) {
            fetchData();
        }
    }, [isOpen, ticketId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const ticket = res.data.data;

                // Parse warranty calculation
                if (ticket.warranty_calculation) {
                    try {
                        setWarrantyCalc(JSON.parse(ticket.warranty_calculation));
                    } catch (e) {
                        console.error('Failed to parse warranty_calculation:', e);
                    }
                }

                // Parse MS review data
                if (ticket.ms_review) {
                    try {
                        setMSReview(JSON.parse(ticket.ms_review));
                    } catch (e) {
                        console.error('Failed to parse ms_review:', e);
                    }
                }

                // Parse existing settlement
                if (ticket.final_settlement) {
                    try {
                        const settlement = JSON.parse(ticket.final_settlement);
                        setExistingSettlement(settlement);
                        setPartsCost(settlement.actual_parts_cost?.toString() || '');
                        setLaborCost(settlement.actual_labor_cost?.toString() || '');
                        setOtherCost(settlement.actual_other_cost?.toString() || '');
                        setPiNumber(settlement.final_pi_number || '');
                    } catch (e) {
                        console.error('Failed to parse final_settlement:', e);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch ticket data:', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotal = () => {
        const parts = parseFloat(partsCost) || 0;
        const labor = parseFloat(laborCost) || 0;
        const other = parseFloat(otherCost) || 0;
        return parts + labor + other;
    };

    const handleSubmit = async () => {
        // Validation
        if (warrantyCalc?.final_warranty_status !== 'warranty_valid') {
            // For non-warranty cases, PI number is required
            if (!piNumber.trim()) {
                alert('保外维修需要填写 PI 号');
                return;
            }
        }

        setSaving(true);
        try {
            const settlementData = {
                actual_parts_cost: parseFloat(partsCost) || 0,
                actual_labor_cost: parseFloat(laborCost) || 0,
                actual_other_cost: parseFloat(otherCost) || 0,
                actual_total_cost: calculateTotal(),
                final_pi_number: piNumber || null,
                final_pi_generated_at: new Date().toISOString()
            };

            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                final_settlement: settlementData,
                current_node: 'op_shipping',
                change_reason: '完成费用结算，流转至发货'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const isWarranty = warrantyCalc?.final_warranty_status === 'warranty_valid';
    const totalCost = calculateTotal();

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 600, background: 'var(--modal-bg)', borderRadius: 16,
                border: '1px solid var(--modal-border)', overflow: 'hidden',
                boxShadow: 'var(--glass-shadow-lg)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign size={20} color="#10B981" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>最终费用结算</h3>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>工单 {ticketNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 16px' }} />
                            加载中...
                        </div>
                    ) : (
                        <>
                            {/* Warranty Status Summary */}
                            <div style={{
                                padding: 16, borderRadius: 12,
                                background: isWarranty ? 'var(--accent-green-subtle)' : 'var(--accent-gold-subtle)',
                                border: `1px solid ${isWarranty ? 'var(--accent-green)' : 'var(--accent-gold)'}`
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <CheckCircle size={20} color={isWarranty ? '#10B981' : '#FFD200'} />
                                    <span style={{ fontSize: 16, fontWeight: 600, color: isWarranty ? '#10B981' : '#FFD200' }}>
                                        {isWarranty ? '✅ 保内维修 - 免费' : '⚠️ 保外维修 - 付费'}
                                    </span>
                                </div>
                                {!isWarranty && msReview && (
                                    <div style={{ fontSize: 13, color: '#aaa' }}>
                                        预估费用范围：¥{msReview.estimated_cost_min || 0} ~ ¥{msReview.estimated_cost_max || 0}
                                    </div>
                                )}
                            </div>

                            {/* Cost Input Form */}
                            <div style={{ background: 'var(--glass-bg-light)', padding: 16, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Calculator size={16} /> 实际维修费用
                                </h4>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>备件费用 (¥)</label>
                                        <input
                                            type="number"
                                            value={partsCost}
                                            onChange={e => setPartsCost(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isWarranty}
                                            style={{
                                                width: '100%', padding: 10, background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)',
                                                fontSize: 14, outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>工时费用 (¥)</label>
                                        <input
                                            type="number"
                                            value={laborCost}
                                            onChange={e => setLaborCost(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isWarranty}
                                            style={{
                                                width: '100%', padding: 10, background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)',
                                                fontSize: 14, outline: 'none'
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>其他费用 (¥)</label>
                                        <input
                                            type="number"
                                            value={otherCost}
                                            onChange={e => setOtherCost(e.target.value)}
                                            placeholder="0.00"
                                            disabled={isWarranty}
                                            style={{
                                                width: '100%', padding: 10, background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)',
                                                fontSize: 14, outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Total */}
                                <div style={{
                                    marginTop: 16, padding: 12, borderRadius: 8,
                                    background: 'var(--accent-gold-subtle)', border: '1px solid var(--glass-border-accent)',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <span style={{ fontSize: 14, color: 'var(--accent-gold)', fontWeight: 600 }}>实际总费用</span>
                                    <span style={{ fontSize: 24, color: 'var(--accent-gold)', fontWeight: 700 }}>
                                        ¥{totalCost.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            {/* PI Number (for non-warranty only) */}
                            {!isWarranty && (
                                <div style={{ background: 'var(--glass-bg-light)', padding: 16, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <FileText size={16} /> PI 信息
                                    </h4>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>PI 编号 *</label>
                                        <input
                                            type="text"
                                            value={piNumber}
                                            onChange={e => setPiNumber(e.target.value)}
                                            placeholder="请输入PI编号"
                                            style={{
                                                width: '100%', padding: 10, background: 'var(--input-bg)',
                                                border: '1px solid var(--input-border)', borderRadius: 6, color: 'var(--text-main)',
                                                fontSize: 14, outline: 'none'
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Note for warranty case */}
                            {isWarranty && (
                                <div style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                    保内维修无需填写费用，系统将自动记录为免费
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--glass-bg-light)' }}>
                    <button onClick={onClose} disabled={saving} style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', borderRadius: 8 }}>取消</button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving || loading}
                        style={{
                            padding: '10px 24px', background: '#FFD700',
                            border: 'none', color: '#000', borderRadius: 8, fontWeight: 700,
                            cursor: saving || loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            opacity: saving || loading ? 0.7 : 1
                        }}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {isWarranty ? '确认并流转至发货' : '生成PI并流转至发货'}
                    </button>
                </div>
            </div>
        </div>
    );
};
