import React, { useState, useEffect } from 'react';
import { X, Save, Send, FileText, Plus, Trash2, Download, Shield } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { DocumentReviewModal } from './DocumentReviewModal';
import { exportToPDF } from '../../utils/pdfExport';

interface PIEditorProps {
    isOpen: boolean;
    onClose: () => void;
    ticketId: number;
    ticketNumber: string;
    piId?: number | null;  // null for new PI
    onSuccess: () => void;
    onReview?: () => void;  // Callback when review is needed
}

interface PIItem {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
}

interface PIContent {
    header: {
        title: string;
        subtitle: string;
    };
    customer_info: {
        name: string;
        address: string;
        contact: string;
        email: string;
    };
    device_info: {
        product_name: string;
        serial_number: string;
        firmware_version: string;
    };
    items: PIItem[];
    terms: {
        payment_terms: string;
        delivery_terms: string;
        valid_days: number;
    };
    notes: string;
}

interface PIData {
    id?: number;
    pi_number?: string;
    status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';
    content: PIContent;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    currency: string;
    version: number;
    created_by?: { id: number; display_name: string };
    created_at?: string;
    updated_at?: string;
    reviewed_by?: { id: number; display_name: string };
    reviewed_at?: string;
    review_comment?: string;
}

const DEFAULT_CONTENT: PIContent = {
    header: {
        title: 'KINEFINITY TECHNOLOGY CO., LTD.',
        subtitle: 'Proforma Invoice / 形式发票'
    },
    customer_info: {
        name: '',
        address: '',
        contact: '',
        email: ''
    },
    device_info: {
        product_name: '',
        serial_number: '',
        firmware_version: ''
    },
    items: [],
    terms: {
        payment_terms: '100% Prepayment',
        delivery_terms: 'Express Shipping',
        valid_days: 7
    },
    notes: ''
};

export const PIEditor: React.FC<PIEditorProps> = ({
    isOpen, onClose, ticketId, ticketNumber, piId, onSuccess
}) => {
    const { token, user } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
    const [showReviewModal, setShowReviewModal] = useState(false);
    
    const [piData, setPIData] = useState<PIData>({
        status: 'draft',
        content: DEFAULT_CONTENT,
        subtotal: 0,
        tax_rate: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        currency: 'CNY',
        version: 1
    });

    // Load existing PI or initialize from ticket data
    useEffect(() => {
        if (isOpen) {
            if (piId) {
                loadPI();
            } else {
                initializeFromTicket();
            }
        }
    }, [isOpen, piId, ticketId]);

    const loadPI = async () => {
        if (!piId) return;
        setLoading(true);
        try {
            const res = await axios.get(`/api/v1/rma-documents/pi/${piId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setPIData(res.data.data);
            }
        } catch (err) {
            console.error('Failed to load PI:', err);
            alert('加载PI失败');
        } finally {
            setLoading(false);
        }
    };

    const initializeFromTicket = async () => {
        setLoading(true);
        try {
            // Fetch ticket data to pre-populate
            const res = await axios.get(`/api/v1/tickets/${ticketId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                const ticket = res.data.data;
                setPIData(prev => ({
                    ...prev,
                    content: {
                        ...prev.content,
                        customer_info: {
                            name: ticket.account_name || '',
                            address: '',
                            contact: ticket.contact_name || ticket.reporter_name || '',
                            email: ''
                        },
                        device_info: {
                            product_name: ticket.product_name || '',
                            serial_number: ticket.serial_number || '',
                            firmware_version: ticket.firmware_version || ''
                        }
                    }
                }));
            }
        } catch (err) {
            console.error('Failed to load ticket:', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateTotals = (items: PIItem[], taxRate: number, discount: number) => {
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount - discount;
        return { subtotal, taxAmount, total };
    };

    const updateItem = (id: string, field: keyof PIItem, value: any) => {
        const newItems = piData.content.items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === 'quantity' || field === 'unit_price') {
                    updated.total = updated.quantity * updated.unit_price;
                }
                return updated;
            }
            return item;
        });
        
        const { subtotal, taxAmount, total } = calculateTotals(newItems, piData.tax_rate, piData.discount_amount);
        
        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, items: newItems },
            subtotal,
            tax_amount: taxAmount,
            total_amount: total
        }));
    };

    const addItem = () => {
        const newItem: PIItem = {
            id: Date.now().toString(),
            description: '',
            quantity: 1,
            unit_price: 0,
            total: 0
        };
        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, items: [...prev.content.items, newItem] }
        }));
    };

    const removeItem = (id: string) => {
        const newItems = piData.content.items.filter(item => item.id !== id);
        const { subtotal, taxAmount, total } = calculateTotals(newItems, piData.tax_rate, piData.discount_amount);
        
        setPIData(prev => ({
            ...prev,
            content: { ...prev.content, items: newItems },
            subtotal,
            tax_amount: taxAmount,
            total_amount: total
        }));
    };

    const saveDraft = async () => {
        setSaving(true);
        try {
            const payload = {
                ticket_id: ticketId,
                content: piData.content,
                subtotal: piData.subtotal,
                tax_rate: piData.tax_rate,
                tax_amount: piData.tax_amount,
                discount_amount: piData.discount_amount,
                total_amount: piData.total_amount,
                currency: piData.currency,
                valid_until: new Date(Date.now() + piData.content.terms.valid_days * 24 * 60 * 60 * 1000).toISOString()
            };

            if (piId) {
                await axios.patch(`/api/v1/rma-documents/pi/${piId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post('/api/v1/rma-documents/pi', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '保存失败');
        } finally {
            setSaving(false);
        }
    };

    const submitForReview = async () => {
        setSubmitting(true);
        try {
            await axios.post(`/api/v1/rma-documents/pi/${piId}/submit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onSuccess();
        } catch (err: any) {
            alert(err.response?.data?.error || '提交审核失败');
        } finally {
            setSubmitting(false);
        }
    };

    const exportPDF = async () => {
        try {
            const previewElement = document.getElementById('pi-preview-content');
            if (!previewElement) {
                alert('预览内容未找到');
                return;
            }

            await exportToPDF({
                filename: `${piData.pi_number || 'PI'}.pdf`,
                element: previewElement,
                orientation: 'portrait',
                format: 'a4'
            });
        } catch (err) {
            console.error('PDF export error:', err);
            alert('PDF导出失败');
        }
    };

    if (!isOpen) return null;

    const isReadOnly = piData.status === 'published' || piData.status === 'pending_review';
    const canEdit = !isReadOnly && (piData.status === 'draft' || piData.status === 'rejected');
    const canSubmit = canEdit && piData.content.items.length > 0;
    const canExport = piData.status === 'published' || piData.status === 'approved';
    const canReview = ['Admin', 'Lead'].includes(user?.role || '') && (piData.status === 'pending_review' || piData.status === 'approved');

    const handleReviewSuccess = () => {
        setShowReviewModal(false);
        loadPI(); // Reload to get updated status
        onSuccess();
    };

    return (
        <>
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div style={{
                    width: 900, height: '90vh', background: '#1c1c1e', borderRadius: 16,
                    border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                    boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                    display: 'flex', flexDirection: 'column'
                }}>
                {/* Header */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={18} color="#10B981" />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
                                {piId ? '编辑 PI' : '新建 PI'}
                            </h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                <span style={{ fontSize: 12, color: '#888' }}>工单 {ticketNumber}</span>
                                {piData.pi_number && (
                                    <span style={{ fontSize: 11, color: '#3B82F6', background: 'rgba(59,130,246,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                                        {piData.pi_number}
                                    </span>
                                )}
                                <StatusBadge status={piData.status} />
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => setActiveTab('edit')}
                            style={{
                                padding: '6px 16px', background: activeTab === 'edit' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none', color: activeTab === 'edit' ? '#fff' : '#888', borderRadius: 6,
                                cursor: 'pointer', fontSize: 13
                            }}
                        >
                            编辑
                        </button>
                        <button
                            onClick={() => setActiveTab('preview')}
                            style={{
                                padding: '6px 16px', background: activeTab === 'preview' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none', color: activeTab === 'preview' ? '#fff' : '#888', borderRadius: 6,
                                cursor: 'pointer', fontSize: 13
                            }}
                        >
                            预览
                        </button>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginLeft: 8 }}>
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                            加载中...
                        </div>
                    ) : activeTab === 'edit' ? (
                        <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {/* Customer Info */}
                            <Section title="客户信息">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <Input label="客户名称" value={piData.content.customer_info.name} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, customer_info: { ...prev.content.customer_info, name: v } } }))} disabled={!canEdit} />
                                    <Input label="联系人" value={piData.content.customer_info.contact} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, customer_info: { ...prev.content.customer_info, contact: v } } }))} disabled={!canEdit} />
                                    <Input label="邮箱" value={piData.content.customer_info.email} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, customer_info: { ...prev.content.customer_info, email: v } } }))} disabled={!canEdit} />
                                    <Input label="地址" value={piData.content.customer_info.address} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, customer_info: { ...prev.content.customer_info, address: v } } }))} disabled={!canEdit} />
                                </div>
                            </Section>

                            {/* Device Info */}
                            <Section title="设备信息">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <Input label="产品型号" value={piData.content.device_info.product_name} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, device_info: { ...prev.content.device_info, product_name: v } } }))} disabled={!canEdit} />
                                    <Input label="序列号" value={piData.content.device_info.serial_number} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, device_info: { ...prev.content.device_info, serial_number: v } } }))} disabled={!canEdit} />
                                </div>
                            </Section>

                            {/* Items */}
                            <Section title="服务项目" action={canEdit && <button onClick={addItem} style={{ padding: '4px 12px', background: '#3B82F6', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> 添加</button>}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {piData.content.items.map((item) => (
                                        <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                                            <div style={{ flex: 1 }}>
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                                                    placeholder="服务/零件描述"
                                                    disabled={!canEdit}
                                                    style={{ width: '100%', padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                                />
                                            </div>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                                placeholder="数量"
                                                disabled={!canEdit}
                                                style={{ width: 70, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13, textAlign: 'center' }}
                                            />
                                            <input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                                                placeholder="单价"
                                                disabled={!canEdit}
                                                style={{ width: 100, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13, textAlign: 'right' }}
                                            />
                                            <div style={{ width: 100, padding: 8, textAlign: 'right', color: '#FFD700', fontWeight: 600 }}>
                                                ¥{item.total.toFixed(2)}
                                            </div>
                                            {canEdit && (
                                                <button onClick={() => removeItem(item.id)} style={{ padding: 8, background: 'rgba(239,68,68,0.2)', border: 'none', borderRadius: 4, color: '#EF4444', cursor: 'pointer' }}>
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {piData.content.items.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                                            暂无服务项目，点击"添加"按钮添加
                                        </div>
                                    )}
                                </div>
                            </Section>

                            {/* Financial Summary */}
                            <Section title="财务汇总">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 300, marginLeft: 'auto' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                                        <span>小计</span>
                                        <span>¥{piData.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#aaa' }}>税率 (%)</span>
                                        <input
                                            type="number"
                                            value={piData.tax_rate}
                                            onChange={e => {
                                                const rate = parseFloat(e.target.value) || 0;
                                                const { taxAmount, total } = calculateTotals(piData.content.items, rate, piData.discount_amount);
                                                setPIData(prev => ({ ...prev, tax_rate: rate, tax_amount: taxAmount, total_amount: total }));
                                            }}
                                            disabled={!canEdit}
                                            style={{ width: 60, padding: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13, textAlign: 'right' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                                        <span>税额</span>
                                        <span>¥{piData.tax_amount.toFixed(2)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#aaa' }}>优惠金额</span>
                                        <input
                                            type="number"
                                            value={piData.discount_amount}
                                            onChange={e => {
                                                const discount = parseFloat(e.target.value) || 0;
                                                const { taxAmount, total } = calculateTotals(piData.content.items, piData.tax_rate, discount);
                                                setPIData(prev => ({ ...prev, discount_amount: discount, tax_amount: taxAmount, total_amount: total }));
                                            }}
                                            disabled={!canEdit}
                                            style={{ width: 100, padding: 4, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13, textAlign: 'right' }}
                                        />
                                    </div>
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#FFD700', fontWeight: 600 }}>合计</span>
                                        <span style={{ color: '#FFD700', fontSize: 20, fontWeight: 700 }}>¥{piData.total_amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </Section>

                            {/* Terms */}
                            <Section title="条款">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <Input label="付款条款" value={piData.content.terms.payment_terms} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, terms: { ...prev.content.terms, payment_terms: v } } }))} disabled={!canEdit} />
                                    <Input label="交付条款" value={piData.content.terms.delivery_terms} onChange={v => setPIData(prev => ({ ...prev, content: { ...prev.content, terms: { ...prev.content.terms, delivery_terms: v } } }))} disabled={!canEdit} />
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ color: '#aaa', fontSize: 13 }}>有效期 (天)</span>
                                        <input
                                            type="number"
                                            value={piData.content.terms.valid_days}
                                            onChange={e => setPIData(prev => ({ ...prev, content: { ...prev.content, terms: { ...prev.content.terms, valid_days: parseInt(e.target.value) || 7 } } }))}
                                            disabled={!canEdit}
                                            style={{ width: 80, padding: 8, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', fontSize: 13 }}
                                        />
                                    </div>
                                </div>
                            </Section>

                            {/* Notes */}
                            <Section title="备注">
                                <textarea
                                    value={piData.content.notes}
                                    onChange={e => setPIData(prev => ({ ...prev, content: { ...prev.content, notes: e.target.value } }))}
                                    disabled={!canEdit}
                                    placeholder="添加备注信息..."
                                    style={{ width: '100%', minHeight: 80, padding: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#fff', fontSize: 13, resize: 'vertical' }}
                                />
                            </Section>
                        </div>
                    ) : (
                        <PIPreview piData={piData} />
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {canExport && (
                            <button
                                onClick={exportPDF}
                                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Download size={16} /> 导出PDF
                            </button>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={onClose} style={{ padding: '8px 20px', background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', borderRadius: 6 }}>关闭</button>
                        {canEdit && (
                            <button
                                onClick={saveDraft}
                                disabled={saving}
                                style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6, color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Save size={16} /> {saving ? '保存中...' : '保存草稿'}
                            </button>
                        )}
                        {canSubmit && piId && (
                            <button
                                onClick={submitForReview}
                                disabled={submitting}
                                style={{ padding: '8px 20px', background: '#3B82F6', border: 'none', borderRadius: 6, color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Send size={16} /> {submitting ? '提交中...' : '提交审核'}
                            </button>
                        )}
                        {canReview && piId && (
                            <button
                                onClick={() => setShowReviewModal(true)}
                                style={{ padding: '8px 20px', background: '#F59E0B', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                            >
                                <Shield size={16} /> 审核
                            </button>
                        )}
                    </div>
                    </div>
                </div>
            </div>

            {/* Review Modal */}
            {showReviewModal && piId && (
                <DocumentReviewModal
                    isOpen={showReviewModal}
                    onClose={() => setShowReviewModal(false)}
                    documentType="pi"
                    documentId={piId}
                    documentNumber={piData.pi_number || 'PI'}
                    onSuccess={handleReviewSuccess}
                />
            )}
        </>
    );
};

// Helper Components
const Section: React.FC<{ title: string; children: React.ReactNode; action?: React.ReactNode }> = ({ title, children, action }) => (
    <div style={{ background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff' }}>{title}</h4>
            {action}
        </div>
        {children}
    </div>
);

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => (
    <div>
        <label style={{ display: 'block', fontSize: 12, color: '#888', marginBottom: 6 }}>{label}</label>
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{ width: '100%', padding: 10, background: disabled ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none' }}
        />
    </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const configs: Record<string, { text: string; color: string; bg: string }> = {
        'draft': { text: '草稿', color: '#888', bg: 'rgba(255,255,255,0.1)' },
        'pending_review': { text: '审核中', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
        'approved': { text: '已批准', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
        'rejected': { text: '已驳回', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
        'published': { text: '已发布', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' }
    };
    const config = configs[status] || configs['draft'];
    return (
        <span style={{ fontSize: 11, color: config.color, background: config.bg, padding: '2px 8px', borderRadius: 4 }}>
            {config.text}
        </span>
    );
};

const PIPreview: React.FC<{ piData: PIData }> = ({ piData }) => (
    <div style={{ flex: 1, overflow: 'auto', padding: 40, background: '#f5f5f5' }}>
        <div id="pi-preview-content" style={{ maxWidth: 800, margin: '0 auto', background: '#fff', padding: 60, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', color: '#333' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 40, borderBottom: '2px solid #333', paddingBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>{piData.content.header.title}</h1>
                <p style={{ margin: '8px 0 0 0', fontSize: 16, color: '#666' }}>{piData.content.header.subtitle}</p>
            </div>

            {/* PI Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 30 }}>
                <div>
                    <div style={{ fontSize: 14, color: '#666' }}>PI Number:</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{piData.pi_number || 'DRAFT'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, color: '#666' }}>Date:</div>
                    <div>{new Date().toLocaleDateString()}</div>
                    <div style={{ fontSize: 14, color: '#666', marginTop: 8 }}>Valid Until:</div>
                    <div>{new Date(Date.now() + piData.content.terms.valid_days * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
                </div>
            </div>

            {/* Customer Info */}
            <div style={{ marginBottom: 30 }}>
                <h3 style={{ fontSize: 14, color: '#666', borderBottom: '1px solid #ddd', paddingBottom: 8 }}>Bill To:</h3>
                <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{piData.content.customer_info.name || '[Customer Name]'}</div>
                    <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>{piData.content.customer_info.address || '[Address]'}</div>
                    <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>Contact: {piData.content.customer_info.contact || '-'}</div>
                    <div style={{ fontSize: 14, color: '#666' }}>Email: {piData.content.customer_info.email || '-'}</div>
                </div>
            </div>

            {/* Device Info */}
            <div style={{ marginBottom: 30 }}>
                <h3 style={{ fontSize: 14, color: '#666', borderBottom: '1px solid #ddd', paddingBottom: 8 }}>Device Information:</h3>
                <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><span style={{ color: '#666' }}>Product:</span> {piData.content.device_info.product_name || '-'}</div>
                    <div><span style={{ color: '#666' }}>Serial Number:</span> {piData.content.device_info.serial_number || '-'}</div>
                </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 30 }}>
                <thead>
                    <tr style={{ background: '#f5f5f5' }}>
                        <th style={{ padding: 12, textAlign: 'left', borderBottom: '2px solid #333', fontSize: 14 }}>Description</th>
                        <th style={{ padding: 12, textAlign: 'center', borderBottom: '2px solid #333', fontSize: 14, width: 80 }}>Qty</th>
                        <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #333', fontSize: 14, width: 120 }}>Unit Price</th>
                        <th style={{ padding: 12, textAlign: 'right', borderBottom: '2px solid #333', fontSize: 14, width: 120 }}>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {piData.content.items.map((item, index) => (
                        <tr key={item.id}>
                            <td style={{ padding: 12, borderBottom: '1px solid #ddd', fontSize: 14 }}>{item.description || `[Item ${index + 1}]`}</td>
                            <td style={{ padding: 12, borderBottom: '1px solid #ddd', textAlign: 'center', fontSize: 14 }}>{item.quantity}</td>
                            <td style={{ padding: 12, borderBottom: '1px solid #ddd', textAlign: 'right', fontSize: 14 }}>¥{item.unit_price.toFixed(2)}</td>
                            <td style={{ padding: 12, borderBottom: '1px solid #ddd', textAlign: 'right', fontSize: 14 }}>¥{item.total.toFixed(2)}</td>
                        </tr>
                    ))}
                    {piData.content.items.length === 0 && (
                        <tr>
                            <td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#999' }}>No items</td>
                        </tr>
                    )}
                </tbody>
            </table>

            {/* Totals */}
            <div style={{ marginLeft: 'auto', width: 300, marginBottom: 30 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <span>Subtotal:</span>
                    <span>¥{piData.subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <span>Tax ({piData.tax_rate}%):</span>
                    <span>¥{piData.tax_amount.toFixed(2)}</span>
                </div>
                {piData.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee', color: '#10B981' }}>
                        <span>Discount:</span>
                        <span>-¥{piData.discount_amount.toFixed(2)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid #333', fontSize: 18, fontWeight: 700 }}>
                    <span>Total:</span>
                    <span>¥{piData.total_amount.toFixed(2)}</span>
                </div>
            </div>

            {/* Terms */}
            <div style={{ marginBottom: 30 }}>
                <h3 style={{ fontSize: 14, color: '#666', borderBottom: '1px solid #ddd', paddingBottom: 8 }}>Terms & Conditions:</h3>
                <div style={{ marginTop: 12, fontSize: 14 }}>
                    <div><strong>Payment Terms:</strong> {piData.content.terms.payment_terms}</div>
                    <div style={{ marginTop: 8 }}><strong>Delivery Terms:</strong> {piData.content.terms.delivery_terms}</div>
                    <div style={{ marginTop: 8 }}><strong>Validity:</strong> This PI is valid for {piData.content.terms.valid_days} days.</div>
                </div>
            </div>

            {/* Notes */}
            {piData.content.notes && (
                <div style={{ marginBottom: 30 }}>
                    <h3 style={{ fontSize: 14, color: '#666', borderBottom: '1px solid #ddd', paddingBottom: 8 }}>Notes:</h3>
                    <div style={{ marginTop: 12, fontSize: 14, whiteSpace: 'pre-wrap' }}>{piData.content.notes}</div>
                </div>
            )}

            {/* Footer */}
            <div style={{ marginTop: 60, paddingTop: 20, borderTop: '1px solid #ddd', textAlign: 'center', fontSize: 12, color: '#999' }}>
                <p>This is a computer-generated document. No signature required.</p>
                <p style={{ marginTop: 8 }}>KINEFINITY TECHNOLOGY CO., LTD.</p>
            </div>
        </div>
    </div>
);
