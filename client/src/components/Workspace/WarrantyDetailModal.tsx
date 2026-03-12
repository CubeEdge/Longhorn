import React, { useState, useEffect } from 'react';
import { X, Shield, AlertTriangle, CheckCircle, Calculator, FileText, Clock, Cpu, User, DollarSign } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface WarrantyDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
}

interface WarrantyCalculation {
    start_date: string;
    end_date: string;
    calculation_basis: string;
    is_in_warranty: boolean;
    is_damage_void_warranty: boolean;
    final_warranty_status: 'warranty_valid' | 'warranty_void_damage' | 'warranty_expired';
}

// TechnicalAssessment interface removed - not used in this component

interface MSReviewData {
    estimated_cost_min?: number;
    estimated_cost_max?: number;
    customer_confirmed?: boolean;
}

interface TicketData {
    serial_number?: string;
    product_name?: string;
    technical_damage_status?: string;
    technical_warranty_suggestion?: string;
    warranty_calculation?: string;
    ms_review?: string;
}

export const WarrantyDetailModal: React.FC<WarrantyDetailModalProps> = ({
    isOpen, onClose, ticketId, ticketNumber
}) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [warrantyCalc, setWarrantyCalc] = useState<WarrantyCalculation | null>(null);
    const [msReview, setMSReview] = useState<MSReviewData | null>(null);

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
                const data = res.data.data;
                setTicket(data);

                if (data.warranty_calculation) {
                    try {
                        setWarrantyCalc(JSON.parse(data.warranty_calculation));
                    } catch (e) {
                        console.error('Failed to parse warranty_calculation:', e);
                    }
                }

                if (data.ms_review) {
                    try {
                        setMSReview(JSON.parse(data.ms_review));
                    } catch (e) {
                        console.error('Failed to parse ms_review:', e);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch warranty data:', err);
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

    const getBasisIcon = (basis: string) => {
        if (basis === 'iot_activation') return <Cpu size={14} />;
        if (basis === 'invoice') return <FileText size={14} />;
        return <Clock size={14} />;
    };

    const getDamageStatusText = (status?: string) => {
        const map: Record<string, { text: string; color: string; bg: string }> = {
            'no_damage': { text: '无人为损坏 / 正常故障', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
            'physical_damage': { text: '人为损坏 / 物理损伤', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
            'uncertain': { text: '无法判定', color: '#FFD200', bg: 'rgba(245,158,11,0.15)' }
        };
        return map[status || ''] || { text: status || '未填写', color: '#888', bg: 'rgba(255,255,255,0.05)' };
    };

    const getSuggestionText = (suggestion?: string) => {
        const map: Record<string, string> = {
            'suggest_in_warranty': '建议保内',
            'suggest_out_warranty': '建议保外',
            'needs_verification': '需进一步核实'
        };
        return map[suggestion || ''] || '未填写';
    };

    const getStatusConfig = (status?: string) => {
        const configs: Record<string, { icon: React.ReactNode; title: string; color: string; bg: string; border: string }> = {
            'warranty_valid': {
                icon: <CheckCircle size={24} />,
                title: '✅ 在保期内 - 免费维修',
                color: '#10B981',
                bg: 'rgba(16,185,129,0.1)',
                border: 'rgba(16,185,129,0.3)'
            },
            'warranty_void_damage': {
                icon: <AlertTriangle size={24} />,
                title: '❌ 人为损坏 - 保修失效',
                color: '#EF4444',
                bg: 'rgba(239,68,68,0.1)',
                border: 'rgba(239,68,68,0.3)'
            },
            'warranty_expired': {
                icon: <AlertTriangle size={24} />,
                title: '⚠️ 已过保 - 付费维修',
                color: '#FFD200',
                bg: 'rgba(245,158,11,0.1)',
                border: 'rgba(245,158,11,0.3)'
            }
        };
        return configs[status || ''] || configs['warranty_expired'];
    };

    const statusConfig = getStatusConfig(warrantyCalc?.final_warranty_status);
    const damageStatus = getDamageStatusText(ticket?.technical_damage_status);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                width: 600, background: '#1c1c1e', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                display: 'flex', flexDirection: 'column', maxHeight: '90vh'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Shield size={20} color="#3B82F6" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>保修计算详情</h3>
                            <p style={{ margin: 0, fontSize: 12, color: '#888', marginTop: 4 }}>工单 {ticketNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                            加载中...
                        </div>
                    ) : (
                        <>
                            {/* Device Info */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>设备信息</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>产品型号</div>
                                        <div style={{ fontSize: 14, color: '#fff' }}>{ticket?.product_name || '未知型号'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>序列号</div>
                                        <div style={{ fontSize: 14, color: '#fff', fontFamily: 'monospace' }}>{ticket?.serial_number || '-'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Calculation Process */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Calculator size={14} /> 计算过程
                                </h4>

                                {warrantyCalc ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {/* Step 1: Warranty Start */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{
                                                width: 24, height: 24, borderRadius: '50%', background: 'rgba(59,130,246,0.2)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                marginTop: 2
                                            }}>
                                                <span style={{ fontSize: 12, color: '#3B82F6', fontWeight: 700 }}>1</span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>保修起始日</div>
                                                <div style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>{warrantyCalc.start_date}</div>
                                                <div style={{ fontSize: 12, color: '#3B82F6', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    {getBasisIcon(warrantyCalc.calculation_basis)}
                                                    {getBasisText(warrantyCalc.calculation_basis)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <div style={{ paddingLeft: 11, borderLeft: '2px solid rgba(255,255,255,0.1)', marginLeft: 11, height: 20 }} />

                                        {/* Step 2: Warranty End */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{
                                                width: 24, height: 24, borderRadius: '50%', background: 'rgba(139,92,246,0.2)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                marginTop: 2
                                            }}>
                                                <span style={{ fontSize: 12, color: '#8B5CF6', fontWeight: 700 }}>2</span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>保修结束日</div>
                                                <div style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>{warrantyCalc.end_date}</div>
                                                <div style={{ fontSize: 12, color: '#8B5CF6', marginTop: 4 }}>标准保修期 24 个月</div>
                                            </div>
                                        </div>

                                        {/* Arrow */}
                                        <div style={{ paddingLeft: 11, borderLeft: '2px solid rgba(255,255,255,0.1)', marginLeft: 11, height: 20 }} />

                                        {/* Step 3: Current Status */}
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                            <div style={{
                                                width: 24, height: 24, borderRadius: '50%', background: 'rgba(245,158,11,0.2)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                marginTop: 2
                                            }}>
                                                <span style={{ fontSize: 12, color: '#FFD200', fontWeight: 700 }}>3</span>
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>当前日期对比</div>
                                                <div style={{ fontSize: 14, color: '#fff' }}>
                                                    当前日期: {new Date().toISOString().split('T')[0]}
                                                </div>
                                                <div style={{ fontSize: 12, color: warrantyCalc.is_in_warranty ? '#10B981' : '#FFD200', marginTop: 4 }}>
                                                    {warrantyCalc.is_in_warranty ? '✓ 在保修期内' : '✗ 保修期已结束'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                                        暂无保修计算数据
                                    </div>
                                )}
                            </div>

                            {/* OP Technical Assessment */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                <h4 style={{ margin: '0 0 16px 0', fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <User size={14} /> OP 技术判定
                                </h4>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {/* Damage Status */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ fontSize: 13, color: '#aaa', width: 100 }}>损坏类型</div>
                                        <div style={{
                                            padding: '6px 12px', borderRadius: 6,
                                            background: damageStatus.bg,
                                            color: damageStatus.color,
                                            fontSize: 13, fontWeight: 500
                                        }}>
                                            {damageStatus.text}
                                        </div>
                                    </div>

                                    {/* Interception Check */}
                                    <div style={{
                                        padding: 12, borderRadius: 8, marginTop: 4,
                                        background: ticket?.technical_damage_status === 'physical_damage'
                                            ? 'rgba(239,68,68,0.1)'
                                            : 'rgba(16,185,129,0.1)',
                                        border: `1px solid ${ticket?.technical_damage_status === 'physical_damage'
                                            ? 'rgba(239,68,68,0.3)'
                                            : 'rgba(16,185,129,0.3)'}`,
                                        display: 'flex', alignItems: 'center', gap: 8
                                    }}>
                                        {ticket?.technical_damage_status === 'physical_damage' ? (
                                            <>
                                                <AlertTriangle size={16} color="#EF4444" />
                                                <span style={{ fontSize: 13, color: '#EF4444' }}>
                                                    ⚡ 拦截检查: 人为损坏 → 保修直接失效
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={16} color="#10B981" />
                                                <span style={{ fontSize: 13, color: '#10B981' }}>
                                                    ⚡ 拦截检查: 无人为损坏 → 继续日期计算
                                                </span>
                                            </>
                                        )}
                                    </div>

                                    {/* Suggestion */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                                        <div style={{ fontSize: 13, color: '#aaa', width: 100 }}>保修建议</div>
                                        <div style={{ fontSize: 14, color: '#fff' }}>
                                            {getSuggestionText(ticket?.technical_warranty_suggestion)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Final Result */}
                            <div style={{
                                padding: 20, borderRadius: 12,
                                background: statusConfig.bg,
                                border: `1px solid ${statusConfig.border}`,
                                textAlign: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 12 }}>
                                    <div style={{ color: statusConfig.color }}>{statusConfig.icon}</div>
                                    <div style={{ fontSize: 18, fontWeight: 700, color: statusConfig.color }}>
                                        {statusConfig.title}
                                    </div>
                                </div>

                                {warrantyCalc?.final_warranty_status === 'warranty_expired' && warrantyCalc.end_date && (
                                    <div style={{ fontSize: 13, color: '#aaa' }}>
                                        保修期已于 {warrantyCalc.end_date} 结束
                                    </div>
                                )}

                                {warrantyCalc?.final_warranty_status === 'warranty_void_damage' && (
                                    <div style={{ fontSize: 13, color: '#aaa' }}>
                                        因人为损坏/物理损伤，保修条款不适用
                                    </div>
                                )}
                            </div>

                            {/* Cost Reference */}
                            {(msReview?.estimated_cost_min || msReview?.estimated_cost_max) && (
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <DollarSign size={14} /> 费用参考
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: 13, color: '#aaa' }}>OP 预估费用</span>
                                            <span style={{ fontSize: 14, color: '#fff' }}>
                                                ¥{msReview.estimated_cost_min || 0} ~ ¥{msReview.estimated_cost_max || 0}
                                            </span>
                                        </div>
                                        {msReview.customer_confirmed && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: 13, color: '#aaa' }}>客户确认状态</span>
                                                <span style={{ fontSize: 14, color: '#10B981' }}>✓ 已确认</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 32px', background: 'rgba(255,255,255,0.1)',
                            border: 'none', color: '#fff', borderRadius: 8,
                            cursor: 'pointer', fontSize: 14
                        }}
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};
