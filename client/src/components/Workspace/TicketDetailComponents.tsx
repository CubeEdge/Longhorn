/**
 * Ticket Detail Enhancement Components (工单详情页增强)
 * P2 架构升级 - macOS26 风格
 */

import React, { useState } from 'react';
import { t } from 'i18next';
import { MentionCommentInput } from './MentionCommentInput';
import {
  Clock, User, Tag, Package, Calendar, MessageSquare,
  AlertTriangle, ArrowRight, Send,
  AtSign, Paperclip
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
// Activity Timeline
// ==============================

interface ActivityTimelineProps {
  activities: Activity[];
  loading?: boolean;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  loading
}) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare size={16} />;
      case 'status_change': return <ArrowRight size={16} />;
      case 'assignment': return <User size={16} />;
      case 'mention': return <AtSign size={16} />;
      case 'attachment': return <Paperclip size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'comment': return '#3B82F6';
      case 'status_change': return '#10B981';
      case 'assignment': return '#FFD700';
      case 'mention': return '#8B5CF6';
      default: return '#666';
    }
  };

  const getVisibilityBadge = (visibility: string) => {
    if (visibility === 'all') return null;
    return (
      <span style={{
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        background: visibility === 'internal' ? 'rgba(255,215,0,0.2)' : 'rgba(239,68,68,0.2)',
        color: visibility === 'internal' ? '#FFD700' : '#EF4444',
        marginLeft: 8
      }}>
        {visibility === 'internal' ? '内部' : '仅OP'}
      </span>
    );
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>加载中...</div>;
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {activities.map((activity, index) => (
        <div
          key={activity.id}
          style={{
            display: 'flex',
            gap: 12,
            padding: '12px 16px',
            position: 'relative'
          }}
        >
          {/* Timeline line */}
          {index < activities.length - 1 && (
            <div style={{
              position: 'absolute',
              left: 27,
              top: 36,
              bottom: -12,
              width: 2,
              background: 'rgba(255,255,255,0.1)'
            }} />
          )}

          {/* Icon */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: `${getActivityColor(activity.activity_type)}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: getActivityColor(activity.activity_type),
            flexShrink: 0,
            zIndex: 1
          }}>
            {getActivityIcon(activity.activity_type)}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: 4
            }}>
              <span style={{
                fontWeight: 500,
                color: '#fff',
                fontSize: 14
              }}>
                {activity.actor?.name || '系统'}
              </span>
              {getVisibilityBadge(activity.visibility)}
              <span style={{
                marginLeft: 'auto',
                fontSize: 12,
                color: '#666'
              }}>
                {formatTime(activity.created_at)}
              </span>
            </div>

            <div
              style={{
                color: '#aaa',
                fontSize: 14,
                lineHeight: 1.5
              }}
              dangerouslySetInnerHTML={{
                __html: activity.content_html || activity.content
              }}
            />
          </div>
        </div>
      ))}
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
    const colors: Record<string, string> = {
      owner: '#FFD700',
      assignee: '#10B981',
      mentioned: '#3B82F6',
      follower: '#666'
    };
    const labels: Record<string, string> = {
      owner: '创建者',
      assignee: '处理人',
      mentioned: '被@',
      follower: '关注者'
    };

    return (
      <span style={{
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        background: `${colors[role]}20`,
        color: colors[role]
      }}>
        {labels[role]}
      </span>
    );
  };

  const allParticipants = [
    ...(owner ? [{ user_id: owner.id, name: owner.name, role: 'owner' as const, added_at: '' }] : []),
    ...(assignee && assignee.id !== owner?.id
      ? [{ user_id: assignee.id, name: assignee.name, role: 'assignee' as const, added_at: '' }]
      : []),
    ...participants.filter(p => p.user_id !== owner?.id && p.user_id !== assignee?.id)
  ];

  return (
    <div style={{
      padding: 16,
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{
        fontSize: 12,
        color: '#888',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}>
        <User size={14} />
        参与者 ({allParticipants.length})
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {allParticipants.map(p => (
          <div
            key={p.user_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 6
            }}
          >
            <div style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'rgba(255,215,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              color: '#FFD700'
            }}>
              {(p.name || '?')[0]}
            </div>
            <span style={{ fontSize: 13, color: '#ccc' }}>{p.name}</span>
            {getRoleBadge(p.role)}
          </div>
        ))}
      </div>
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
      default: return '#3B82F6';
    }
  };

  const infoItems = [
    { icon: Package, label: '产品', value: ticket.product_name },
    { icon: Tag, label: '序列号', value: ticket.serial_number },
    { icon: User, label: '客户', value: ticket.account_name },
    { icon: Calendar, label: '创建时间', value: formatDate(ticket.created_at) }
  ];

  return (
    <div style={{
      padding: 16,
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16
      }}>
        <span style={{
          fontSize: 16,
          fontWeight: 600,
          color: '#fff'
        }}>
          {ticket.ticket_number}
        </span>
        <span style={{
          padding: '2px 8px',
          borderRadius: 4,
          background: `${getPriorityColor(ticket.priority)}20`,
          color: getPriorityColor(ticket.priority),
          fontSize: 12,
          fontWeight: 500
        }}>
          {ticket.priority}
        </span>
        {ticket.sla_status === 'warning' && (
          <AlertTriangle size={16} color="#FFD700" />
        )}
        {ticket.sla_status === 'breached' && (
          <AlertTriangle size={16} color="#EF4444" />
        )}
        {ticket.is_warranty && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(16,185,129,0.2)',
            color: '#10B981',
            fontSize: 12
          }}>
            保修内
          </span>
        )}
      </div>

      {/* Info Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12
      }}>
        {infoItems.map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <item.icon size={14} color="#666" />
            <span style={{ fontSize: 12, color: '#888' }}>{item.label}:</span>
            <span style={{ fontSize: 13, color: '#ccc' }}>{item.value || '-'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==============================
// Utilities
// ==============================

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;

  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

export default {
  ActivityTimeline,
  CommentInput,
  ParticipantsPanel,
  TicketInfoCard
};
