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

const DealerRepairCreatePage: React.FC = () => {
    const { token } = useAuthStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState<Product[]>([]);

    // Form fields
    const [repairType, setRepairType] = useState('InWarranty');
    const [productId, setProductId] = useState<number | null>(null);
    const [serialNumber, setSerialNumber] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerContact, setCustomerContact] = useState('');
    const [problemDescription, setProblemDescription] = useState('');
    const [receivedCondition, setReceivedCondition] = useState('');
    const [accessories, setAccessories] = useState('');

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await axios.get('/api/v1/system/products', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data.success) setProducts(res.data.data || []);
            } catch (err) {
                console.error('Failed to fetch products:', err);
            }
        };
        fetchProducts();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!problemDescription.trim()) {
            alert(t('dealer_repair.error.problem_required'));
            return;
        }

        setLoading(true);
        try {
            const payload = {
                repair_type: repairType,
                product_id: productId,
                serial_number: serialNumber,
                customer_name: customerName,
                customer_contact: customerContact,
                problem_description: problemDescription,
                received_condition: receivedCondition,
                accessories
            };

            const res = await axios.post('/api/v1/dealer-repairs', payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                navigate(`/dealer-repairs/${res.data.data.id}`);
            }
        } catch (err: any) {
            console.error('Failed to create dealer repair:', err);
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
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('dealer_repair.create')}</h1>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{
                    background: 'var(--bg-card)',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid var(--border-color)'
                }}>
                    {/* Repair Type */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                        {t('dealer_repair.section.repair_info')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('dealer_repair.field.repair_type')}</label>
                            <select value={repairType} onChange={(e) => setRepairType(e.target.value)} className="form-control">
                                <option value="InWarranty">{t('dealer_repair.type.in_warranty')}</option>
                                <option value="OutOfWarranty">{t('dealer_repair.type.out_of_warranty')}</option>
                                <option value="Upgrade">{t('dealer_repair.type.upgrade')}</option>
                                <option value="Maintenance">{t('dealer_repair.type.maintenance')}</option>
                            </select>
                        </div>
                    </div>

                    {/* Product Info */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                        {t('dealer_repair.section.product')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('dealer_repair.field.product')}</label>
                            <select value={productId || ''} onChange={(e) => setProductId(e.target.value ? parseInt(e.target.value) : null)} className="form-control">
                                <option value="">{t('dealer_repair.placeholder.select_product')}</option>
                                {products.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label">{t('dealer_repair.field.serial_number')}</label>
                            <input
                                type="text"
                                value={serialNumber}
                                onChange={(e) => setSerialNumber(e.target.value)}
                                className="form-control"
                                placeholder="ME_XXXXXX"
                            />
                        </div>
                    </div>

                    {/* Customer Info */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>
                        {t('dealer_repair.section.customer')}
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('dealer_repair.field.customer_name')}</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="form-control"
                                placeholder={t('dealer_repair.placeholder.customer_name')}
                            />
                        </div>
                        <div>
                            <label className="form-label">{t('dealer_repair.field.customer_contact')}</label>
                            <input
                                type="text"
                                value={customerContact}
                                onChange={(e) => setCustomerContact(e.target.value)}
                                className="form-control"
                                placeholder={t('dealer_repair.placeholder.customer_contact')}
                            />
                        </div>
                    </div>

                    {/* Condition */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                            <label className="form-label">{t('dealer_repair.field.received_condition')}</label>
                            <input
                                type="text"
                                value={receivedCondition}
                                onChange={(e) => setReceivedCondition(e.target.value)}
                                className="form-control"
                                placeholder={t('dealer_repair.placeholder.received_condition')}
                            />
                        </div>
                        <div>
                            <label className="form-label">{t('dealer_repair.field.accessories')}</label>
                            <input
                                type="text"
                                value={accessories}
                                onChange={(e) => setAccessories(e.target.value)}
                                className="form-control"
                                placeholder={t('dealer_repair.placeholder.accessories')}
                            />
                        </div>
                    </div>

                    {/* Problem Description */}
                    <div style={{ marginBottom: '24px' }}>
                        <label className="form-label">{t('dealer_repair.field.problem_description')} *</label>
                        <textarea
                            value={problemDescription}
                            onChange={(e) => setProblemDescription(e.target.value)}
                            className="form-control"
                            rows={4}
                            placeholder={t('dealer_repair.placeholder.problem_description')}
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

export default DealerRepairCreatePage;
