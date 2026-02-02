import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Phone, Mail, MessageSquare, Clock, CheckCircle, ArrowUpCircle, Loader2, XCircle } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface ServiceRecord {
  id: number;
  record_number: string;
  service_mode: string;
  customer_name: string;
  customer_contact: string;
  product_name: string;
  serial_number: string;
  service_type: string;
  channel: string;
  problem_summary: string;
  status: string;
  handler: { id: number; name: string } | null;
  dealer: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
}

const statusColors: Record<string, string> = {
  Created: '#f59e0b',
  InProgress: '#3b82f6',
  WaitingCustomer: '#8b5cf6',
  Resolved: '#10b981',
  AutoClosed: '#6b7280',
  UpgradedToTicket: '#06b6d4'
};

const channelIcons: Record<string, React.ReactNode> = {
  Phone: <Phone size={14} />,
  Email: <Mail size={14} />,
  WeChat: <MessageSquare size={14} />,
  Online: <MessageSquare size={14} />,
  InPerson: <MessageSquare size={14} />
};

const ServiceRecordListPage: React.FC = () => {
  const { token } = useAuthStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecords = async () => {
    // Search-First: Don't load anything if no search term and default filters
    const isDefaultState = !searchTerm && statusFilter === 'all' && serviceTypeFilter === 'all';
    if (isDefaultState) {
      setRecords([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('page_size', pageSize.toString());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (serviceTypeFilter !== 'all') params.append('service_type', serviceTypeFilter);
      if (searchTerm) params.append('keyword', searchTerm);

      const res = await axios.get(`/api/v1/service-records?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setRecords(res.data.data);
        setTotal(res.data.meta.total);
      }
    } catch (err) {
      console.error('Failed to fetch service records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, statusFilter, serviceTypeFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const totalPages = Math.ceil(total / pageSize);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Created': return <Clock size={14} />;
      case 'InProgress': return <Loader2 size={14} />;
      case 'WaitingCustomer': return <Clock size={14} />;
      case 'Resolved': return <CheckCircle size={14} />;
      case 'AutoClosed': return <XCircle size={14} />;
      case 'UpgradedToTicket': return <ArrowUpCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      Created: t('service_record.status.created'),
      InProgress: t('service_record.status.inprogress'),
      WaitingCustomer: t('service_record.status.waiting_customer'),
      Resolved: t('service_record.status.resolved'),
      AutoClosed: t('service_record.status.auto_closed'),
      UpgradedToTicket: t('service_record.status.upgraded')
    };
    return labels[status] || status;
  };

  const getServiceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      Consultation: t('service_record.type.consultation'),
      TechnicalSupport: t('service_record.type.technical_support'),
      WarrantyQuery: t('service_record.type.warranty_query'),
      RepairRequest: t('service_record.type.repair_request'),
      Complaint: t('service_record.type.complaint'),
      Other: t('service_record.type.other')
    };
    return labels[type] || type;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '4px' }}>{t('service_record.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('service_record.total_count', { count: total })}
          </p>
        </div>
        <button
          onClick={() => navigate('/service-records/new')}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          {t('service_record.create')}
        </button>
      </div>

      {/* Search & Filters */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearch} style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '8px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('service_record.search_placeholder')}
                className="form-control"
                style={{ paddingLeft: '40px' }}
              />
            </div>
            <button type="submit" className="btn btn-secondary">{t('action.search')}</button>
          </form>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Filter size={16} />
            {t('action.filter')}
          </button>
        </div>

        {/* Quick Filters */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginTop: '12px' }}>
          <button
            onClick={() => { setStatusFilter('InProgress'); setServiceTypeFilter('all'); setSearchTerm(''); setPage(1); }}
            className={`btn btn-sm ${statusFilter === 'InProgress' ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t('service_record.status.inprogress')}
          </button>
          <button
            onClick={() => { setStatusFilter('Created'); setServiceTypeFilter('all'); setSearchTerm(''); setPage(1); }}
            className={`btn btn-sm ${statusFilter === 'Created' ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t('service_record.status.new')}
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                {t('issue.status')}
              </label>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="form-control"
                style={{ minWidth: '140px' }}
              >
                <option value="all">{t('filter.all')}</option>
                <option value="Created">{t('service_record.status.created')}</option>
                <option value="InProgress">{t('service_record.status.inprogress')}</option>
                <option value="WaitingCustomer">{t('service_record.status.waiting_customer')}</option>
                <option value="Resolved">{t('service_record.status.resolved')}</option>
                <option value="AutoClosed">{t('service_record.status.auto_closed')}</option>
                <option value="UpgradedToTicket">{t('service_record.status.upgraded')}</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                {t('service_record.service_type')}
              </label>
              <select
                value={serviceTypeFilter}
                onChange={(e) => { setServiceTypeFilter(e.target.value); setPage(1); }}
                className="form-control"
                style={{ minWidth: '140px' }}
              >
                <option value="all">{t('filter.all')}</option>
                <option value="Consultation">{t('service_record.type.consultation')}</option>
                <option value="TechnicalSupport">{t('service_record.type.technical_support')}</option>
                <option value="WarrantyQuery">{t('service_record.type.warranty_query')}</option>
                <option value="RepairRequest">{t('service_record.type.repair_request')}</option>
                <option value="Complaint">{t('service_record.type.complaint')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Service Record List */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <Loader2 size={32} className="spin" style={{ color: 'var(--accent-color)' }} />
          </div>
        ) : records.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {t('service_record.no_records')}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('service_record.record_number')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('service_record.customer_product')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('service_record.service_type')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('service_record.channel')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.status')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('service_record.handler')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.created_at')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.id}
                  onClick={() => navigate(`/service-records/${record.id}`)}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--accent-color)' }}>
                    {record.record_number}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, marginBottom: '2px' }}>{record.customer_name || '-'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {record.product_name || '-'} {record.serial_number && `· ${record.serial_number}`}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                    {getServiceTypeLabel(record.service_type)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {channelIcons[record.channel]}
                      {record.channel}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: `${statusColors[record.status]}20`,
                      color: statusColors[record.status]
                    }}>
                      {getStatusIcon(record.status)}
                      {getStatusLabel(record.status)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                    {record.handler?.name || <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {formatDate(record.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)'
          }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {t('service_record.show_range', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, total), total })}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary"
                style={{ padding: '6px 12px' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ padding: '6px 12px', fontSize: '0.875rem' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary"
                style={{ padding: '6px 12px' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceRecordListPage;
