/**
 * WorkspacePage (个人执行台)
 * PRD P2 Section 6.3.B - The Workspace
 * 三视图架构: My Tasks / Mentioned / Team Queue
 * 适用角色: All (员工的主战场，主管的副战场)
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Star, Loader2, Search, MoreHorizontal,
  Flame, Hand, MessageSquare, Clock, CheckSquare
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useConfirm } from '../../store/useConfirm';
// TicketDetailComponents now used via UnifiedTicketDetail
import UnifiedTicketDetail from '../Workspace/UnifiedTicketDetail';

// ==============================
// Types
// ==============================

interface Ticket {
  id: number;
  ticket_number: string;
  ticket_type: string;
  current_node: string;
  status: string;
  priority: 'P0' | 'P1' | 'P2';
  sla_status: string;
  sla_due_at: string | null;
  account?: { name: string; service_tier?: string };
  account_name?: string;
  contact_name?: string;
  reporter_name?: string;
  product_name?: string;
  serial_number?: string;
  assigned_to: number | null;
  assigned_name: string | null;
  submitted_name?: string;
  participants?: number[];
  snooze_until?: string | null;
  problem_summary?: string;
  problem_description?: string;
  breach_counter?: number;
  created_at: string;
  updated_at: string;
  // Mentioned view: last mention info
  last_mention?: { actor_name: string; content: string };
}

type WorkspaceView = 'my-tasks' | 'mentioned' | 'team-queue';

// Star storage key
const STAR_STORAGE_KEY = 'longhorn_workspace_stars';

function loadStarredIds(): Record<number, number> {
  try {
    const saved = localStorage.getItem(STAR_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveStarredIds(stars: Record<number, number>) {
  localStorage.setItem(STAR_STORAGE_KEY, JSON.stringify(stars));
}

// ==============================
// Main Component
// ==============================

const WorkspacePage: React.FC = () => {
  const { token, user } = useAuthStore();
  const location = useLocation();
  const { t } = useLanguage();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Star: { ticketId: timestamp } for sorting by star time
  const [starredMap, setStarredMap] = useState<Record<number, number>>(loadStarredIds);
  const [snoozedIds, setSnoozedIds] = useState<Set<number>>(new Set());
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ticketId: number } | null>(null);

  // Detail view state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const confirm = useConfirm();

  // Determine current view from route
  const currentView: WorkspaceView = useMemo(() => {
    if (location.pathname.includes('/mentioned')) return 'mentioned';
    if (location.pathname.includes('/team-queue')) return 'team-queue';
    return 'my-tasks';
  }, [location.pathname]);

  // Fetch tickets
  useEffect(() => {
    fetchTickets();
  }, [currentView, location.search]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page_size: '200',
        sort_by: 'sla_due_at',
        sort_order: 'ASC'
      };

      const searchParams = new URLSearchParams(location.search);
      const urlAssignee = searchParams.get('assignee');

      if (currentView === 'my-tasks') {
        // Assigned to me, not closed
        params.assigned_to = String((user as any)?.id || '');
      } else if (currentView === 'team-queue') {
        // Unassigned or specific assignee from URL
        params.assigned_to = urlAssignee || '0';
      }
      // For 'mentioned', we fetch all and filter client-side

      const res = await axios.get('/api/v1/tickets', {
        headers: { Authorization: `Bearer ${token}` },
        params
      });

      let data: Ticket[] = (res.data.data || []).map((t: any) => ({
        ...t,
        participants: t.participants || []
      }));

      // Filter out closed tickets for my-tasks
      if (currentView === 'my-tasks') {
        data = data.filter(t => !['closed', 'cancelled', 'auto_closed', 'converted'].includes(t.current_node));
      }

      // For mentioned: filter where user is in participants but not assigned_to
      if (currentView === 'mentioned') {
        const myId = (user as any)?.id;
        data = data.filter(t => {
          const parts = Array.isArray(t.participants) ? t.participants : [];
          return parts.includes(myId) && t.assigned_to !== myId;
        });
      }

      // For team-queue: filter unassigned (assigned_to is null) or specific assignee
      if (currentView === 'team-queue') {
        data = data.filter(t => {
          if (urlAssignee === 'all') return true;
          return urlAssignee ? String(t.assigned_to) === urlAssignee : !t.assigned_to;
        });

        data = data.filter(t => !['closed', 'cancelled', 'auto_closed', 'converted', 'resolved'].includes(t.current_node));
      }

      // Load snooze state from tickets
      const snoozed = new Set<number>();
      const now = Date.now();
      data.forEach(t => {
        if (t.snooze_until && new Date(t.snooze_until).getTime() > now) {
          snoozed.add(t.id);
        }
      });
      setSnoozedIds(snoozed);

      setTickets(data);
    } catch (err) {
      console.error('[Workspace] Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  // Hybrid sort (PRD Section 6.3.B)
  const sortedTickets = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlSlaStatus = searchParams.get('sla_status');
    const urlNode = searchParams.get('node');

    let result = tickets.filter(t => {
      // Hide snoozed (except P0 - Critical can't be snoozed)
      if (snoozedIds.has(t.id) && t.priority !== 'P0') return false;

      // URL Filters
      if (urlSlaStatus) {
        const statuses = urlSlaStatus.split(',');
        if (!statuses.includes(t.sla_status?.toLowerCase()) && !statuses.includes(t.sla_status)) {
          return false;
        }
      }

      if (urlNode) {
        const nodes = urlNode.split(',');
        if (!nodes.includes(t.current_node)) {
          return false;
        }
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.ticket_number.toLowerCase().includes(q) ||
          t.problem_summary?.toLowerCase().includes(q) ||
          t.problem_description?.toLowerCase().includes(q) ||
          t.account_name?.toLowerCase().includes(q) ||
          t.serial_number?.toLowerCase().includes(q)
        );
      }
      return true;
    });

    result.sort((a, b) => {
      // 1. Critical/Breached - forced top
      const aBreached = a.priority === 'P0' || a.sla_status === 'BREACHED' || a.sla_status === 'breached';
      const bBreached = b.priority === 'P0' || b.sla_status === 'BREACHED' || b.sla_status === 'breached';
      if (aBreached && !bBreached) return -1;
      if (!aBreached && bBreached) return 1;

      // 2. Starred - second priority (by star timestamp)
      const aStarred = starredMap[a.id];
      const bStarred = starredMap[b.id];
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;
      if (aStarred && bStarred) return aStarred - bStarred;

      // 3. Remaining SLA time (ascending - most urgent first)
      const aDue = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Infinity;
      const bDue = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Infinity;
      return aDue - bDue;
    });

    return result;
  }, [tickets, searchQuery, starredMap, snoozedIds, location.search]);

  // Toggle star
  const toggleStar = useCallback((id: number) => {
    setStarredMap(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = Date.now();
      }
      saveStarredIds(next);
      return next;
    });
  }, []);

  // Snooze ticket (set snooze_until to tomorrow 9am)
  const snoozeTicket = useCallback(async (id: number) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    try {
      await axios.patch(`/api/v1/tickets/${id}`, {
        snooze_until: tomorrow.toISOString()
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSnoozedIds(prev => new Set(prev).add(id));
    } catch (err) {
      console.error('[Workspace] Snooze failed:', err);
    }
    setContextMenu(null);
  }, [token]);

  // Pick up (Team Queue)
  const pickUpTicket = useCallback(async (id: number) => {
    try {
      await axios.patch(`/api/v1/tickets/${id}`, {
        assigned_to: (user as any)?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Remove from list
      setTickets(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('[Workspace] Pick up failed:', err);
    }
  }, [token, user]);

  // Handle Snooze click with confirm dialog
  const handleSnoozeClick = async (e: React.MouseEvent, ticket: Ticket) => {
    e.stopPropagation();
    const confirmed = await confirm.confirm(
      t('workspace.snooze_confirm_msg') || '确定要将此工单挂起至明天上午 9:00 吗？\n挂起期间 SLA 倒计时将暂停。',
      t('workspace.snooze_confirm_title') || '确认挂起',
      t('common.confirm') || '确认',
      t('common.cancel') || '取消'
    );
    if (confirmed) {
      snoozeTicket(ticket.id);
    }
  };

  // Navigate to ticket detail (Full View)
  // Legacy navigateToTicketFull removed as inline view IS the full view now.

  // Handle row click
  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  // Right-click handler
  const handleContextMenu = useCallback((e: React.MouseEvent, ticketId: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, ticketId });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // SLA remaining calculation
  const getSlaRemaining = (sla_due_at: string | null): { text: string; color: string } => {
    if (!sla_due_at) return { text: '-', color: '#666' };
    const remaining = new Date(sla_due_at).getTime() - Date.now();
    const hours = Math.round(remaining / (1000 * 60 * 60));

    if (hours < 0) return { text: `${hours}h`, color: '#EF4444' };
    if (hours < 4) return { text: `${hours}h`, color: '#EF4444' };
    if (hours < 24) return { text: `${hours}h`, color: '#F59E0B' };
    const days = Math.round(hours / 24);
    return { text: `${days}d`, color: '#10B981' };
  };

  // Get status display
  const getStatusDisplay = (node: string): { label: string; color: string } => {
    const statusMap: Record<string, { label: string; color: string }> = {
      draft: { label: '草稿', color: '#9CA3AF' },
      submitted: { label: '已提交', color: '#3B82F6' },
      in_progress: { label: '处理中', color: '#3B82F6' },
      waiting_customer: { label: '待反馈', color: '#D946EF' },
      ms_review: { label: 'MS审阅', color: '#F59E0B' },
      op_receiving: { label: '待收货', color: '#F59E0B' },
      op_diagnosing: { label: '诊断中', color: '#8B5CF6' },
      op_repairing: { label: '维修中', color: '#3B82F6' },
      op_qa: { label: 'QA检测', color: '#06B6D4' },
      ms_closing: { label: '待结案', color: '#10B981' },
      resolved: { label: '已解决', color: '#10B981' },
      closed: { label: '已关闭', color: '#6B7280' }
    };
    return statusMap[node] || { label: node, color: '#9CA3AF' };
  };

  const priorityColors: Record<string, string> = {
    P0: '#EF4444',
    P1: '#F59E0B',
    P2: '#3B82F6'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)' }}>

      {/* Header - macOS26 Style */}
      {!selectedTicket && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 20px 20px' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}>
              {currentView === 'my-tasks' && <CheckSquare size={28} color="#3B82F6" />}
              {currentView === 'mentioned' && <MessageSquare size={28} color="#8B5CF6" />}
              {currentView === 'team-queue' && <Loader2 size={28} color="#F59E0B" />}
              {currentView === 'my-tasks' && t('workspace.page_title')}
              {currentView === 'mentioned' && (t('sidebar.service_mentioned', { defaultValue: '协作' }) || '协作')}
              {currentView === 'team-queue' && (t('sidebar.service_team_queue', { defaultValue: '部门池' }) || '部门池')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.9rem' }}>
              {currentView === 'my-tasks' && t('workspace.page_subtitle')}
              {currentView === 'mentioned' && t('workspace.mentioned_subtitle', { defaultValue: '提及您的工单和内部协作任务' })}
              {currentView === 'team-queue' && t('workspace.team_queue_subtitle', { defaultValue: '待领取的部门公共池任务' })}
            </p>
          </div>

          {/* Right side: Search */}
          <div style={{ display: 'flex', alignItems: 'center', height: '40px' }}>
            <div style={{ position: 'relative', width: '250px', height: '100%' }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder={t('workspace.search_tickets')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '100%',
                  padding: '0 12px 0 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxShadow: '0 2px 8px var(--glass-shadow)',
                  transition: 'all 0.2s'
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#3B82F6'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
              />
            </div>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13, marginLeft: 16, whiteSpace: 'nowrap' }}>
              {sortedTickets.length} {t('workspace.items_count')}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {selectedTicket ? (
        <div style={{ padding: '0 24px 24px', flex: 1, overflow: 'auto' }}>
          <UnifiedTicketDetail
            ticketId={selectedTicket.id}
            onBack={() => setSelectedTicket(null)}
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--text-tertiary)' }} />
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                  <th style={{ padding: '0 16px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', width: '70px', textAlign: 'center' }}>Star/Lock</th>
                  <th style={{ padding: '0 16px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', width: '140px' }}>ID</th>
                  <th style={{ padding: '0 16px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>{t('workspace.title')}</th>
                  <th style={{ padding: '0 16px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', width: '220px' }}>{t('workspace.status')}</th>
                  <th style={{ padding: '0 16px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', width: '150px', textAlign: 'right' }}>{t('workspace.sla_timer')}</th>
                </tr>
              </thead>
              <tbody>
                {sortedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                      {t('workspace.no_tickets')}
                    </td>
                  </tr>
                ) : sortedTickets.map(ticket => {
                  const isCritical = ticket.priority === 'P0' || ticket.sla_status === 'BREACHED' || ticket.sla_status === 'breached';
                  const isStarred = !!starredMap[ticket.id];
                  const sla = getSlaRemaining(ticket.sla_due_at);
                  const statusInfo = getStatusDisplay(ticket.current_node);

                  return (
                    <tr
                      key={`${ticket.ticket_type}-${ticket.id}`}
                      onClick={() => handleTicketClick(ticket)}
                      onContextMenu={(e) => handleContextMenu(e, ticket.id)}
                      className="workspace-ticket-row row-hover"
                      style={{
                        borderBottom: '1px solid var(--glass-border)',
                        cursor: 'pointer',
                        background: isCritical ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {/* Left: Star/Lock Icon */}
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        {isCritical ? (
                          <Flame size={18} style={{ color: '#EF4444', margin: '0 auto' }} />
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); toggleStar(ticket.id); }}
                            className="workspace-star-btn"
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 2,
                              cursor: 'pointer',
                              color: isStarred ? '#FFD700' : 'var(--text-tertiary)',
                              opacity: isStarred ? 1 : 0,
                              transition: 'opacity 0.15s',
                              display: 'block',
                              margin: '0 auto'
                            }}
                          >
                            <Star size={16} fill={isStarred ? '#FFD700' : 'none'} />
                          </button>
                        )}
                      </td>

                      {/* ID */}
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          fontSize: '1.05rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap'
                        }}>
                          {ticket.ticket_number}
                        </span>
                      </td>

                      {/* Title & Subtitle */}
                      <td style={{ padding: '16px', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: priorityColors[ticket.priority] || '#3B82F6',
                            background: `${priorityColors[ticket.priority] || '#3B82F6'}15`,
                            padding: '2px 8px',
                            borderRadius: 6
                          }}>
                            {ticket.priority}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: '0.9rem' }}>
                          <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            {(() => {
                              const acc = ticket.account_name;
                              const person = ticket.contact_name || ticket.reporter_name;
                              if (acc && person && acc !== person && acc.toLowerCase() !== person.toLowerCase()) {
                                return <>{acc} <span style={{ color: 'var(--text-tertiary)' }}>· {person}</span></>;
                              }
                              return acc || person || '-';
                            })()}
                            {ticket.product_name && <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>· {ticket.product_name}</span>}
                          </span>
                          {ticket.account?.service_tier && ['VIP', 'VVIP'].includes(ticket.account.service_tier) && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: ticket.account.service_tier === 'VVIP' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(var(--accent-rgb), 0.2)',
                              color: ticket.account.service_tier === 'VVIP' ? '#EF4444' : 'var(--accent-blue)',
                              border: ticket.account.service_tier === 'VVIP' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(var(--accent-rgb), 0.4)'
                            }}>
                              👑 {ticket.account.service_tier}
                            </span>
                          )}
                        </div>

                        <div style={{
                          fontSize: '0.95rem',
                          color: 'var(--text-primary)',
                          display: '-webkit-box',
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          <span style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>
                            {ticket.ticket_type === 'INQUIRY' || ticket.ticket_type === 'inquiry' ? '[Troubleshooting]' :
                              ticket.ticket_type === 'RMA' || ticket.ticket_type === 'rma' ? '[RMA]' :
                                ticket.ticket_type === 'SVC' || ticket.ticket_type === 'svc' ? '[Repair]' : ''}
                          </span>
                          {ticket.problem_summary || ticket.problem_description || '-'}
                        </div>

                        {currentView === 'mentioned' && ticket.last_mention && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
                            fontSize: '0.85rem', color: 'var(--accent-blue)'
                          }}>
                            <MessageSquare size={14} />
                            <span style={{ fontWeight: 600 }}>{ticket.last_mention.actor_name}:</span>
                            <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              "{ticket.last_mention.content}"
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: statusInfo.color, fontWeight: 500 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusInfo.color, display: 'inline-block' }} />
                              {statusInfo.label}
                            </span>
                            {ticket.assigned_name && (
                              <span style={{ color: 'var(--text-tertiary)' }}>· {ticket.assigned_name}</span>
                            )}
                          </div>
                          {(ticket.sla_status === 'WARNING' || ticket.sla_status === 'warning' ||
                            ticket.sla_status === 'BREACHED' || ticket.sla_status === 'breached') && (
                              <div style={{ display: 'inline-block' }}>
                                <span style={{
                                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                                  background: `${sla.color}15`, color: sla.color, fontWeight: 600
                                }}>
                                  {ticket.sla_status?.toUpperCase() === 'BREACHED' ? t('workspace.sla_breached', { defaultValue: 'SLA 违约' }) : t('workspace.sla_warning', { defaultValue: 'SLA 预警' })}
                                </span>
                              </div>
                            )}
                        </div>
                      </td>

                      {/* SLA Timer & Actions */}
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: sla.color, fontFamily: 'monospace' }}>
                          {sla.text}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {t('workspace.remaining', { defaultValue: '剩余时间' })}
                        </div>

                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {currentView === 'team-queue' && (
                            <button
                              onClick={e => { e.stopPropagation(); pickUpTicket(ticket.id); }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                borderRadius: 6, border: '1px solid var(--accent-blue)', background: 'transparent',
                                color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'var(--accent-blue)';
                                e.currentTarget.style.color = '#000';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--accent-blue)';
                              }}
                            >
                              <Hand size={14} /> {t('workspace.pick_up', { defaultValue: '拾取' })}
                            </button>
                          )}
                          {ticket.priority !== 'P0' && currentView !== 'team-queue' && (
                            <button
                              onClick={e => handleSnoozeClick(e, ticket)}
                              className="workspace-snooze-btn"
                              style={{
                                background: 'none', border: 'none', padding: 6, cursor: 'pointer',
                                color: 'var(--text-tertiary)', opacity: 0, transition: 'opacity 0.15s',
                                borderRadius: 6
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                              title={t('workspace.snooze_tomorrow')}
                            >
                              <MoreHorizontal size={18} />
                            </button>
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
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--glass-border)',
            borderRadius: 8,
            padding: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 9999,
            minWidth: 160
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => toggleStar(contextMenu.ticketId)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-main)',
              cursor: 'pointer',
              borderRadius: 6,
              fontSize: 13
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Star size={14} style={{ color: '#FFD700' }} />
            {starredMap[contextMenu.ticketId] ? t('workspace.unstar') : t('workspace.starred')}
          </button>
          {tickets.find(t => t.id === contextMenu.ticketId)?.priority !== 'P0' && (
            <button
              onClick={() => snoozeTicket(contextMenu.ticketId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-main)',
                cursor: 'pointer',
                borderRadius: 6,
                fontSize: 13
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-bg-hover)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <Clock size={14} />
              {t('workspace.snooze_tomorrow')}
            </button>
          )}
        </div>
      )}

      {/* Drawer Overlay Removed */}

      {/* Hover styles for star/snooze visibility */}
      <style>{`
        .workspace-ticket-row:hover .workspace-star-btn,
        .workspace-ticket-row:hover .workspace-snooze-btn {
          opacity: 1 !important;
        }
        .workspace-star-btn[style*="opacity: 1"] {
          opacity: 1 !important; /* Keep visible when starred */
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default WorkspacePage;
