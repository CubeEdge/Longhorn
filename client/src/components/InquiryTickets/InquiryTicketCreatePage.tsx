import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
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
                navigate(`/inquiry-tickets/${res.data.data.id}`);
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
