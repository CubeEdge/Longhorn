import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Truck, Calendar, FileText, AlertTriangle, Save, ArrowRight, BadgeDollarSign, Edit3, ChevronRight, Package, Clock, Eye } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface ClosingHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
    onSuccess: () => void;
    onOpenRepairReport?: () => void;
    onOpenPI?: () => void;
    refreshTrigger?: number; // Trigger to refresh doc status
}

export const ClosingHandoverModal: React.FC<ClosingHandoverModalProps> = ({ isOpen, onClose, ticket, onSuccess, onOpenRepairReport, onOpenPI, refreshTrigger }) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'docs' | 'payment' | 'logistics'>('docs');
    // 默认发货日期为明天
    const getDefaultShippingDate = () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    };

    const [formData, setFormData] = useState({
        payment_confirmed: false,
        payment_memo: '',
        actual_payment: '',
        shipping_address_override: '',
        target_shipping_date: getDefaultShippingDate(),
        shipping_payment: 'prepaid' as 'prepaid' | 'collect', // 寄付(默认) / 到付
        shipping_urgency: 'standard' as 'fastest' | 'standard' | 'other', // 最快 / 标准(默认) / 其他
        shipping_combine: 'standalone' as 'standalone' | 'with_order' | 'with_rma', // 独立发货(默认) / 随其他订单 / 随其他RMA
        shipping_combine_ref: '', // 合单参考号
        handover_notes: ''
    });

    const [docsStatus, setDocsStatus] = useState<{
        reportPublished: boolean;
        piPublished: boolean;
        reportNumber?: string;
        reportPublishedAt?: string;
        reportTotalCost?: number; // 维修报告的总费用
        piNumber?: string;
        piPublishedAt?: string;
        piTotal?: number;
        hasDraftPI?: boolean; // 是否有草稿PI
        hasDraftReport?: boolean; // 是否有草稿报告
    }>({ reportPublished: false, piPublished: false });
    const [loadingDocs, setLoadingDocs] = useState(true);

    // Initialize from existing final_settlement if available
    useEffect(() => {
        if (ticket.final_settlement) {
            try {
                // 处理字符串或已解析对象
                const data = typeof ticket.final_settlement === 'string' 
                    ? JSON.parse(ticket.final_settlement) 
                    : ticket.final_settlement;
                setFormData({
                    payment_confirmed: !!data.payment_confirmed,
                    payment_memo: data.payment_memo || '',
                    actual_payment: data.actual_payment || '',
                    shipping_address_override: data.shipping_address_override || '',
                    target_shipping_date: data.target_shipping_date || getDefaultShippingDate(),
                    shipping_payment: data.shipping_payment || 'prepaid',
                    shipping_urgency: data.shipping_urgency || 'standard',
                    shipping_combine: data.shipping_combine || 'standalone',
                    shipping_combine_ref: data.shipping_combine_ref || '',
                    handover_notes: data.handover_notes || ''
                });
            } catch (e) {
                console.error('Failed to parse final_settlement', e);
            }
        }
    }, [ticket.final_settlement]);

    // Fetch Document Statuses to ensure publish prerequisite
    useEffect(() => {
        if (!isOpen) return;
        const fetchDocs = async () => {
            setLoadingDocs(true);
            try {
                const [piRes, rrRes] = await Promise.all([
                    axios.get(`/api/v1/rma-documents/pi?ticket_id=${ticket.id}`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`/api/v1/rma-documents/repair-reports?ticket_id=${ticket.id}`, { headers: { Authorization: `Bearer ${token}` } })
                ]);

                const pis = piRes.data.success ? piRes.data.data : [];
                const rrs = rrRes.data.success ? rrRes.data.data : [];

                const publishedReport = rrs.find((r: any) => r.status === 'published');
                const publishedPI = pis.find((p: any) => p.status === 'published');
                const draftReport = rrs.find((r: any) => r.status === 'draft');
                const draftPI = pis.find((p: any) => p.status === 'draft');
                // 获取维修报告的总费用（优先已发布，其次草稿）
                const reportForCost = publishedReport || draftReport;

                setDocsStatus({
                    reportPublished: !!publishedReport,
                    piPublished: !!publishedPI,
                    reportNumber: publishedReport?.report_number,
                    reportPublishedAt: publishedReport?.published_at,
                    reportTotalCost: reportForCost?.total_cost || 0,
                    piNumber: publishedPI?.pi_number,
                    piPublishedAt: publishedPI?.published_at,
                    piTotal: publishedPI?.total_amount,
                    hasDraftPI: !!draftPI,
                    hasDraftReport: !!draftReport
                });
            } catch (err) {
                console.error('Failed to fetch doc status', err);
            } finally {
                setLoadingDocs(false);
            }
        };
        fetchDocs();
    }, [isOpen, ticket.id, token, refreshTrigger]);

    if (!isOpen) return null;

    // 检测是否为更正模式（工单已经不在 ms_closing 节点）
    const isCorrectMode = ticket.current_node !== 'ms_closing';

    const handleSave = async (isFinal: boolean) => {
        setLoading(true);
        try {
            // 构建 PATCH 数据
            const patchData: any = {
                final_settlement: JSON.stringify(formData)
            };
            
            // 更正模式下添加 change_reason 记录到时间线
            if (isCorrectMode) {
                patchData.change_reason = '更正了结案确认信息';
            }
            
            await axios.patch(`/api/v1/tickets/${ticket.id}`, patchData, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            // 只有在非更正模式且 isFinal 时才执行 settle action
            if (isFinal && !isCorrectMode) {
                await axios.post(`/api/v1/tickets/${ticket.id}/action`, {
                    action: 'settle'
                }, { headers: { Authorization: `Bearer ${token}` } });
            }

            onSuccess();
        } catch (error) {
            console.error('Failed to save handover data', error);
            alert('保存失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const getServiceTypeInfo = () => {
        // 使用工单的 warranty_status 来判断保内/保外，而不是 is_warranty
        const isWarranty = ticket.warranty_status === 'in_warranty';
        // 判断是否需要收款：维修报告费用 > 0 或 PI金额 > 0 则需收款
        const reportCost = docsStatus.reportTotalCost || 0;
        const piAmount = docsStatus.piTotal || 0;
        const needsPayment = reportCost > 0 || piAmount > 0;
        
        if (!needsPayment && isWarranty) {
            return { text: '(保内免费)', color: '#10B981', isPaid: false };
        } else if (!needsPayment && !isWarranty) {
            return { text: '(无收费项目)', color: '#888', isPaid: false };
        }
        return { text: isWarranty ? '(保内收费)' : '(保外收费)', color: '#FFD200', isPaid: true };
    };

    const serviceType = getServiceTypeInfo();
    const isPaidTicket = serviceType.isPaid;

    const docsSatisfied = docsStatus.reportPublished && (!isPaidTicket || docsStatus.piPublished);
    const canConfirm = (!isPaidTicket || formData.payment_confirmed) && docsSatisfied;

    const tabs = [
        { id: 'docs', label: '文档检查', icon: <FileText size={16} />, warning: !docsSatisfied },
        { id: 'payment', label: '款项确认', icon: <BadgeDollarSign size={16} />, warning: isPaidTicket && !formData.payment_confirmed },
        { id: 'logistics', label: '发货指令', icon: <Truck size={16} />, warning: false }
    ];

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 640, background: '#1c1c1e', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,215,0,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255, 210, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={20} color="#FFD200" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#fff' }}>结案确认与交接</h3>
                            <p style={{ margin: 0, fontSize: 12, color: '#888', marginTop: 2 }}>{ticket.ticket_number} · 根据发货要求补齐信息</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '0 24px' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '16px 20px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid #FFD200' : '2px solid transparent',
                                color: activeTab === tab.id ? '#FFD200' : '#888',
                                fontSize: 14, fontWeight: activeTab === tab.id ? 600 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            {tab.icon} {tab.label}
                            {tab.warning && (
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444', position: 'absolute', top: 12, right: 8 }} />
                            )}
                        </button>
                    ))}
                </div>

                {/* Body - 固定高度保持窗口尺寸一致 */}
                <div style={{ padding: 24, height: 460, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

                    {activeTab === 'docs' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.2s ease-out' }}>
                            <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>为确保客户能收到正式结案文书，系统要求所有文档必须完成发布后才能移交发货。</div>

                            {loadingDocs ? (
                                <div style={{ fontSize: 13, color: '#888' }}>正在检查文档状态...</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: docsStatus.reportPublished ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', borderRadius: 12, border: `1px solid ${docsStatus.reportPublished ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: docsStatus.reportPublished ? '#10B981' : '#EF4444' }}>
                                                {docsStatus.reportPublished ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                                <span style={{ fontWeight: 500 }}>{docsStatus.reportPublished ? `已发布《维修结案报告》` : '《维修结案报告》未发布！'}</span>
                                            </div>
                                            {docsStatus.reportPublished && docsStatus.reportNumber && (
                                                <div style={{ fontSize: 12, color: '#888', marginLeft: 30 }}>
                                                    {docsStatus.reportNumber}
                                                    {docsStatus.reportPublishedAt && ` · ${new Date(docsStatus.reportPublishedAt).toLocaleString('zh-CN')}`}
                                                </div>
                                            )}
                                        </div>
                                        {!docsStatus.reportPublished && onOpenRepairReport && (
                                            <button onClick={onOpenRepairReport} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#EF4444', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Edit3 size={12} /> 去编辑/发布
                                            </button>
                                        )}
                                        {docsStatus.reportPublished && onOpenRepairReport && (
                                            <button onClick={onOpenRepairReport} style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, color: '#10B981', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Eye size={12} /> 查看
                                            </button>
                                        )}
                                    </div>

                                    {/* PI检查 - 有收费项目或有草稿PI时显示 */}
                                    {(isPaidTicket || docsStatus.hasDraftPI) && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: docsStatus.piPublished ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', borderRadius: 12, border: `1px solid ${docsStatus.piPublished ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: docsStatus.piPublished ? '#10B981' : '#EF4444' }}>
                                                    {docsStatus.piPublished ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                                    <span style={{ fontWeight: 500 }}>{docsStatus.piPublished ? `已发布《Proforma Invoice》` : '《Proforma Invoice》未发布！'}</span>
                                                </div>
                                                {docsStatus.piPublished && docsStatus.piNumber && (
                                                    <div style={{ fontSize: 12, color: '#888', marginLeft: 30 }}>
                                                        {docsStatus.piNumber}
                                                        {docsStatus.piTotal !== undefined && ` · ¥${docsStatus.piTotal.toLocaleString()}`}
                                                        {docsStatus.piPublishedAt && ` · ${new Date(docsStatus.piPublishedAt).toLocaleString('zh-CN')}`}
                                                    </div>
                                                )}
                                                {!docsStatus.piPublished && (
                                                    <div style={{ fontSize: 12, color: '#888', marginLeft: 30 }}>
                                                        {isPaidTicket 
                                                            ? `维修报告有收费项目（¥${(docsStatus.reportTotalCost || 0).toLocaleString()}），请先制作并发布PI`
                                                            : '检测到草稿PI，请确认是否需要发布'
                                                        }
                                                    </div>
                                                )}
                                            </div>
                                            {!docsStatus.piPublished && onOpenPI && (
                                                <button onClick={onOpenPI} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#EF4444', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Edit3 size={12} /> 去编辑/发布
                                                </button>
                                            )}
                                            {docsStatus.piPublished && onOpenPI && (
                                                <button onClick={onOpenPI} style={{ padding: '6px 12px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, color: '#10B981', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Eye size={12} /> 查看
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'payment' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.2s ease-out' }}>
                            {isPaidTicket ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {/* PI vs 实收核对 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                        <div style={{ padding: 16, background: 'rgba(255,210,0,0.05)', borderRadius: 12, border: '1px solid rgba(255,210,0,0.1)' }}>
                                            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>PI应收金额 · <span style={{ color: serviceType.color }}>{serviceType.text}</span></div>
                                            <div style={{ fontSize: 28, fontWeight: 600, color: '#FFD200' }}>¥ {(docsStatus.piTotal || 0).toLocaleString()}</div>
                                        </div>
                                        <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                                            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>实收金额</div>
                                            <input
                                                type="number"
                                                className="payment-input"
                                                value={formData.actual_payment}
                                                onChange={e => setFormData(prev => ({ ...prev, actual_payment: e.target.value }))}
                                                placeholder="请输入金额"
                                                style={{ width: '100%', padding: '8px 0', background: 'transparent', border: 'none', color: '#fff', fontSize: 28, fontWeight: 600, outline: 'none' }}
                                            />
                                        </div>
                                    </div>
                            
                                    {/* 金额差异警告 */}
                                    {formData.actual_payment && parseFloat(formData.actual_payment) !== (docsStatus.piTotal || 0) && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
                                            <AlertTriangle size={16} color="#EF4444" />
                                            <span style={{ fontSize: 13, color: '#EF4444' }}>
                                                实收金额与PI金额不一致，差额：¥ {(parseFloat(formData.actual_payment) - (docsStatus.piTotal || 0)).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                            
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: 16, background: formData.payment_confirmed ? 'rgba(255,210,0,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${formData.payment_confirmed ? 'rgba(255,210,0,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, transition: 'all 0.2s' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.payment_confirmed}
                                            onChange={e => setFormData(prev => ({ ...prev, payment_confirmed: e.target.checked }))}
                                            style={{ width: 20, height: 20, accentColor: '#FFD200', cursor: 'pointer' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>确认已收到客户款项</span>
                                            <span style={{ fontSize: 12, color: '#888' }}>打勾即代表财务已认账，且款项金额符合要求</span>
                                        </div>
                                    </label>
                                    <div>
                                        <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>款项及折扣备注（选填）</label>
                                        <textarea
                                            value={formData.payment_memo}
                                            onChange={e => setFormData(prev => ({ ...prev, payment_memo: e.target.value }))}
                                            placeholder="如单号、折扣理由、特殊账号等..."
                                            style={{ width: '100%', padding: 16, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, minHeight: 80, resize: 'none' }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#10B981', fontSize: 15, padding: 32, background: 'rgba(16,185,129,0.05)', borderRadius: 12, border: '1px dashed rgba(16,185,129,0.2)' }}>
                                    <CheckCircle size={24} /> 免费单据，无需确认收款
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'logistics' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.2s ease-out' }}>
                            {/* 发货日期和运费方式 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>期望发货日期</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                                        <input
                                            type="date"
                                            value={formData.target_shipping_date}
                                            onChange={e => setFormData(prev => ({ ...prev, target_shipping_date: e.target.value }))}
                                            style={{ width: '100%', padding: '12px 16px 12px 44px', background: 'var(--glass-bg-hover)', border: '1px solid var(--glass-border)', borderRadius: 10, color: 'var(--text-main)', fontSize: 14, outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>运费方式</label>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {[{ value: 'prepaid', label: '寄付' }, { value: 'collect', label: '到付' }].map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => setFormData(prev => ({ ...prev, shipping_payment: opt.value as any }))}
                                                style={{
                                                    flex: 1, padding: '12px 16px', borderRadius: 10,
                                                    background: formData.shipping_payment === opt.value ? 'rgba(255,210,0,0.1)' : 'var(--glass-bg-hover)',
                                                    border: `1px solid ${formData.shipping_payment === opt.value ? 'rgba(255,210,0,0.4)' : 'var(--glass-border)'}`,
                                                    color: formData.shipping_payment === opt.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                                    fontSize: 14, fontWeight: formData.shipping_payment === opt.value ? 600 : 400,
                                                    cursor: 'pointer', transition: 'all 0.2s'
                                                }}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 发货时效 */}
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                    <Clock size={14} /> 发货时效
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[{ value: 'fastest', label: '最快', desc: '优先处理' }, { value: 'standard', label: '标准', desc: '按序处理' }, { value: 'other', label: '其他', desc: '特殊安排' }].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFormData(prev => ({ ...prev, shipping_urgency: opt.value as any }))}
                                            style={{
                                                flex: 1, padding: '10px 12px', borderRadius: 10,
                                                background: formData.shipping_urgency === opt.value ? 'rgba(255,210,0,0.1)' : 'var(--glass-bg-hover)',
                                                border: `1px solid ${formData.shipping_urgency === opt.value ? 'rgba(255,210,0,0.4)' : 'var(--glass-border)'}`,
                                                color: formData.shipping_urgency === opt.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                                fontSize: 13, fontWeight: formData.shipping_urgency === opt.value ? 600 : 400,
                                                cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
                                            }}
                                        >
                                            <div>{opt.label}</div>
                                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 合单指令 */}
                            <div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                    <Package size={14} /> 合单指令
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[
                                        { value: 'standalone', label: '独立发货', desc: '单独包裹' },
                                        { value: 'with_order', label: '随订单发货', desc: '合并到经销商订单' },
                                        { value: 'with_rma', label: '随其他RMA', desc: '合并到其他维修单' }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFormData(prev => ({ ...prev, shipping_combine: opt.value as any, shipping_combine_ref: opt.value === 'standalone' ? '' : prev.shipping_combine_ref }))}
                                            style={{
                                                flex: 1, padding: '10px 12px', borderRadius: 10,
                                                background: formData.shipping_combine === opt.value ? 'rgba(255,210,0,0.1)' : 'var(--glass-bg-hover)',
                                                border: `1px solid ${formData.shipping_combine === opt.value ? 'rgba(255,210,0,0.4)' : 'var(--glass-border)'}`,
                                                color: formData.shipping_combine === opt.value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                                                fontSize: 13, fontWeight: formData.shipping_combine === opt.value ? 600 : 400,
                                                cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
                                            }}
                                        >
                                            <div>{opt.label}</div>
                                            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{opt.desc}</div>
                                        </button>
                                    ))}
                                </div>
                                {formData.shipping_combine !== 'standalone' && (
                                    <input
                                        type="text"
                                        value={formData.shipping_combine_ref}
                                        onChange={e => setFormData(prev => ({ ...prev, shipping_combine_ref: e.target.value }))}
                                        placeholder={formData.shipping_combine === 'with_order' ? '输入订单号或经销商名称...' : '输入要合并的RMA单号...'}
                                        style={{ width: '100%', marginTop: 8, padding: '10px 14px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                                    />
                                )}
                            </div>

                            {/* 变更收货地址 */}
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>变更收货地址（留空使用工单默认地址）</label>
                                <textarea
                                    value={formData.shipping_address_override}
                                    onChange={e => setFormData(prev => ({ ...prev, shipping_address_override: e.target.value }))}
                                    placeholder="若客户更改了地址，请输入新的详细地址、收件人、联系电话..."
                                    style={{ width: '100%', padding: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, minHeight: 60, resize: 'none' }}
                                />
                            </div>

                            {/* 给OP的留言 */}
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>给 OP 发货同事的留言</label>
                                <textarea
                                    value={formData.handover_notes}
                                    onChange={e => setFormData(prev => ({ ...prev, handover_notes: e.target.value }))}
                                    placeholder="例如：请务必加固包装、随箱带一个备用电池盖等..."
                                    style={{ width: '100%', padding: 12, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 13, minHeight: 60, resize: 'none' }}
                                />
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Warnings */}
                {(!docsSatisfied) && (
                    <div style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.1)', borderTop: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <AlertTriangle size={16} color="#EF4444" />
                        <span style={{ fontSize: 13, color: '#EF4444' }}>无法结案确认：请先确保所有的服务及财务报告均已发布且款项结清。</span>
                    </div>
                )}

                {/* Footer Controls - Tab1/Tab2显示下一步，Tab3显示提交 */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', display: 'flex', gap: 16 }}>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={loading}
                        style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}
                    >
                        <Save size={18} /> 仅保存草稿
                    </button>
                    {activeTab !== 'logistics' ? (
                        <button
                            onClick={() => {
                                if (activeTab === 'docs') setActiveTab('payment');
                                else if (activeTab === 'payment') setActiveTab('logistics');
                            }}
                            style={{
                                flex: 1.5, padding: '14px', background: '#FFD200',
                                border: 'none', borderRadius: 12, color: '#000',
                                fontSize: 15, fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                boxShadow: '0 8px 20px rgba(255,210,0,0.25)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <ChevronRight size={20} /> 下一步
                        </button>
                    ) : (
                        <button
                            onClick={() => handleSave(true)}
                            disabled={loading || (!isCorrectMode && !canConfirm)}
                            style={{
                                flex: 1.5, padding: '14px', background: (isCorrectMode || canConfirm) ? '#FFD200' : 'rgba(255,210,0,0.1)',
                                border: 'none', borderRadius: 12, color: (isCorrectMode || canConfirm) ? '#000' : '#666',
                                fontSize: 15, fontWeight: 700, cursor: (isCorrectMode || canConfirm) ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                boxShadow: (isCorrectMode || canConfirm) ? '0 8px 20px rgba(255,210,0,0.25)' : 'none',
                                transition: 'all 0.2s'
                            }}
                        >
                            {loading ? '处理中...' : (
                                <>
                                    <ArrowRight size={20} /> {isCorrectMode ? '保存更正' : '确认并移交至展示发货 (OP)'}
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
