
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
  Network,
  LayoutDashboard,
  ClipboardList,
  MessageCircleQuestion,
  Book,
  Settings,
  Users,
  Building,
  Wrench,
  Package
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
import { InquiryTicketListPage, InquiryTicketCreatePage, InquiryTicketDetailPage } from './components/InquiryTickets';
import { RMATicketListPage, RMATicketCreatePage, RMATicketDetailPage } from './components/RMATickets';
import { DealerRepairListPage, DealerRepairCreatePage, DealerRepairDetailPage } from './components/DealerRepairs';
import { DealerInventoryListPage, RestockOrderListPage, RestockOrderDetailPage, RestockOrderCreatePage } from './components/DealerInventory';
import CustomerManagement from './components/CustomerManagement';
import DealerManagement from './components/DealerManagement';
import ProductManagement from './components/ProductManagement';
import CustomerDetailPage from './components/CustomerDetailPage';

import KnowledgeAuditLog from './components/KnowledgeAuditLog';
import { KinefinityWiki } from './components/KinefinityWiki';
import AppRail from './components/AppRail';
// ... imports
import TicketCreationModal from './components/Service/TicketCreationModal';
import BokehContainer from './components/Bokeh/BokehContainer';



import TicketAiWizard from './components/TicketAiWizard';
import { useNavigationState, canAccessFilesModule } from './hooks/useNavigationState';
import type { ModuleType } from './hooks/useNavigationState';

import ShareCollectionPage from './components/ShareCollectionPage';
import Toast from './components/Toast';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useRouteMemoryStore } from './store/useRouteMemoryStore';
import { useListStateStore } from './store/useListStateStore';

// Main Layout Component for authenticated users
// Main Layout Component for authenticated users
const MainLayout: React.FC<{ user: any }> = ({ user }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { currentModule, switchModule } = useNavigationState();
  const canAccessFiles = canAccessFilesModule(user.role);

  return (
    <div className="app-container fade-in" style={{ display: 'flex', flexDirection: 'row', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* App Rail - Always visible on Desktop */}
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
        role={user.role}
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentModule={currentModule}
      />

      <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopBar user={user} onMenuClick={() => setSidebarOpen(true)} currentModule={currentModule} />

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
          {/* Inquiry Tickets (咨询工单) - Layer 1 */}
          <Route path="/service/inquiry-tickets" element={<InquiryTicketListPage />} />
          <Route path="/service/inquiry-tickets/new" element={<InquiryTicketCreatePage />} />
          <Route path="/service/inquiry-tickets/:id" element={<InquiryTicketDetailPage />} />
          <Route path="/inquiry-tickets" element={<Navigate to="/service/inquiry-tickets" replace />} />
          <Route path="/inquiry-tickets/*" element={<Navigate to="/service/inquiry-tickets" replace />} />

          {/* AI Ticket Wizard */}
          <Route path="/service/ticket-wizard" element={<TicketAiWizard />} />

          {/* RMA Tickets (RMA返厂单) - Layer 2 */}
          <Route path="/service/rma-tickets" element={<RMATicketListPage />} />
          <Route path="/service/rma-tickets/new" element={<RMATicketCreatePage />} />
          <Route path="/service/rma-tickets/:id" element={<RMATicketDetailPage />} />
          <Route path="/rma-tickets" element={<Navigate to="/service/rma-tickets" replace />} />
          <Route path="/rma-tickets/*" element={<Navigate to="/service/rma-tickets" replace />} />

          {/* Dealer Repairs (经销商维修单) - Layer 3 */}
          <Route path="/service/dealer-repairs" element={<DealerRepairListPage />} />
          <Route path="/service/dealer-repairs/new" element={<DealerRepairCreatePage />} />
          <Route path="/service/dealer-repairs/:id" element={<DealerRepairDetailPage />} />
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
          <Route path="/service/products" element={
            ['Admin', 'Lead'].includes(user?.role || '') ? <ProductManagement /> : <Navigate to="/" />
          } />
          <Route path="/service/assets" element={<Navigate to="/service/products" replace />} />

          {/* Knowledge Audit Log - Internal Staff Only (Admin) */}
          <Route path="/service/knowledge/audit" element={
            user?.role === 'Admin' ? <KnowledgeAuditLog /> : <Navigate to="/" />
          } />
          <Route path="/tech-hub/wiki" element={<KinefinityWiki />} />
          <Route path="/tech-hub/wiki/:slug" element={<KinefinityWiki />} />

          {/* Parts Management (placeholder) */}
          <Route path="/service/parts" element={<InquiryTicketListPage />} />

          {/* Dealer Inventory Management */}
          <Route path="/service/inventory" element={<DealerInventoryListPage />} />
          <Route path="/service/inventory/restock" element={<RestockOrderListPage />} />
          <Route path="/service/inventory/restock/new" element={<RestockOrderCreatePage />} />
          <Route path="/service/inventory/restock/:id" element={<RestockOrderDetailPage />} />

          {/* Service Admin Settings */}
          <Route path="/service/admin/*" element={user?.role === 'Admin' ? <AdminPanel moduleType="service" /> : <Navigate to="/" />} />

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
          <Route path="/root" element={user?.role === 'Admin' ? <RootDirectoryView /> : <Navigate to="/" />} />
          <Route path="/members" element={user?.role === 'Admin' ? <MemberSpacePage /> : <Navigate to="/" />} />
          {/* Files Admin - Using /admin/* */}
          <Route path="/admin/*" element={user?.role === 'Admin' ? <AdminPanel moduleType="files" /> : <Navigate to="/" />} />
          <Route path="/department-dashboard" element={user?.role === 'Lead' ? <DepartmentDashboard /> : <Navigate to="/" />} />

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
      <ConfirmDialog />
    </Router>
  );
};

const DeptRedirect: React.FC = () => {
  const location = useLocation();
  const newPath = location.pathname.replace(/^\/dept\//, '/files/dept/');
  return <Navigate to={newPath} replace />;
};

const Sidebar: React.FC<{ role: string, isOpen: boolean, onClose: () => void, currentModule: ModuleType }> = ({ role, isOpen, onClose, currentModule }) => {
  const location = useLocation();
  const { token } = useAuthStore();
  const [accessibleDepts, setAccessibleDepts] = React.useState<any[]>([]);
  const { t } = useLanguage();
  const { saveRoute, getRoute } = useRouteMemoryStore();

  // Save route on change
  React.useEffect(() => {
    saveRoute(location.pathname + location.search);
  }, [location.pathname, location.search, saveRoute]);

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

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} `}>
      <div className="sidebar-brand">
        <h2 className="sidebar-title">{t('app.name')}</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          {currentModule === 'files' ? 'Kinefinity 文件小角' : 'Kinefinity Service Hub'}
        </p>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {currentModule === 'service' && (
          <>
            <Link to={getRoute('/service/inquiry-tickets')} className={`sidebar-item ${location.pathname.startsWith('/service/inquiry-tickets') ? 'active' : ''} `} onClick={onClose}>
              <MessageCircleQuestion size={18} />
              <span>{t('sidebar.inquiry_tickets')}</span>
            </Link>
            <Link to={getRoute('/service/rma-tickets')} className={`sidebar-item ${location.pathname.startsWith('/service/rma-tickets') ? 'active' : ''} `} onClick={onClose}>
              <ClipboardList size={18} />
              <span>{t('sidebar.rma_tickets')}</span>
            </Link>
            <Link to={getRoute('/service/dealer-repairs')} className={`sidebar-item ${location.pathname.startsWith('/service/dealer-repairs') ? 'active' : ''} `} onClick={onClose}>
              <Wrench size={18} />
              <span>{t('sidebar.dealer_repairs')}</span>
            </Link>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 16px' }} />

            {/* 档案和基础信息 (Archives) - 三级入口结构 */}
            <div style={{ padding: '0 24px 8px', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>
              档案和基础信息
            </div>

            {/* 1. 渠道和经销商 (第一入口) */}
            <Link to={getRoute('/service/dealers')} className={`sidebar-item ${location.pathname.startsWith('/service/dealers') ? 'active' : ''} `} onClick={onClose}>
              <Building size={18} />
              <span>{t('sidebar.archives_dealers') || '渠道和经销商'}</span>
            </Link>

            {/* 2. 客户档案 (第二入口) */}
            <Link to={getRoute('/service/customers')} className={`sidebar-item ${location.pathname.startsWith('/service/customers') ? 'active' : ''} `} onClick={onClose}>
              <Users size={18} />
              <span>{t('sidebar.archives_customers') || '客户档案'}</span>
            </Link>

            {/* 3. 产品管理 (第三入口) */}
            <Link to={getRoute('/service/products')} className={`sidebar-item ${location.pathname.startsWith('/service/products') ? 'active' : ''} `} onClick={onClose}>
              <Box size={18} />
              <span>{t('sidebar.archives_assets') || '产品管理'}</span>
            </Link>

            {/* 4. 配件库存 (第四入口) - 经销商可见 */}
            <Link to={getRoute('/service/inventory')} className={`sidebar-item ${location.pathname.startsWith('/service/inventory') ? 'active' : ''} `} onClick={onClose}>
              <Package size={18} />
              <span>{t('sidebar.parts_inventory') || '配件库存'}</span>
            </Link>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 16px' }} />

            {/* Kinefinity WIKI - All Users */}
            <Link
              to="/tech-hub/wiki?line=A"
              className={`sidebar-item ${location.pathname.startsWith('/tech-hub/wiki') ? 'active' : ''} `}
              onClick={() => {
                // Clear wiki state to ensure navigating to homepage
                localStorage.removeItem('wiki-last-article');
                onClose();
              }}
            >
              <Book size={18} />
              <span>Kinefinity WIKI</span>
            </Link>

            {role === 'Admin' && (
              <>
                <div style={{ marginTop: 'auto' }} />
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 16px' }} />
                <Link to="/service/admin" className={`sidebar-item ${location.pathname.startsWith('/service/admin') ? 'active' : ''} `} onClick={onClose}>
                  <Settings size={18} />
                  <span>{t('sidebar.service_admin')}</span>
                </Link>
              </>
            )}
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

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 16px' }} />

            <Link to="/files/personal" className={`sidebar-item ${location.pathname.startsWith('/files/personal') ? 'active' : ''} `} onClick={onClose}>
              <User size={18} />
              <span>{t('sidebar.personal')}</span>
            </Link>

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 16px' }} />

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
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 16px' }} />

            <Link to="/files/recycle" className={`sidebar-item ${location.pathname === '/files/recycle' ? 'active' : ''} `} onClick={onClose}>
              <Trash2 size={20} />
              <span>{t('browser.recycle')}</span>
            </Link>

            {role === 'Admin' && (
              <>
                <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 16px' }} />
                <Link to="/admin" className={`sidebar-item ${location.pathname.startsWith('/admin') && !location.pathname.includes('settings') ? 'active' : ''} `} onClick={onClose}>
                  <LayoutDashboard size={20} />
                  <span>{t('sidebar.files_admin')}</span>
                </Link>
              </>
            )}
          </>
        )}

        {role === 'Lead' && (
          <>
            <div style={{ marginTop: currentModule === 'service' ? 'auto' : '0' }} />
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '12px 16px' }} />
            <Link to="/department-dashboard" className={`sidebar-item ${location.pathname === '/department-dashboard' ? 'active' : ''} `} onClick={onClose}>
              <Network size={20} />
              <span>{t('admin.dept_manage')}</span>
            </Link>
          </>
        )}
      </nav>
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
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        opacity: loading ? 0.5 : 1
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255, 210, 0, 0.1)';
        e.currentTarget.style.borderColor = 'var(--accent-blue)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('browser.stats_files')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{displayStats.uploadCount}</div>
      </div>
      <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{t('browser.stats_storage')}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatBytes(displayStats.storageUsed)}</div>
      </div>
      <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.2)' }} />
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
        let endpoint = '';
        if (context === 'inquiry') endpoint = '/api/v1/inquiry-tickets/stats';
        else if (context === 'rma') endpoint = '/api/v1/rma-tickets/stats';
        else if (context === 'dealer') endpoint = '/api/v1/dealer-repairs/stats';

        // Build query params with filters
        const params = new URLSearchParams();
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
          background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
          border: isActive ? `1px solid ${color}` : '1px solid transparent',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ fontSize: '0.8rem', color: isActive ? '#fff' : 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color }}>{count}</div>
      </div>
    );
  };

  const divider = <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.15)' }} />;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 12px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        opacity: loading ? 0.7 : 1
      }}
    >
      {/* Status colors using Kine brand colors from context.md:
          Kine Yellow: #FFD700, Kine Green: #10B981, Kine Red: #EF4444 */}
      {context === 'inquiry' && (
        <>
          {renderStatItem('all', '全部', '#6b7280')}
          {divider}
          {renderStatItem('Pending', '待处理', '#EF4444')}      {/* Kine Red */}
          {divider}
          {renderStatItem('InProgress', '处理中', '#3b82f6')}   {/* Blue */}
          {divider}
          {renderStatItem('AwaitingFeedback', '待反馈', '#d946ef')} {/* Purple */}
          {divider}
          {renderStatItem('Resolved', '已解决', '#10B981')}     {/* Kine Green */}
          {divider}
          {renderStatItem('AutoClosed', '已关闭', '#9ca3af')}   {/* Gray */}
          {divider}
          {renderStatItem('Upgraded', '已升级', '#22d3ee')}     {/* Cyan */}
        </>
      )}

      {context === 'rma' && (
        <>
          {renderStatItem('all', '全部', '#6b7280')}
          {divider}
          {renderStatItem('Pending', '已收货', '#FFD700')}      {/* Kine Yellow */}
          {divider}
          {renderStatItem('Confirming', '确认中', '#f59e0b')}   {/* Amber */}
          {divider}
          {renderStatItem('Diagnosing', '检测中', '#8b5cf6')}   {/* Purple */}
          {divider}
          {renderStatItem('InRepair', '维修中', '#3b82f6')}     {/* Blue */}
          {divider}
          {renderStatItem('Completed', '已完成', '#10B981')}    {/* Kine Green - 使用Completed状态 */}
        </>
      )}

      {context === 'dealer' && (
        <>
          {renderStatItem('all', '全部', '#6b7280')}
          {divider}
          {renderStatItem('Received', '已收货', '#FFD700')}     {/* Kine Yellow */}
          {divider}
          {renderStatItem('Confirming', '确认中', '#f59e0b')}   {/* Amber */}
          {divider}
          {renderStatItem('Diagnosing', '检测中', '#8b5cf6')}   {/* Purple */}
          {divider}
          {renderStatItem('InRepair', '维修中', '#3b82f6')}     {/* Blue */}
          {divider}
          {renderStatItem('Completed', '已完成', '#10B981')}    {/* Kine Green */}
        </>
      )}
    </div>
  );
};


const TopBar: React.FC<{ user: any, onMenuClick: () => void, currentModule: ModuleType }> = ({ user, onMenuClick, currentModule }) => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { language: currentLanguage, setLanguage, t } = useLanguage();

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

        {/* Stats card only visible in FILES module */}
        {currentModule === 'files' && (
          <div className="hidden-mobile">
            <UserStatsCard onClick={() => navigate('/dashboard')} />
          </div>
        )}

        {/* SERVICE MODULE: Stats Only (Nav is in Sidebar) */}
        {currentModule === 'service' && (
          <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center' }}>
            <ServiceTopBarStats />
          </div>
        )}

      </div>

      {/* Center: Daily Word - DailyWordBadge handles its own visibility via localStorage */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        {(currentModule === 'files' || currentModule === 'service') && <DailyWordBadge />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
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
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
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
            background: showDropdown ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
          }}
        >
          {/* Username/Role - hidden on mobile, flex-column on desktop */}
          <div className="hidden-mobile">
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{user.username}</span>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>
                {user.role === 'Admin' ? t('role.admin') : user.role === 'Lead' ? t('role.lead') : t('role.member')}
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
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
          }}>
            {user?.username?.substring(0, 1).toUpperCase() || '?'}
          </div>

          {/* Version Display - Client & Server (Two rows) */}
          <div className="hidden-mobile" style={{
            color: '#10b981',
            fontWeight: 700,
            fontSize: '0.75rem',
            background: 'rgba(16, 185, 129, 0.08)',
            padding: '2px 8px',
            borderRadius: '6px',
            marginRight: '12px',
            border: '1px solid rgba(16, 185, 129, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            lineHeight: '1.2'
          }}>
            <div style={{ opacity: 0.9 }}>v{typeof __APP_FULL_VERSION__ !== 'undefined' ? __APP_FULL_VERSION__ : '11.3.1 (dev)'}</div>
            {serverVersion && (
              <div style={{ opacity: 0.6, fontSize: '0.7rem' }}>s{serverVersion}</div>
            )}
          </div>

          {/* User Dropdown Menu */}
          {showDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 8,
              background: 'rgba(28, 28, 30, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '6px',
              minWidth: '180px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
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
                borderBottom: '1px solid rgba(255,255,255,0.1)',
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
                      background: currentLanguage === lang ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)',
                      color: currentLanguage === lang ? '#000' : 'rgba(255,255,255,0.8)',
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
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <User size={16} />
                {t('sidebar.personal')}
              </button>

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
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
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
                  color: '#FF453A',
                  fontSize: '0.9rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 69, 58, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <LogOut size={16} />
                {t('auth.logout')}
              </button>

              {/* Version Info */}
              <div style={{
                padding: '8px 12px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                marginTop: '4px',
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.3)',
                textAlign: 'center',
                fontFamily: 'monospace'
              }}>
                {/* @ts-ignore */}
                <div style={{ marginBottom: 4 }}>Longhorn {window.__APP_FULL_VERSION__ || 'v1.5.16'}</div>
                {/* @ts-ignore */}
                <div style={{ opacity: 0.8 }}>Code: {window.__APP_COMMIT_TIME__ || '2026-02-04 22:20'}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }}></span>
                  {/* @ts-ignore */}
                  <span style={{ color: '#10b981', fontWeight: 600 }}>v{window.__APP_VERSION__ || '1.1.7'}</span>
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
  if (user?.role === 'Admin') {
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
