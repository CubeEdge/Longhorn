/**
 * Ticket Detail Enhancement Components (工单详情页增强)
 * P2 架构升级 - macOS26 风格
 */

import React, { useState } from 'react';
import { MentionCommentInput } from './MentionCommentInput';
import {
  Clock, User, MessageSquare,
  ArrowRight, Plus as PlusIcon, AlertTriangle,
  AtSign, Paperclip, ChevronDown, ChevronRight, UserCheck,
  Edit3, Trash2, X, Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/useAuthStore';

// ==============================
// Types
// ==============================

interface Activity {
  id: number;
  activity_type: string;
  content: string;
  content_html?: string;
  metadata?: Record<string, unknown>;
  visibility: 'all' | 'internal' | 'op_only';
  actor: {
    id: number;
    name: string;
    role?: string;
  } | null;
  attachments?: Array<{
    id: number;
    file_name: string;
    file_size: number;
    file_type: string;
    file_url: string;
    thumbnail_url?: string | null;
  }>;
  created_at: string;
}

interface Participant {
  user_id: number;
  name?: string;
  role: 'owner' | 'assignee' | 'mentioned' | 'follower';
  added_at: string;
}

// ==============================
// Collapsible Panel
// ==============================

interface CollapsiblePanelProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title, icon, count, defaultOpen = true, children
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderRadius: 12, marginBottom: 16,
      background: 'rgba(30,30,30,0.5)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.06)',
      // Remove overflow: hidden to prevent clipping of absolute children like AssigneeSelector or @mentions
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', padding: '14px 20px',
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#fff', textAlign: 'left',
        }}
      >
        {icon}
        <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize: 12, color: '#666', marginLeft: 'auto', marginRight: 8 }}>
            {count}
          </span>
        )}
        {open ? <ChevronDown size={14} color="#888" style={count === undefined ? { marginLeft: 'auto' } : undefined} /> : <ChevronRight size={14} color="#888" style={count === undefined ? { marginLeft: 'auto' } : undefined} />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
};

// ==============================
// Field Update Content (审计化修正高亮显示)
// PRD §7.1 - 对比高亮形式呈现字段变更
// ==============================

export interface FieldUpdateMetadata {
  field_name?: string;
  field_label?: string;
  old_value?: unknown;
  new_value?: unknown;
  change_reason?: string;
}

interface FieldUpdateContentProps {
  content: string;
  metadata: FieldUpdateMetadata;
}

const FieldUpdateContent: React.FC<FieldUpdateContentProps> = ({ metadata }) => {
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '(空)';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'object') return '(内容)';
    const s = String(value);
    return s.length > 30 ? s.substring(0, 30) + '...' : s;
  };

  const fieldLabel = metadata.field_label || metadata.field_name || '未知字段';

  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 6px' }}>
      <span style={{ color: '#888' }}>修改了</span>
      <span style={{ color: '#FFD700', fontWeight: 600, background: 'rgba(255,215,0,0.1)', padding: '0 4px', borderRadius: '4px' }}>
        {fieldLabel}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ccc' }}>
        <span style={{ color: '#EF4444', textDecoration: 'line-through', fontSize: 12, opacity: 0.7 }}>
          {formatValue(metadata.old_value)}
        </span>
        <ArrowRight size={10} color="#666" />
        <span style={{ color: '#10B981', fontWeight: 500, fontSize: 12 }}>
          {formatValue(metadata.new_value)}
        </span>
      </div>
      {metadata.change_reason && (
        <span style={{ fontSize: 12, color: '#666', fontStyle: 'italic', marginLeft: 4 }}>
          [{metadata.change_reason}]
        </span>
      )}
    </div>
  );
};

const DiagnosticReportContent: React.FC<{ metadata: any }> = ({ metadata }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 8px' }}>
      <span style={{ color: '#10B981', fontWeight: 600 }}>提交了详细诊断报告</span>
      <span style={{ color: '#666', fontSize: 12 }}>
        [故障判定: {metadata.diagnosis?.substring(0, 20)}{metadata.diagnosis?.length > 20 ? '...' : ''}]
      </span>
      <span style={{
        fontSize: 10, padding: '1px 6px', borderRadius: 4,
        background: metadata.is_warranty ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
        color: metadata.is_warranty ? '#10B981' : '#F59E0B',
        border: `1px solid ${metadata.is_warranty ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`
      }}>
        {metadata.is_warranty ? '保修免费' : '付费/拒保'}
      </span>
    </div>
  );
};

// ==============================
// Activity Timeline (Compact Horizontal Layout)
// ==============================

interface ActivityTimelineProps {
  activities: Activity[];
  loading?: boolean;
  onActivityClick?: (activity: Activity) => void;
}

// ==============================
// Image Lightbox
// ==============================

interface MediaLightboxProps {
  url: string | null;
  type?: 'image' | 'video' | null;
  onClose: () => void;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({ url, type = 'image', onClose }) => {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
            zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out', padding: 20
          }}
        >
          {type === 'video' ? (
            <video
              src={url}
              controls
              autoPlay
              style={{
                maxWidth: '90%', maxHeight: '90%', borderRadius: 12,
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                objectFit: 'contain'
              }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <motion.img
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              src={url}
              style={{
                maxWidth: '100%', maxHeight: '100%', borderRadius: 12,
                boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
                objectFit: 'contain'
              }}
              onClick={e => e.stopPropagation()}
            />
          )}

          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 30, right: 30,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '50%', width: 44, height: 44,
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s',
              zIndex: 2001
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            <X size={20} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  loading,
  onActivityClick
}) => {
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [showSystemEvents, setShowSystemEvents] = useState(false);

  // Define activity type categories
  const COMMENT_TYPES = ['comment', 'diagnostic_report'];
  const SYSTEM_TYPES = ['status_change', 'assignment_change', 'field_update', 'system_event', 'creation', 'assignment', 'priority_change', 'soft_delete'];

  // Filter out standalone 'mention' type activities (merged into comments now)
  const filteredActivities = activities.filter(a => a.activity_type !== 'mention');

  // Helper to check if a comment is actually a system operation (e.g., 【完成收货入库】)
  const isSystemOperationComment = (activity: Activity): boolean => {
    if (activity.activity_type !== 'comment') return false;
    const content = activity.content || '';
    // Match patterns like 【完成收货入库】, 【提交诊断报告】, etc.
    return /^【[^】]+】/.test(content) || /^(完成|提交|确认|创建|修改|删除)/.test(content);
  };

  // Split activities into comments and system events
  // System operation comments (e.g., 【完成收货入库】) are treated as system events
  const commentActivities = filteredActivities.filter(a => COMMENT_TYPES.includes(a.activity_type) && !isSystemOperationComment(a));
  const systemActivities = filteredActivities.filter(a => SYSTEM_TYPES.includes(a.activity_type) || isSystemOperationComment(a));
  const getVisibilityBadge = (visibility: string) => {
    if (visibility === 'all') return null;
    return (
      <span style={{
        fontSize: 10,
        padding: '1px 5px',
        borderRadius: 3,
        background: visibility === 'internal' ? 'rgba(255,215,0,0.2)' : 'rgba(239,68,68,0.2)',
        color: visibility === 'internal' ? '#FFD700' : '#EF4444',
        fontWeight: 600,
        lineHeight: '16px',
      }}>
        {visibility === 'internal' ? '内部' : '仅OP'}
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare size={12} />;
      case 'status_change': return <ArrowRight size={12} />;
      case 'creation': case 'system_event': return <PlusIcon size={12} />;
      case 'assignment': case 'assignment_change': return <UserCheck size={12} />;
      case 'priority_change': return <AlertTriangle size={12} />;
      case 'mention': return <AtSign size={12} />;
      case 'attachment': return <Paperclip size={12} />;
      case 'field_update': return <Edit3 size={12} />;
      case 'diagnostic_report': return <Wrench size={12} />;
      case 'soft_delete': return <Trash2 size={12} />;
      default: return <Clock size={12} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'comment': return '#10B981'; // Kine Green for comments
      case 'status_change': return '#3B82F6'; // Kine Blue for system events
      case 'creation': case 'system_event': return '#3B82F6'; // Kine Blue for system events
      case 'assignment': case 'assignment_change': return '#FFD700';
      case 'priority_change': return '#F59E0B';
      case 'mention': return '#8B5CF6';
      case 'field_update': return '#FFD700';
      case 'diagnostic_report': return '#10B981';
      case 'soft_delete': return '#EF4444';
      default: return '#666';
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>加载中...</div>;
  }

  const renderActivityItem = (activity: Activity) => {
    const isSystemOpComment = isSystemOperationComment(activity);
    const displayType = isSystemOpComment ? 'system_event' : activity.activity_type;
    const color = getTypeColor(displayType);
    const isFieldUpdate = activity.activity_type === 'field_update';
    const actorName = activity.actor?.name || '系统';
    const formattedDate = formatFullDateTime(activity.created_at);
    const isSystemEvent = SYSTEM_TYPES.includes(activity.activity_type) || isSystemOpComment;

    return (
      <div
        key={activity.id}
        onClick={() => onActivityClick && onActivityClick(activity)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '4px 12px',
          borderRadius: '6px',
          transition: 'background 0.2s',
          borderLeft: isFieldUpdate ? `2px solid ${color}44` : 'none',
          cursor: onActivityClick ? 'pointer' : 'default',
          opacity: isSystemEvent ? 0.85 : 1
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {/* Meta: Time & Icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '20px' }}>
          <span style={{ fontSize: '11px', color: '#444', fontFamily: 'monospace', minWidth: '70px', whiteSpace: 'nowrap' }}>
            {formattedDate}
          </span>
          <span style={{ color, display: 'flex', alignItems: 'center', opacity: 0.8 }}>
            {getTypeIcon(displayType)}
          </span>
        </div>

        {/* Main Body */}
        <div style={{ flex: 1, minWidth: 0, fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
            <span style={{ fontWeight: 600, color: isSystemEvent ? '#666' : '#999', flexShrink: 0 }}>{actorName}</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }}>
              {getVisibilityBadge(activity.visibility)}

              {activity.activity_type === 'field_update' && activity.metadata ? (
                <FieldUpdateContent
                  content={activity.content || ''}
                  metadata={activity.metadata as FieldUpdateMetadata}
                />
              ) : activity.activity_type === 'diagnostic_report' && activity.metadata ? (
                <DiagnosticReportContent metadata={activity.metadata as any} />
              ) : (
                <div
                  style={{ color: isSystemEvent ? '#666' : '#888', wordBreak: 'break-word', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                  dangerouslySetInnerHTML={{
                    __html: (activity.content_html || activity.content || '').replace(/<[^>]+>/g, ' ')
                  }}
                />
              )}

              {/* Attachments Icon Indicator */}
              {activity.attachments && activity.attachments.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: 'auto', flexShrink: 0 }}>
                  <Paperclip size={12} color="#666" />
                  <span style={{ fontSize: '11px', color: '#555' }}>{activity.attachments.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Attachment Links have been moved to the Detail Drawer */}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '8px 4px 16px' }}>
      {filteredActivities.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 13 }}>暂无活动记录</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Comments Section - Always shown and expanded */}
          {commentActivities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#3B82F6',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                <MessageSquare size={12} />
                讨论与诊断 ({commentActivities.length})
              </div>
              {commentActivities.map(renderActivityItem)}
            </div>
          )}

          {/* System Events Section - Collapsible */}
          {systemActivities.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button
                onClick={() => setShowSystemEvents(!showSystemEvents)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#666',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'color 0.2s',
                  width: '100%'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#888'}
                onMouseLeave={e => e.currentTarget.style.color = '#666'}
              >
                <Clock size={12} />
                <span style={{ flex: 1 }}>系统变更 ({systemActivities.length})</span>
                {showSystemEvents ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
              {showSystemEvents && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {systemActivities.map(renderActivityItem)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <MediaLightbox url={lightboxMedia?.url || null} type={lightboxMedia?.type || null} onClose={() => setLightboxMedia(null)} />
    </div>
  );
};

// ==============================
// Comment Input
// ==============================

export const CommentInput = MentionCommentInput;

// ==============================
// Participants Panel
// ==============================

interface ParticipantsPanelProps {
  participants: Participant[];
  owner?: { id: number; name: string };
  assignee?: { id: number; name: string };
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
  participants,
  owner,
  assignee
}) => {
  const getRoleBadge = (role: string) => {
    const roles: Record<string, { color: string; label: string }> = {
      owner: { color: '#FFD700', label: '创建者' },
      assignee: { color: '#10B981', label: '处理人' },
      mentioned: { color: '#3B82F6', label: '协作中' },
      follower: { color: '#8B5CF6', label: '关注者' }
    };
    const r = roles[role] || { color: '#888', label: role };
    return (
      <span style={{
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        background: `${r.color}20`,
        color: r.color,
        fontWeight: 600,
      }}>
        {r.label}
      </span>
    );
  };

  const allParticipants: { id: number; name: string; role: string }[] = [];

  if (owner) allParticipants.push({ id: owner.id, name: owner.name, role: 'owner' });
  if (assignee && (!owner || assignee.id !== owner.id)) {
    allParticipants.push({ id: assignee.id, name: assignee.name, role: 'assignee' });
  }

  if (participants && participants.length > 0) {
    participants.forEach(p => {
      if (!allParticipants.some(x => x.id === p.user_id)) {
        allParticipants.push({
          id: p.user_id,
          name: p.name || `User #${p.user_id}`,
          role: p.role
        });
      }
    });
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{
        fontSize: 14, fontWeight: 600, color: '#fff',
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 12,
      }}>
        <User size={16} color="#FFD700" />
        协作成员
        <span style={{ color: '#666', fontWeight: 400, fontSize: 13 }}>({allParticipants.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {allParticipants.map(p => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 8px', borderRadius: 8,
            background: 'rgba(255,255,255,0.03)',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,215,0,0.15)', color: '#FFD700',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 500,
            }}>
              {p.name[0]?.toUpperCase() || '?'}
            </div>
            <span style={{ fontSize: 13, color: '#ddd', fontWeight: 500 }}>{p.name}</span>
            {getRoleBadge(p.role)}
          </div>
        ))}
      </div>
      {allParticipants.length === 0 && (
        <div style={{ fontSize: 12, color: '#666', textAlign: 'center', padding: 12 }}>暂无</div>
      )}
    </div>
  );
};

// ==============================
// Ticket Info Card
// ==============================

interface TicketInfoCardProps {
  ticket: {
    ticket_number: string;
    ticket_type: string;
    priority: string;
    sla_status: string;
    sla_due_at: string | null;
    current_node: string;
    account_name: string;
    product_name: string;
    serial_number: string;
    is_warranty?: boolean;
    created_at: string;
  };
}

export const TicketInfoCard: React.FC<TicketInfoCardProps> = ({ ticket }) => {
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'P0': return '#EF4444';
      case 'P1': return '#FFD700';
      case 'P2': return '#3B82F6';
      default: return '#9CA3AF';
    }
  };

  return (
    <div style={{
      background: 'rgba(30, 30, 30, 0.5)',
      backdropFilter: 'blur(12px)',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: 16,
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: '#fff' }}>
          {ticket.ticket_number}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
          background: `${getPriorityColor(ticket.priority)}15`,
          color: getPriorityColor(ticket.priority),
        }}>
          {ticket.priority}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
        <div style={{ color: '#888' }}>客户: <span style={{ color: '#ccc' }}>{ticket.account_name || '-'}</span></div>
        <div style={{ color: '#888' }}>产品: <span style={{ color: '#ccc' }}>{ticket.product_name || '-'}</span></div>
        <div style={{ color: '#888' }}>SN: <span style={{ color: '#ccc' }}>{ticket.serial_number || '-'}</span></div>
        <div style={{ color: '#888' }}>创建: <span style={{ color: '#ccc' }}>{formatDate(ticket.created_at)}</span></div>
      </div>
    </div>
  );
};

// ==============================
// Utilities
// ==============================



function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  // Ensure SQLite datetime string is parsed as UTC
  const safeStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(safeStr.endsWith('Z') || safeStr.includes('+') ? safeStr : safeStr + 'Z');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}`;
}

function formatFullDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  // Ensure SQLite datetime string is parsed as UTC
  const safeStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  // Add 'Z' if no timezone info, but be careful not to double-add
  const finalStr = (safeStr.endsWith('Z') || safeStr.includes('+')) ? safeStr : safeStr + 'Z';

  const d = new Date(finalStr);
  if (isNaN(d.getTime())) return dateStr;

  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();

  if (isToday) return `${h}:${min}`;
  if (isThisYear) return `${m}-${day} ${h}:${min}`;
  return `${d.getFullYear().toString().slice(-2)}-${m}-${day} ${h}:${min}`;
}


// ==============================
// Activity Detail Drawer
// ==============================

export interface ActivityDetailDrawerProps {
  activity: Activity | null;
  onClose: () => void;
}

export const ActivityDetailDrawer: React.FC<ActivityDetailDrawerProps> = ({
  activity,
  onClose
}) => {
  const { token } = useAuthStore();
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);

  if (!activity) return null;

  return (
    <>
      {/* Overlay - click to close */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 60, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 998
        }}
      />
      <div style={{
        position: 'fixed',
        top: 60, right: 0, bottom: 0, width: 400,
        background: 'rgba(30,30,30,0.95)',
        backdropFilter: 'blur(20px)',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.5)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        zIndex: 999,
        display: 'flex', flexDirection: 'column',
        transform: 'translateX(0)',
        transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>详情</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* User Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,215,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFD700', fontWeight: 600, fontSize: 14 }}>
              {activity.actor?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{activity.actor?.name || 'System'}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{new Date(activity.created_at).toLocaleString('zh-CN')}</div>
            </div>
          </div>

          {/* Text Content */}
          {activity.content && (
            <div style={{
              fontSize: 14, color: '#ddd', lineHeight: 1.6, wordBreak: 'break-word',
              background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8
            }} dangerouslySetInnerHTML={{ __html: activity.content_html || activity.content.replace(/\n/g, '<br/>') }} />
          )}

          {/* Field Updates (if any) */}
          {activity.activity_type.endsWith('_change') && activity.metadata && (
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 8 }}>
              <FieldUpdateContent content={activity.content} metadata={activity.metadata as unknown as FieldUpdateMetadata} />
            </div>
          )}

          {/* Attachments Grid */}
          {activity.attachments && activity.attachments.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#888', fontWeight: 600 }}>附件 ({activity.attachments.length})</h4>
              <div style={{
                display: 'grid',
                // If 1 attachment, full width. If 2, 2 columns. If more, auto-fill.
                gridTemplateColumns: activity.attachments.length === 1 ? '1fr' : (activity.attachments.length === 2 ? '1fr 1fr' : 'repeat(auto-fill, minmax(100px, 1fr))'),
                gap: 8,
                alignItems: 'start'
              }}>
                {activity.attachments.map((att) => {
                  const isImage = att.file_type?.startsWith('image/');
                  const isVideo = att.file_type?.startsWith('video/');
                  const mediaUrl = att.file_url + '?inline=true' + (token ? `&token=${token}` : '');
                  const thumbUrl = (att.thumbnail_url || att.file_url) + (token ? `?token=${token}` : '');

                  return (
                    <div key={att.id}
                      onClick={() => (isImage || isVideo) ? setLightboxMedia({ url: mediaUrl, type: isVideo ? 'video' : 'image' }) : window.open(mediaUrl)}
                      style={{
                        aspectRatio: activity.attachments!.length === 1 ? 'auto' : '1',
                        width: '100%',
                        background: '#111',
                        borderRadius: 8,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '1px solid rgba(255,255,255,0.1)',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {isImage ? (
                        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#222' }}>
                          {/* Loading spinner */}
                          <div style={{
                            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#555', transition: 'opacity 0.3s'
                          }} className="thumb-loading">
                            <div style={{ width: 20, height: 20, border: '2px solid #333', borderTopColor: '#FFD700', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          </div>
                          <img
                            src={thumbUrl}
                            alt={att.file_name}
                            key={`${att.id}-${activity.id}`}
                            onLoad={(e) => {
                              e.currentTarget.style.opacity = '1';
                              const loader = e.currentTarget.parentElement?.querySelector('.thumb-loading') as HTMLElement;
                              if (loader) loader.style.opacity = '0';
                            }}
                            style={{
                              width: '100%', height: '100%', objectFit: activity.attachments!.length === 1 ? 'contain' : 'cover',
                              opacity: 0, transition: 'opacity 0.3s'
                            }}
                          />
                          {/* Inner soft glow if it's the only image */}
                          {activity.attachments!.length === 1 && (
                            <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)', pointerEvents: 'none' }} />
                          )}
                        </div>
                      ) : isVideo ? (
                        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#222' }}>
                          {att.thumbnail_url ? (
                            <img src={thumbUrl} alt={att.file_name} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                              <Clock size={24} style={{ animation: 'spin 2s linear infinite' }} />
                            </div>
                          )}
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: '50%', padding: 12, color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: 12, textAlign: 'center' }}>
                          <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                          <div style={{ fontSize: 10, color: '#888', wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{att.file_name}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <MediaLightbox url={lightboxMedia?.url || null} type={lightboxMedia?.type || null} onClose={() => setLightboxMedia(null)} />
    </>
  );
};

export default {
  ActivityTimeline,
  CommentInput,
  ParticipantsPanel,
  TicketInfoCard,
  CollapsiblePanel
};
