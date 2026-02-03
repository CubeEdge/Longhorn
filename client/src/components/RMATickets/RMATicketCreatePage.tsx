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

interface Dealer {
    id: number;
    name: string;
}

const RMATicketCreatePage: React.FC = () => {
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);
    const [dealers, setDealers] = useState<Dealer[]>([]);

    // Form fields
    const [channelCode, setChannelCode] = useState('D');
    const [issueType, setIssueType] = useState('CustomerReturn');
    const [issueCategory, setIssueCategory] = useState('');
    const [severity, setSeverity] = useState(3);
    const [productId, setProductId] = useState<number | null>(null);
    const [serialNumber, setSerialNumber] = useState('');
    const [firmwareVersion, setFirmwareVersion] = useState('');
    const [problemDescription, setProblemDescription] = useState('');
    const [isWarranty, setIsWarranty] = useState(true);
    const [reporterName, setReporterName] = useState('');
    const [dealerId, setDealerId] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [productsRes, dealersRes] = await Promise.all([
                    axios.get('/api/v1/system/products', { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get('/api/v1/dealers', { headers: { Authorization: `Bearer ${token}` } })
                ]);
                if (productsRes.data.success) setProducts(productsRes.data.data || []);
                if (dealersRes.data.success) setDealers(dealersRes.data.data || []);
            } catch (err) {
                console.error('Failed to fetch data:', err);
            }
        };
        fetchData();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!problemDescription.trim()) {
            alert(t('rma_ticket.error.problem_required'));
            return;
        }

        setLoading(true);
        try {
            const payload = {
                channel_code: channelCode,
                issue_type: issueType,
                issue_category: issueCategory,
                severity,
                product_id: productId,
                serial_number: serialNumber,
                firmware_version: firmwareVersion,
                problem_description: problemDescription,
                is_warranty: isWarranty,
                reporter_name: reporterName,
                dealer_id: dealerId
            };

            const res = await axios.post('/api/v1/rma-tickets', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                navigate(`/rma-tickets/${res.data.data.id}`);
            }
        } catch (err: any) {
            console.error('Failed to create RMA ticket:', err);
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
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('rma_ticket.create')}</h1>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid var(--border-color)'
                }}>
                    {/* Channel & Issue Info */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                        {t('rma_ticket.section.classification')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('rma_ticket.field.channel')}</label>
                            <select value={channelCode} onChange={(e) => setChannelCode(e.target.value)} className="form-control">
                                <option value="D">{t('rma_ticket.channel.dealer')}</option>
                                <option value="C">{t('rma_ticket.channel.customer')}</option>
                                <option value="I">{t('rma_ticket.channel.internal')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label">{t('rma_ticket.field.issue_type')}</label>
                            <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="form-control">
                                <option value="CustomerReturn">{t('rma_ticket.issue_type.customer_return')}</option>
                                <option value="Production">{t('rma_ticket.issue_type.production')}</option>
                                <option value="Shipping">{t('rma_ticket.issue_type.shipping')}</option>
                                <option value="InternalSample">{t('rma_ticket.issue_type.internal_sample')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label">{t('rma_ticket.field.severity')}</label>
                            <select value={severity} onChange={(e) => setSeverity(parseInt(e.target.value))} className="form-control">
                                <option value={1}>P1 - {t('rma_ticket.severity.critical')}</option>
                                <option value={2}>P2 - {t('rma_ticket.severity.high')}</option>
                                <option value={3}>P3 - {t('rma_ticket.severity.normal')}</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('rma_ticket.field.issue_category')}</label>
                            <select value={issueCategory} onChange={(e) => setIssueCategory(e.target.value)} className="form-control">
                                <option value="">{t('rma_ticket.placeholder.select_category')}</option>
                                <option value="稳定性">{t('rma_ticket.category.stability')}</option>
                                <option value="硬件结构">{t('rma_ticket.category.hardware')}</option>
                                <option value="功能缺陷">{t('rma_ticket.category.functionality')}</option>
                                <option value="画质问题">{t('rma_ticket.category.image_quality')}</option>
                                <option value="存储问题">{t('rma_ticket.category.storage')}</option>
                            </select>
                        </div>
                        {channelCode === 'D' && (
                            <div>
                                <label className="form-label">{t('rma_ticket.field.dealer')}</label>
                                <select value={dealerId || ''} onChange={(e) => setDealerId(e.target.value ? parseInt(e.target.value) : null)} className="form-control">
                                    <option value="">{t('rma_ticket.placeholder.select_dealer')}</option>
                                    {dealers.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Product Info */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                        {t('rma_ticket.section.product')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('rma_ticket.field.product')}</label>
                            <select value={productId || ''} onChange={(e) => setProductId(e.target.value ? parseInt(e.target.value) : null)} className="form-control">
                                <option value="">{t('rma_ticket.placeholder.select_product')}</option>
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">{t('rma_ticket.field.serial_number')}</label>
                            <input
                                type="text"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value)}
                                className="form-control"
                                placeholder="ME_XXXXXX"
                            />
                        </div>
                        <div>
                            <label className="form-label">{t('rma_ticket.field.firmware_version')}</label>
                            <input
                                type="text"
                                value={firmwareVersion}
                                onChange={(e) => setFirmwareVersion(e.target.value)}
                                className="form-control"
                                placeholder="8025"
                            />
                        </div>
                    </div>

                    {/* Reporter */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('rma_ticket.field.reporter_name')}</label>
                            <input
                                type="text"
                                value={reporterName}
                                onChange={(e) => setReporterName(e.target.value)}
                                className="form-control"
                                placeholder={t('rma_ticket.placeholder.reporter_name')}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', paddingTop: '24px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isWarranty}
                                    onChange={(e) => setIsWarranty(e.target.checked)}
                                />
                                {t('rma_ticket.field.is_warranty')}
                            </label>
                        </div>
                    </div>

                    {/* Problem Description */}
                    <div style={{ marginBottom: '24px' }}>
                        <label className="form-label">{t('rma_ticket.field.problem_description')} *</label>
                        <textarea
                            value={problemDescription}
                            onChange={(e) => setProblemDescription(e.target.value)}
                            className="form-control"
                            rows={4}
                            placeholder={t('rma_ticket.placeholder.problem_description')}
                            required
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

export default RMATicketCreatePage;
