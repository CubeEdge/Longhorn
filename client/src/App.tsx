
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate, useSearchParams, Outlet } from 'react-router-dom';
import {
  Share2,
  LogOut,
  Camera,
  Film,
  Code,
  Box,
  Menu,
  Star,
  Trash2,
  User,
  LayoutDashboard,
  ClipboardList,
  MessageCircleQuestion,
  Book,
  Users,
  Building,
  Wrench,
  Package,
  CheckSquare,
  Bell,
  ChevronDown,
  ChevronRight,
  Eye,
  Plus,
  Layers
} from 'lucide-react';
import { useLanguage } from './i18n/useLanguage';
import axios from 'axios';
import { useAuthStore } from './store/useAuthStore';
import FileBrowser from './components/FileBrowser';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import RecycleBin from './components/RecycleBin';
import SearchPage from './components/SearchPage';
import StarredPage from './components/StarredPage';
import RecentPage from './components/RecentPage';
import SharesPage from './components/SharesPage';
import MemberSpacePage from './components/MemberSpacePage';
import RootDirectoryView from './components/RootDirectoryView';
import Dashboard from './components/Dashboard';
import DepartmentDashboard from './components/DepartmentDashboard';
import { DailyWordBadge } from './components/DailyWord';
// import { ContextPanel } from './components/ServiceRecords';
import { InquiryTicketListPage, InquiryTicketCreatePage } from './components/InquiryTickets';
import { RMATicketListPage, RMATicketCreatePage } from './components/RMATickets';
import { DealerRepairListPage, DealerRepairCreatePage } from './components/DealerRepairs';
import UnifiedTicketDetailPage from './components/Service/UnifiedTicketDetailPage';
import { DealerInventoryListPage, RestockOrderListPage, RestockOrderDetailPage, RestockOrderCreatePage } from './components/DealerInventory';
import CustomerManagement from './components/CustomerManagement';
import DealerManagement from './components/DealerManagement';
import ProductManagement from './components/ProductManagement';
import ProductDetailPage from './components/ProductDetailPage';
import ProductModelsManagement from './components/ProductModelsManagement';
import ProductModelDetailPage from './components/ProductModelDetailPage';
import ProductSkusManagement from './components/ProductSkusManagement';
import ProductSkuDetailPage from './components/ProductSkuDetailPage';
import { PartsManagementPage, PartsCatalogPage, PartsInventoryPage, PartsConsumptionPage, PartsSettlementPage } from './components/PartsManagement';
import CustomerDetailPage from './components/CustomerDetailPage';

import KnowledgeAuditLog from './components/KnowledgeAuditLog';
import { KinefinityWiki } from './components/KinefinityWiki';
import AppRail from './components/AppRail';
// ... imports
import { useTicketStore } from './store/useTicketStore';
import TicketCreationModal from './components/Service/TicketCreationModal';
import BokehContainer from './components/Bokeh/BokehContainer';
import WorkspacePage from './components/Service/WorkspacePage';
import ServiceOverviewPage from './components/Service/ServiceOverviewPage';

import TicketAiWizard from './components/TicketAiWizard';
import { useNavigationState, canAccessFilesModule } from './hooks/useNavigationState';
import type { ModuleType } from './hooks/useNavigationState';
import { useUIStore } from './store/useUIStore';

import ShareCollectionPage from './components/ShareCollectionPage';

import Toast from './components/Toast';
import NotificationPopupManager from './components/Notifications/NotificationPopupManager';
import { ConfirmDialog } from './components/ConfirmDialog';
import { NotificationBell, NotificationCenter } from './components/Notifications';
import { useRouteMemoryStore } from './store/useRouteMemoryStore';
import { useListStateStore } from './store/useListStateStore';
import { ViewAsIndicator, ViewAsSelector, useViewAs } from './components/Workspace/ViewAsComponents';
import { useViewAsStore } from './store/useViewAsStore';
import { DebugInfoPanel } from './components/DebugOverlay';

// Main Layout Component for authenticated users
const MainLayout: React.FC<{ user: any }> = ({ user }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { currentModule, switchModule } = useNavigationState();
  const canAccessFiles = canAccessFilesModule(user.role);

  // P2: View As functionality
  const {
    viewingAs,
    isOpen: isViewAsOpen,
    setIsOpen: setViewAsOpen,
    startViewAs,
    exitViewAs,
    availableUsers
  } = useViewAs();

  // Alt + N Global Shortcut
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + N (Mac: Option + N)
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        useTicketStore.getState().openModal('Inquiry');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-container fade-in" style={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      <AppRail
        currentModule={currentModule}
        onModuleChange={switchModule}
        canAccessFiles={canAccessFiles}
        userRole={user.role}
      />

      {/* Mobile Overlay - FIX: Use correct class name without extra spaces */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar - Always rendered (logic inside handles content) */}
      <Sidebar
        user={user}
        viewingAs={viewingAs}
        role={viewingAs?.role || user.role}
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentModule={currentModule}
      />

      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar
          user={viewingAs || user}
          onMenuClick={() => setSidebarOpen(true)}
          currentModule={currentModule}
        />

        {/* Content Area - All modules support scrolling */}
        <div
          className={currentModule === 'service' ? '' : 'content-area'}
          style={{ flex: 1, overflow: 'auto', position: 'relative' }}
        >
          <Outlet />
        </div>
      </main>

      {/* Global Ticket Creation Modal */}
      <TicketCreationModal />
      <BokehContainer />
      <NotificationCenter />

      <ViewAsSelector
        isOpen={isViewAsOpen}
        onClose={() => setViewAsOpen(false)}
        onSelect={startViewAs}
        users={availableUsers}
      />
      <ViewAsIndicator viewingAs={viewingAs} onExit={exitViewAs} />

      {/* P2: Debug Overlay */}
      <DebugInfoPanel />
    </div>
  );
};

const App: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/share-collection/:token" element={<ShareCollectionPage />} />

        {/* Login Route */}
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />

        {/* Protected Routes */}
        <Route element={
          (!user || typeof user !== 'object' || !user.role) ? (
            <Login />
          ) : (
            <MainLayout user={user} />
          )
        }>
          <Route path="/" element={<HomeRedirect user={user} />} />

          {/* ==================== SERVICE MODULE ==================== */}
          {/* P2: Overview Dashboard (管理仪表盘) */}
          <Route path="/service/overview" element={<ServiceOverviewPage />} />

          {/* P2: Workspace (个人执行台) */}
          <Route path="/service/workspace" element={<WorkspacePage />} />
          <Route path="/service/mentioned" element={<WorkspacePage />} />
          <Route path="/service/team-hub" element={<WorkspacePage />} />

          {/* 统一工单详情页 - 所有类型工单共用 */}
          <Route path="/service/tickets/:id" element={<UnifiedTicketDetailPage />} />

          {/* Inquiry Tickets (咨询工单) - Layer 1 */}
          <Route path="/service/inquiry-tickets" element={<InquiryTicketListPage />} />
          <Route path="/service/inquiry-tickets/new" element={<InquiryTicketCreatePage />} />
          <Route path="/inquiry-tickets" element={<Navigate to="/service/inquiry-tickets" replace />} />
          <Route path="/inquiry-tickets/*" element={<Navigate to="/service/inquiry-tickets" replace />} />

          {/* AI Ticket Wizard */}
          <Route path="/service/ticket-wizard" element={<TicketAiWizard />} />

          {/* RMA Tickets (RMA返厂单) - Layer 2 */}
          <Route path="/service/rma-tickets" element={<RMATicketListPage />} />
          <Route path="/service/rma-tickets/new" element={<RMATicketCreatePage />} />
          <Route path="/rma-tickets" element={<Navigate to="/service/rma-tickets" replace />} />
          <Route path="/rma-tickets/*" element={<Navigate to="/service/rma-tickets" replace />} />

          {/* Dealer Repairs (经销商维修单) - Layer 3 */}
          <Route path="/service/dealer-repairs" element={<DealerRepairListPage />} />
          <Route path="/service/dealer-repairs/new" element={<DealerRepairCreatePage />} />
          <Route path="/dealer-repairs" element={<Navigate to="/service/dealer-repairs" replace />} />
          <Route path="/dealer-repairs/*" element={<Navigate to="/service/dealer-repairs" replace />} />

          {/* Dealer Repairs (经销商维修单) - Layer 3 */}

          {/* Archives (档案和基础信息) - Section 2.3 - 三级入口结构 */}
          {/* 1. 渠道和经销商 (第一入口) */}
          <Route path="/service/dealers" element={<DealerManagement />} />
          <Route path="/service/dealers/:id" element={<CustomerDetailPage />} />

          {/* 2. 客户档案 (第二入口) */}
          <Route path="/service/customers" element={<CustomerManagement />} />
          <Route path="/service/customers/:id" element={<CustomerDetailPage />} />

          {/* 3. 资产和物料 (第三入口) */}
          {/* 产品台账权限：仅 MS, OP, GE 和 Exec 可见 */}
          <Route path="/service/products" element={
            (user?.role === 'Exec' || ['MS', 'OP', 'GE'].includes(user?.department_code || '')) ? <ProductManagement /> : <Navigate to="/service/overview" />
          } />
          <Route path="/service/products/:id" element={
            (user?.role === 'Exec' || ['MS', 'OP', 'GE'].includes(user?.department_code || '')) ? <ProductDetailPage /> : <Navigate to="/service/overview" />
          } />
          <Route path="/service/product-models" element={
            (user?.role === 'Exec' || ['MS', 'OP', 'GE'].includes(user?.department_code || '')) ? <ProductModelsManagement /> : <Navigate to="/service/overview" />
          } />
          <Route path="/service/product-models/:id" element={
            (user?.role === 'Exec' || ['MS', 'OP', 'GE'].includes(user?.department_code || '')) ? <ProductModelDetailPage /> : <Navigate to="/service/overview" />
          } />
          <Route path="/service/product-skus" element={
            (user?.role === 'Exec' || ['MS', 'OP', 'GE'].includes(user?.department_code || '')) ? <ProductSkusManagement /> : <Navigate to="/service/overview" />
          } />
          <Route path="/service/product-skus/:id" element={
            (user?.role === 'Exec' || ['MS', 'OP', 'GE'].includes(user?.department_code || '')) ? <ProductSkuDetailPage /> : <Navigate to="/service/overview" />
          } />
          <Route path="/service/assets" element={<Navigate to="/service/products" replace />} />

          {/* Knowledge Audit Log - Internal Staff Only (Admin) */}
          <Route path="/service/knowledge/audit" element={
            (user?.role === 'Admin' || user?.role === 'Exec') ? <KnowledgeAuditLog /> : <Navigate to="/" />
          } />
          <Route path="/tech-hub/wiki" element={<KinefinityWiki />} />
          <Route path="/tech-hub/wiki/:slug" element={<KinefinityWiki />} />

          {/* Parts Management */}
          <Route path="/service/parts" element={<PartsManagementPage />} />
          <Route path="/service/parts/catalog" element={<PartsCatalogPage />} />
          <Route path="/service/parts/inventory" element={<PartsInventoryPage />} />
          <Route path="/service/parts/consumption" element={<PartsConsumptionPage />} />
          <Route path="/service/parts/settlement" element={<PartsSettlementPage />} />

          {/* Dealer Inventory Management */}
          <Route path="/service/dealer-operations" element={<DealerInventoryListPage />} />
          <Route path="/service/dealer-operations/restock" element={<RestockOrderListPage />} />
          <Route path="/service/dealer-operations/restock/new" element={<RestockOrderCreatePage />} />
          <Route path="/service/dealer-operations/restock/:id" element={<RestockOrderDetailPage />} />
          {/* 旧路由重定向 */}
          <Route path="/service/inventory" element={<Navigate to="/service/dealer-operations" replace />} />
          <Route path="/service/inventory/*" element={<Navigate to="/service/dealer-operations" replace />} />

          {/* Legacy Service Routes - Redirects */}
          <Route path="/service/records" element={<Navigate to="/service/inquiry-tickets" replace />} />
          <Route path="/service/records/*" element={<Navigate to="/service/inquiry-tickets" replace />} />
          <Route path="/service/issues" element={<Navigate to="/service/rma-tickets" replace />} />
          <Route path="/service/issues/*" element={<Navigate to="/service/rma-tickets" replace />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* ==================== FILES MODULE ==================== */}
          {/* Personal Space */}
          <Route path="/files/personal/*" element={<FileBrowser key="personal" mode="personal" />} />
          <Route path="/files/personal" element={<FileBrowser key="personal-root" mode="personal" />} />

          {/* Department Files */}
          <Route path="/files/dept/:deptCode/*" element={<FileBrowser key="dept" />} />
          <Route path="/files/dept/:deptCode" element={<FileBrowser key="dept-root" />} />

          {/* Quick Access */}
          <Route path="/files/starred" element={<StarredPage />} />
          <Route path="/files/shares" element={<SharesPage />} />
          <Route path="/files/recycle" element={<RecycleBin />} />
          <Route path="/files/search" element={<SearchPage />} />
          <Route path="/files/recent" element={<RecentPage />} />

          {/* ==================== ADMIN ROUTES ==================== */}
          <Route path="/root" element={(user?.role === 'Admin' || user?.role === 'Exec') ? <RootDirectoryView /> : <Navigate to="/" />} />
          <Route path="/members" element={(user?.role === 'Admin' || user?.role === 'Exec') ? <MemberSpacePage /> : <Navigate to="/" />} />

          {/* Unified Settings Panel (统一系统设置) - Admin/Exec/Lead */}
          <Route path="/settings/*" element={
            ['Admin', 'Exec', 'Lead'].includes(user?.role || '')
              ? <AdminPanel />
              : <Navigate to="/" />
          } />

          {/* Legacy Admin Routes - Redirect to unified settings */}
          <Route path="/admin/*" element={<Navigate to="/settings" replace />} />
          <Route path="/service/admin/*" element={<Navigate to="/settings" replace />} />

          <Route path="/department-dashboard" element={(user?.role === 'Lead' || user?.role === 'Exec') ? <DepartmentDashboard /> : <Navigate to="/" />} />

          {/* ==================== BACKWARD COMPATIBILITY REDIRECTS ==================== */}
          {/* Old service routes → new service routes */}
          <Route path="/issues" element={<Navigate to="/service/issues" replace />} />
          <Route path="/issues/*" element={<Navigate to="/service/issues" replace />} />
          <Route path="/service-records" element={<Navigate to="/service/records" replace />} />
          <Route path="/service-records/*" element={<Navigate to="/service/records" replace />} />
          <Route path="/context" element={<Navigate to="/service/context" replace />} />

          {/* Old files routes → new files routes */}
          <Route path="/personal" element={<Navigate to="/files/personal" replace />} />
          <Route path="/personal/*" element={<Navigate to="/files/personal" replace />} />
          <Route path="/dept/:deptCode" element={<DeptRedirect />} />
          <Route path="/dept/:deptCode/*" element={<DeptRedirect />} />
          <Route path="/starred" element={<Navigate to="/files/starred" replace />} />
          <Route path="/shares" element={<Navigate to="/files/shares" replace />} />
          <Route path="/recycle-bin" element={<Navigate to="/files/recycle" replace />} />
          <Route path="/search" element={<Navigate to="/files/search" replace />} />
          <Route path="/recent" element={<Navigate to="/files/recent" replace />} />

          {/* Legacy routes */}
          <Route path="/files" element={<Navigate to="/" replace />} />
          <Route path="/recycle" element={<Navigate to="/files/recycle" replace />} />
          <Route path="/shared" element={<Navigate to="/files/shares" replace />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
      <Toast />
      <NotificationPopupManager />
      <ConfirmDialog />
    </Router>
  );
};

const DeptRedirect: React.FC = () => {
  const location = useLocation();
  const newPath = location.pathname.replace(/^\/dept\//, '/files/dept/');
  return <Navigate to={newPath} replace />;
};

const SIDEBAR_EXPANDED_KEY = 'longhorn_sidebar_expanded';
const SIDEBAR_WIDTH_KEY = 'longhorn_sidebar_width';

const Sidebar: React.FC<{
  user: any,
  viewingAs?: any,
  role: string,
  isOpen: boolean,
  onClose: () => void,
  currentModule: ModuleType
}> = ({ user, viewingAs, role, isOpen, onClose, currentModule }) => {
  const location = useLocation();

  // Hide sidebar completely in Settings module (AdminPanel has its own sidebar)
  if (location.pathname.startsWith('/settings')) {
    return null;
  }
  const [searchParams] = useSearchParams();
  const { token } = useAuthStore();
  const [accessibleDepts, setAccessibleDepts] = React.useState<any[]>([]);
  const { t } = useLanguage();
  const { triggerWorkspaceClear } = useUIStore();

  // 处理工作区菜单点击：触发清除选中工单并返回列表视图
  const handleWorkspaceMenuClick = () => {
    triggerWorkspaceClear();
    onClose();
  };

  // Sidebar resize
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? Math.max(160, Math.min(400, parseInt(saved))) : 220;
  });
  const sidebarResizingRef = React.useRef<{ startX: number; startWidth: number } | null>(null);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', sidebarWidth + 'px');
  }, [sidebarWidth]);

  const startSidebarResize = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizingRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    const onMouseMove = (me: MouseEvent) => {
      if (!sidebarResizingRef.current) return;
      const delta = me.clientX - sidebarResizingRef.current.startX;
      const newWidth = Math.max(160, Math.min(400, sidebarResizingRef.current.startWidth + delta));
      setSidebarWidth(newWidth);
      document.documentElement.style.setProperty('--sidebar-width', newWidth + 'px');
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(newWidth));
    };
    const onMouseUp = () => {
      sidebarResizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  // Collapsible section state
  const [expandedSections, setExpandedSections] = React.useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
      return saved ? JSON.parse(saved) : { workspace: true, operations: true, archives: true };
    } catch {
      return { workspace: true, operations: true, archives: true };
    }
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const currentState = prev[sectionId] !== false; // If undefined or true, it's currently expanded
      const next = { ...prev, [sectionId]: !currentState };
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(next));
      return next;
    });
  };
  const { saveRoute, getRoute } = useRouteMemoryStore();

  // Save route on change
  React.useEffect(() => {
    saveRoute(location.pathname + location.search);
  }, [location.pathname, location.search, saveRoute]);

  const [workspaceCounts, setWorkspaceCounts] = React.useState<any>({ my_tasks: 0, mentioned: 0, team_queue: 0 });

  React.useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await axios.get('/api/v1/tickets/workspace/counts', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data.success) {
          setWorkspaceCounts(res.data.data);
        }
      } catch (err) {
        console.error('[Sidebar] Failed to fetch workspace counts:', err);
      }
    };
    if (token && currentModule === 'service') {
      fetchCounts();
      // Polling every 60s
      const timer = setInterval(fetchCounts, 60000);
      return () => clearInterval(timer);
    }
  }, [token, currentModule]);

  React.useEffect(() => {
    const fetchDepts = async () => {
      try {
        console.log('[Sidebar] Fetching departments with token:', token?.substring(0, 20) + '...');
        const res = await axios.get(`/api/user/accessible-departments?_t=${Date.now()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('[Sidebar] Received departments:', res.data);
        setAccessibleDepts(res.data);
      } catch (err) {
        console.error('[Sidebar] Failed to fetch departments:', err);
      }
    };
    if (token) {
      fetchDepts();
    }
  }, [token]);

  // Dept Icons Map (key is the dept CODE)
  const deptIcons: { [key: string]: any } = {
    'MS': Camera,
    'OP': Film,
    'RD': Code,
    'RE': Box
  };

  // Helper to extract dept code safely
  const getDeptCode = (name: string): string => {
    // 1. Try to extract code from parentheses, e.g., "Market (MS)" -> "MS"
    const match = name.match(/\(([A-Z]+)\)/);
    // ... existing helper logic ...
    if (match) return match[1];

    // 2. If name itself is short uppercase (like "MS"), use it
    if (/^[A-Z]{2,3}$/.test(name)) return name;

    // 3. Fallback map for known Chinese names (Legacy support)
    const legacyMap: { [key: string]: string } = {
      '市场部': 'MS', '运营部': 'OP', '研发部': 'RD', '通用台面': 'RE'
    };
    // Check if name contains these keywords
    for (const key in legacyMap) {
      if (name.includes(key)) return legacyMap[key];
    }

    // 4. Ultimate fallback: use the name itself (URL encoded later naturally)
    return name;
  };

  // P2: Data visibility logic for navigation
  const actingRole = viewingAs?.role || role;
  const actingDeptCode = viewingAs?.department_code || user.department_code;

  // CRM/Full Archive Access: Admin, Exec OR internal staff from MS/GE departments
  const hasCrmAccess = actingRole === 'Admin' || actingRole === 'Exec' ||
    (actingRole === 'Lead' && actingDeptCode === 'MS') ||
    (actingRole === 'Member' && (actingDeptCode === 'MS' || actingDeptCode === 'GE'));

  // 产品台账访问权限：仅 MS, OP, GE 部门和 Exec 可见
  const hasProductLedgerAccess = actingRole === 'Exec' ||
    actingDeptCode === 'MS' || actingDeptCode === 'OP' || actingDeptCode === 'GE';

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} `} style={{ width: sidebarWidth, flexShrink: 0, position: 'relative' }}>
      <div className="sidebar-brand">
        <h2 className="sidebar-title">{t('app.name')}</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {currentModule === 'files' ? 'Kinefinity 文件小角' : 'Kinefinity Service Hub'}
        </p>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {currentModule === 'service' && (
          <>
            {/* WORKSPACE section - collapsible */}
            <div className="sidebar-section-title" onClick={() => toggleSection('workspace')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('sidebar.section_workspace')}</span>
              {expandedSections.workspace !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {expandedSections.workspace !== false && (
              <>
                {/* Overview - Lead/Admin Only */}
                {(role === 'Admin' || role === 'Exec' || role === 'Lead') && (
                  <Link to={getRoute('/service/overview')} className={`sidebar-item ${location.pathname === '/service/overview' ? 'active' : ''}`} onClick={onClose}>
                    <LayoutDashboard size={18} />
                    <span>{t('sidebar.overview')}</span>
                  </Link>
                )}
                {/* 侧边栏选中态逻辑：支持路径匹配 + URL参数 ctx 匹配 */}
                <Link
                  to={getRoute('/service/workspace')}
                  className={`sidebar-item ${location.pathname === '/service/workspace' || (location.pathname.startsWith('/service/tickets/') && searchParams.get('ctx') === 'my_tasks') ? 'active' : ''}`}
                  onClick={handleWorkspaceMenuClick}
                >
                  <CheckSquare size={18} />
                  <span>{t('sidebar.my_tasks')}</span>
                  {workspaceCounts.my_tasks > 0 && <span className="sidebar-badge">{workspaceCounts.my_tasks}</span>}
                </Link>
                <Link
                  to={getRoute('/service/mentioned')}
                  className={`sidebar-item ${location.pathname === '/service/mentioned' || (location.pathname.startsWith('/service/tickets/') && searchParams.get('ctx') === 'mentioned') ? 'active' : ''}`}
                  onClick={handleWorkspaceMenuClick}
                >
                  <Bell size={18} />
                  <span>{t('sidebar.mentioned')}</span>
                  {workspaceCounts.mentioned > 0 && <span className="sidebar-badge badge-blue">{workspaceCounts.mentioned}</span>}
                </Link>
                <Link
                  to={getRoute('/service/team-hub')}
                  className={`sidebar-item ${location.pathname === '/service/team-hub' || (location.pathname.startsWith('/service/tickets/') && searchParams.get('ctx') === 'team_queue') ? 'active' : ''}`}
                  onClick={handleWorkspaceMenuClick}
                >
                  <Users size={18} />
                  <span>{t('sidebar.team_hub', { defaultValue: '部门工单' })}</span>
                  {workspaceCounts.team_hub_total !== undefined && (
                    <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                      <span className="sidebar-badge badge-gold" title="所有工单">{workspaceCounts.team_hub_total}</span>
                      {workspaceCounts.team_hub_unclaimed > 0 && <span className="sidebar-badge" title="待认领">{workspaceCounts.team_hub_unclaimed}</span>}
                    </div>
                  )}
                </Link>
              </>
            )}

            {/* 知识中心 - with divider lines */}
            <div style={{ borderTop: '1px solid var(--text-secondary)', opacity: 0.3, margin: '8px 12px' }} />
            <Link
              to="/tech-hub/wiki?line=A"
              className={`sidebar-item ${location.pathname.startsWith('/tech-hub/wiki') ? 'active' : ''}`}
              onClick={() => {
                localStorage.removeItem('wiki-last-article');
                onClose();
              }}
            >
              <Book size={18} />
              <span>{t('sidebar.tech_hub')}</span>
            </Link>
            <div style={{ borderTop: '1px solid var(--text-secondary)', opacity: 0.3, margin: '8px 12px' }} />

            {/* OPERATIONS section (统计和所有工单) - collapsible, after Tech Hub */}
            <div className="sidebar-section-title" onClick={() => toggleSection('operations')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{t('sidebar.section_operations')}</span>
              {expandedSections.operations !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
            {expandedSections.operations !== false && (
              <>
                {/* Inquiry visible to Global access users (MS, etc) */}
                {hasCrmAccess && (
                  <Link
                    to={getRoute('/service/inquiry-tickets')}
                    className={`sidebar-item ${location.pathname.startsWith('/service/inquiry-tickets') || (location.pathname.startsWith('/service/tickets/') && (searchParams.get('ctx') === 'search-inquiry' || searchParams.get('ctx') === 'search' || !searchParams.get('ctx'))) ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <MessageCircleQuestion size={18} />
                    <span>{t('sidebar.inquiry_tickets')}</span>
                  </Link>
                )}
                <Link
                  to={getRoute('/service/rma-tickets')}
                  className={`sidebar-item ${location.pathname.startsWith('/service/rma-tickets') || (location.pathname.startsWith('/service/tickets/') && (searchParams.get('ctx') === 'search-rma' || searchParams.get('ctx') === 'search')) ? 'active' : ''}`}
                  onClick={onClose}
                >
                  <ClipboardList size={18} />
                  <span>{t('sidebar.rma_tickets')}</span>
                </Link>
                {/* SVC visible to Global access users (MS, etc) */}
                {hasCrmAccess && (
                  <Link
                    to={getRoute('/service/dealer-repairs')}
                    className={`sidebar-item ${location.pathname.startsWith('/service/dealer-repairs') || (location.pathname.startsWith('/service/tickets/') && (searchParams.get('ctx') === 'search-svc' || searchParams.get('ctx') === 'search')) ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Wrench size={18} />
                    <span>{t('sidebar.dealer_repairs')}</span>
                  </Link>
                )}
              </>
            )}

            {/* 客户和经销商分组 - collapsible, Role-based visibility (OP/RD 隐藏) */}
            {hasCrmAccess && (
              <>
                <div className="sidebar-section-title" onClick={() => toggleSection('customers_dealers')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t('sidebar.section_customers_dealers')}</span>
                  {expandedSections.customers_dealers !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                {expandedSections.customers_dealers !== false && (
                  <>
                    <Link to={getRoute('/service/dealers')} className={`sidebar-item ${location.pathname.startsWith('/service/dealers') ? 'active' : ''}`} onClick={onClose}>
                      <Building size={18} />
                      <span>{t('sidebar.archives_dealers')}</span>
                    </Link>
                    <Link to={getRoute('/service/customers')} className={`sidebar-item ${location.pathname.startsWith('/service/customers') ? 'active' : ''}`} onClick={onClose}>
                      <Users size={18} />
                      <span>{t('sidebar.archives_customers')}</span>
                    </Link>
                    <Link to={getRoute('/service/dealer-operations')} className={`sidebar-item ${location.pathname.startsWith('/service/dealer-operations') ? 'active' : ''}`} onClick={onClose}>
                      <Package size={18} />
                      <span>{t('sidebar.dealer_operations')}</span>
                    </Link>
                  </>
                )}
              </>
            )}

            {/* 产品和配件分组 - 仅 MS, OP, GE 和 Exec 可见 */}
            {hasProductLedgerAccess && (
              <>
                <div className="sidebar-section-title" onClick={() => toggleSection('products_parts')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t('sidebar.section_products_parts')}</span>
                  {expandedSections.products_parts !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                {expandedSections.products_parts !== false && (
                  <>
                    <Link to={getRoute('/service/product-models')} className={`sidebar-item ${location.pathname.startsWith('/service/product-models') ? 'active' : ''}`} onClick={onClose}>
                      <Layers size={18} />
                      <span>{t('sidebar.product_catalog')}</span>
                    </Link>
                    <Link to={getRoute('/service/product-skus')} className={`sidebar-item ${location.pathname.startsWith('/service/product-skus') ? 'active' : ''}`} onClick={onClose}>
                      <Package size={18} />
                      <span>{t('sidebar.product_skus')}</span>
                    </Link>
                    <Link to={getRoute('/service/products')} className={`sidebar-item ${location.pathname.startsWith('/service/products') ? 'active' : ''}`} onClick={onClose}>
                      <Box size={18} />
                      <span>{t('sidebar.archives_assets')}</span>
                    </Link>
                    <Link to={getRoute('/service/parts')} className={`sidebar-item ${location.pathname.startsWith('/service/parts') ? 'active' : ''}`} onClick={onClose}>
                      <Package size={18} />
                      <span>{t('sidebar.parts')}</span>
                    </Link>
                  </>
                )}
              </>
            )}

            {/* System Settings - removed, now in AppRail */}
          </>
        )}

        {currentModule === 'files' && (
          <>
            <Link to="/files/starred" className={`sidebar-item ${location.pathname === '/files/starred' ? 'active' : ''} `} onClick={onClose}>
              <Star size={18} />
              <span>{t('sidebar.favorites')}</span>
            </Link>
            <Link to="/files/shares" className={`sidebar-item ${location.pathname === '/files/shares' ? 'active' : ''} `} onClick={onClose}>
              <Share2 size={18} />
              <span>{t('share.my_shares')}</span>
            </Link>

            <div style={{ height: '1px', background: 'var(--glass-bg-hover)', margin: '12px 16px' }} />

            <Link to="/files/personal" className={`sidebar-item ${location.pathname.startsWith('/files/personal') ? 'active' : ''} `} onClick={onClose}>
              <User size={18} />
              <span>{t('sidebar.personal')}</span>
            </Link>

            <div style={{ height: '1px', background: 'var(--glass-bg-hover)', margin: '12px 16px' }} />

            {Array.from(new Map(accessibleDepts.map(d => [getDeptCode(d.name), d])).values()).map((dept: any) => {
              const code = getDeptCode(dept.name);
              const Icon = deptIcons[code] || Box;

              const transKey = `dept.${code}`;
              const translated = t(transKey as any);
              const displayName = translated !== transKey ? `${translated} (${code})` : dept.name;

              const isActive = location.pathname.startsWith(`/files/dept/${code}`) || location.pathname.includes(encodeURIComponent(code));
              return (
                <Link key={dept.name} to={`/files/dept/${code}`} className={`sidebar-item ${isActive ? 'active' : ''} `} onClick={onClose}>
                  <Icon size={20} />
                  <span>{displayName}</span>
                </Link>
              );
            })}

            <div style={{ marginTop: 'auto' }} />
            <div style={{ height: '1px', background: 'var(--glass-bg-hover)', margin: '12px 16px' }} />

            <Link to="/files/recycle" className={`sidebar-item ${location.pathname === '/files/recycle' ? 'active' : ''} `} onClick={onClose}>
              <Trash2 size={20} />
              <span>{t('browser.recycle')}</span>
            </Link>

            {/* Files Admin - Admin/Exec: Root directory access */}
            {(role === 'Admin' || role === 'Exec') && (
              <>
                <div style={{ height: '1px', background: 'var(--glass-bg-hover)', margin: '12px 16px' }} />
                <Link to="/root" className={`sidebar-item ${location.pathname === '/root' ? 'active' : ''} `} onClick={onClose}>
                  <LayoutDashboard size={20} />
                  <span>{t('sidebar.root_dir', { defaultValue: '根目录' })}</span>
                </Link>
              </>
            )}

            {/* Lead: Department Dashboard - Removed to hide dept management from files sidebar */}
          </>
        )}
      </nav>

      {/* Sidebar Resize Handle */}
      <div
        onMouseDown={startSidebarResize}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
          cursor: 'col-resize', zIndex: 10, background: 'transparent',
          transition: 'background 0.15s'
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-blue-transparent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />
    </aside>
  );
};

// User Stats Card Component
const UserStatsCard: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { token } = useAuthStore();
  const { t } = useLanguage();
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('/api/user/stats', {
          headers: { Authorization: `Bearer ${token} ` }
        });
        setStats(res.data);
      } catch (err) {
        console.error('Failed to fetch user stats:', err);
        // Set default stats on error
        setStats({ uploadCount: 0, storageUsed: 0, starredCount: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Always render, show loading state if needed
  const displayStats = stats || { uploadCount: '-', storageUsed: 0, shareCount: '-' };

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        padding: '10px 16px',
        background: 'var(--glass-bg-hover)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        opacity: loading ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.1)';
        e.currentTarget.style.borderColor = 'var(--accent-blue)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--glass-bg-hover)';
        e.currentTarget.style.borderColor = 'var(--glass-bg-hover)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('browser.stats_files')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{displayStats.uploadCount}</div>
      </div>
      <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('browser.stats_storage')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatBytes(displayStats.storageUsed)}</div>
      </div>
      <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('browser.stats_shares')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{displayStats.shareCount || 0}</div>
      </div>
    </div>
  );
};



// TopBar Component



const ServiceTopBarStats: React.FC = () => {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentStatus = searchParams.get('status') || 'all';

  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Get saved filters from store
  const { inquiryFilters, rmaFilters, dealerFilters } = useListStateStore();

  // Determine context
  const context = React.useMemo(() => {
    if (location.pathname.startsWith('/service/inquiry-tickets')) return 'inquiry';
    if (location.pathname.startsWith('/service/rma-tickets')) return 'rma';
    if (location.pathname.startsWith('/service/dealer-repairs')) return 'dealer';
    return null;
  }, [location.pathname]);

  // Check if on detail page (e.g., /service/rma-tickets/123)
  const isDetailPage = React.useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    return pathSegments.length >= 3 && !isNaN(Number(pathSegments[pathSegments.length - 1]));
  }, [location.pathname]);

  // Get filter params for stats query
  // On detail page: use saved filters from store
  // On list page: use URL params
  const { timeScope, productFamily, keyword } = React.useMemo(() => {
    if (isDetailPage) {
      // Use saved filters from store based on context
      const savedFilters = context === 'inquiry' ? inquiryFilters
        : context === 'rma' ? rmaFilters
          : context === 'dealer' ? dealerFilters
            : { time_scope: '7d', product_family: 'all', keyword: '' };
      return {
        timeScope: savedFilters.time_scope,
        productFamily: savedFilters.product_family,
        keyword: savedFilters.keyword
      };
    } else {
      // Use URL params
      return {
        timeScope: searchParams.get('time_scope') || '30d',
        productFamily: searchParams.get('product_family') || 'all',
        keyword: searchParams.get('keyword') || ''
      };
    }
  }, [isDetailPage, context, searchParams, inquiryFilters, rmaFilters, dealerFilters]);

  // Fetch stats based on context and filters
  React.useEffect(() => {
    if (!context) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        // P2: Use unified tickets API with ticket_type filter
        const endpoint = '/api/v1/tickets/stats/summary';

        // Build query params with filters
        const params = new URLSearchParams();
        // P2: Add ticket_type filter for unified API
        if (context === 'inquiry') params.set('ticket_type', 'inquiry');
        else if (context === 'rma') params.set('ticket_type', 'rma');
        else if (context === 'dealer') params.set('ticket_type', 'svc');

        if (timeScope && timeScope !== 'all') params.set('time_scope', timeScope);
        if (productFamily && productFamily !== 'all') params.set('product_family', productFamily);
        if (keyword) params.set('keyword', keyword);

        const queryString = params.toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;

        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token} ` } });
        setStats(res.data?.data || {});
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [context, token, timeScope, productFamily, keyword]);

  if (!context) return null;

  const displayStats = stats || { total: '-', by_status: {} };

  const handleFilter = (status: string) => {
    const newParams = new URLSearchParams(searchParams);

    // Update status
    if (status === 'all') {
      newParams.delete('status');
    } else {
      newParams.set('status', status);
    }

    // Reset page to 1 when changing filters
    newParams.set('page', '1');

    // Check if currently on a detail page (e.g., /service/rma-tickets/123)
    // If so, navigate to the list page instead of staying on detail page
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const isDetailPage = pathSegments.length >= 3 && !isNaN(Number(pathSegments[pathSegments.length - 1]));

    let targetPathname = location.pathname;
    if (isDetailPage) {
      // Navigate to list page
      if (context === 'inquiry') targetPathname = '/service/inquiry-tickets';
      else if (context === 'rma') targetPathname = '/service/rma-tickets';
      else if (context === 'dealer') targetPathname = '/service/dealer-repairs';
    }

    navigate({
      pathname: targetPathname,
      search: `?${newParams.toString()}`
    });
  };

  const renderStatItem = (key: string, label: string, color: string, countKey?: string) => {
    // Correctly extract count based on context
    let rawCount;

    if (key === 'all') {
      rawCount = displayStats.total;
    } else {
      // For RMA, we might use a special countKey if provided
      const effectiveKey = (context === 'rma' && countKey) ? countKey : key;
      rawCount = displayStats.by_status?.[effectiveKey];
    }

    // Default to 0 if valid stats object exists but key is missing/undefined
    // Default to '-' if stats are still loading (null)
    const count = (stats && rawCount !== undefined) ? rawCount : (stats ? 0 : '-');
    const isActive = currentStatus === key;

    return (
      <div
        key={key}
        onClick={() => handleFilter(key)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '6px',
          background: isActive ? 'var(--glass-bg-hover)' : 'transparent',
          border: isActive ? `1px solid ${color}` : '1px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ fontSize: '0.8rem', color: isActive ? 'var(--text-main)' : 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color }}>{count}</div>
      </div>
    );
  };

  const divider = <div style={{ width: '1px', height: '16px', background: 'var(--glass-bg-hover)' }} />;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 12px',
        background: 'var(--glass-bg-hover)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        opacity: loading ? 0.7 : 1
      }}
    >
      {/* Status colors using CSS variables for theme compatibility */}
      {context === 'inquiry' && (
        <>
          {renderStatItem('all', '全部', 'var(--text-tertiary)')}
          {divider}
          {renderStatItem('Pending', '待处理', 'var(--status-red)')}      {/* Red */}
          {divider}
          {renderStatItem('InProgress', '处理中', 'var(--status-blue)')}   {/* Blue */}
          {divider}
          {renderStatItem('AwaitingFeedback', '待反馈', 'var(--status-purple)')} {/* Purple */}
          {divider}
          {renderStatItem('Resolved', '已解决', 'var(--status-green)')}     {/* Green */}
          {divider}
          {renderStatItem('AutoClosed', '已关闭', 'var(--text-secondary)')}   {/* Gray */}
          {divider}
          {renderStatItem('Upgraded', '已升级', 'var(--status-cyan)')}     {/* Cyan */}
        </>
      )}

      {context === 'rma' && (
        <>
          {renderStatItem('all', '全部', 'var(--text-tertiary)')}
          {divider}
          {renderStatItem('Pending', '已收货', 'var(--accent-blue)')}      {/* Kine Yellow */}
          {divider}
          {renderStatItem('Confirming', '确认中', 'var(--status-amber)')}   {/* Amber */}
          {divider}
          {renderStatItem('Diagnosing', '检测中', 'var(--status-purple)')}   {/* Purple */}
          {divider}
          {renderStatItem('InRepair', '维修中', 'var(--status-blue)')}     {/* Blue */}
          {divider}
          {renderStatItem('Completed', '已完成', 'var(--status-green)')}    {/* Kine Green */}
        </>
      )}

      {context === 'dealer' && (
        <>
          {renderStatItem('all', '全部', 'var(--text-tertiary)')}
          {divider}
          {renderStatItem('Received', '已收货', 'var(--accent-blue)')}     {/* Kine Yellow */}
          {divider}
          {renderStatItem('Confirming', '确认中', 'var(--status-amber)')}   {/* Amber */}
          {divider}
          {renderStatItem('Diagnosing', '检测中', 'var(--status-purple)')}   {/* Purple */}
          {divider}
          {renderStatItem('InRepair', '维修中', 'var(--status-blue)')}     {/* Blue */}
          {divider}
          {renderStatItem('Completed', '已完成', 'var(--status-green)')}    {/* Kine Green */}
        </>
      )}
    </div>
  );
};


const TopBar: React.FC<{
  user: any,
  onMenuClick: () => void,
  currentModule: ModuleType
}> = ({ user, onMenuClick, currentModule }) => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { language: currentLanguage, setLanguage, t } = useLanguage();
  const { viewingAs } = useViewAs();

  // Fetch server version on mount
  React.useEffect(() => {
    axios.get('/api/status')
      .then(res => setServerVersion(res.data?.version || null))
      .catch(() => setServerVersion(null));
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation();
    logout();
  };

  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button className="menu-toggle" onClick={onMenuClick}>
          <Menu size={24} />
        </button>

        {/* TOPBAR CONTEXT LABEL: 居左显示场景标签 */}
        {(() => {
          const { contextLabel } = useUIStore();
          if (!contextLabel) return null;
          return (
            <div
              className="fade-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 12px',
                fontSize: 13,
                fontWeight: 700,
                color: contextLabel.color,
                marginLeft: 12,
                height: 24,
                whiteSpace: 'nowrap'
              }}
            >
              {contextLabel.pulsing && (
                <span style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: contextLabel.color,
                  boxShadow: `0 0 8px ${contextLabel.color}`,
                  animation: 'pulse 1.5s infinite'
                }} />
              )}
              {contextLabel.text}
            </div>
          );
        })()}

        {/* Stats card only visible in FILES module */}
        {currentModule === 'files' && (
          <div className="hidden-mobile">
            <UserStatsCard onClick={() => navigate('/dashboard')} />
          </div>
        )}

        {/* SERVICE MODULE: Stats Only (Nav is in Sidebar) */}
        {currentModule === 'service' &&
          !location.pathname.startsWith('/service/inquiry-tickets') &&
          !location.pathname.startsWith('/service/rma-tickets') &&
          !location.pathname.startsWith('/service/dealer-repairs') && (
            <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center' }}>
              <ServiceTopBarStats />
            </div>
          )}

      </div>

      {/* Center: Daily Word - DailyWordBadge handles its own visibility via localStorage */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {(currentModule === 'files' || currentModule === 'service') && <DailyWordBadge />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Global Create Ticket Action: Only visible to MS/Admin */}
        {(() => {
          const userDept = (user?.department_code || user?.department_name || '').toUpperCase();
          const isAdmin = user?.role === 'Admin' || user?.role === 'Exec';
          const isMS = userDept === 'MS' || userDept === '市场部';
          const canCreateTicket = isAdmin || isMS;

          if (currentModule === 'service' && canCreateTicket) {
            return (
              <button
                onClick={() => useTicketStore.getState().openModal('Inquiry')}
                title={t('action.create_ticket', { defaultValue: '新建工单' })}
                style={{
                  width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--glass-bg-light)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  marginLeft: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--glass-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--glass-bg-light)';
                }}
              >
                <Plus size={18} />
              </button>
            );
          }
          return null;
        })()}

        {/* Notification Bell - Service Module only */}
        {currentModule === 'service' && <NotificationBell />}

        {/* Search - only visible in FILES module (for now) */}
        {currentModule === 'files' && (
          <button
            onClick={() => navigate('/search')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--glass-bg-hover)';
              e.currentTarget.style.color = 'var(--accent-blue)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.7 }}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          </button>
        )}

        {/* User Profile - visible on all screen sizes */}
        <div
          ref={dropdownRef}
          onClick={() => setShowDropdown(!showDropdown)}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '6px 12px',
            borderRadius: '10px',
            transition: 'background 0.2s',
            position: 'relative',
            background: showDropdown ? 'var(--glass-bg-hover)' : 'transparent'
          }}
        >
          {/* Username/Role - hidden on mobile, flex-column on desktop */}
          <div className="hidden-mobile">
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{user.username}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {user.role === 'Admin' ? t('role.admin') : user.role === 'Exec' ? t('role.exec') : user.role === 'Lead' ? t('role.lead') : t('role.member')}
              </span>
            </div>
          </div>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'var(--accent-blue)',
            color: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            fontWeight: 800,
            boxShadow: 'var(--shadow-sm)'
          }}>
            {user?.username?.substring(0, 1).toUpperCase() || '?'}
          </div>

          {/* Version Display moved to Dropdown Menu */}


          {/* User Dropdown Menu */}
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              background: 'var(--modal-bg)',
              border: '1px solid var(--glass-border)',
              borderRadius: '12px',
              padding: '6px',
              minWidth: '180px',
              boxShadow: 'var(--glass-shadow-lg)',
              zIndex: 9999,
              backdropFilter: 'blur(20px)',
              overflow: 'hidden'
            }}>
              {/* Language Selector */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderBottom: '1px solid var(--glass-border)',
                marginBottom: '4px'
              }}>
                {['zh', 'en', 'de', 'ja'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setLanguage(lang as any);
                      setShowDropdown(false);
                    }}
                    style={{
                      background: currentLanguage === lang ? 'var(--accent-blue)' : 'var(--glass-bg-hover)',
                      color: currentLanguage === lang ? 'var(--bg-main)' : 'var(--text-secondary)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    {lang === 'zh' ? t('lang.zh_short') : lang === 'en' ? 'En' : lang === 'de' ? 'De' : 'Ja'}
                  </button>
                ))}
              </div>

              {/* Personal Space Entry */}
              <button
                onClick={() => {
                  navigate('/personal');
                  setShowDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <User size={16} />
                {t('sidebar.personal')}
              </button>

              {/* P2: View As - Admin Only or when already Viewing As */}
              {(user.role === 'Admin' || !!viewingAs) && (
                <button
                  onClick={() => {
                    useViewAsStore.getState().setSelectorOpen(true);
                    setShowDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Eye size={16} color="var(--accent-gold)" />
                  预览视角
                </button>
              )}

              {/* Dashboard Entry */}
              <button
                onClick={() => {
                  navigate('/dashboard');
                  setShowDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--glass-bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <LayoutDashboard size={16} />
                {t('sidebar.dashboard')}
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'var(--status-red)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--status-red-subtle)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={16} />
                {t('auth.logout')}
              </button>

              {/* Version Info - Moved from TopBar */}
              <div style={{
                padding: '10px 12px',
                borderTop: '1px solid var(--glass-border)',
                marginTop: '4px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <div style={{
                  color: 'var(--status-green)',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  background: 'var(--badge-success-bg)',
                  padding: '4px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  lineHeight: '1.3',
                  width: '100%'
                }}>
                  <div style={{ opacity: 0.9 }}>v{typeof __APP_FULL_VERSION__ !== 'undefined' ? __APP_FULL_VERSION__ : (window as any).__APP_FULL_VERSION__ || '11.3.1 (dev)'}</div>
                  {serverVersion && (
                    <div style={{ opacity: 0.6, fontSize: '0.7rem' }}>s{serverVersion}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const HomeRedirect: React.FC<{ user: any }> = ({ user }) => {
  const canAccessFiles = canAccessFilesModule(user?.role || '');

  // Admin goes to admin panel
  if (user?.role === 'Admin' || user?.role === 'Exec') {
    return <Navigate to="/admin" replace />;
  }

  // Dealers (cannot access files) go directly to service
  if (!canAccessFiles) {
    return <Navigate to="/service/records" replace />;
  }

  // Internal staff: default to service records
  return <Navigate to="/service/records" replace />;
};

export default App;
