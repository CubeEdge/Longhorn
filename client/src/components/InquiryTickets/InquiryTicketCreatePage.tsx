import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface Product {
    id: number;
    name: string;
}

const InquiryTicketCreatePage: React.FC = () => {
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);

    // Form fields
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [productId, setProductId] = useState<number | null>(null);
    const [serialNumber, setSerialNumber] = useState('');
    const [serviceType, setServiceType] = useState('Consultation');
    const [channel, setChannel] = useState('');
    const [problemSummary, setProblemSummary] = useState('');
    const [communicationLog, setCommunicationLog] = useState('');

    // AI State
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [showAi, setShowAi] = useState(true);

    useEffect(() => {
        // Fetch products for dropdown
        const fetchProducts = async () => {
            try {
                const res = await axios.get('/api/v1/system/products', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) {
                    setProducts(res.data.data || []);
                }
            } catch (err) {
                console.error('Failed to fetch products:', err);
            }
        };
        fetchProducts();
    }, [token]);

    const handleAiFill = async () => {
        if (!aiInput.trim()) return;
        setAiLoading(true);
        try {
            const res = await axios.post('/api/ai/ticket_parse',
                { text: aiInput },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success && res.data.data) {
                const data = res.data.data;
                if (data.customer_name) setCustomerName(data.customer_name);
                if (data.contact_info) setCustomerContact(data.contact_info);
                if (data.issue_summary) setProblemSummary(data.issue_summary);

                // Append description to communication log if exists, else replace
                const newLog = data.issue_description || '';
                setCommunicationLog(prev => prev ? `${prev}\n\n[AI Extracted]:\n${newLog}` : newLog);

                // Try to match product
                if (data.product_model) {
                    const matched = products.find(p => p.name.toLowerCase().includes(data.product_model.toLowerCase()) || data.product_model.toLowerCase().includes(p.name.toLowerCase()));
                    if (matched) {
                        setProductId(matched.id);
                    }
                }

                // Try to match urgency to service type or prepend to summary
                if (data.urgency === 'High' || data.urgency === 'Critical') {
                    setProblemSummary(prev => `[${data.urgency}] ${prev}`);
                }
            }
        } catch (err) {
            console.error('AI Fill Error:', err);
            alert(t('common.error'));
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!problemSummary.trim()) {
            alert(t('inquiry_ticket.error.problem_required'));
            return;
        }

        setLoading(true);
        try {
            const payload = {
                customer_name: customerName,
                customer_contact: customerContact,
                product_id: productId,
                serial_number: serialNumber,
                service_type: serviceType,
                channel,
                problem_summary: problemSummary,
                communication_log: communicationLog
            };

            const res = await axios.post('/api/v1/inquiry-tickets', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                navigate(`/service/inquiry-tickets/${res.data.data.id}`);
            }
        } catch (err: any) {
            console.error('Failed to create inquiry ticket:', err);
            alert(err.response?.data?.error?.message || t('common.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">
                    <ArrowLeft size={18} />
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('inquiry_ticket.create')}</h1>
            </div>

            {/* AI Smart Assist Section */}
            <div style={{
                marginBottom: '24px',
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.05) 100%)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '12px',
                padding: '20px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={20} color="#FFD700" fill="#FFD700" />
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#FFD700' }}>AI Smart Assist</h3>
                    </div>
                    <button
                        onClick={() => setShowAi(!showAi)}
                        style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        {showAi ? 'Hide' : 'Show'}
                    </button>
                </div>

                {showAi && (
                    <>
                        <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#aaa' }}>
                            Paste email content, chat logs, or issue descriptions here to auto-fill the form.
                        </p>
                        <textarea
                            value={aiInput}
                            onChange={(e) => setAiInput(e.target.value)}
                            placeholder="Paste text here..."
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                padding: '12px',
                                color: '#eee',
                                marginBottom: '12px',
                                fontSize: '0.9rem'
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                onClick={() => setAiInput('')}
                                className="btn btn-ghost btn-sm"
                                style={{ color: '#888' }}
                                disabled={aiLoading}
                            >
                                <RotateCcw size={14} style={{ marginRight: '6px' }} />
                                Clear
                            </button>
                            <button
                                onClick={handleAiFill}
                                disabled={aiLoading || !aiInput.trim()}
                                style={{
                                    background: '#FFD700',
                                    color: 'black',
                                    border: 'none',
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    cursor: (aiLoading || !aiInput.trim()) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    opacity: (aiLoading || !aiInput.trim()) ? 0.7 : 1
                                }}
                            >
                                {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                Auto-Fill Form
                            </button>
                        </div>
                    </>
                )}
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid var(--border-color)'
                }}>
                    {/* Customer Info */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                        {t('inquiry_ticket.section.customer')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('inquiry_ticket.field.customer_name')}</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="form-control"
                                placeholder={t('inquiry_ticket.placeholder.customer_name')}
                            />
                        </div>
                        <div>
                            <label className="form-label">{t('inquiry_ticket.field.customer_contact')}</label>
                            <input
                                type="text"
                                value={customerContact}
                                onChange={(e) => setCustomerContact(e.target.value)}
                                className="form-control"
                                placeholder={t('inquiry_ticket.placeholder.customer_contact')}
                            />
                        </div>
                    </div>

                    {/* Product Info */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                        {t('inquiry_ticket.section.product')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('inquiry_ticket.field.product')}</label>
                            <select
                                value={productId || ''}
                                onChange={(e) => setProductId(e.target.value ? parseInt(e.target.value) : null)}
                                className="form-control"
                            >
                                <option value="">{t('inquiry_ticket.placeholder.select_product')}</option>
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">{t('inquiry_ticket.field.serial_number')}</label>
                            <input
                                type="text"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value)}
                                className="form-control"
                                placeholder={t('inquiry_ticket.placeholder.serial_number')}
                            />
                        </div>
                    </div>

                    {/* Service Info */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                        {t('inquiry_ticket.section.service')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('inquiry_ticket.field.service_type')}</label>
                            <select
                                value={serviceType}
                                onChange={(e) => setServiceType(e.target.value)}
                                className="form-control"
                            >
                                <option value="Consultation">{t('inquiry_ticket.type.consultation')}</option>
                                <option value="Troubleshooting">{t('inquiry_ticket.type.troubleshooting')}</option>
                                <option value="RemoteAssist">{t('inquiry_ticket.type.remote_assist')}</option>
                                <option value="Complaint">{t('inquiry_ticket.type.complaint')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label">{t('inquiry_ticket.field.channel')}</label>
                            <select
                                value={channel}
                                onChange={(e) => setChannel(e.target.value)}
                                className="form-control"
                            >
                                <option value="">{t('inquiry_ticket.placeholder.select_channel')}</option>
                                <option value="Phone">📞 {t('inquiry_ticket.channel.phone')}</option>
                                <option value="Email">📧 {t('inquiry_ticket.channel.email')}</option>
                                <option value="WeChat">💬 {t('inquiry_ticket.channel.wechat')}</option>
                                <option value="WeCom">💼 {t('inquiry_ticket.channel.wecom')}</option>
                                <option value="Facebook">📘 {t('inquiry_ticket.channel.facebook')}</option>
                                <option value="Online">🌐 {t('inquiry_ticket.channel.online')}</option>
                            </select>
                        </div>
                    </div>

                    {/* Problem */}
                    <div style={{ marginBottom: '16px' }}>
                        <label className="form-label">{t('inquiry_ticket.field.problem_summary')} *</label>
                        <textarea
                            value={problemSummary}
                            onChange={(e) => setProblemSummary(e.target.value)}
                            className="form-control"
                            rows={3}
                            placeholder={t('inquiry_ticket.placeholder.problem_summary')}
                            required
                        />
                    </div>

                    {/* Communication Log */}
                    <div style={{ marginBottom: '24px' }}>
                        <label className="form-label">{t('inquiry_ticket.field.communication_log')}</label>
                        <textarea
                            value={communicationLog}
                            onChange={(e) => setCommunicationLog(e.target.value)}
                            className="form-control"
                            rows={5}
                            placeholder={t('inquiry_ticket.placeholder.communication_log')}
                        />
                    </div>

                    {/* Submit */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
                            {t('action.cancel')}
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            <span style={{ marginLeft: '8px' }}>{t('action.save')}</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default InquiryTicketCreatePage;
