/**
 * WorkspacePage (个人执行台)
 * PRD P2 Section 6.3.B - The Workspace
 * 适用角色: All (员工的主战场，主管的副战场)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Inbox, Star, Clock, AlertTriangle, ChevronRight,
  Loader2, Filter, Search, MoreHorizontal
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';

interface Ticket {
  id: number;
  ticket_number: string;
  ticket_type: 'inquiry' | 'rma' | 'svc';
  problem_summary: string;
  status: string;
  priority: 'P0' | 'P1' | 'P2';
  sla_status?: 'normal' | 'warning' | 'breached';
  sla_remaining_hours?: number;
  account_name?: string;
  customer_name?: string;
  product_name?: string;
  handler_name?: string;
  created_at: string;
  updated_at: string;
}

type ViewType = 'inbox' | 'assigned' | 'sla_warning' | 'all';

const WorkspacePage: React.FC = () => {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewType>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [snoozedIds, setSnoozedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchTickets();
  }, [currentView]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      // Fetch from multiple ticket sources
      const [inquiryRes, rmaRes] = await Promise.all([
        axios.get('/api/v1/inquiry-tickets', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/v1/rma-tickets', { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { data: [] } }))
      ]);

      const inquiryTickets = (inquiryRes.data.data || []).map((t: any) => ({
        ...t,
        ticket_type: 'inquiry' as const,
        problem_summary: t.problem_summary || t.communication_log?.slice(0, 100) || '无描述',
        account_name: t.customer_name || t.account?.name,
        product_name: t.product?.name,
        handler_name: t.handler?.name,
        priority: t.priority || 'P2',
        sla_status: calculateSlaStatus(t.created_at, t.status),
        sla_remaining_hours: calculateRemainingHours(t.created_at)
      }));

      const rmaTickets = (rmaRes.data.data || []).map((t: any) => ({
        ...t,
        ticket_type: 'rma' as const,
        problem_summary: t.problem_description || '无描述',
        account_name: t.account?.name || t.customer_name,
        product_name: t.product?.name,
        handler_name: t.assigned_name,
        priority: t.priority || 'P1',
        sla_status: calculateSlaStatus(t.created_at, t.status),
        sla_remaining_hours: calculateRemainingHours(t.created_at)
      }));

      setTickets([...inquiryTickets, ...rmaTickets]);
    } catch (err) {
      console.error('Failed to fetch workspace tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateSlaStatus = (createdAt: string, status: string): 'normal' | 'warning' | 'breached' => {
    if (['Resolved', 'Closed', 'AutoClosed'].includes(status)) return 'normal';
    const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
    if (hours > 48) return 'breached';
    if (hours > 24) return 'warning';
    return 'normal';
  };

  const calculateRemainingHours = (createdAt: string): number => {
    const deadline = new Date(createdAt).getTime() + 48 * 60 * 60 * 1000;
    return Math.max(0, Math.round((deadline - Date.now()) / (1000 * 60 * 60)));
  };

  // Filter and sort tickets based on PRD hybrid sort logic
  const filteredTickets = useMemo(() => {
    let result = tickets.filter(t => {
      // Hide snoozed
      if (snoozedIds.has(t.id)) return false;

      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return t.ticket_number.toLowerCase().includes(q) ||
               t.problem_summary?.toLowerCase().includes(q) ||
               t.account_name?.toLowerCase().includes(q);
      }

      // View filter
      if (currentView === 'sla_warning') {
        return t.sla_status === 'warning' || t.sla_status === 'breached';
      }
      if (currentView === 'assigned') {
        return t.handler_name === (user as any)?.name;
      }

      return true;
    });

    // Hybrid Sort (PRD Section 6.3.B)
    result.sort((a, b) => {
      // 1. Critical/Breached - forced top
      const aBreached = a.sla_status === 'breached' || a.priority === 'P0';
      const bBreached = b.sla_status === 'breached' || b.priority === 'P0';
      if (aBreached && !bBreached) return -1;
      if (!aBreached && bBreached) return 1;

      // 2. Starred - second priority
      const aStarred = starredIds.has(a.id);
      const bStarred = starredIds.has(b.id);
      if (aStarred && !bStarred) return -1;
      if (!aStarred && bStarred) return 1;

      // 3. Remaining SLA time (ascending)
      return (a.sla_remaining_hours || 999) - (b.sla_remaining_hours || 999);
    });

    return result;
  }, [tickets, currentView, searchQuery, starredIds, snoozedIds, user]);

  const counts = useMemo(() => ({
    inbox: tickets.filter(t => !snoozedIds.has(t.id)).length,
    assigned: tickets.filter(t => t.handler_name === (user as any)?.name).length,
    sla_warning: tickets.filter(t => t.sla_status === 'warning' || t.sla_status === 'breached').length,
    all: tickets.length
  }), [tickets, snoozedIds, user]);

  const toggleStar = (id: number) => {
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const snoozeTicket = (id: number) => {
    setSnoozedIds(prev => new Set(prev).add(id));
  };

  const navigateToTicket = (ticket: Ticket) => {
    const routes: Record<string, string> = {
      inquiry: `/service/inquiry-tickets/${ticket.id}`,
      rma: `/service/rma-tickets/${ticket.id}`,
      svc: `/service/dealer-repairs/${ticket.id}`
    };
    navigate(routes[ticket.ticket_type] || routes.inquiry);
  };

  const viewItems = [
    { id: 'inbox' as const, icon: Inbox, label: '收件箱', count: counts.inbox },
    { id: 'assigned' as const, icon: Clock, label: '指派给我', count: counts.assigned },
    { id: 'sla_warning' as const, icon: AlertTriangle, label: 'SLA 告警', count: counts.sla_warning, alert: counts.sla_warning > 0 },
    { id: 'all' as const, icon: Filter, label: '全部工单', count: counts.all }
  ];

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-main)' }}>
      {/* Left Sidebar - View Selector */}
      <div style={{
        width: 240,
        background: 'rgba(30, 30, 30, 0.6)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: '16px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }}>
        <div style={{ padding: '8px 12px', marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>工作台</h2>
          <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0' }}>My Workspace</p>
        </div>

        {viewItems.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: currentView === item.id ? 'rgba(255, 215, 0, 0.15)' : 'transparent',
              color: currentView === item.id ? '#FFD700' : '#999',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left',
              transition: 'all 0.2s'
            }}
          >
            <item.icon size={18} style={{ color: item.alert ? '#EF4444' : 'inherit' }} />
            <span style={{ flex: 1, fontSize: 14 }}>{item.label}</span>
            {item.count > 0 && (
              <span style={{
                background: item.alert ? '#EF4444' : 'rgba(255,255,255,0.1)',
                color: item.alert ? '#fff' : '#888',
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 500
              }}>
                {item.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(30, 30, 30, 0.4)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: '8px 12px',
            flex: 1,
            maxWidth: 400
          }}>
            <Search size={16} color="#666" />
            <input
              type="text"
              placeholder="搜索工单..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: 14,
                width: '100%'
              }}
            />
          </div>

          <span style={{ color: '#666', fontSize: 13 }}>
            {filteredTickets.length} 项
          </span>
        </div>

        {/* Ticket List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader2 className="animate-spin" size={24} color="#888" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
              暂无工单
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredTickets.map(ticket => (
                <TicketCard
                  key={`${ticket.ticket_type}-${ticket.id}`}
                  ticket={ticket}
                  isStarred={starredIds.has(ticket.id)}
                  onStar={() => toggleStar(ticket.id)}
                  onSnooze={() => snoozeTicket(ticket.id)}
                  onClick={() => navigateToTicket(ticket)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Ticket Card Component
interface TicketCardProps {
  ticket: Ticket;
  isStarred: boolean;
  onStar: () => void;
  onSnooze: () => void;
  onClick: () => void;
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, isStarred, onStar, onSnooze, onClick }) => {
  const priorityColors: Record<string, string> = {
    P0: '#EF4444',
    P1: '#F59E0B',
    P2: '#3B82F6'
  };

  const slaColors: Record<string, string> = {
    normal: '#10B981',
    warning: '#F59E0B',
    breached: '#EF4444'
  };

  const typeLabels: Record<string, string> = {
    inquiry: '咨询',
    rma: 'RMA',
    svc: '维修'
  };

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(30, 30, 30, 0.6)',
        backdropFilter: 'blur(20px)',
        borderRadius: 10,
        padding: '14px 16px',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(40, 40, 40, 0.8)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(30, 30, 30, 0.6)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
      }}
    >
      {/* Star Button */}
      <button
        onClick={e => { e.stopPropagation(); onStar(); }}
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: isStarred ? '#FFD700' : '#444'
        }}
      >
        <Star size={18} fill={isStarred ? '#FFD700' : 'none'} />
      </button>

      {/* Priority Badge */}
      <div style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: `${priorityColors[ticket.priority]}20`,
        color: priorityColors[ticket.priority],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700
      }}>
        {ticket.priority}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>
            {ticket.ticket_number}
          </span>
          <span style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.08)',
            color: '#888'
          }}>
            {typeLabels[ticket.ticket_type]}
          </span>
          {ticket.sla_status && ticket.sla_status !== 'normal' && (
            <span style={{
              fontSize: 10,
              padding: '2px 6px',
              borderRadius: 4,
              background: `${slaColors[ticket.sla_status] || '#666'}20`,
              color: slaColors[ticket.sla_status] || '#666'
            }}>
              {ticket.sla_status === 'warning' ? 'SLA警告' : 'SLA超时'}
            </span>
          )}
        </div>
        <div style={{
          color: '#aaa',
          fontSize: 13,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {ticket.problem_summary}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: '#666' }}>
          {ticket.account_name && <span>{ticket.account_name}</span>}
          {ticket.product_name && <span>{ticket.product_name}</span>}
        </div>
      </div>

      {/* SLA Remaining */}
      <div style={{ textAlign: 'right', minWidth: 60 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: slaColors[ticket.sla_status || 'normal'] || slaColors.normal
        }}>
          {ticket.sla_remaining_hours}h
        </div>
        <div style={{ fontSize: 11, color: '#666' }}>剩余</div>
      </div>

      {/* Actions */}
      <button
        onClick={e => { e.stopPropagation(); onSnooze(); }}
        style={{
          background: 'none',
          border: 'none',
          padding: 4,
          cursor: 'pointer',
          color: '#666'
        }}
        title="稍后处理"
      >
        <MoreHorizontal size={18} />
      </button>

      <ChevronRight size={18} color="#444" />
    </div>
  );
};

export default WorkspacePage;
