/**
 * WorkspacePage (个人执行台)
 * PRD P2 Section 6.3.B - The Workspace
 * 三视图架构: My Tasks / Mentioned / Team Hub
 * 适用角色: All (员工的主战场，主管的副战场)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Star, Loader2, Search, MoreHorizontal,
  Flame, Hand, MessageSquare, Clock, CheckSquare, Users, Package, Wrench, Truck, AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useConfirm } from '../../store/useConfirm';
import { useViewAs } from '../Workspace/ViewAsComponents';
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
  reporter_snapshot?: any;
  channel?: string;
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

type WorkspaceView = 'my-tasks' | 'mentioned' | 'team-hub';

// Star storage key
const STAR_STORAGE_KEY = 'longhorn_workspace_stars';

// View state storage keys for each workspace view
const VIEW_STATE_KEYS: Record<WorkspaceView, string> = {
  'my-tasks': 'longhorn_workspace_my_tasks_state',
  'mentioned': 'longhorn_workspace_mentioned_state',
  'team-hub': 'longhorn_workspace_team_hub_state'
};

interface ViewState {
  searchQuery: string;
  selectedTicketId: number | null;
  scrollPosition: number;
  timestamp: number;
}

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

function loadViewState(view: WorkspaceView): ViewState | null {
  try {
    const saved = localStorage.getItem(VIEW_STATE_KEYS[view]);
    if (saved) {
      const state = JSON.parse(saved);
      // Only restore if within 24 hours
      if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
        return state;
      }
    }
  } catch { }
  return null;
}

function saveViewState(view: WorkspaceView, state: Omit<ViewState, 'timestamp'>) {
  try {
    localStorage.setItem(VIEW_STATE_KEYS[view], JSON.stringify({
      ...state,
      timestamp: Date.now()
    }));
  } catch { }
}

// ==============================
// Team Hub Department Tabs Configuration
// PRD v1.7 - ABC方案
// ==============================

interface DeptTabConfig {
  key: string;
  label: { zh: string; en: string };
  icon: React.ReactNode;
  filter: (t: Ticket) => boolean;
  isCollabTab?: boolean; // 是否是协作 Tab，需要独立请求 dept_collab 接口
}

const DEPT_TABS: Record<string, DeptTabConfig[]> = {
  // A. OP (运营): 全量活跃RMA + 部门协作工单
  OP: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: t => !t.assigned_to },
    { key: 'receiving', label: { zh: '待收货', en: 'Receiving' }, icon: <Package size={14} />, filter: t => t.current_node === 'op_receiving' },
    { key: 'diagnosing', label: { zh: '待检测', en: 'Diagnosing' }, icon: <AlertCircle size={14} />, filter: t => t.current_node === 'op_diagnosing' },
    { key: 'repairing', label: { zh: '待维修', en: 'Repairing' }, icon: <Wrench size={14} />, filter: t => t.current_node === 'op_repairing' },
    { key: 'shipping', label: { zh: '待发货', en: 'Shipping' }, icon: <Truck size={14} />, filter: t => t.current_node === 'op_qa' || t.current_node === 'ms_closing' },
    { key: 'collab', label: { zh: '协作', en: 'Collab' }, icon: <MessageSquare size={14} />, filter: () => true, isCollabTab: true },
  ],
  // B. RD (研发): 完全由部门@Mention驱动
  RD: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: t => !t.assigned_to },
    { key: 'pending', label: { zh: '需技术建议', en: 'Need Advice' }, icon: <AlertCircle size={14} />, filter: t => t.current_node === 'rd_consulting' },
    { key: 'provided', label: { zh: '已提供方案', en: 'Advice Provided' }, icon: <CheckSquare size={14} />, filter: t => t.current_node === 'rd_resolved' },
  ],
  // C. GE (通用台面/管理层): 全量工单 + 部门协作
  GE: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: t => !t.assigned_to },
    { key: 'review', label: { zh: '待审批', en: 'Pending Review' }, icon: <Clock size={14} />, filter: t => t.current_node === 'ms_review' || t.current_node === 'ge_review' },
    { key: 'collab', label: { zh: '协作', en: 'Collab' }, icon: <MessageSquare size={14} />, filter: () => true, isCollabTab: true },
  ],
  // D. MS (市场): 全量活跃工单
  MS: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: t => !t.assigned_to },
    { key: 'inquiry', label: { zh: '活跃咨询', en: 'Active Inquiries' }, icon: <MessageSquare size={14} />, filter: t => t.ticket_type === 'inquiry' },
    { key: 'rma', label: { zh: '返修协调', en: 'RMA Coord' }, icon: <Package size={14} />, filter: t => t.ticket_type === 'rma' },
    { key: 'svc', label: { zh: '代理维修', en: 'Dealer Repairs' }, icon: <Wrench size={14} />, filter: t => t.ticket_type === 'svc' },
    { key: 'review', label: { zh: '待审批', en: 'Pending Review' }, icon: <Clock size={14} />, filter: t => t.current_node === 'ms_review' || t.current_node === 'ge_review' },
  ],
  // Default for other departments
  DEFAULT: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: t => !t.assigned_to },
  ]
};

// ==============================
// Main Component
// ==============================

const WorkspacePage: React.FC = () => {
  const { token, user } = useAuthStore();
  const location = useLocation();
  const { t, language } = useLanguage();
  const lang = language === 'zh' || language === 'ja' ? 'zh' : 'en';

  // P2: View As support - use viewingAs user's department if active
  const { viewingAs } = useViewAs();
  const actingDeptCode = viewingAs?.department_code || (user as any)?.department_code;

  // User's department for Team Hub tab config
  const userDept = actingDeptCode?.toUpperCase() || 'DEFAULT';
  const deptTabs = DEPT_TABS[userDept] || DEPT_TABS.DEFAULT;

  // Determine current view from route
  const currentView: WorkspaceView = useMemo(() => {
    if (location.pathname.includes('/mentioned')) return 'mentioned';
    if (location.pathname.includes('/team-hub')) return 'team-hub';
    return 'my-tasks';
  }, [location.pathname]);

  // Team Hub active tab
  const [activeTab, setActiveTab] = useState('all');

  // Load saved state for current view
  const savedState = useMemo(() => loadViewState(currentView), [currentView]);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [collabTickets, setCollabTickets] = useState<Ticket[]>([]); // 协作 Tab 独立列表
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(savedState?.searchQuery || '');
  // Star: { ticketId: timestamp } for sorting by star time
  const [starredMap, setStarredMap] = useState<Record<number, number>>(loadStarredIds);
  const [snoozedIds, setSnoozedIds] = useState<Set<number>>(new Set());
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; ticketId: number } | null>(null);

  // Detail view state - restore from saved state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const confirm = useConfirm();

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset selected ticket when switching views (e.g., clicking sidebar "协作" or "部门池")
  useEffect(() => {
    setSelectedTicket(null);
  }, [currentView]);

  // Fetch tickets
  useEffect(() => {
    fetchTickets();
  }, [currentView, location.search]);

  // Restore selected ticket after tickets load
  useEffect(() => {
    if (!loading && tickets.length > 0 && savedState?.selectedTicketId) {
      const ticket = tickets.find(t => t.id === savedState.selectedTicketId);
      if (ticket) {
        setSelectedTicket(ticket);
      }
    }
  }, [loading, tickets, savedState?.selectedTicketId]);

  // Restore scroll position when returning to list view
  useEffect(() => {
    if (!selectedTicket && scrollContainerRef.current && savedState?.scrollPosition) {
      scrollContainerRef.current.scrollTop = savedState.scrollPosition;
    }
  }, [selectedTicket, savedState?.scrollPosition]);

  // Save state when leaving the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveViewState(currentView, {
        searchQuery,
        selectedTicketId: selectedTicket?.id || null,
        scrollPosition: scrollContainerRef.current?.scrollTop || 0
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also save when component unmounts (navigating away)
      saveViewState(currentView, {
        searchQuery,
        selectedTicketId: selectedTicket?.id || null,
        scrollPosition: scrollContainerRef.current?.scrollTop || 0
      });
    };
  }, [currentView, searchQuery, selectedTicket]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const baseParams: Record<string, string> = {
        page_size: '200',
        sort_by: 'sla_due_at',
        sort_order: 'ASC'
      };

      const searchParams = new URLSearchParams(location.search);
      const urlAssignee = searchParams.get('assignee');

      const filterClosed = (data: any[]) =>
        data.filter(t => !['closed', 'cancelled', 'auto_closed', 'converted', 'resolved'].includes(t.current_node));

      const fetchList = async (params: Record<string, string>) => {
        const res = await axios.get('/api/v1/tickets', {
          headers: { Authorization: `Bearer ${token}` },
          params
        });
        return filterClosed((res.data.data || []).map((t: any) => ({ ...t, participants: t.participants || [] })));
      };

      if (currentView === 'my-tasks') {
        const data = await fetchList({ ...baseParams, assigned_to: 'me' });
        setTickets(data);
        setCollabTickets([]);
      } else if (currentView === 'team-hub') {
        if (urlAssignee) {
          // URL override
          const data = await fetchList({ ...baseParams, assigned_to: urlAssignee });
          setTickets(data);
          setCollabTickets([]);
        } else if (userDept === 'OP') {
          // OP: 主列表(RMA) + 协作列表(dept_collab) 并行加载
          const [rmaData, collabData] = await Promise.all([
            fetchList({ ...baseParams, ticket_type: 'rma' }),
            fetchList({ ...baseParams, dept_collab: 'OP' })
          ]);
          setTickets(rmaData);
          setCollabTickets(collabData);
        } else if (userDept === 'GE') {
          // GE: 主列表(全量) + 协作列表(dept_collab) 并行加载
          const [allData, collabData] = await Promise.all([
            fetchList({ ...baseParams }),
            fetchList({ ...baseParams, dept_collab: 'GE' })
          ]);
          setTickets(allData);
          setCollabTickets(collabData);
        } else if (userDept === 'RD') {
          // RD: 整个列表由部门@Mention驱动
          const data = await fetchList({ ...baseParams, dept_collab: 'RD' });
          setTickets(data);
          setCollabTickets([]);
        } else {
          // MS/DEFAULT: 全量工单
          const data = await fetchList({ ...baseParams });
          setTickets(data);
          setCollabTickets([]);
        }
      } else if (currentView === 'mentioned') {
        const data = await fetchList({ ...baseParams, participant_id: 'me', exclude_assigned_to: 'me' });
        setTickets(data);
        setCollabTickets([]);
      }

      // Load snooze state
      const snoozed = new Set<number>();
      const now = Date.now();
      [...tickets, ...collabTickets].forEach(t => {
        if (t.snooze_until && new Date(t.snooze_until).getTime() > now) {
          snoozed.add(t.id);
        }
      });
      setSnoozedIds(snoozed);
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

    // 协作 Tab 激活时用独立的 collabTickets
    const activeTabConfig = deptTabs.find(tab => tab.key === activeTab);
    const isCollabActive = currentView === 'team-hub' && activeTabConfig?.isCollabTab;
    const sourceTickets = isCollabActive ? collabTickets : tickets;

    let result = sourceTickets.filter(t => {
      // Hide snoozed (except P0 - Critical can't be snoozed)
      if (snoozedIds.has(t.id) && t.priority !== 'P0') return false;

      // Team Hub Tab Filter
      if (currentView === 'team-hub' && activeTab !== 'all') {
        const tabConfig = deptTabs.find(tab => tab.key === activeTab);
        // isCollabTab: 数据已由后端 dept_collab 接口过滤，前端不再重复过滤
        if (tabConfig && !tabConfig.isCollabTab && !tabConfig.filter(t)) return false;
      }

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
  }, [tickets, collabTickets, searchQuery, starredMap, snoozedIds, location.search, currentView, activeTab, deptTabs]);

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
              {currentView === 'team-hub' && <Users size={28} color="#F59E0B" />}
              {currentView === 'my-tasks' && t('workspace.page_title')}
              {currentView === 'mentioned' && (t('sidebar.service_mentioned', { defaultValue: '协作' }) || '协作')}
              {currentView === 'team-hub' && (t('sidebar.team_hub') || '部门工单')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.9rem' }}>
              {currentView === 'my-tasks' && t('workspace.page_subtitle')}
              {currentView === 'mentioned' && t('workspace.mentioned_subtitle', { defaultValue: '提及您的工单和内部协作任务' })}
              {currentView === 'team-hub' && t('workspace.team_hub_subtitle', { defaultValue: '部门的职责中心与协同雷达站' })}
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

      {/* Team Hub Topbar Dashboard - 仅部门工单页面显示 */}
      {currentView === 'team-hub' && !selectedTicket && (
        <div style={{
          display: 'flex',
          gap: 8,
          padding: '0 20px 16px',
          overflowX: 'auto',
          flexWrap: 'wrap'
        }}>
          {deptTabs.map(tab => {
            // 协作 Tab 数字独立统计，其他 Tab 基于主列表
            const count = tab.isCollabTab ? collabTickets.length : tickets.filter(tab.filter).length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 20,
                  border: 'none',
                  background: isActive ? '#FFD700' : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#000' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }}
              >
                {tab.icon}
                <span>{tab.label[lang]}</span>
                <span style={{
                  background: isActive ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)',
                  padding: '2px 8px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  minWidth: 24,
                  textAlign: 'center'
                }}>
                  {count}
                </span>
              </button>
            );
          })}
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
        <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
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
                            {ticket.account_name || ticket.contact_name || ticket.reporter_name || '-'}
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
                            {ticket.assigned_name ? (
                              <span style={{ color: 'var(--text-tertiary)' }}>· {ticket.assigned_name}</span>
                            ) : currentView === 'team-hub' && (
                              <button
                                onClick={e => { e.stopPropagation(); pickUpTicket(ticket.id); }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px',
                                  borderRadius: 12, border: '1px solid #FFD700', background: 'rgba(255,215,0,0.1)',
                                  color: '#FFD700', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                                  marginLeft: 4
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = '#FFD700';
                                  e.currentTarget.style.color = '#000';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = 'rgba(255,215,0,0.1)';
                                  e.currentTarget.style.color = '#FFD700';
                                }}
                              >
                                <Hand size={12} /> {t('workspace.claim', { defaultValue: '认领' })}
                              </button>
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
                          {currentView === 'team-hub' && !ticket.assigned_to && (
                            <button
                              onClick={e => { e.stopPropagation(); pickUpTicket(ticket.id); }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                borderRadius: 6, border: '1px solid #FFD700', background: 'transparent',
                                color: '#FFD700', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#FFD700';
                                e.currentTarget.style.color = '#000';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#FFD700';
                              }}
                            >
                              <Hand size={14} /> {t('workspace.claim', { defaultValue: '认领' })}
                            </button>
                          )}
                          {ticket.priority !== 'P0' && currentView !== 'team-hub' && (
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
