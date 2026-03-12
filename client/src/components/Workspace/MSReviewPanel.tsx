import React, { useState, useEffect } from 'react';
import { X, Calculator, CheckCircle, AlertTriangle, DollarSign, FileText, Loader2, Save, Shield } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface MSReviewPanelProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    onSuccess: () => void;
}

interface WarrantyCalculation {
    start_date: string;
    end_date: string;
    calculation_basis: string;
    is_in_warranty: boolean;
    is_damage_void_warranty: boolean;
    final_warranty_status: 'warranty_valid' | 'warranty_void_damage' | 'warranty_expired';
}

interface TechnicalAssessment {
    technical_damage_status: string;
    technical_warranty_suggestion: string;
}

export const MSReviewPanel: React.FC<MSReviewPanelProps> = ({ isOpen, onClose, ticketId, ticketNumber, onSuccess }) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);

    // Warranty calculation result
    const [warrantyCalc, setWarrantyCalc] = useState<WarrantyCalculation | null>(null);
    const [technicalAssessment, setTechnicalAssessment] = useState<TechnicalAssessment | null>(null);

    // MS review form
    const [estimatedMin, setEstimatedMin] = useState('');
    const [estimatedMax, setEstimatedMax] = useState('');
    const [confirmationMethod, setConfirmationMethod] = useState<'email' | 'pi_preview' | 'phone_screenshot' | ''>('');
    const [customerConfirmed, setCustomerConfirmed] = useState(false);
    const [showCalculationDetails, setShowCalculationDetails] = useState(false);

    useEffect(() => {
        if (isOpen && ticketId) {
            fetchWarrantyData();
        }
    }, [isOpen, ticketId]);

    // Auto-calculate warranty when panel opens and no calculation exists
    useEffect(() => {
        if (isOpen && ticketId && !warrantyCalc && !calculating) {
            calculateWarranty();
        }
    }, [isOpen, ticketId, warrantyCalc, calculating]);

    const fetchWarrantyData = async () => {
        try {
            const res = await axios.get(`/api/v1/warranty/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setTechnicalAssessment({
                    technical_damage_status: res.data.data.technical_damage_status,
                    technical_warranty_suggestion: res.data.data.technical_warranty_suggestion
                });
                if (res.data.data.warranty_calculation) {
                    setWarrantyCalc(res.data.data.warranty_calculation);
                }
            }
        } catch (err) {
            console.error('Failed to fetch warranty data:', err);
        }
    };

    const calculateWarranty = async () => {
        setCalculating(true);
        try {
            const res = await axios.post('/api/v1/warranty/calculate', {
                ticket_id: ticketId,
                technical_damage_status: technicalAssessment?.technical_damage_status || 'no_damage'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setWarrantyCalc(res.data.data);
                // Save calculation to ticket
                await axios.post(`/api/v1/warranty/${ticketId}/save`, {
                    warranty_calculation: res.data.data
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
        } catch (err: any) {
            alert(err.response?.data?.error || '保修计算失败');
        } finally {
            setCalculating(false);
        }
    };

    const handleSubmit = async () => {
        if (!warrantyCalc) {
            alert('请先执行保修计算');
            return;
        }
        // Only require estimated cost for out-of-warranty cases
        if (warrantyCalc.final_warranty_status !== 'warranty_valid' && (!estimatedMin || !estimatedMax)) {
            alert('请填写预估费用范围');
            return;
        }
        if (!confirmationMethod) {
            alert('请选择客户确认方式');
            return;
        }

        setLoading(true);
        try {
            // Build ms_review data, ensuring valid numbers for estimated costs
            const msReviewData: any = {
                customer_confirmation_method: confirmationMethod,
                customer_confirmed: customerConfirmed,
                confirmed_at: customerConfirmed ? new Date().toISOString() : null
            };

            // Only include estimated costs if they have values
            if (estimatedMin && estimatedMin !== '') {
                msReviewData.estimated_cost_min = parseFloat(estimatedMin);
            }
            if (estimatedMax && estimatedMax !== '') {
                msReviewData.estimated_cost_max = parseFloat(estimatedMax);
            }

            // Save MS review data
            await axios.patch(`/api/v1/tickets/${ticketId}`, {
                ms_review: msReviewData,
                // If customer confirmed, proceed to repair
                current_node: customerConfirmed ? 'op_repairing' : 'ms_review',
                change_reason: customerConfirmed
                    ? '客户确认维修费用，流向维修执行'
                    : '完成商务审核，等待客户确认'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const getBasisText = (basis: string) => {
        const map: Record<string, string> = {
            'iot_activation': 'IoT激活日期',
            'invoice': '销售发票日期',
            'registration': '官网注册日期',
            'direct_ship': '直销发货日期+7天',
            'dealer_fallback': '经销商发货日期+90天',
            'damage_void': '人为损坏（保修失效）',
            'ticket_created': '保修依据缺失',
            'unknown': '保修依据缺失'
        };
        return map[basis] || basis;
    };

    const getDamageStatusText = (status: string) => {
        const map: Record<string, string> = {
            'no_damage': '无人为损坏 / 正常故障',
            'physical_damage': '人为损坏 / 物理损伤',
            'uncertain': '无法判定'
        };
        return map[status] || status;
    };

    const getSuggestionText = (suggestion: string) => {
        const map: Record<string, string> = {
            'suggest_in_warranty': '建议保内',
            'suggest_out_warranty': '建议保外',
            'needs_verification': '需进一步核实'
        };
        return map[suggestion] || suggestion || '未填写';
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 700, background: '#1c1c1e', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255, 210, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Calculator size={20} color="#FFD200" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>商务审核 - 保修计算</h3>
                            <p style={{ margin: 0, fontSize: 12, color: '#888', marginTop: 4 }}>工单 {ticketNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* OP Technical Assessment */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#aaa', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={16} /> OP 技术判定（参考）
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>技术损坏判定</div>
                                <div style={{ fontSize: 14, color: '#fff' }}>
                                    {technicalAssessment?.technical_damage_status
                                        ? getDamageStatusText(technicalAssessment.technical_damage_status)
                                        : '未提交'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>保修建议</div>
                                <div style={{ fontSize: 14, color: '#fff' }}>
                                    {getSuggestionText(technicalAssessment?.technical_warranty_suggestion || '')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Warranty Calculation Result */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h4 style={{ margin: 0, fontSize: 14, color: '#aaa', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calculator size={16} /> 保修计算结果
                            </h4>
                            {warrantyCalc && (
                                <button
                                    onClick={() => setShowCalculationDetails(true)}
                                    style={{
                                        padding: '6px 12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6,
                                        color: '#aaa', fontSize: 12, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 6
                                    }}
                                >
                                    <Calculator size={14} />
                                    查看如何计算
                                </button>
                            )}
                        </div>

                        {warrantyCalc ? (
                            <div style={{
                                padding: 20,
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: 12,
                                border: `2px solid ${warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{
                                        width: 50,
                                        height: 50,
                                        borderRadius: '50%',
                                        background: `${warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444'}20`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 16
                                    }}>
                                        <Shield size={24} color={warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444'} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444' }}>
                                            {warrantyCalc.final_warranty_status === 'warranty_valid' ? '在保' : '过保'}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#aaa', marginTop: 4 }}>
                                            截止日期: {warrantyCalc.end_date}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase' }}>计算依据</div>
                                    <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 500, marginTop: 4 }}>
                                        {getBasisText(warrantyCalc.calculation_basis)}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 20, color: '#666', fontSize: 14 }}>
                                点击"执行计算"按钮获取保修计算结果
                            </div>
                        )}
                    </div>

                    {/* Cost Estimation (Always shown, optional for warranty cases) */}
                    {warrantyCalc && (
                        <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#aaa', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <DollarSign size={16} /> 预估维修费用
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>
                                        预估最低费用 (¥)
                                        {warrantyCalc.final_warranty_status === 'warranty_valid' && <span style={{ color: '#666', marginLeft: 4 }}>(可选)</span>}
                                    </label>
                                    <input
                                        type="number"
                                        value={estimatedMin}
                                        onChange={e => setEstimatedMin(e.target.value)}
                                        placeholder={warrantyCalc.final_warranty_status === 'warranty_valid' ? '保内免费' : '0.00'}
                                        style={{
                                            width: '100%', padding: 10, background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff',
                                            fontSize: 14, outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>
                                        预估最高费用 (¥)
                                        {warrantyCalc.final_warranty_status === 'warranty_valid' && <span style={{ color: '#666', marginLeft: 4 }}>(可选)</span>}
                                    </label>
                                    <input
                                        type="number"
                                        value={estimatedMax}
                                        onChange={e => setEstimatedMax(e.target.value)}
                                        placeholder={warrantyCalc.final_warranty_status === 'warranty_valid' ? '保内免费' : '0.00'}
                                        style={{
                                            width: '100%', padding: 10, background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff',
                                            fontSize: 14, outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#666' }}>
                                {warrantyCalc.final_warranty_status === 'warranty_valid'
                                    ? '* 保内维修免费，填写预估费用仅用于与客户沟通参考'
                                    : '* 此为预估费用，实际费用将在维修完成后根据实际备件和工时计算'}
                            </div>
                        </div>
                    )}

                    {/* Customer Confirmation */}
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#aaa' }}>客户确认方式</h4>
                        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                            {[
                                { key: 'email', label: '邮件确认' },
                                { key: 'pi_preview', label: 'PI预览确认' },
                                { key: 'phone_screenshot', label: '电话确认（截图）' }
                            ].map(method => (
                                <button
                                    key={method.key}
                                    onClick={() => setConfirmationMethod(method.key as any)}
                                    style={{
                                        flex: 1, padding: '10px', background: confirmationMethod === method.key ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${confirmationMethod === method.key ? '#3B82F6' : 'rgba(255,255,255,0.1)'}`,
                                        color: confirmationMethod === method.key ? '#3B82F6' : '#fff', borderRadius: 8, cursor: 'pointer',
                                        fontSize: 13, fontWeight: confirmationMethod === method.key ? 600 : 400
                                    }}
                                >
                                    {method.label}
                                </button>
                            ))}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={customerConfirmed}
                                onChange={e => setCustomerConfirmed(e.target.checked)}
                                style={{ width: 18, height: 18 }}
                            />
                            <span style={{ fontSize: 14, color: '#fff' }}>客户已确认维修</span>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'rgba(0,0,0,0.2)' }}>
                    <button onClick={onClose} disabled={loading} style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: 8 }}>取消</button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !warrantyCalc}
                        style={{
                            padding: '10px 24px', background: '#FFD200',
                            border: 'none', color: '#000', borderRadius: 8, fontWeight: 700,
                            cursor: loading || !warrantyCalc ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                            opacity: loading || !warrantyCalc ? 0.7 : 1
                        }}
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {customerConfirmed ? '确认并流转至维修' : '保存审核结果'}
                    </button>
                </div>
            </div>

            {/* Calculation Details Modal */}
            {showCalculationDetails && warrantyCalc && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1100,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setShowCalculationDetails(false)}>
                    <div style={{
                        width: 500, background: '#1c1c1e', borderRadius: 16,
                        border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                        boxShadow: '0 30px 60px rgba(0,0,0,0.6)', padding: 24
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>保修计算说明</h3>
                            <button onClick={() => setShowCalculationDetails(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Rules Section */}
                            <div style={{ padding: '0 4px' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#aaa', fontWeight: 600 }}>保修计算说明</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#888' }}>
                                    {[
                                        { p: 1, basis: 'IOT_ACTIVATION', label: 'IoT', detail: '联网激活日期' },
                                        { p: 2, basis: 'INVOICE_PROOF', label: '发票', detail: '人工发票日期' },
                                        { p: 3, basis: 'REGISTRATION', label: '注册', detail: '用户注册日期' },
                                        { p: 4, basis: 'DIRECT_SHIPMENT', label: '直销', detail: '直销出库+7天' },
                                        { p: 5, basis: 'DEALER_FALLBACK', label: '兜底', detail: '代理发货+90天' }
                                    ].map((rule) => {
                                        const isActive = warrantyCalc?.calculation_basis?.toUpperCase() === rule.basis;
                                        return (
                                            <div key={rule.p} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                padding: '6px 10px',
                                                background: isActive ? 'rgba(255, 210, 0, 0.1)' : 'rgba(255,255,255,0.02)',
                                                borderRadius: 6,
                                                border: isActive ? '1px solid rgba(255, 210, 0, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                                                gridColumn: rule.p === 5 ? 'span 2' : 'auto'
                                            }}>
                                                <span style={{ color: isActive ? '#FFD200' : '#888', fontWeight: 700 }}>{rule.p}.</span>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ color: isActive ? '#fff' : '#ccc', fontWeight: 600 }}>{rule.label}</span>
                                                    <span style={{ fontSize: 11, opacity: 0.7 }}>{rule.detail}</span>
                                                </div>
                                                {isActive && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFD200' }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '4px 0' }} />

                            {/* Result Section */}
                            <div style={{
                                padding: 16, borderRadius: 12,
                                background: warrantyCalc.final_warranty_status === 'warranty_valid' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                border: `1px solid ${warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444'}`,
                                display: 'flex', flexDirection: 'column', gap: 12
                            }}>
                                <h4 style={{ margin: 0, fontSize: 12, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444', opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>本机计算结果</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {warrantyCalc.final_warranty_status === 'warranty_valid'
                                        ? <CheckCircle size={22} color="#10B981" />
                                        : <AlertTriangle size={22} color="#EF4444" />}
                                    <span style={{ fontSize: 15, fontWeight: 600, color: warrantyCalc.final_warranty_status === 'warranty_valid' ? '#10B981' : '#EF4444' }}>
                                        {warrantyCalc.final_warranty_status === 'warranty_valid' ? '在保期内 - 免费维修' : '已过保 - 付费维修'}
                                    </span>
                                </div>
                                <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
                                    {[
                                        { label: '生效日期', value: warrantyCalc.start_date || '-' },
                                        { label: '截止日期', value: warrantyCalc.end_date || '-' },
                                        { label: '计算依据', value: getBasisText(warrantyCalc.calculation_basis) || '-', fullWidth: true }
                                    ].map((item, idx) => (
                                        <div key={idx} style={{ gridColumn: item.fullWidth ? '1/-1' : 'span 1' }}>
                                            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{item.label}</div>
                                            <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div >
                </div >
            )}
        </div >
    );
};
