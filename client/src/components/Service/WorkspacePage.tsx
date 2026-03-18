/**
 * WorkspacePage (个人执行台)
 * PRD P2 Section 6.3.B - The Workspace
 * 三视图架构: My Tasks / Mentioned / Team Hub
 * 适用角色: All (员工的主战场，主管的副战场)
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Star, Loader2, Search, MoreHorizontal, Plus,
  Flame, Hand, MessageSquare, Clock, CheckSquare, Users, Package, Wrench, Truck, AlertCircle, Trash2
} from 'lucide-react';
import axios from 'axios';
import { useTicketStore } from '../../store/useTicketStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useConfirm } from '../../store/useConfirm';
import { useViewAs } from '../Workspace/ViewAsComponents';
import { useUIStore } from '../../store/useUIStore';
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

// Column widths storage
const COL_WIDTHS_KEY = 'longhorn_workspace_col_widths';
type ColKey = 'first' | 'id' | 'status' | 'sla';
const DEFAULT_COL_WIDTHS: Record<ColKey, number> = { first: 72, id: 200, status: 220, sla: 150 };

function loadColWidths(): Record<ColKey, number> {
  try {
    const saved = localStorage.getItem(COL_WIDTHS_KEY);
    return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : { ...DEFAULT_COL_WIDTHS };
  } catch {
    return { ...DEFAULT_COL_WIDTHS };
  }
}

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
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: (t: Ticket) => !t.assigned_to },
    { key: 'receiving', label: { zh: '待收货', en: 'Receiving' }, icon: <Package size={14} />, filter: (t: Ticket) => t.current_node === 'op_receiving' },
    { key: 'diagnosing', label: { zh: '待检测', en: 'Diagnosing' }, icon: <AlertCircle size={14} />, filter: (t: Ticket) => t.current_node === 'op_diagnosing' },
    { key: 'repairing', label: { zh: '待维修', en: 'Repairing' }, icon: <Wrench size={14} />, filter: (t: Ticket) => t.current_node === 'op_repairing' },
    { key: 'shipping', label: { zh: '待发货', en: 'Shipping' }, icon: <Truck size={14} />, filter: (t: Ticket) => t.current_node === 'op_shipping' || t.current_node === 'op_qa' || t.current_node === 'ms_closing' },
  ],
  // B. RD (研发): 完全由部门@Mention驱动
  RD: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: (t: Ticket) => !t.assigned_to },
    { key: 'pending', label: { zh: '需技术建议', en: 'Need Advice' }, icon: <AlertCircle size={14} />, filter: (t: Ticket) => t.current_node === 'rd_consulting' },
    { key: 'provided', label: { zh: '已提供方案', en: 'Advice Provided' }, icon: <CheckSquare size={14} />, filter: (t: Ticket) => t.current_node === 'rd_resolved' },
  ],
  // C. GE (通用台面/管理层): 全量工单
  GE: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: (t: Ticket) => !t.assigned_to },
    { key: 'review', label: { zh: '待审批', en: 'Pending Review' }, icon: <Clock size={14} />, filter: (t: Ticket) => t.current_node === 'ms_review' || t.current_node === 'ge_review' },
  ],
  // D. MS (市场): 全量活跃工单
  MS: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: (t: Ticket) => !t.assigned_to },
    { key: 'review', label: { zh: '待审批', en: 'Pending Review' }, icon: <Clock size={14} />, filter: (t: Ticket) => t.current_node === 'ms_review' || t.current_node === 'ge_review' },
    { key: 'inquiry', label: { zh: '咨询工单', en: 'Inquiry' }, icon: null, filter: (t: Ticket) => t.ticket_type === 'inquiry' },
    { key: 'rma', label: { zh: 'RMA 工单', en: 'RMA' }, icon: null, filter: (t: Ticket) => t.ticket_type === 'rma' },
    { key: 'svc', label: { zh: 'SVC 工单', en: 'SVC' }, icon: null, filter: (t: Ticket) => t.ticket_type === 'svc' },
  ],
  // Default for other departments
  DEFAULT: [
    { key: 'all', label: { zh: '全部', en: 'All' }, icon: null, filter: () => true },
    { key: 'unclaimed', label: { zh: '待认领', en: 'Unclaimed' }, icon: <Hand size={14} />, filter: (t: Ticket) => !t.assigned_to },
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
  const rawDeptCode = viewingAs?.department_code || (user as any)?.department_code || (user as any)?.department_name;

  // Normalize department name to code (Internal helper to match DEPT_TABS keys)
  const normalizeDeptCode = (name: string) => {
    if (!name) return 'DEFAULT';

    // Try to extract code in parentheses: "Marketing (MS)" -> "MS"
    const match = name.match(/\(([A-Z]{2,3})\)/);
    if (match) return match[1].toUpperCase();

    const upper = name.toUpperCase();
    if (/^[A-Z]{2,3}$/.test(upper)) return upper;
    const map: Record<string, string> = {
      '市场部': 'MS', '生产运营部': 'OP', '运营部': 'OP',
      '研发部': 'RD', '通用台面': 'GE', '综合部': 'GE', '管理层': 'GE'
    };
    return map[name] || 'DEFAULT';
  };

  // User's department for Team Hub tab config
  const userDept = normalizeDeptCode(rawDeptCode);
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
  const [isTrashMenuOpen, setTrashMenuOpen] = useState(false);

  // Column widths & resize
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(loadColWidths);
  const resizingRef = useRef<{ col: ColKey; startX: number; startWidth: number } | null>(null);

  // Column sort state: null = hybrid default sort
  type SortKey = 'priority' | 'id' | 'title' | 'status' | 'sla';
  const [sortConfig, setSortConfig] = useState<{ key: SortKey | null; dir: 'asc' | 'desc' }>({ key: null, dir: 'asc' });
  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.dir === 'asc') return { key, dir: 'desc' as const };
        return { key: null, dir: 'asc' as const }; // third click resets to default
      }
      return { key, dir: 'asc' as const };
    });
  }, []);

  const startColResize = useCallback((e: React.MouseEvent, col: ColKey, inverse = false) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { col, startX: e.clientX, startWidth: colWidths[col] };
    const onMouseMove = (me: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = me.clientX - resizingRef.current.startX;
      const newWidth = Math.max(50, resizingRef.current.startWidth + (inverse ? -delta : delta));
      setColWidths(prev => {
        const next = { ...prev, [resizingRef.current!.col]: newWidth };
        localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(next));
        return next;
      });
    };
    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  // Detail view state - restore from saved state
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const confirm = useConfirm();
  const { workspaceClearTrigger } = useUIStore();

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Reset selected ticket when switching views (e.g., clicking sidebar "协作" or "部门池")
  useEffect(() => {
    setSelectedTicket(null);
  }, [currentView]);

  // 监听侧边栏菜单点击，清除选中工单返回列表视图
  useEffect(() => {
    if (workspaceClearTrigger > 0) {
      setSelectedTicket(null);
    }
  }, [workspaceClearTrigger]);

  // Fetch tickets
  useEffect(() => {
    fetchTickets();
  }, [currentView, location.search, activeTab]);

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

  // Load snoozed memory externally so we don't have to redefine inside fetch
  const setupSnoozedIds = (allTickets: Ticket[]) => {
    const snoozed = new Set<number>();
    const now = Date.now();
    allTickets.forEach(t => {
      if (t.snooze_until && new Date(t.snooze_until).getTime() > now) {
        snoozed.add(t.id);
      }
    });
    setSnoozedIds(snoozed);
  };

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

      const filterClosed = (data: any[]) => {
        // Recycle bin shows deleted tickets only
        if (activeTab === 'trash') return data;
        return data.filter(t => !['closed', 'cancelled', 'auto_closed', 'converted', 'resolved'].includes(t.current_node));
      };

      const fetchList = async (params: Record<string, string>) => {
        // If trash tab, request is_deleted=1
        if (activeTab === 'trash') {
          params.is_deleted = '1';
        }
        const res = await axios.get('/api/v1/tickets', {
          headers: { Authorization: `Bearer ${token}` },
          params
        });
        return filterClosed((res.data.data || []).map((t: any) => ({ ...t, participants: t.participants || [] })));
      };

      let dataToSnooze: any[] = [];
      let collabDataToSnooze: any[] = [];

      if (currentView === 'my-tasks') {
        const data = await fetchList({ ...baseParams, assigned_to: 'me' });
        setTickets(data);
        setCollabTickets([]);
        dataToSnooze = data;
      } else if (currentView === 'team-hub') {
        if (urlAssignee) {
          // URL override
          const data = await fetchList({ ...baseParams, assigned_to: urlAssignee });
          setTickets(data);
          setCollabTickets([]);
          dataToSnooze = data;
        } else if (userDept === 'OP') {
          // OP: 主列表(RMA) + 协作列表(dept_collab) 并行加载
          const [rmaData, collabData] = await Promise.all([
            fetchList({ ...baseParams, ticket_type: 'rma' }),
            fetchList({ ...baseParams, dept_collab: 'OP' })
          ]);
          setTickets(rmaData);
          setCollabTickets(collabData);
          dataToSnooze = rmaData;
          collabDataToSnooze = collabData;
        } else if (userDept === 'GE') {
          // GE: 主列表(全量) + 协作列表(dept_collab) 并行加载
          const [allData, collabData] = await Promise.all([
            fetchList({ ...baseParams }),
            fetchList({ ...baseParams, dept_collab: 'GE' })
          ]);
          setTickets(allData);
          setCollabTickets(collabData);
          dataToSnooze = allData;
          collabDataToSnooze = collabData;
        } else if (userDept === 'RD') {
          // RD: 整个列表由部门@Mention驱动
          const data = await fetchList({ ...baseParams, dept_collab: 'RD' });
          setTickets(data);
          setCollabTickets([]);
          dataToSnooze = data;
        } else {
          // MS/DEFAULT: 全量工单
          const data = await fetchList({ ...baseParams });
          setTickets(data);
          setCollabTickets([]);
          dataToSnooze = data;
        }
      } else if (currentView === 'mentioned') {
        const data = await fetchList({ ...baseParams, participant_id: 'me', exclude_assigned_to: 'me' });
        setTickets(data);
        setCollabTickets([]);
        dataToSnooze = data;
      }

      // Load snooze state
      setupSnoozedIds([...dataToSnooze, ...collabDataToSnooze]);

    } catch (err) {
      console.error('[Workspace] Failed to fetch tickets:', err);
      // Ensure we clear loading if it errors to avoid perpetual loading screen
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [currentView, location.search, userDept]);

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

    // User-selected column sort overrides hybrid sort
    if (sortConfig.key) {
      const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
      result.sort((a, b) => {
        let cmp = 0;
        switch (sortConfig.key) {
          case 'priority': {
            const isAStarred = !!starredMap[a.id];
            const isBStarred = !!starredMap[b.id];
            if (isAStarred && !isBStarred) { cmp = -1; break; }
            if (!isAStarred && isBStarred) { cmp = 1; break; }
            cmp = (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
            break;
          }
          case 'id':
            cmp = a.ticket_number.localeCompare(b.ticket_number);
            break;
          case 'title':
            cmp = (a.problem_summary || '').localeCompare(b.problem_summary || '');
            break;
          case 'status':
            cmp = a.current_node.localeCompare(b.current_node);
            break;
          case 'sla': {
            const aDue2 = a.sla_due_at ? new Date(a.sla_due_at).getTime() : Infinity;
            const bDue2 = b.sla_due_at ? new Date(b.sla_due_at).getTime() : Infinity;
            cmp = aDue2 - bDue2;
            break;
          }
        }
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [tickets, collabTickets, searchQuery, starredMap, snoozedIds, location.search, currentView, activeTab, deptTabs, sortConfig]);

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
    const confirmed = await confirm.confirm(
      t('workspace.claim_confirm_msg', { defaultValue: '确实要认领此工单吗？' }),
      t('workspace.claim_confirm_title', { defaultValue: '确认认领' }),
      t('common.confirm') || '确认',
      t('common.cancel') || '取消'
    );
    if (!confirmed) return;

    try {
      await axios.patch(`/api/v1/tickets/${id}`, {
        assigned_to: (user as any)?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Remove from list or refresh
      setTickets(prev => prev.filter(t => t.id !== id));
      setCollabTickets(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      console.error('[Workspace] Pick up failed:', err);
    }
  }, [token, user, confirm, t]);

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

  const getSlaRemaining = (sla_due_at: string | null): { text: string; color: string } => {
    if (!sla_due_at) return { text: '-', color: '#666' };
    const remaining = new Date(sla_due_at).getTime() - Date.now();
    const hours = Math.round(remaining / (1000 * 60 * 60));

    // Chinese formatting logic for SLA
    const isZh = ['zh', 'ja'].includes(language);

    if (hours < 0) {
      const absHours = Math.abs(hours);
      const d = Math.floor(absHours / 24);
      const h = absHours % 24;
      const valText = d > 0 ? `${d}${isZh ? '天' : 'd'} ${h}${isZh ? '小时' : 'h'}` : `${h}${isZh ? '小时' : 'h'}`;
      return { text: `${isZh ? '已逾期' : 'Overdue'} ${valText}`, color: '#EF4444' };
    }
    const d = Math.floor(hours / 24);
    const h = hours % 24;
    const valText = d > 0 ? `${d}${isZh ? '天' : 'd'} ${h}${isZh ? '小时' : 'h'}` : `${h}${isZh ? '小时' : 'h'}`;
    return { text: `${isZh ? '还剩' : 'Remaining'} ${valText}`, color: hours < 4 ? '#EF4444' : (hours < 24 ? '#FFD200' : '#10B981') };
  };

  // Get status display
  const getStatusDisplay = (node: string): { label: string; color: string } => {
    const statusMap: Record<string, { label: string; color: string }> = {
      draft: { label: '草稿', color: '#9CA3AF' },
      submitted: { label: '已提交', color: '#3B82F6' },
      in_progress: { label: '处理中', color: '#3B82F6' },
      waiting_customer: { label: '待反馈', color: '#D946EF' },
      ms_review: { label: 'MS审阅', color: '#FFD200' },
      op_receiving: { label: '待收货', color: '#FFD200' },
      op_diagnosing: { label: '诊断中', color: '#8B5CF6' },
      op_repairing: { label: '维修中', color: '#3B82F6' },
      op_shipping: { label: '待发货', color: '#06B6D4' },
      op_qa: { label: '待发货', color: '#06B6D4' },
      ms_closing: { label: '待结案', color: '#10B981' },
      resolved: { label: '已解决', color: '#10B981' },
      closed: { label: '已关闭', color: '#6B7280' }
    };
    return statusMap[node] || { label: node, color: '#9CA3AF' };
  };

  const priorityColors: Record<string, string> = {
    P0: '#EF4444',
    P1: '#FFD200',
    P2: '#3B82F6'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)' }}>

      {/* Header - macOS26 Style */}
      {!selectedTicket && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 20px 20px' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12, margin: 0, color: 'inherit' }}>
              {currentView === 'my-tasks' && <CheckSquare size={28} color="#FFD200" />}
              {currentView === 'mentioned' && <MessageSquare size={28} color="#3B82F6" />}
              {currentView === 'team-hub' && <Users size={28} color="#FFD200" />}
              {currentView === 'my-tasks' && t('workspace.page_title')}
              {currentView === 'mentioned' && (t('sidebar.mentioned') || '协作')}
              {currentView === 'team-hub' && (t('sidebar.team_hub') || '部门工单')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: '0.9rem' }}>
              {currentView === 'my-tasks' && t('workspace.page_subtitle')}
              {currentView === 'mentioned' && t('workspace.mentioned_subtitle', { defaultValue: '提及您的工单和内部协作任务' })}
              {currentView === 'team-hub' && (activeTab === 'trash' ? '查看已删除的工单' : '部门内所有未关闭的活跃工单和协助工单')}
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

            {/* Create Ticket Button (My Tasks Only) */}
            {currentView === 'my-tasks' && (() => {
              const actingRole = viewingAs?.role || user?.role;
              const userDeptName = viewingAs?.department_code || (viewingAs as any)?.department_name || (user as any)?.department_code || (user as any)?.department_name || '';
              const normalizedDept = normalizeDeptCode(userDeptName);
              const canCreate = actingRole === 'Admin' || actingRole === 'Exec' || normalizedDept === 'MS';
              if (!canCreate) return null;

              return (
                <button
                  onClick={() => useTicketStore.getState().openModal('Inquiry')}
                  title={t('action.create_ticket', { defaultValue: '新建工单' })}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    height: 40, padding: '0 16px', marginLeft: 16,
                    background: 'var(--accent-blue)', color: 'var(--bg-main)',
                    border: 'none', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600,
                    cursor: 'pointer', boxShadow: '0 2px 8px rgba(var(--accent-rgb), 0.3)',
                    transition: 'all 0.2s', whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
                  onMouseLeave={e => e.currentTarget.style.filter = 'none'}
                >
                  <Plus size={18} />
                  <span className="hidden-mobile">{t('action.create_ticket', { defaultValue: '新建工单' })}</span>
                </button>
              );
            })()}
            {/* Trash Menu Component - macOS Style極簡三點 */}
            {currentView === 'team-hub' && (() => {
              const actingRole = viewingAs?.role || user?.role;
              const actingDept = userDept;
              const canAccessTrash = actingRole === 'Admin' || actingRole === 'Exec' || (actingDept === 'MS' && actingRole === 'Lead');
              return canAccessTrash;
            })() && (
                <div style={{ position: 'relative', marginLeft: 16 }}>
                  <button
                    id="trash-menu-trigger"
                    onClick={() => setTrashMenuOpen(!isTrashMenuOpen)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      border: activeTab === 'trash' ? '1.5px solid rgba(239,68,68,0.6)' : '1.5px solid var(--glass-border)',
                      background: activeTab === 'trash' ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-card)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                      color: activeTab === 'trash' ? '#EF4444' : 'var(--text-secondary)',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                      outline: 'none',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = activeTab === 'trash' ? 'rgba(239,68,68,0.6)' : 'var(--glass-border)'; }}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {isTrashMenuOpen && (
                    <>
                      <div
                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                        onClick={() => setTrashMenuOpen(false)}
                      />
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 100,
                        background: 'var(--bg-popover)', border: '1px solid var(--glass-border)',
                        borderRadius: 8, padding: '4px', minWidth: 160, boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
                      }}>
                        <button
                          onClick={() => { setActiveTab(activeTab === 'trash' ? 'all' : 'trash'); setTrashMenuOpen(false); }}
                          style={{
                            width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'transparent',
                            color: 'var(--text-primary)', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <Trash2 size={14} color="#EF4444" />
                          <span>{activeTab === 'trash' ? '返回工单池' : '查看已删除的工单'}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
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
          {deptTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            // PRD: 视觉间隔线，区分状态与分类
            const showDivider = tab.key === 'inquiry';
            return (
              <React.Fragment key={tab.key}>
                {showDivider && (
                  <div style={{ width: 1, height: 20, background: 'var(--glass-border)', margin: '0 8px', alignSelf: 'center' }} />
                )}
                <button
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 20,

                    background: isActive ? 'var(--accent-subtle)' : 'var(--glass-bg-light)',
                    color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    border: isActive ? '1px solid var(--accent-subtle)' : '1px solid transparent',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = 'var(--glass-bg-hover)';
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'var(--glass-bg-light)';
                  }}
                >
                  {tab.icon}
                  <span>{tab.label[lang]}</span>
                  <span style={{
                    background: isActive ? 'var(--glass-bg-hover)' : 'var(--glass-bg)',
                    padding: '2px 8px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    minWidth: 24,
                    textAlign: 'center'
                  }}>
                    {tab.isCollabTab ? collabTickets.length : tickets.filter(tab.filter).length}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      {
        selectedTicket ? (
          <div style={{ padding: '0 24px 24px', flex: 1, overflow: 'auto' }}>
            <UnifiedTicketDetail
              ticketId={selectedTicket.id}
              onBack={() => setSelectedTicket(null)}
              viewContext={
                currentView === 'my-tasks' ? 'my_tasks'
                  : currentView === 'team-hub' ? 'team_queue'
                    : currentView === 'mentioned' ? 'mentioned'
                      : 'search'
              }
            />
          </div>

        ) : (
          <div ref={scrollContainerRef} style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <Loader2 className="animate-spin" size={24} style={{ color: 'var(--text-tertiary)' }} />
              </div>
            ) : (
              <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: colWidths.first }} />
                  <col style={{ width: colWidths.id }} />
                  <col />
                  <col style={{ width: colWidths.status }} />
                  <col style={{ width: colWidths.sla }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                    <th
                      onClick={() => handleSort('priority')}
                      style={{ padding: '0 8px 16px', color: sortConfig.key === 'priority' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500, fontSize: '0.82rem', textAlign: 'center', position: 'relative', userSelect: 'none', cursor: 'pointer' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        Pri/★
                        {sortConfig.key === 'priority'
                          ? <span style={{ fontSize: 10, color: 'var(--accent-blue)' }}>{sortConfig.dir === 'asc' ? ' ↑' : ' ↓'}</span>
                          : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                      </span>
                      <div onMouseDown={e => startColResize(e, 'first')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                    </th>
                    <th
                      onClick={() => handleSort('id')}
                      style={{ padding: '0 16px 16px', color: sortConfig.key === 'id' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', position: 'relative', userSelect: 'none', cursor: 'pointer' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        ID
                        {sortConfig.key === 'id'
                          ? <span style={{ fontSize: 10, color: 'var(--accent-blue)' }}>{sortConfig.dir === 'asc' ? ' ↑' : ' ↓'}</span>
                          : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                      </span>
                      <div onMouseDown={e => startColResize(e, 'id')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                    </th>
                    <th
                      onClick={() => handleSort('title')}
                      style={{ padding: '0 16px 16px', color: sortConfig.key === 'title' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', position: 'relative', userSelect: 'none', cursor: 'pointer' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {t('workspace.title')}
                        {sortConfig.key === 'title'
                          ? <span style={{ fontSize: 10, color: 'var(--accent-blue)' }}>{sortConfig.dir === 'asc' ? ' ↑' : ' ↓'}</span>
                          : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                      </span>
                      <div onMouseDown={e => startColResize(e, 'status', true)} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                    </th>
                    <th
                      onClick={() => handleSort('status')}
                      style={{ padding: '0 16px 16px', color: sortConfig.key === 'status' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', position: 'relative', userSelect: 'none', cursor: 'pointer' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        {t('workspace.status')}
                        {sortConfig.key === 'status'
                          ? <span style={{ fontSize: 10, color: 'var(--accent-blue)' }}>{sortConfig.dir === 'asc' ? ' ↑' : ' ↓'}</span>
                          : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                      </span>
                      <div onMouseDown={e => startColResize(e, 'status')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                    </th>
                    <th
                      onClick={() => handleSort('sla')}
                      style={{ padding: '0 16px 16px', color: sortConfig.key === 'sla' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem', textAlign: 'right', position: 'relative', userSelect: 'none', cursor: 'pointer' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end', width: '100%' }}>
                        {t('workspace.sla_timer')}
                        {sortConfig.key === 'sla'
                          ? <span style={{ fontSize: 10, color: 'var(--accent-blue)' }}>{sortConfig.dir === 'asc' ? ' ↑' : ' ↓'}</span>
                          : <span style={{ fontSize: 10, opacity: 0.3 }}> ↕</span>}
                      </span>
                      <div onMouseDown={e => startColResize(e, 'sla')} onClick={e => e.stopPropagation()} className="col-resize-handle" />
                    </th>
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
                        {/* Left: Star/Flame + Priority badge - horizontal, whole cell is star zone */}
                        <td
                          onClick={e => { e.stopPropagation(); toggleStar(ticket.id); }}
                          style={{ padding: '8px 4px', textAlign: 'center', cursor: 'pointer' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                            {/* Star icon - always rendered; visible when starred or row hovered */}
                            <Star
                              size={14}
                              fill={isStarred ? '#FFD200' : 'none'}
                              className={`workspace-star-icon${isStarred ? ' starred' : ''}`}
                              style={{ color: isStarred ? '#FFD200' : 'var(--text-tertiary)', flexShrink: 0, transition: 'opacity 0.15s, color 0.15s' }}
                            />
                            {/* Flame for critical/P0 */}
                            {isCritical && (
                              <Flame size={14} style={{ color: '#EF4444', flexShrink: 0 }} />
                            )}
                            {/* Priority badge - always show */}
                            {ticket.priority && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '0.02em',
                                color: priorityColors[ticket.priority] || '#3B82F6',
                                background: `${priorityColors[ticket.priority] || '#3B82F6'}18`,
                                border: `1px solid ${priorityColors[ticket.priority] || '#3B82F6'}44`,
                                padding: '1px 4px', borderRadius: 3, lineHeight: 1.5, flexShrink: 0
                              }}>
                                {ticket.priority}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* ID */}
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            fontSize: '1.05rem',
                            fontWeight: 400,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap'
                          }}>
                            {ticket.ticket_number}
                          </span>
                        </td>

                        {/* Title & Subtitle */}
                        <td style={{ padding: '16px', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: '0.9rem' }}>
                            <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              {ticket.account_name || ticket.contact_name || ticket.reporter_snapshot?.name || ticket.reporter_name || '-'}
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
                              {ticket.assigned_name && <span style={{ color: 'var(--text-tertiary)' }}>· {ticket.assigned_name}</span>}
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
                          <div style={{ fontSize: '0.85rem', color: sla.color, fontWeight: 500 }}>
                            {sla.text}
                          </div>

                          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            {currentView === 'team-hub' && !ticket.assigned_to && (
                              <button
                                onClick={e => { e.stopPropagation(); pickUpTicket(ticket.id); }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px',
                                  borderRadius: 6, border: '1px solid #FFD200', background: 'transparent',
                                  color: '#FFD200', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                                  transition: 'all 0.15s'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = '#FFD200';
                                  e.currentTarget.style.color = '#000';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#FFD200';
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
        )
      }

      {/* Context Menu */}
      {
        contextMenu && (
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
              <Star size={14} style={{ color: '#FFD200' }} />
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
        )
      }

      {/* Drawer Overlay Removed */}

      {/* Hover styles for star/snooze visibility */}
      <style>{`
        .workspace-ticket-row:hover .workspace-snooze-btn {
          opacity: 1 !important;
        }
        .workspace-star-icon {
          opacity: 0;
        }
        .workspace-star-icon.starred {
          opacity: 1;
        }
        .workspace-ticket-row:hover .workspace-star-icon {
          opacity: 0.45;
        }
        .workspace-ticket-row:hover .workspace-star-icon.starred {
          opacity: 1;
        }
        .col-resize-handle {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          cursor: col-resize;
          z-index: 10;
          background: transparent;
          transition: background 0.15s;
        }
        .col-resize-handle:hover {
          background: rgba(59, 130, 246, 0.45);
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
    </div >
  );
};

export default WorkspacePage;
