import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Truck, Calendar, FileText, AlertTriangle, Save, ArrowRight, BadgeDollarSign, Edit3 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface ClosingHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    ticket: any;
    onSuccess: () => void;
    onOpenRepairReport?: () => void;
    onOpenPI?: () => void;
}

export const ClosingHandoverModal: React.FC<ClosingHandoverModalProps> = ({ isOpen, onClose, ticket, onSuccess, onOpenRepairReport, onOpenPI }) => {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'docs' | 'payment' | 'logistics'>('docs');
    const [formData, setFormData] = useState({
        payment_confirmed: false,
        payment_memo: '',
        shipping_address_override: '',
        target_shipping_date: '',
        handover_notes: ''
    });

    const [docsStatus, setDocsStatus] = useState({ reportPublished: false, piPublished: false });
    const [loadingDocs, setLoadingDocs] = useState(true);

    // Initialize from existing final_settlement if available
    useEffect(() => {
        if (ticket.final_settlement) {
            try {
                const data = JSON.parse(ticket.final_settlement);
                setFormData({
                    payment_confirmed: !!data.payment_confirmed,
                    payment_memo: data.payment_memo || '',
                    shipping_address_override: data.shipping_address_override || '',
                    target_shipping_date: data.target_shipping_date || '',
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
            try {
                const [piRes, rrRes] = await Promise.all([
                    axios.get(`/api/v1/rma-documents/pi?ticket_id=${ticket.id}`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`/api/v1/rma-documents/repair-reports?ticket_id=${ticket.id}`, { headers: { Authorization: `Bearer ${token}` } })
                ]);

                const pis = piRes.data.success ? piRes.data.data : [];
                const rrs = rrRes.data.success ? rrRes.data.data : [];

                setDocsStatus({
                    reportPublished: rrs.some((r: any) => r.status === 'published'),
                    piPublished: pis.some((p: any) => p.status === 'published')
                });
            } catch (err) {
                console.error('Failed to fetch doc status', err);
            } finally {
                setLoadingDocs(false);
            }
        };
        fetchDocs();
    }, [isOpen, ticket.id, token]);

    if (!isOpen) return null;

    const handleSave = async (isFinal: boolean) => {
        setLoading(true);
        try {
            await axios.patch(`/api/v1/tickets/${ticket.id}`, {
                final_settlement: JSON.stringify(formData)
            }, { headers: { Authorization: `Bearer ${token}` } });

            if (isFinal) {
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
        const isWarranty = ticket.is_warranty === true || ticket.is_warranty === 1;
        if (isWarranty) {
            return { text: '(保内免费)', color: '#10B981', isPaid: false };
        }
        return { text: '(保外收费)', color: '#FFD200', isPaid: true };
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

                {/* Body */}
                <div style={{ padding: 24, minHeight: 460, display: 'flex', flexDirection: 'column' }}>

                    {activeTab === 'docs' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'fadeIn 0.2s ease-out' }}>
                            <div style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>为确保客户能收到正式结案文书，系统要求所有文档必须完成发布后才能移交发货。</div>

                            {loadingDocs ? (
                                <div style={{ fontSize: 13, color: '#888' }}>正在检查文档状态...</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: docsStatus.reportPublished ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', borderRadius: 12, border: `1px solid ${docsStatus.reportPublished ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: docsStatus.reportPublished ? '#10B981' : '#EF4444' }}>
                                            {docsStatus.reportPublished ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                            <span style={{ fontWeight: 500 }}>{docsStatus.reportPublished ? '已发布《维修结案报告》' : '《维修结案报告》未发布！'}</span>
                                        </div>
                                        {!docsStatus.reportPublished && onOpenRepairReport && (
                                            <button onClick={onOpenRepairReport} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#EF4444', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Edit3 size={12} /> 去编辑/发布
                                            </button>
                                        )}
                                    </div>

                                    {isPaidTicket && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: docsStatus.piPublished ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)', borderRadius: 12, border: `1px solid ${docsStatus.piPublished ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: docsStatus.piPublished ? '#10B981' : '#EF4444' }}>
                                                {docsStatus.piPublished ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                                                <span style={{ fontWeight: 500 }}>{docsStatus.piPublished ? '已发布《Proforma Invoice》' : '《Proforma Invoice》未发布！'}</span>
                                            </div>
                                            {!docsStatus.piPublished && onOpenPI && (
                                                <button onClick={onOpenPI} style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#EF4444', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Edit3 size={12} /> 去编辑/发布
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
                            <div style={{ padding: '16px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>待收金额</div>
                                <div style={{ fontSize: 32, fontWeight: 700, color: serviceType.color }}>
                                    ¥ {ticket.payment_amount?.toLocaleString() || '0.00'}
                                    <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 12, color: '#666' }}>
                                        {serviceType.text}
                                    </span>
                                </div>
                            </div>

                            {isPaidTicket ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: 16, background: formData.payment_confirmed ? 'rgba(255,210,0,0.05)' : 'rgba(255,255,255,0.02)', border: `1px solid ${formData.payment_confirmed ? 'rgba(255,210,0,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 12, transition: 'all 0.2s' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.payment_confirmed}
                                            onChange={e => setFormData(prev => ({ ...prev, payment_confirmed: e.target.checked }))}
                                            style={{ width: 20, height: 20, accentColor: '#FFD200', cursor: 'pointer' }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span style={{ fontSize: 15, color: '#fff', fontWeight: 500 }}>确认已收到客户款项</span>
                                            <span style={{ fontSize: 12, color: '#888' }}>打钩即代表财务已认账，且款项金额符合要求</span>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeIn 0.2s ease-out' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>变更收货地址 (留空则使用工单默认地址)</label>
                                <textarea
                                    value={formData.shipping_address_override}
                                    onChange={e => setFormData(prev => ({ ...prev, shipping_address_override: e.target.value }))}
                                    placeholder="请输入新的详细地址、收件人、联系电话 (若客户改了地址)..."
                                    style={{ width: '100%', padding: 16, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, minHeight: 80, resize: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>期望发货日期</label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                                        <input
                                            type="date"
                                            value={formData.target_shipping_date}
                                            onChange={e => setFormData(prev => ({ ...prev, target_shipping_date: e.target.value }))}
                                            style={{ width: '100%', padding: '14px 16px 14px 44px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, color: '#888', marginBottom: 8 }}>给 OP 发货同事的留言</label>
                                <textarea
                                    value={formData.handover_notes}
                                    onChange={e => setFormData(prev => ({ ...prev, handover_notes: e.target.value }))}
                                    placeholder="例如：请务必加固包装、随箱带一个备用电池盖等..."
                                    style={{ width: '100%', padding: 16, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 14, minHeight: 80, resize: 'none' }}
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

                {/* Footer Controls */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', display: 'flex', gap: 16 }}>
                    <button
                        onClick={() => handleSave(false)}
                        disabled={loading}
                        style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s' }}
                    >
                        <Save size={18} /> 仅保存草稿
                    </button>
                    <button
                        onClick={() => handleSave(true)}
                        disabled={loading || !canConfirm}
                        style={{
                            flex: 1.5, padding: '14px', background: canConfirm ? '#FFD200' : 'rgba(255,210,0,0.1)',
                            border: 'none', borderRadius: 12, color: canConfirm ? '#000' : '#666',
                            fontSize: 15, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            boxShadow: canConfirm ? '0 8px 20px rgba(255,210,0,0.25)' : 'none',
                            transition: 'all 0.2s'
                        }}
                    >
                        {loading ? '处理中...' : (
                            <>
                                <ArrowRight size={20} /> 确认并移交至展示发货 (OP)
                            </>
                        )}
                    </button>
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
