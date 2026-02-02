import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight, AlertCircle, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface Issue {
  id: number;
  issue_number: string;
  title: string;
  status: string;
  severity: string;
  issue_category: string;
  issue_source: string;
  product_model?: string;
  customer_name?: string;
  assigned_to_name?: string;
  created_by_name: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  Pending: '#f59e0b',
  Assigned: '#3b82f6',
  InProgress: '#8b5cf6',
  AwaitingVerification: '#06b6d4',
  Closed: '#10b981',
  Rejected: '#ef4444'
};

const severityColors: Record<string, string> = {
  Low: '#6b7280',
  Medium: '#f59e0b',
  High: '#f97316',
  Critical: '#ef4444'
};

const IssueListPage: React.FC = () => {
  const { token } = useAuthStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchIssues = async () => {
    // Search-First: Don't load anything if no search term and default filters
    const isDefaultState = !searchTerm && statusFilter === 'all' && categoryFilter === 'all';
    if (isDefaultState) {
      setIssues([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchTerm) params.append('search', searchTerm);

      const res = await axios.get(`/api/issues?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setIssues(res.data.data); // Fixed: response structure is { data: [...], meta: ... } based on issues.js
      setTotal(res.data.meta.total);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [page, statusFilter, categoryFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchIssues();
  };

  const totalPages = Math.ceil(total / limit);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Pending': return <Clock size={14} />;
      case 'Closed': return <CheckCircle size={14} />;
      case 'Rejected': return <XCircle size={14} />;
      default: return <AlertCircle size={14} />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '4px' }}>{t('issue.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {t('issue.total_count', { count: total })}
          </p>
        </div>
        <button
          onClick={() => navigate('/issues/new')}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} />
          {t('issue.create')}
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
                placeholder={t('issue.search_placeholder')}
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
            onClick={() => { setStatusFilter('Pending'); setCategoryFilter('all'); setSearchTerm(''); setPage(1); }}
            className={`btn btn-sm ${statusFilter === 'Pending' ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t('issue.status.pending')}
          </button>
          <button
            onClick={() => { setStatusFilter('Assigned'); setCategoryFilter('all'); setSearchTerm(''); setPage(1); }}
            className={`btn btn-sm ${statusFilter === 'Assigned' ? 'btn-primary' : 'btn-ghost'}`}
          >
            {t('issue.status.assigned')}
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
                <option value="Pending">{t('issue.status.pending')}</option>
                <option value="Assigned">{t('issue.status.assigned')}</option>
                <option value="InProgress">{t('issue.status.inprogress')}</option>
                <option value="AwaitingVerification">{t('issue.status.awaitingverification')}</option>
                <option value="Closed">{t('issue.status.closed')}</option>
                <option value="Rejected">{t('issue.status.rejected')}</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                {t('issue.category')}
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className="form-control"
                style={{ minWidth: '140px' }}
              >
                <option value="all">{t('filter.all')}</option>
                <option value="Hardware">{t('issue.category.hardware')}</option>
                <option value="Software">{t('issue.category.software')}</option>
                <option value="Consultation">{t('issue.category.consultation')}</option>
                <option value="Return">{t('issue.category.return')}</option>
                <option value="Complaint">{t('issue.category.complaint')}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Issue List */}
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
        ) : issues.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {t('issue.no_issues')}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.number')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.title_field')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.status')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.severity')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.customer')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.assignee')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 500, fontSize: '0.875rem' }}>{t('issue.created_at')}</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr
                  key={issue.id}
                  onClick={() => navigate(`/issues/${issue.id}`)}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--accent-color)' }}>
                    {issue.issue_number}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 500, marginBottom: '2px' }}>{issue.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {(t as Function)(`issue.category.${issue.issue_category.toLowerCase()}`)} · {issue.product_model || '-'}
                    </div>
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
                      background: `${statusColors[issue.status]}20`,
                      color: statusColors[issue.status]
                    }}>
                      {getStatusIcon(issue.status)}
                      {(t as Function)(`issue.status.${issue.status.toLowerCase()}`)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      background: `${severityColors[issue.severity]}20`,
                      color: severityColors[issue.severity]
                    }}>
                      {(t as Function)(`issue.severity.${issue.severity.toLowerCase()}`)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                    {issue.customer_name || '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                    {issue.assigned_to_name || <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {formatDate(issue.created_at)}
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
              {t('pagination.showing', { from: (page - 1) * limit + 1, to: Math.min(page * limit, total), total })}
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

export default IssueListPage;
