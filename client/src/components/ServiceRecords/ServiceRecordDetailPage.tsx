import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, ArrowUpCircle, Clock, CheckCircle, Loader2, User, Phone, Mail, Package, MessageSquare } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';

interface ServiceRecordDetail {
  id: number;
  record_number: string;
  service_mode: string;
  customer_name: string;
  customer_contact: string;
  customer_id: number | null;
  product_id: number | null;
  product_name: string;
  serial_number: string;
  firmware_version: string;
  hardware_version: string;
  service_type: string;
  channel: string;
  problem_summary: string;
  problem_category: string;
  status: string;
  resolution: string;
  resolution_type: string;
  handler: { id: number; name: string } | null;
  dealer: { id: number; name: string; code: string } | null;
  department: string;
  upgraded_to_issue_id: number | null;
  upgrade_reason: string;
  first_response_at: string | null;
  resolved_at: string | null;
  waiting_customer_since: string | null;
  created_by: { id: number; name: string };
  created_at: string;
  updated_at: string;
  comments: Comment[];
  status_history: StatusHistory[];
  linked_issue: { id: number; issue_number: string; rma_number: string; status: string; title: string } | null;
  permissions: { can_edit: boolean; can_upgrade: boolean };
}

interface Comment {
  id: number;
  content: string;
  comment_type: string;
  is_internal: boolean;
  author: { id: number; name: string };
  created_at: string;
}

interface StatusHistory {
  from_status: string;
  to_status: string;
  reason: string;
  changed_by: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  Created: '#f59e0b',
  InProgress: '#3b82f6',
  WaitingCustomer: '#8b5cf6',
  Resolved: '#10b981',
  AutoClosed: '#6b7280',
  UpgradedToTicket: '#06b6d4'
};

const ServiceRecordDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuthStore();
  const { t } = useLanguage();

  const [record, setRecord] = useState<ServiceRecordDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Comment form
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Upgrade modal
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeData, setUpgradeData] = useState({
    ticket_type: 'IS',
    issue_category: '',
    severity: 3,
    upgrade_reason: ''
  });

  const fetchRecord = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/v1/service-records/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        setRecord(res.data.data);
      } else {
        setError(res.data.error?.message || '加载失败');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await axios.patch(`/api/v1/service-records/${id}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRecord();
    } catch (err) {
      console.error('Status change failed:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    setSubmitting(true);
    try {
      await axios.post(`/api/v1/service-records/${id}/comments`, {
        content: newComment,
        comment_type: 'Staff',
        is_internal: isInternal
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNewComment('');
      setIsInternal(false);
      fetchRecord();
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpgrade = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post(`/api/v1/service-records/${id}/upgrade`, upgradeData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.data.success) {
        navigate(`/issues/${res.data.data.issue_id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '升级失败');
    } finally {
      setSubmitting(false);
      setShowUpgradeModal(false);
    }
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--accent-color)' }} />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          padding: '48px',
          textAlign: 'center',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)'
        }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{error || t('service_record.not_exist')}</p>
          <button onClick={() => navigate('/service-records')} className="btn btn-secondary">
            {t('service_record.back_to_list')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/service-records')}
          className="btn btn-secondary"
          style={{ padding: '8px' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{record.record_number}</h1>
            <span style={{
              padding: '4px 12px',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              background: `${statusColors[record.status]}20`,
              color: statusColors[record.status]
            }}>
              {getStatusLabel(record.status)}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {getServiceTypeLabel(record.service_type)} · {record.channel} · 创建于 {formatDate(record.created_at)}
          </p>
        </div>
        
        {record.permissions.can_upgrade && record.status !== 'UpgradedToTicket' && (
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <ArrowUpCircle size={18} />
            {t('service_record.upgrade_to_ticket')}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
        {/* Main Content */}
        <div>
          {/* Problem Summary */}
          <div style={{ 
            background: 'var(--bg-card)', 
            borderRadius: '12px', 
            padding: '20px',
            marginBottom: '16px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>{t('service_record.problem_summary')}</h3>
            <p style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{record.problem_summary}</p>
          </div>

          {/* Linked Issue */}
          {record.linked_issue && (
            <div style={{ 
              background: 'var(--bg-card)', 
              borderRadius: '12px', 
              padding: '16px',
              marginBottom: '16px',
              border: '1px solid #06b6d4',
              cursor: 'pointer'
            }}
            onClick={() => navigate(`/issues/${record.linked_issue!.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ArrowUpCircle size={16} style={{ color: '#06b6d4' }} />
                <span style={{ fontWeight: 500, color: '#06b6d4' }}>{t('service_record.upgraded_to_ticket')}</span>
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--accent-color)' }}>{record.linked_issue.issue_number}</span>
                {record.linked_issue.rma_number && (
                  <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>RMA: {record.linked_issue.rma_number}</span>
                )}
                <p style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>{record.linked_issue.title}</p>
              </div>
            </div>
          )}

          {/* Comments */}
          <div style={{ 
            background: 'var(--bg-card)', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>{t('service_record.communication_log')}</h3>
            
            {record.comments.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px' }}>{t('service_record.no_communication')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {record.comments.map(comment => (
                  <div key={comment.id} style={{
                    padding: '12px 16px',
                    background: comment.is_internal ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-secondary)',
                    borderRadius: '8px',
                    borderLeft: comment.is_internal ? '3px solid #f59e0b' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                        {comment.author.name}
                        {comment.is_internal && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>(内部备注)</span>}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{comment.content}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add Comment Form */}
            {record.permissions.can_edit && (
              <form onSubmit={handleAddComment}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('service_record.add_comment')}
                  className="form-control"
                  rows={3}
                  style={{ marginBottom: '12px', resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{t('service_record.internal_note')}</span>
                  </label>
                  <button
                    type="submit"
                    disabled={submitting || !newComment.trim()}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {submitting ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                    发送
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Customer Info */}
          <div style={{ 
            background: 'var(--bg-card)', 
            borderRadius: '12px', 
            padding: '20px',
            marginBottom: '16px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('service_record.customer_info')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>{record.customer_name || '-'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Phone size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>{record.customer_contact || '-'}</span>
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
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('service_record.product_info')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Package size={16} style={{ color: 'var(--text-secondary)' }} />
                <span>{record.product_name || '-'}</span>
              </div>
              {record.serial_number && (
                <div style={{ fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('service_record.serial_number')}: </span>
                  <span style={{ fontFamily: 'monospace' }}>{record.serial_number}</span>
                </div>
              )}
              {record.firmware_version && (
                <div style={{ fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('service_record.firmware_version')}: </span>
                  <span>{record.firmware_version}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Actions */}
          {record.permissions.can_edit && record.status !== 'UpgradedToTicket' && (
            <div style={{ 
              background: 'var(--bg-card)', 
              borderRadius: '12px', 
              padding: '20px',
              marginBottom: '16px',
              border: '1px solid var(--border-color)'
            }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('service_record.status_actions')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {record.status === 'Created' && (
                  <button
                    onClick={() => handleStatusChange('InProgress')}
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                  >
                    {t('service_record.start_processing')}
                  </button>
                )}
                {record.status === 'InProgress' && (
                  <>
                    <button
                      onClick={() => handleStatusChange('WaitingCustomer')}
                      className="btn btn-secondary"
                      style={{ width: '100%' }}
                    >
                      {t('service_record.wait_customer')}
                    </button>
                    <button
                      onClick={() => handleStatusChange('Resolved')}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      {t('service_record.mark_resolved')}
                    </button>
                  </>
                )}
                {record.status === 'WaitingCustomer' && (
                  <>
                    <button
                      onClick={() => handleStatusChange('InProgress')}
                      className="btn btn-secondary"
                      style={{ width: '100%' }}
                    >
                      {t('service_record.continue_processing')}
                    </button>
                    <button
                      onClick={() => handleStatusChange('Resolved')}
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                    >
                      {t('service_record.mark_resolved')}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Time Metrics */}
          <div style={{ 
            background: 'var(--bg-card)', 
            borderRadius: '12px', 
            padding: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '16px', color: 'var(--text-secondary)' }}>{t('service_record.time_info')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('issue.created_at')}</span>
                <span>{formatDate(record.created_at)}</span>
              </div>
              {record.first_response_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('service_record.first_response')}</span>
                  <span>{formatDate(record.first_response_at)}</span>
                </div>
              )}
              {record.resolved_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('service_record.resolved_at')}</span>
                  <span>{formatDate(record.resolved_at)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('service_record.handler')}</span>
                <span>{record.handler?.name || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '500px',
            border: '1px solid var(--border-color)'
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '20px' }}>{t('service_record.upgrade_modal.title')}</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.upgrade_modal.ticket_type')}
              </label>
              <select
                value={upgradeData.ticket_type}
                onChange={(e) => setUpgradeData(prev => ({ ...prev, ticket_type: e.target.value }))}
                className="form-control"
              >
                <option value="IS">{t('service_record.upgrade_modal.ticket_type.is')}</option>
                <option value="LR">{t('service_record.upgrade_modal.ticket_type.lr')}</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.upgrade_modal.issue_category')}
              </label>
              <select
                value={upgradeData.issue_category}
                onChange={(e) => setUpgradeData(prev => ({ ...prev, issue_category: e.target.value }))}
                className="form-control"
              >
                <option value="">{t('issue.select_product')}</option>
                <option value="Stability">{t('service_record.upgrade_modal.category.stability')}</option>
                <option value="Material">{t('service_record.upgrade_modal.category.material')}</option>
                <option value="Monitor">{t('service_record.upgrade_modal.category.monitor')}</option>
                <option value="SSD">{t('service_record.upgrade_modal.category.ssd')}</option>
                <option value="Audio">{t('service_record.upgrade_modal.category.audio')}</option>
                <option value="Compatibility">{t('service_record.upgrade_modal.category.compatibility')}</option>
                <option value="Timecode">{t('service_record.upgrade_modal.category.timecode')}</option>
                <option value="Hardware">{t('service_record.upgrade_modal.category.hardware')}</option>
              </select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.upgrade_modal.severity')}
              </label>
              <select
                value={upgradeData.severity}
                onChange={(e) => setUpgradeData(prev => ({ ...prev, severity: parseInt(e.target.value) }))}
                className="form-control"
              >
                <option value={1}>{t('service_record.upgrade_modal.severity.1')}</option>
                <option value={2}>{t('service_record.upgrade_modal.severity.2')}</option>
                <option value={3}>{t('service_record.upgrade_modal.severity.3')}</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                {t('service_record.upgrade_modal.upgrade_reason')}
              </label>
              <textarea
                value={upgradeData.upgrade_reason}
                onChange={(e) => setUpgradeData(prev => ({ ...prev, upgrade_reason: e.target.value }))}
                className="form-control"
                rows={3}
                placeholder={t('service_record.upgrade_modal.upgrade_reason')}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="btn btn-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleUpgrade}
                disabled={submitting}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {submitting ? <Loader2 size={16} className="spin" /> : <ArrowUpCircle size={16} />}
                {t('service_record.upgrade_modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceRecordDetailPage;
