import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Package, Clock, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface ContextResult {
  customer: {
    id: number;
    name: string;
    type: string;
    contact_person: string;
    phone: string;
    email: string;
    company: string;
  } | null;
  product: {
    serial_number: string;
    product_id: number;
    model_name: string;
    product_line: string;
    firmware_version: string;
    hardware_version: string;
  } | null;
  current_owner: {
    owner_name: string;
    account_id: number;
    first_seen: string;
    last_seen: string;
    service_count: number;
  } | null;
  service_records: {
    id: number;
    record_number: string;
    service_type: string;
    channel: string;
    problem_summary: string;
    status: string;
    handler_name: string;
    created_at: string;
  }[];
  issues: {
    id: number;
    issue_number: string;
    rma_number: string;
    ticket_type: string;
    issue_type: string;
    issue_category: string;
    severity: number;
    status: string;
    title: string;
    product_name: string;
    serial_number: string;
    is_warranty: boolean;
    customer_name: string;
    created_at: string;
  }[];
  products: {
    serial_number: string;
    product_id: number;
    product_name: string;
    product_line: string;
    firmware_version: string;
    last_service_date: string;
  }[];
  ownership_history: {
    owner_name: string;
    account_id: number;
    first_seen: string;
    last_seen: string;
    service_count: number;
  }[];
  summary: {
    total_service_records: number;
    total_issues: number;
    total_products?: number;
    total_owners?: number;
    open_issues?: number;
    pending_service_records?: number;
    warranty_repairs?: number;
    non_warranty_repairs?: number;
  };
}

type SearchMode = 'customer' | 'serial';

const ContextPanel: React.FC = () => {
  const { token } = useAuthStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [searchMode, setSearchMode] = useState<SearchMode>('customer');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ContextResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const endpoint = searchMode === 'customer'
        ? `/api/v1/context/customer/${encodeURIComponent(searchQuery)}`
        : `/api/v1/context/serial/${encodeURIComponent(searchQuery)}`;

      const res = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setResult(res.data.data);
      } else {
        setError(res.data.error?.message || '查询失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '查询失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Created: '#f59e0b',
      InProgress: '#3b82f6',
      WaitingCustomer: '#8b5cf6',
      Resolved: '#10b981',
      AutoClosed: '#6b7280',
      UpgradedToTicket: '#06b6d4',
      Pending: '#f59e0b',
      Assigned: '#3b82f6',
      Closed: '#10b981'
    };
    return colors[status] || '#6b7280';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px' }}>{t('context.title')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {t('context.subtitle')}
        </p>
      </div>

      {/* Search Form */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        border: '1px solid var(--border-color)'
      }}>
        {/* Search Mode Toggle */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <button
            onClick={() => { setSearchMode('customer'); setResult(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: `2px solid ${searchMode === 'customer' ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: searchMode === 'customer' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s'
            }}
          >
            <User size={20} style={{ color: searchMode === 'customer' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>{t('context.search_by_customer')}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('context.search_by_customer_desc')}</div>
            </div>
          </button>
          <button
            onClick={() => { setSearchMode('serial'); setResult(null); }}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: `2px solid ${searchMode === 'serial' ? 'var(--accent-color)' : 'var(--border-color)'}`,
              background: searchMode === 'serial' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s'
            }}
          >
            <Package size={20} style={{ color: searchMode === 'serial' ? 'var(--accent-color)' : 'var(--text-secondary)' }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>{t('context.search_by_serial')}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('context.search_by_serial_desc')}</div>
            </div>
          </button>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchMode === 'customer' ? t('context.customer_placeholder') : t('context.serial_placeholder')}
              className="form-control"
              style={{ paddingLeft: '40px' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {loading ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
            {t('context.query')}
          </button>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '16px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: '#ef4444',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
          {/* Left Column - Info Cards */}
          <div>
            {/* Customer Info (for customer search) */}
            {searchMode === 'customer' && result.customer && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid var(--border-color)'
              }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('context.customer_info')}</h3>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{result.customer.name}</div>
                  {result.customer.company && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{result.customer.company}</div>
                  )}
                </div>
                {result.customer.phone && (
                  <div style={{ fontSize: '0.875rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>电话: </span>{result.customer.phone}
                  </div>
                )}
                {result.customer.email && (
                  <div style={{ fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>邮箱: </span>{result.customer.email}
                  </div>
                )}
              </div>
            )}

            {/* Product Info (for serial search) */}
            {searchMode === 'serial' && result.product && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid var(--border-color)'
              }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('context.product_info')}</h3>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: 600 }}>{result.product.model_name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{result.product.product_line}</div>
                </div>
                <div style={{ fontSize: '0.875rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>序列号: </span>
                  <span style={{ fontFamily: 'monospace' }}>{result.product.serial_number}</span>
                </div>
                {result.product.firmware_version && (
                  <div style={{ fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>固件: </span>{result.product.firmware_version}
                  </div>
                )}
              </div>
            )}

            {/* Current Owner (for serial search) */}
            {searchMode === 'serial' && result.current_owner && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '16px',
                border: '1px solid var(--border-color)'
              }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('context.current_owner')}</h3>
                <div style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '4px' }}>{result.current_owner.owner_name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {t('context.service_count', { count: result.current_owner.service_count })} · {t('context.recent')} {formatDate(result.current_owner.last_seen)}
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('context.summary')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-color)' }}>
                    {result.summary.total_service_records}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('context.service_records')}</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>
                    {result.summary.total_issues}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('context.issues')}</div>
                </div>
                {result.summary.open_issues !== undefined && (
                  <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>
                      {result.summary.open_issues}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('context.pending')}</div>
                  </div>
                )}
                {searchMode === 'customer' && result.summary.total_products !== undefined && (
                  <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                      {result.summary.total_products}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('context.related_products')}</div>
                  </div>
                )}
                {searchMode === 'serial' && result.summary.total_owners !== undefined && (
                  <div style={{ textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>
                      {result.summary.total_owners}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('context.history_owners')}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Records */}
          <div>
            {/* Service Records */}
            {result.service_records.length > 0 && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                marginBottom: '16px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{t('context.service_records')} ({result.service_records.length})</h3>
                </div>
                <div>
                  {result.service_records.slice(0, 5).map(sr => (
                    <div
                      key={sr.id}
                      onClick={() => navigate(`/service-records/${sr.id}`)}
                      style={{
                        padding: '12px 20px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--accent-color)' }}>
                          {sr.record_number}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: `${getStatusColor(sr.status)}20`,
                          color: getStatusColor(sr.status)
                        }}>
                          {sr.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                        {sr.problem_summary?.substring(0, 60)}...
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {sr.service_type} · {formatDate(sr.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
                {result.service_records.length > 5 && (
                  <div
                    onClick={() => navigate('/service-records')}
                    style={{
                      padding: '12px 20px',
                      textAlign: 'center',
                      color: 'var(--accent-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    {t('context.view_all', { count: result.service_records.length })} <ChevronRight size={16} />
                  </div>
                )}
              </div>
            )}

            {/* Issues */}
            {result.issues.length > 0 && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{t('context.issue_records')} ({result.issues.length})</h3>
                </div>
                <div>
                  {result.issues.slice(0, 5).map(issue => (
                    <div
                      key={issue.id}
                      onClick={() => navigate(`/issues/${issue.id}`)}
                      style={{
                        padding: '12px 20px',
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--accent-color)' }}>
                            {issue.issue_number}
                          </span>
                          {issue.rma_number && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              RMA: {issue.rma_number}
                            </span>
                          )}
                        </div>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          background: `${getStatusColor(issue.status)}20`,
                          color: getStatusColor(issue.status)
                        }}>
                          {issue.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.875rem', marginBottom: '2px' }}>
                        {issue.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {issue.issue_category} · {issue.is_warranty ? t('context.warranty') : t('context.non_warranty')} · {formatDate(issue.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
                {result.issues.length > 5 && (
                  <div
                    onClick={() => navigate('/issues')}
                    style={{
                      padding: '12px 20px',
                      textAlign: 'center',
                      color: 'var(--accent-color)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    {t('context.view_all', { count: result.issues.length })} <ChevronRight size={16} />
                  </div>
                )}
              </div>
            )}

            {/* No Records */}
            {result.service_records.length === 0 && result.issues.length === 0 && (
              <div style={{
                background: 'var(--bg-card)',
                borderRadius: '12px',
                padding: '48px',
                border: '1px solid var(--border-color)',
                textAlign: 'center'
              }}>
                <Clock size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px' }} />
                <p style={{ color: 'var(--text-secondary)' }}>{t('context.no_service_records')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextPanel;
