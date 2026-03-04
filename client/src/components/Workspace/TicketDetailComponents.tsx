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
  Edit3, Trash2
} from 'lucide-react';

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
  title: string;
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
      overflow: 'hidden',
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

interface FieldUpdateMetadata {
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
    if (typeof value === 'object') return '(数据对象)';
    return String(value);
  };

  return (
    <div style={{ flex: 1, fontSize: 13 }}>
      {/* 字段标签 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 6, 
        marginBottom: 6 
      }}>
        <span style={{ color: '#aaa' }}>修改了</span>
        <span style={{ 
          color: '#FFD700', 
          fontWeight: 600,
          padding: '2px 6px',
          background: 'rgba(255,215,0,0.1)',
          borderRadius: 4
        }}>
          {metadata.field_label || metadata.field_name || '字段'}
        </span>
      </div>

      {/* 对比高亮显示 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        marginBottom: 6
      }}>
        {/* 旧值 - 红色删除线 */}
        <span style={{
          padding: '3px 8px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 4,
          color: '#EF4444',
          textDecoration: 'line-through',
          fontSize: 12,
          maxWidth: 150,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {formatValue(metadata.old_value)}
        </span>

        <ArrowRight size={12} color="#666" />

        {/* 新值 - 绿色高亮 */}
        <span style={{
          padding: '3px 8px',
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 4,
          color: '#10B981',
          fontWeight: 500,
          fontSize: 12,
          maxWidth: 150,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {formatValue(metadata.new_value)}
        </span>
      </div>

      {/* 修正理由 */}
      {metadata.change_reason && (
        <div style={{
          fontSize: 12,
          color: '#888',
          fontStyle: 'italic',
          paddingLeft: 2
        }}>
          理由: {metadata.change_reason}
        </div>
      )}
    </div>
  );
};

// ==============================
// Activity Timeline (Compact Horizontal Layout)
// ==============================

interface ActivityTimelineProps {
  activities: Activity[];
  loading?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  loading
}) => {
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
      case 'field_update': return <Edit3 size={12} />;  // PRD §7.1 审计化修正
      case 'soft_delete': return <Trash2 size={12} />;  // PRD §7.2 软删除
      default: return <Clock size={12} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'comment': return '#3B82F6';
      case 'status_change': return '#10B981';
      case 'creation': case 'system_event': return '#22C55E';
      case 'assignment': case 'assignment_change': return '#FFD700';
      case 'priority_change': return '#F59E0B';
      case 'mention': return '#8B5CF6';
      case 'field_update': return '#FFD700';  // Kine Yellow - 审计修正
      case 'soft_delete': return '#EF4444';   // Kine Red - 删除操作
      default: return '#666';
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>加载中...</div>;
  }

  // Filter out standalone 'mention' type activities (merged into comments now)
  const filteredActivities = activities.filter(a => a.activity_type !== 'mention');

  return (
    <div style={{ padding: '8px 20px 16px' }}>
      {filteredActivities.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#666', fontSize: 13 }}>暂无活动记录</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {filteredActivities.map((activity) => {
              const color = getTypeColor(activity.activity_type);
              return (
                <tr
                  key={activity.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {/* Time column */}
                  <td style={{
                    padding: '10px 12px 10px 0',
                    fontSize: 12, color: '#555',
                    whiteSpace: 'nowrap', verticalAlign: 'top',
                    width: 110,
                  }}>
                    {formatFullDateTime(activity.created_at)}
                  </td>

                  {/* Actor column */}
                  <td style={{
                    padding: '10px 12px 10px 0',
                    verticalAlign: 'top',
                    width: 90,
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <span style={{ color, display: 'flex', alignItems: 'center' }}>
                        {getTypeIcon(activity.activity_type)}
                      </span>
                      <span style={{
                        fontSize: 13, fontWeight: 600, color: '#ccc',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 70,
                      }}>
                        {activity.actor?.name || '系统'}
                      </span>
                    </div>
                  </td>

                  {/* Content column */}
                  <td style={{
                    padding: '10px 0',
                    verticalAlign: 'top',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                      {getVisibilityBadge(activity.visibility)}
                      
                      {/* PRD §7.1: field_update 类型使用特殊高亮渲染 */}
                      {activity.activity_type === 'field_update' && activity.metadata ? (
                        <FieldUpdateContent
                          content={activity.content || ''}
                          metadata={activity.metadata as {
                            field_name?: string;
                            field_label?: string;
                            old_value?: unknown;
                            new_value?: unknown;
                            change_reason?: string;
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            color: '#aaa', fontSize: 13, lineHeight: 1.5,
                            flex: 1, wordBreak: 'break-word',
                          }}
                          dangerouslySetInnerHTML={{
                            __html: activity.content_html || activity.content || ''
                          }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
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
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${h}:${min}`;
}

function formatFullDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${m}-${day} ${h}:${min}`;
}

export default {
  ActivityTimeline,
  CommentInput,
  ParticipantsPanel,
  TicketInfoCard,
  CollapsiblePanel
};
