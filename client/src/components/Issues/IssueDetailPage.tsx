import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Package, Clock, AlertCircle, MessageSquare, Paperclip, Send, Upload, Download, Loader2, Edit2, UserPlus } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useToast } from '../../store/useToast';

interface IssueDetail {
  id: number;
  issue_number: string;
  title: string;
  description: string;
  status: string;
  severity: string;
  issue_category: string;
  issue_source: string;
  resolution?: string;
  created_at: string;
  updated_at: string;
  assigned_at?: string;
  resolved_at?: string;
  closed_at?: string;
  // Product
  product_line?: string;
  model_name?: string;
  serial_number?: string;
  firmware_version?: string;
  production_batch?: string;
  // Customer
  customer_type?: string;
  customer_name?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  country?: string;
  province?: string;
  city?: string;
  company_name?: string;
  // Users
  created_by_name: string;
  assigned_to_name?: string;
  closed_by_name?: string;
}

interface Comment {
  id: number;
  user_id: number;
  user_name: string;
  comment_type: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

interface Attachment {
  id: number;
  file_name: string;
  file_size: number;
  file_type: string;
  uploaded_by_name: string;
  uploaded_at: string;
}

const statusColors: Record<string, string> = {
  Pending: '#f59e0b',
  Assigned: '#3b82f6',
  InProgress: '#8b5cf6',
  AwaitingVerification: '#06b6d4',
  Closed: '#10b981',
  Rejected: '#ef4444'
};

const IssueDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuthStore();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const navigate = useNavigate();
  
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [users, setUsers] = useState<{ id: number; username: string }[]>([]);
  
  const fetchIssue = async () => {
    try {
      const res = await axios.get(`/api/issues/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIssue(res.data.issue);
      setComments(res.data.comments || []);
      setAttachments(res.data.attachments || []);
      setCanWrite(res.data.canWrite);
    } catch (err: any) {
      console.error('Failed to fetch issue:', err);
      if (err.response?.status === 404) {
        showToast(t('issue.not_found'), 'error');
        navigate('/issues');
      }
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchIssue();
  }, [id]);
  
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    
    setCommentLoading(true);
    try {
      await axios.post(`/api/issues/${id}/comments`, {
        content: newComment
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNewComment('');
      fetchIssue();
      showToast(t('issue.comment_added'), 'success');
    } catch (err) {
      console.error('Failed to add comment:', err);
      showToast(t('issue.error.comment_failed'), 'error');
    } finally {
      setCommentLoading(false);
    }
  };
  
  const handleStatusChange = async (newStatus: string) => {
    try {
      await axios.put(`/api/issues/${id}`, { status: newStatus }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchIssue();
      showToast(t('issue.status_updated'), 'success');
    } catch (err) {
      console.error('Failed to update status:', err);
      showToast(t('issue.error.status_failed'), 'error');
    }
    setShowStatusMenu(false);
  };
  
  const handleAssign = async (userId: number) => {
    try {
      await axios.post(`/api/issues/${id}/assign`, { assigned_to: userId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchIssue();
      showToast(t('issue.assigned_success'), 'success');
    } catch (err) {
      console.error('Failed to assign:', err);
      showToast(t('issue.error.assign_failed'), 'error');
    }
    setShowAssignModal(false);
  };
  
  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data.users || res.data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    
    try {
      await axios.post(`/api/issues/${id}/attachments`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      fetchIssue();
      showToast(t('issue.attachment_uploaded'), 'success');
    } catch (err) {
      console.error('Failed to upload:', err);
      showToast(t('issue.error.upload_failed'), 'error');
    }
    e.target.value = '';
  };
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };
  
  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <Loader2 size={32} className="spin" style={{ color: 'var(--accent-color)' }} />
      </div>
    );
  }
  
  if (!issue) {
    return null;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <button 
          onClick={() => navigate('/issues')} 
          className="btn btn-secondary"
          style={{ padding: '8px' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{ fontFamily: 'monospace', color: 'var(--accent-color)', fontSize: '0.875rem' }}>
              {issue.issue_number}
            </span>
            <span style={{
              padding: '4px 12px',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: `${statusColors[issue.status]}20`,
              color: statusColors[issue.status]
            }}>
              {t(`issue.status.${issue.status.toLowerCase()}`)}
            </span>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{issue.title}</h1>
        </div>
        
        {/* Actions */}
        {canWrite && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {(user?.role === 'Admin' || user?.role === 'Lead') && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowAssignModal(true); fetchUsers(); }}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <UserPlus size={16} />
                  {t('issue.assign')}
                </button>
              </div>
            )}
            
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowStatusMenu(!showStatusMenu)}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Edit2 size={16} />
                {t('issue.change_status')}
              </button>
              
              {showStatusMenu && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  marginTop: '4px',
                  minWidth: '180px',
                  zIndex: 100,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                  {['Pending', 'Assigned', 'InProgress', 'AwaitingVerification', 'Closed', 'Rejected'].map(s => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={s === issue.status}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '10px 16px',
                        textAlign: 'left',
                        border: 'none',
                        background: s === issue.status ? 'var(--bg-hover)' : 'transparent',
                        cursor: s === issue.status ? 'default' : 'pointer',
                        color: statusColors[s]
                      }}
                    >
                      {t(`issue.status.${s.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left Column - Main Content */}
        <div>
          {/* Description */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            marginBottom: '20px'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>{t('issue.description')}</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{issue.description}</p>
            
            {issue.resolution && (
              <>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>{t('issue.resolution')}</h3>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#10b981' }}>{issue.resolution}</p>
              </>
            )}
          </div>
          
          {/* Attachments */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid var(--border-color)',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Paperclip size={18} />
                {t('issue.attachments')} ({attachments.length})
              </h3>
              {canWrite && (
                <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Upload size={16} />
                  {t('action.upload')}
                  <input type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>
              )}
            </div>
            
            {attachments.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{t('issue.no_attachments')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {attachments.map(att => (
                  <div key={att.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px'
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{att.file_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {formatFileSize(att.file_size)} · {att.uploaded_by_name} · {formatDate(att.uploaded_at)}
                      </div>
                    </div>
                    <a
                      href={`/api/issues/attachments/${att.id}`}
                      download
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px' }}
                    >
                      <Download size={16} />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Comments */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} />
              {t('issue.comments')} ({comments.length})
            </h3>
            
            {/* Comment List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
              {comments.map(comment => (
                <div key={comment.id} style={{
                  padding: '12px',
                  background: comment.comment_type !== 'Comment' ? 'var(--bg-secondary)' : 'transparent',
                  borderRadius: '8px',
                  borderLeft: comment.comment_type !== 'Comment' ? '3px solid var(--accent-color)' : 'none'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{comment.user_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(comment.created_at)}</span>
                  </div>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>{comment.content}</p>
                </div>
              ))}
            </div>
            
            {/* Add Comment */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('issue.comment_placeholder')}
                className="form-control"
                style={{ flex: 1, minHeight: '60px', resize: 'none' }}
              />
              <button
                onClick={handleAddComment}
                disabled={commentLoading || !newComment.trim()}
                className="btn btn-primary"
                style={{ alignSelf: 'flex-end' }}
              >
                {commentLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Column - Info Cards */}
        <div>
          {/* Issue Info */}
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '16px',
            border: '1px solid var(--border-color)',
            marginBottom: '16px'
          }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)' }}>
              {t('issue.details')}
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('issue.category')}</span>
                <span>{t(`issue.category.${issue.issue_category.toLowerCase()}`)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('issue.source')}</span>
                <span>{t(`issue.source.${issue.issue_source.toLowerCase().replace('feedback', '').replace('return', 'offline').replace('test', 'internal')}`)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('issue.severity')}</span>
                <span>{t(`issue.severity.${issue.severity.toLowerCase()}`)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('issue.created_by')}</span>
                <span>{issue.created_by_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('issue.assignee')}</span>
                <span>{issue.assigned_to_name || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('issue.created_at')}</span>
                <span>{formatDate(issue.created_at)}</span>
              </div>
            </div>
          </div>
          
          {/* Product Info */}
          {issue.model_name && (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid var(--border-color)',
              marginBottom: '16px'
            }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={16} />
                {t('issue.product')}
              </h4>
              <div style={{ fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{issue.model_name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {issue.product_line}
                  {issue.serial_number && ` · SN: ${issue.serial_number}`}
                </div>
                {issue.firmware_version && (
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                    FW: {issue.firmware_version}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Customer Info */}
          {issue.customer_name && (
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid var(--border-color)'
            }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={16} />
                {t('issue.customer')}
              </h4>
              <div style={{ fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 500, marginBottom: '4px' }}>{issue.customer_name}</div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  {t(`customer.type.${issue.customer_type?.toLowerCase()}`)}
                  {issue.company_name && ` · ${issue.company_name}`}
                </div>
                {(issue.country || issue.city) && (
                  <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {[issue.country, issue.province, issue.city].filter(Boolean).join(', ')}
                  </div>
                )}
                {issue.phone && <div style={{ marginTop: '4px' }}>{issue.phone}</div>}
                {issue.email && <div style={{ color: 'var(--accent-color)' }}>{issue.email}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Assign Modal */}
      {showAssignModal && (
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
        }} onClick={() => setShowAssignModal(false)}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '24px',
            minWidth: '320px',
            maxHeight: '400px',
            overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginBottom: '16px' }}>{t('issue.assign_to')}</h3>
            {users.map(u => (
              <button
                key={u.id}
                onClick={() => handleAssign(u.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px',
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  borderRadius: '6px'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {u.username}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueDetailPage;
