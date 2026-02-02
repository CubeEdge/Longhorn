import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

const ServiceRecordCreatePage: React.FC = () => {
  const { token } = useAuthStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Ensure we are in the correct module
  React.useEffect(() => {
    // Assuming there's a global state or we just let AppRail handle it via URL
    // But if we want to be safe, we might trigger a module switch if we had access to it.
    // For now, simpler is better.
  }, []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    service_mode: 'CustomerService',
    customer_name: '',
    customer_contact: '',
    product_name: '',
    serial_number: '',
    firmware_version: '',
    service_type: 'Consultation',
    channel: 'Phone',
    problem_summary: '',
    problem_category: 'Hardware'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.problem_summary.trim()) {
      setError(t('service_record.fill_problem_desc'));
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/v1/service-records', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        navigate(`/service-records/${res.data.data.id}`);
      } else {
        setError(res.data.error?.message || '创建失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '创建失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/service-records')}
          className="btn btn-secondary"
          style={{ padding: '8px' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '4px' }}>{t('service_record.create')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('service_record.record_customer_issue')}
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: '#ef4444',
          marginBottom: '16px'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Service Mode */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>{t('service_record.service_mode')}</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '8px',
              border: `2px solid ${formData.service_mode === 'CustomerService' ? 'var(--accent-color)' : 'var(--border-color)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}>
              <input
                type="radio"
                name="service_mode"
                value="CustomerService"
                checked={formData.service_mode === 'CustomerService'}
                onChange={handleChange}
                style={{ display: 'none' }}
              />
              <div>
                <div style={{ fontWeight: 500 }}>{t('service_record.mode.customer_service')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('service_record.mode.customer_service_desc')}</div>
              </div>
            </label>
            <label style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              borderRadius: '8px',
              border: `2px solid ${formData.service_mode === 'QuickQuery' ? 'var(--accent-color)' : 'var(--border-color)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}>
              <input
                type="radio"
                name="service_mode"
                value="QuickQuery"
                checked={formData.service_mode === 'QuickQuery'}
                onChange={handleChange}
                style={{ display: 'none' }}
              />
              <div>
                <div style={{ fontWeight: 500 }}>{t('service_record.mode.quick_query')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('service_record.mode.quick_query_desc')}</div>
              </div>
            </label>
          </div>
        </div>

        {/* Customer Info */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>{t('service_record.customer_info')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.customer_name')}
              </label>
              <input
                type="text"
                name="customer_name"
                value={formData.customer_name}
                onChange={handleChange}
                className="form-control"
                placeholder={t('service_record.customer_name')}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.customer_contact')}
              </label>
              <input
                type="text"
                name="customer_contact"
                value={formData.customer_contact}
                onChange={handleChange}
                className="form-control"
                placeholder={t('service_record.customer_contact')}
              />
            </div>
          </div>
        </div>

        {/* Product Info */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>{t('service_record.product_info')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.product_model')}
              </label>
              <input
                type="text"
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                className="form-control"
                placeholder="MAVO Edge 8K"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.serial_number')}
              </label>
              <input
                type="text"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleChange}
                className="form-control"
                placeholder={t('service_record.serial_number')}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.firmware_version')}
              </label>
              <input
                type="text"
                name="firmware_version"
                value={formData.firmware_version}
                onChange={handleChange}
                className="form-control"
                placeholder="7.1.0"
              />
            </div>
          </div>
        </div>

        {/* Service Details */}
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>{t('service_record.service_details')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.problem_category')}
              </label>
              <select
                name="problem_category"
                value={formData.problem_category}
                onChange={handleChange}
                className="form-control"
              >
                <option value="">{t('common.select')}</option>
                <option value="Hardware">{t('issue.category.hardware')}</option>
                <option value="Software">{t('issue.category.software')}</option>
                <option value="Usage">{t('issue.category.usage')}</option>
                <option value="Firmware">{t('issue.category.firmware')}</option>
                <option value="Other">{t('issue.category.other')}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.service_type')} *
              </label>
              <select
                name="service_type"
                value={formData.service_type}
                onChange={handleChange}
                className="form-control"
              >
                <option value="Consultation">{t('service_record.type.consultation')}</option>
                <option value="TechnicalSupport">{t('service_record.type.technical_support')}</option>
                <option value="WarrantyQuery">{t('service_record.type.warranty_query')}</option>
                <option value="RepairRequest">{t('service_record.type.repair_request')}</option>
                <option value="Complaint">{t('service_record.type.complaint')}</option>
                <option value="Other">{t('service_record.type.other')}</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.channel')} *
              </label>
              <select
                name="channel"
                value={formData.channel}
                onChange={handleChange}
                className="form-control"
              >
                <option value="Phone">{t('service_record.channel.phone')}</option>
                <option value="Email">{t('service_record.channel.email')}</option>
                <option value="WeChat">{t('service_record.channel.wechat')}</option>
                <option value="Online">{t('service_record.channel.online')}</option>
                <option value="InPerson">{t('service_record.channel.inperson')}</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              {t('service_record.problem_description')} *
            </label>
            <textarea
              name="problem_summary"
              value={formData.problem_summary}
              onChange={handleChange}
              className="form-control"
              rows={4}
              placeholder={t('service_record.problem_description')}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate('/service-records')}
            className="btn btn-secondary"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {loading ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
            {loading ? t('service_record.creating') : t('service_record.create_record')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ServiceRecordCreatePage;
