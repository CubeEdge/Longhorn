import React, { useState, useEffect } from 'react';
import { X, Calculator, CheckCircle, AlertTriangle, DollarSign, FileText, Loader2, Save, Shield, ShieldAlert, ShieldX } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

// 保修商务决策矩阵颜色常量
const WARRANTY_COLORS = {
    warranty_valid: '#10B981',      // Kine Green - 在保免费
    warranty_void_damage: '#F59E0B', // Kine Amber - 在保收费（人为损坏）
    warranty_expired: '#EF4444'      // Kine Red - 过保收费
};

// 获取保修状态对应的颜色
const getWarrantyColor = (status: string): string => {
    return WARRANTY_COLORS[status as keyof typeof WARRANTY_COLORS] || WARRANTY_COLORS.warranty_expired;
};

// 判断是否需要收费（用于必填校验）
const isChargeRequired = (status: string): boolean => {
    return status === 'warranty_void_damage' || status === 'warranty_expired';
};

interface MSReviewPanelProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    onSuccess: () => void;
    currentNode?: string;  // 用于检测是否为更正模式
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

export const MSReviewPanel: React.FC<MSReviewPanelProps> = ({ isOpen, onClose, ticketId, ticketNumber, onSuccess, currentNode }) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [calculating, setCalculating] = useState(false);

    // 检测是否为更正模式（工单已经不在 ms_review 节点）
    const isCorrectMode = currentNode && currentNode !== 'ms_review';

    // Warranty calculation result
    const [warrantyCalc, setWarrantyCalc] = useState<WarrantyCalculation | null>(null);
    const [technicalAssessment, setTechnicalAssessment] = useState<TechnicalAssessment | null>(null);

    // MS 商务判定（双层决策：系统计算 + MS 覆盖）
    const [msDecision, setMsDecision] = useState<'warranty_valid' | 'warranty_void_damage' | 'warranty_expired' | ''>('');
    const [msDecisionRemark, setMsDecisionRemark] = useState('');
    const [isDecisionManuallyChanged, setIsDecisionManuallyChanged] = useState(false);
    const [recommendedDecision, setRecommendedDecision] = useState<'warranty_valid' | 'warranty_void_damage' | 'warranty_expired' | ''>('');

    // MS review form
    const [estimatedMin, setEstimatedMin] = useState('');
    const [estimatedMax, setEstimatedMax] = useState('');
    const [confirmationMethod, setConfirmationMethod] = useState<'email' | 'pi_preview' | 'phone_screenshot' | ''>('');
    const [customerConfirmed, setCustomerConfirmed] = useState(false);
    const [showCalculationDetails, setShowCalculationDetails] = useState(false);
    const [hasLoadedExisting, setHasLoadedExisting] = useState(false);  // 标记是否已加载已保存数据

    useEffect(() => {
        if (isOpen && ticketId) {
            fetchWarrantyData();
            fetchExistingMSReview();  // 预加载已保存的商务审核数据
        }
        // 面板关闭时重置加载标志
        if (!isOpen) {
            setHasLoadedExisting(false);
        }
    }, [isOpen, ticketId]);

    // Auto-calculate warranty when panel opens and no calculation exists
    useEffect(() => {
        if (isOpen && ticketId && !warrantyCalc && !calculating) {
            calculateWarranty();
        }
    }, [isOpen, ticketId, warrantyCalc, calculating]);

    // 自动推荐逻辑：根据时间计算 + OP 建议 → 初始商务判定
    useEffect(() => {
        if (!warrantyCalc) return;
        
        const timeStatus = warrantyCalc.is_in_warranty ? 'in_warranty' : 'expired';
        const opSuggestion = technicalAssessment?.technical_warranty_suggestion || '';
        
        let recommended: 'warranty_valid' | 'warranty_void_damage' | 'warranty_expired';
        
        if (timeStatus === 'expired') {
            // 过保 → 固定为过保收费，不可更改
            recommended = 'warranty_expired';
        } else {
            // 在保 + OP 建议 → 决定是否收费
            if (opSuggestion === 'suggest_out_warranty' || opSuggestion === 'needs_verification') {
                // OP 建议保外或不确定 → 推荐在保收费
                recommended = 'warranty_void_damage';
            } else {
                // OP 建议保内或未填写 → 推荐在保免费
                recommended = 'warranty_valid';
            }
        }
        
        setRecommendedDecision(recommended);
        
        // 如果 MS 还没手动选择，且没有已保存的数据，则自动设置为推荐值
        if (!msDecision && !hasLoadedExisting) {
            setMsDecision(recommended);
        }
    }, [warrantyCalc, technicalAssessment, hasLoadedExisting]);

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

    // 预加载已保存的商务审核数据
    const fetchExistingMSReview = async () => {
        try {
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success && res.data.data.ms_review) {
                const msReview = typeof res.data.data.ms_review === 'string' 
                    ? JSON.parse(res.data.data.ms_review) 
                    : res.data.data.ms_review;
                
                // 预填表单字段
                if (msReview.final_decision) {
                    setMsDecision(msReview.final_decision);
                    setIsDecisionManuallyChanged(msReview.decision_manually_changed || false);
                    setMsDecisionRemark(msReview.decision_remark || '');
                    setHasLoadedExisting(true);  // 标记已加载已保存数据
                }
                if (msReview.estimated_cost_min !== undefined) {
                    setEstimatedMin(String(msReview.estimated_cost_min));
                }
                if (msReview.estimated_cost_max !== undefined) {
                    setEstimatedMax(String(msReview.estimated_cost_max));
                }
                if (msReview.customer_confirmation_method) {
                    setConfirmationMethod(msReview.customer_confirmation_method);
                }
                if (msReview.customer_confirmed !== undefined) {
                    setCustomerConfirmed(msReview.customer_confirmed);
                }
            }
        } catch (err) {
            console.error('Failed to fetch existing MS review:', err);
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
        if (!msDecision) {
            alert('请选择商务判定结论');
            return;
        }
        // 收费场景（在保收费或过保）必须填写预估费用
        if (isChargeRequired(msDecision) && (!estimatedMin || !estimatedMax)) {
            const scenario = msDecision === 'warranty_void_damage' 
                ? '在保收费工单' 
                : '过保工单';
            alert(`${scenario}必须填写预估费用范围`);
            return;
        }
        // 如果手动调整了判定，必须填写备注
        if (isDecisionManuallyChanged && !msDecisionRemark.trim()) {
            alert('手动调整商务判定时必须填写调整原因');
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
                confirmed_at: customerConfirmed ? new Date().toISOString() : null,
                // 新增：MS 商务判定
                final_decision: msDecision,
                decision_remark: isDecisionManuallyChanged ? msDecisionRemark : '',
                decision_manually_changed: isDecisionManuallyChanged,
                recommended_decision: recommendedDecision
            };

            // Only include estimated costs if they have values
            if (estimatedMin && estimatedMin !== '') {
                msReviewData.estimated_cost_min = parseFloat(estimatedMin);
            }
            if (estimatedMax && estimatedMax !== '') {
                msReviewData.estimated_cost_max = parseFloat(estimatedMax);
            }

            // 更新 warranty_calculation 的 final_warranty_status 为 MS 的最终判定
            const updatedWarrantyCalc = {
                ...warrantyCalc,
                final_warranty_status: msDecision,
                ms_override: isDecisionManuallyChanged,
                ms_override_remark: isDecisionManuallyChanged ? msDecisionRemark : ''
            };

            // Save MS review data
            const patchData: any = {
                ms_review: msReviewData,
                warranty_calculation: updatedWarrantyCalc,
                change_reason: isCorrectMode 
                    ? '更正了商务审核信息'
                    : (customerConfirmed ? '客户确认维修费用，流向维修执行' : '完成商务审核，等待客户确认')
            };
            
            // 更正模式下添加 is_modal_edit 标记以记录 field_update 活动
            if (isCorrectMode) {
                patchData.is_modal_edit = true;
            }
            
            // 只有在非更正模式时才修改 current_node
            if (!isCorrectMode) {
                patchData.current_node = customerConfirmed ? 'op_repairing' : 'ms_review';
            }
            
            await axios.patch(`/api/v1/tickets/${ticketId}`, patchData, {
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
            'registration': '人工注册日期',
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
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 700, background: 'var(--modal-bg, #1c1c1e)', borderRadius: 20,
                border: '1px solid var(--glass-border)', overflow: 'hidden',
                boxShadow: 'var(--glass-shadow-lg, 0 30px 60px rgba(0,0,0,0.6))',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--glass-bg-light)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255, 210, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Calculator size={20} color="#FFD200" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>商务审核 - 保修计算</h3>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>工单 {ticketNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* OP Technical Assessment */}
                    <div style={{ background: 'var(--glass-bg-light)', padding: 16, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={16} /> OP 技术判定（参考）
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>技术损坏判定</div>
                                <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>
                                    {technicalAssessment?.technical_damage_status
                                        ? getDamageStatusText(technicalAssessment.technical_damage_status)
                                        : '未提交'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>保修建议</div>
                                <div style={{ fontSize: 14, color: 'var(--text-main)', fontWeight: 500 }}>
                                    {getSuggestionText(technicalAssessment?.technical_warranty_suggestion || '')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Warranty Calculation Result - 时间维度计算 */}
                    <div style={{ background: 'var(--glass-bg-light)', padding: 16, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <h4 style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calculator size={16} /> 保修计算结果（时间维度）
                            </h4>
                            {warrantyCalc && (
                                <button
                                    onClick={() => setShowCalculationDetails(true)}
                                    style={{
                                        padding: '6px 12px', background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', borderRadius: 6,
                                        color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
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
                                padding: 16,
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: 12,
                                border: `1px solid ${warrantyCalc.is_in_warranty ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: warrantyCalc.is_in_warranty ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginRight: 12
                                    }}>
                                        {warrantyCalc.is_in_warranty 
                                            ? <Shield size={20} color="#10B981" />
                                            : <ShieldX size={20} color="#EF4444" />
                                        }
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '1rem', fontWeight: 600, color: warrantyCalc.is_in_warranty ? '#10B981' : '#EF4444' }}>
                                            {warrantyCalc.is_in_warranty ? '在保修期内' : '已过保修期'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                                            截止: {warrantyCalc.end_date} · {getBasisText(warrantyCalc.calculation_basis)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: 20, color: '#666', fontSize: 14 }}>
                                点击"执行计算"按钮获取保修计算结果
                            </div>
                        )}
                    </div>

                    {/* MS 商务判定选择器 */}
                    {warrantyCalc && (
                        <div style={{ 
                            background: 'var(--glass-bg-light)', 
                            padding: 16, 
                            borderRadius: 12, 
                            border: `2px solid ${msDecision ? getWarrantyColor(msDecision) : 'var(--glass-border)'}` 
                        }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileText size={16} /> 商务判定（MS 最终决定）
                                {recommendedDecision && msDecision === recommendedDecision && (
                                    <span style={{ 
                                        fontSize: 11, 
                                        color: '#3B82F6',
                                        background: 'rgba(59,130,246,0.15)',
                                        padding: '2px 8px', 
                                        borderRadius: 4
                                    }}>
                                        系统推荐
                                    </span>
                                )}
                                {isDecisionManuallyChanged && (
                                    <span style={{ 
                                        fontSize: 11, 
                                        color: '#F59E0B',
                                        background: 'rgba(245,158,11,0.15)',
                                        padding: '2px 8px', 
                                        borderRadius: 4
                                    }}>
                                        已手动调整
                                    </span>
                                )}
                            </h4>

                            {/* OP 建议提示 */}
                            {technicalAssessment?.technical_warranty_suggestion && (
                                <div style={{ 
                                    fontSize: 12, 
                                    color: technicalAssessment.technical_warranty_suggestion === 'suggest_out_warranty' ? '#F59E0B' : '#888',
                                    marginBottom: 12,
                                    padding: '8px 12px',
                                    background: technicalAssessment.technical_warranty_suggestion === 'suggest_out_warranty' 
                                        ? 'rgba(245,158,11,0.1)' 
                                        : 'rgba(255,255,255,0.02)',
                                    borderRadius: 8,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                }}>
                                    <AlertTriangle size={14} />
                                    OP 建议: {getSuggestionText(technicalAssessment.technical_warranty_suggestion)}
                                    {technicalAssessment.technical_warranty_suggestion === 'suggest_out_warranty' && ' → 系统推荐"在保收费"'}
                                </div>
                            )}

                            {/* 判定选项 */}
                            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                {/* 在保免费 */}
                                <button
                                    onClick={() => {
                                        if (warrantyCalc.is_in_warranty) {
                                            const changed = recommendedDecision !== 'warranty_valid';
                                            setMsDecision('warranty_valid');
                                            setIsDecisionManuallyChanged(changed);
                                            if (!changed) setMsDecisionRemark('');
                                        }
                                    }}
                                    disabled={!warrantyCalc.is_in_warranty}
                                    style={{
                                        flex: 1, padding: '14px', borderRadius: 10,
                                        border: `2px solid ${msDecision === 'warranty_valid' ? '#10B981' : 'var(--glass-border)'}`,
                                        background: msDecision === 'warranty_valid' ? 'rgba(16,185,129,0.1)' : 'var(--glass-bg-light)',
                                        color: msDecision === 'warranty_valid' ? '#10B981' : 'var(--text-main)',
                                        cursor: warrantyCalc.is_in_warranty ? 'pointer' : 'not-allowed',
                                        opacity: warrantyCalc.is_in_warranty ? 1 : 0.4,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Shield size={24} />
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>在保免费</span>
                                    {recommendedDecision === 'warranty_valid' && (
                                        <span style={{ fontSize: 10, opacity: 0.7 }}>推荐</span>
                                    )}
                                </button>

                                {/* 在保收费 */}
                                <button
                                    onClick={() => {
                                        if (warrantyCalc.is_in_warranty) {
                                            const changed = recommendedDecision !== 'warranty_void_damage';
                                            setMsDecision('warranty_void_damage');
                                            setIsDecisionManuallyChanged(changed);
                                            if (!changed) setMsDecisionRemark('');
                                        }
                                    }}
                                    disabled={!warrantyCalc.is_in_warranty}
                                    style={{
                                        flex: 1, padding: '14px', borderRadius: 10,
                                        border: `2px solid ${msDecision === 'warranty_void_damage' ? '#F59E0B' : 'var(--glass-border)'}`,
                                        background: msDecision === 'warranty_void_damage' ? 'rgba(245,158,11,0.1)' : 'var(--glass-bg-light)',
                                        color: msDecision === 'warranty_void_damage' ? '#F59E0B' : 'var(--text-main)',
                                        cursor: warrantyCalc.is_in_warranty ? 'pointer' : 'not-allowed',
                                        opacity: warrantyCalc.is_in_warranty ? 1 : 0.4,
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <ShieldAlert size={24} />
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>在保收费</span>
                                    {recommendedDecision === 'warranty_void_damage' && (
                                        <span style={{ fontSize: 10, opacity: 0.7 }}>推荐</span>
                                    )}
                                </button>
                            </div>

                            {/* 过保锁定提示 */}
                            {!warrantyCalc.is_in_warranty && (
                                <div style={{
                                    padding: 12,
                                    background: 'rgba(239,68,68,0.1)',
                                    borderRadius: 8,
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    marginBottom: 12
                                }}>
                                    <ShieldX size={18} color="#EF4444" />
                                    <span style={{ fontSize: 13, color: '#EF4444', fontWeight: 500 }}>
                                        已过保修期，固定为"过保收费"，无法调整
                                    </span>
                                </div>
                            )}

                            {/* 手动调整备注（仅当手动调整时显示） */}
                            {isDecisionManuallyChanged && (
                                <div style={{ marginTop: 12 }}>
                                    <label style={{ display: 'block', fontSize: 12, color: '#F59E0B', marginBottom: 6, fontWeight: 600 }}>
                                        调整原因 <span style={{ color: '#EF4444' }}>*</span>
                                    </label>
                                    <textarea
                                        value={msDecisionRemark}
                                        onChange={e => setMsDecisionRemark(e.target.value)}
                                        placeholder="请说明手动调整商务判定的原因..."
                                        rows={2}
                                        style={{
                                            width: '100%', padding: 10, background: 'var(--glass-bg-light)',
                                            border: msDecisionRemark.trim() ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(239,68,68,0.5)',
                                            borderRadius: 8, color: 'var(--text-main)', fontSize: 13, outline: 'none', resize: 'none'
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Cost Estimation (Always shown, optional for warranty cases) */}
                    {warrantyCalc && (
                        <div style={{ background: 'var(--glass-bg-light)', padding: 16, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <DollarSign size={16} /> 预估维修费用
                                {/* 收费场景增加必填提示 */}
                                {msDecision && isChargeRequired(msDecision) && (
                                    <span style={{ 
                                        fontSize: 11, 
                                        color: msDecision === 'warranty_void_damage' ? '#F59E0B' : '#EF4444',
                                        background: msDecision === 'warranty_void_damage' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
                                        padding: '2px 8px', 
                                        borderRadius: 4,
                                        marginLeft: 8
                                    }}>
                                        必填
                                    </span>
                                )}
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>
                                        预估最低费用 (¥)
                                        {msDecision && !isChargeRequired(msDecision) && <span style={{ color: '#666', marginLeft: 4 }}>(可选)</span>}
                                    </label>
                                    <input
                                        type="number"
                                        value={estimatedMin}
                                        onChange={e => setEstimatedMin(e.target.value)}
                                        placeholder={msDecision && !isChargeRequired(msDecision) ? '保内免费' : '0.00'}
                                        style={{
                                            width: '100%', padding: 10, background: 'var(--glass-bg-light)',
                                            border: `1px solid ${msDecision && isChargeRequired(msDecision) && !estimatedMin ? 'rgba(239,68,68,0.5)' : 'var(--glass-border)'}`, 
                                            borderRadius: 6, color: 'var(--text-main)',
                                            fontSize: 14, outline: 'none'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 12, color: '#666', marginBottom: 6 }}>
                                        预估最高费用 (¥)
                                        {msDecision && !isChargeRequired(msDecision) && <span style={{ color: '#666', marginLeft: 4 }}>(可选)</span>}
                                    </label>
                                    <input
                                        type="number"
                                        value={estimatedMax}
                                        onChange={e => setEstimatedMax(e.target.value)}
                                        placeholder={msDecision && !isChargeRequired(msDecision) ? '保内免费' : '0.00'}
                                        style={{
                                            width: '100%', padding: 10, background: 'var(--glass-bg-light)',
                                            border: `1px solid ${msDecision && isChargeRequired(msDecision) && !estimatedMax ? 'rgba(239,68,68,0.5)' : 'var(--glass-border)'}`, 
                                            borderRadius: 6, color: 'var(--text-main)',
                                            fontSize: 14, outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: msDecision === 'warranty_void_damage' ? '#F59E0B' : '#666' }}>
                                {msDecision === 'warranty_valid'
                                    ? '* 保内维修免费，填写预估费用仅用于与客户沟通参考'
                                    : msDecision === 'warranty_void_damage'
                                        ? '* 在保收费工单必须提供预估报价以供客户确认，否则无法流转'
                                        : '* 此为预估费用，实际费用将在维修完成后根据实际备件和工时计算'}
                            </div>
                        </div>
                    )}

                    {/* Customer Confirmation */}
                    <div style={{ background: 'var(--glass-bg-light)', padding: 16, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-secondary)' }}>客户确认方式</h4>
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
                                        flex: 1, padding: '10px', background: confirmationMethod === method.key ? 'rgba(59,130,246,0.15)' : 'var(--glass-bg-light)',
                                        border: `1px solid ${confirmationMethod === method.key ? '#3B82F6' : 'var(--glass-border)'}`,
                                        color: confirmationMethod === method.key ? '#3B82F6' : 'var(--text-main)', borderRadius: 8, cursor: 'pointer',
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
                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--glass-bg-light)' }}>
                    <button onClick={onClose} disabled={loading} style={{ padding: '10px 20px', background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', borderRadius: 8 }}>取消</button>
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
                                        { p: 3, basis: 'REGISTRATION', label: '注册', detail: '人工注册日期' },
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
                                background: `${getWarrantyColor(warrantyCalc.final_warranty_status)}15`,
                                border: `1px solid ${getWarrantyColor(warrantyCalc.final_warranty_status)}`,
                                display: 'flex', flexDirection: 'column', gap: 12
                            }}>
                                <h4 style={{ margin: 0, fontSize: 12, color: getWarrantyColor(warrantyCalc.final_warranty_status), opacity: 0.8, textTransform: 'uppercase', letterSpacing: 0.5 }}>本机计算结果</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    {warrantyCalc.final_warranty_status === 'warranty_valid' && <CheckCircle size={22} color={getWarrantyColor(warrantyCalc.final_warranty_status)} />}
                                    {warrantyCalc.final_warranty_status === 'warranty_void_damage' && <ShieldAlert size={22} color={getWarrantyColor(warrantyCalc.final_warranty_status)} />}
                                    {warrantyCalc.final_warranty_status === 'warranty_expired' && <AlertTriangle size={22} color={getWarrantyColor(warrantyCalc.final_warranty_status)} />}
                                    <span style={{ fontSize: 15, fontWeight: 600, color: getWarrantyColor(warrantyCalc.final_warranty_status) }}>
                                        {warrantyCalc.final_warranty_status === 'warranty_valid' 
                                            ? '在保期内 - 免费维修' 
                                            : warrantyCalc.final_warranty_status === 'warranty_void_damage'
                                                ? '在保期内 - 人为损坏需付费'
                                                : '已过保 - 付费维修'}
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
