import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Search, X } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useToast } from '../../store/useToast';

interface Product {
  id: number;
  product_line: string;
  model_name: string;
  serial_number?: string;
}

interface Customer {
  id: number;
  customer_type: string;
  customer_name: string;
  company_name?: string;
}

const IssueCreatePage: React.FC = () => {
  const { token } = useAuthStore();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Hardware');
  const [source, setSource] = useState('OnlineFeedback');
  const [severity, setSeverity] = useState('Medium');

  // Product selection
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Customer selection
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  // Fetch products and customers for selection
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, customersRes] = await Promise.all([
          axios.get('/api/products?limit=100', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/customers?limit=100', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        setProducts(productsRes.data.products || []);
        setCustomers(customersRes.data.customers || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    fetchData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) {
      // DEBUG: Alert on validation failure
      alert(`Validation Failed: Title or Description is empty.\nTitle: "${title}"\nDescription: "${description}"`);
      showToast(t('issue.error.required_fields'), 'error');
      return;
    }

    setLoading(true);
    console.log('payload:', {
      title,
      problem_description: description,
      issue_category: category,
      issue_source: source,
      severity,
      product_id: selectedProductId,
      customer_id: selectedCustomerId
    });

    try {
      const res = await axios.post('/api/v1/issues', {
        title,
        problem_description: description,
        issue_category: category,
        issue_source: source,
        severity,
        product_id: selectedProductId,
        customer_id: selectedCustomerId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      showToast(t('issue.created_success'), 'success');
      navigate(`/issues/${res.data.issue_id}`);
    } catch (err: any) {
      console.error('Failed to create issue:', err);
      // DEBUG: Alert the user to the specific error
      const errorMsg = err.response?.data?.error?.message || err.message || 'Unknown error';
      alert(`Debug Error: ${JSON.stringify(err.response?.data || err.message)}`);
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const filteredProducts = products.filter(p =>
    p.model_name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.serial_number && p.serial_number.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const filteredCustomers = customers.filter(c =>
    c.customer_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.company_name && c.company_name.toLowerCase().includes(customerSearch.toLowerCase()))
  );

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/issues')}
          className="btn btn-secondary"
          style={{ padding: '8px' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{t('issue.create')}</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid var(--border-color)'
        }}>
          {/* Title */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              {t('issue.title_field')} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('issue.title_placeholder')}
              className="form-control"
              style={{ width: '100%' }}
              required
            />
          </div>

          {/* Category & Source */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                {t('issue.category')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-control"
                style={{ width: '100%' }}
              >
                <option value="Hardware">{t('issue.category.hardware')}</option>
                <option value="Software">{t('issue.category.software')}</option>
                <option value="Consultation">{t('issue.category.consultation')}</option>
                <option value="Return">{t('issue.category.return')}</option>
                <option value="Complaint">{t('issue.category.complaint')}</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                {t('issue.source')} <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="form-control"
                style={{ width: '100%' }}
              >
                <option value="OnlineFeedback">{t('issue.source.online')}</option>
                <option value="OfflineReturn">{t('issue.source.offline')}</option>
                <option value="DealerFeedback">{t('issue.source.dealer')}</option>
                <option value="InternalTest">{t('issue.source.internal')}</option>
              </select>
            </div>
          </div>

          {/* Severity */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              {t('issue.severity')}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['Low', 'Medium', 'High', 'Critical'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeverity(s)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: severity === s ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                    background: severity === s ? 'var(--accent-color)' : 'transparent',
                    color: severity === s ? '#000' : 'var(--text-primary)',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  {(t as Function)(`issue.severity.${s.toLowerCase()}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Product Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              {t('issue.product')}
            </label>
            {selectedProduct ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{selectedProduct.model_name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {selectedProduct.product_line} {selectedProduct.serial_number && `· SN: ${selectedProduct.serial_number}`}
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedProductId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowProductPicker(!showProductPicker)}
                  className="form-control"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{t('issue.select_product')}</span>
                  <Search size={16} />
                </button>

                {showProductPicker && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder={t('action.search')}
                        className="form-control"
                        style={{ width: '100%' }}
                        autoFocus
                      />
                    </div>
                    {filteredProducts.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {t('issue.no_products')}
                      </div>
                    ) : (
                      filteredProducts.map(p => (
                        <div
                          key={p.id}
                          onClick={() => { setSelectedProductId(p.id); setShowProductPicker(false); setProductSearch(''); }}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 500 }}>{p.model_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {p.product_line} {p.serial_number && `· ${p.serial_number}`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Customer Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              {t('issue.customer')}
            </label>
            {selectedCustomer ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{selectedCustomer.customer_name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {(t as Function)(`customer.type.${selectedCustomer.customer_type.toLowerCase()}`)} {selectedCustomer.company_name && `· ${selectedCustomer.company_name}`}
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedCustomerId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowCustomerPicker(!showCustomerPicker)}
                  className="form-control"
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>{t('issue.select_customer')}</span>
                  <Search size={16} />
                </button>

                {showCustomerPicker && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder={t('action.search')}
                        className="form-control"
                        style={{ width: '100%' }}
                        autoFocus
                      />
                    </div>
                    {filteredCustomers.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        {t('issue.no_customers')}
                      </div>
                    ) : (
                      filteredCustomers.map(c => (
                        <div
                          key={c.id}
                          onClick={() => { setSelectedCustomerId(c.id); setShowCustomerPicker(false); setCustomerSearch(''); }}
                          style={{
                            padding: '12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontWeight: 500 }}>{c.customer_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {(t as Function)(`customer.type.${c.customer_type.toLowerCase()}`)} {c.company_name && `· ${c.company_name}`}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              {t('issue.description')} <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('issue.description_placeholder')}
              className="form-control"
              style={{ width: '100%', minHeight: '120px', resize: 'vertical' }}
              required
            />
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => navigate('/issues')}
              className="btn btn-secondary"
            >
              {t('action.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {loading ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
              {t('action.save')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default IssueCreatePage;
