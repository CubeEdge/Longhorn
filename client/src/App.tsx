import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Users,
  Share2,
  LogOut,
  HardDrive,
  Camera,
  Film,
  Code,
  Box,
  Menu,
  Star,
  Clock,
  Trash2,
  User,
  Network
} from 'lucide-react';
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

import ShareCollectionPage from './components/ShareCollectionPage';

// Main Layout Component for authenticated users
const MainLayout: React.FC<{ user: any, logout: () => void }> = ({ user, logout }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container fade-in">
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${isSidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        role={user.role}
        onLogout={logout}
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main-content">
        <TopBar user={user} onMenuClick={() => setSidebarOpen(true)} />
        <div className="content-area">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  const { user, logout } = useAuthStore();

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
            <MainLayout user={user} logout={logout} />
          )
        }>
          <Route path="/" element={<HomeRedirect user={user} />} />

          {/* Root Directory (Admin) */}
          <Route path="/root" element={user?.role === 'Admin' ? <RootDirectoryView /> : <Navigate to="/" />} />

          {/* Quick Access */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/starred" element={<StarredPage />} />
          <Route path="/recent" element={<RecentPage />} />
          <Route path="/shares" element={<SharesPage />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Personal & Department Spaces */}
          <Route path="/personal" element={<FileBrowser key="personal" mode="personal" />} />
          <Route path="/dept/:deptCode/*" element={<FileBrowser key="dept" />} />
          <Route path="/dept/:deptCode" element={<FileBrowser key="dept-root" />} />

          {/* Admin */}
          <Route path="/members" element={user?.role === 'Admin' ? <MemberSpacePage /> : <Navigate to="/" />} />
          <Route path="/admin/*" element={user?.role === 'Admin' ? <AdminPanel /> : <Navigate to="/" />} />

          {/* Department Management - Lead only */}
          <Route path="/department-dashboard" element={user?.role === 'Lead' ? <DepartmentDashboard /> : <Navigate to="/" />} />

          {/* Recycle Bin */}
          <Route path="/recycle-bin" element={<RecycleBin />} />

          {/* Legacy routes - redirect */}
          <Route path="/files" element={<Navigate to="/" />} />
          <Route path="/recycle" element={<Navigate to="/recycle-bin" />} />
          <Route path="/shared" element={<Navigate to="/shares" />} />

          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </Router>
  );
};

const Sidebar: React.FC<{ role: string, onLogout: () => void, isOpen: boolean, onClose: () => void }> = ({ role, onLogout, isOpen, onClose }) => {
  const location = useLocation();
  const { token } = useAuthStore();
  const [accessibleDepts, setAccessibleDepts] = React.useState<any[]>([]);

  React.useEffect(() => {
    const fetchDepts = async () => {
      try {
        console.log('[Sidebar] Fetching departments with token:', token?.substring(0, 20) + '...');
        const res = await axios.get('/api/user/accessible-departments', {
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

  const deptCodeMap: { [key: string]: string } = {
    '市场部 (MS)': 'MS',
    '运营部 (OP)': 'OP',
    '研发部 (RD)': 'RD',
    '通用台面 (GE)': 'GE'
  };

  const deptIcons: { [key: string]: any } = {
    'MS': Camera,
    'OP': Film,
    'RD': Code,
    'GE': Box
  };

  const menuItems = [
    { path: '/personal', label: '个人空间', icon: User },
    { path: '/files', label: '所有文件', icon: HardDrive },
    { path: '/recent', label: '最近访问', icon: Clock },
    { path: '/starred', label: '星标文件', icon: Star },
  ];

  // Add accessible departments
  accessibleDepts.forEach(dept => {
    const code = deptCodeMap[dept.name];
    if (code) {
      menuItems.push({
        path: `/dept/${code}`,
        label: dept.name,
        icon: deptIcons[code] || Box
      });
    }
  });

  menuItems.push(
    { path: '/shared', label: '共享链接管理', icon: Share2 },
    { path: '/recycle', label: '回收站', icon: Trash2 }
  );

  if (role === 'Admin') {
    menuItems.push({ path: '/admin', label: '系统后台', icon: Users });
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <h2 className="sidebar-title">Longhorn</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>像空气一样自由流动</p>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Quick Access */}
        <Link to="/starred" className={`sidebar-item ${location.pathname === '/starred' ? 'active' : ''}`} onClick={onClose}>
          <Star size={20} />
          <span>星标文件</span>
        </Link>
        <Link to="/shares" className={`sidebar-item ${location.pathname === '/shares' ? 'active' : ''}`} onClick={onClose}>
          <Share2 size={20} />
          <span>我的分享</span>
        </Link>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />

        {/* Personal Space */}
        <Link to="/personal" className={`sidebar-item ${location.pathname === '/personal' ? 'active' : ''}`} onClick={onClose}>
          <User size={20} />
          <span>个人空间</span>
        </Link>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />

        {/* Departments */}
        {accessibleDepts.map((dept: any) => {
          const code = deptCodeMap[dept.name];
          const Icon = code ? deptIcons[code] : Box;
          const isActive = location.pathname.startsWith(`/dept/${code}`);
          return (
            <Link key={dept.name} to={`/dept/${code}`} className={`sidebar-item ${isActive ? 'active' : ''}`} onClick={onClose}>
              <Icon size={20} />
              <span>{dept.name}</span>
            </Link>
          );
        })}

        {/*Admin */}
        {role === 'Admin' && (
          <>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />
            <Link to="/admin" className={`sidebar-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`} onClick={onClose}>
              <Users size={20} />
              <span>系统后台</span>
            </Link>
          </>
        )}

        {/* Department Management - For Lead Users */}
        {role === 'Lead' && (
          <>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />
            <Link to="/department-dashboard" className={`sidebar-item ${location.pathname === '/department-dashboard' ? 'active' : ''}`} onClick={onClose}>
              <Network size={20} />
              <span>部门管理</span>
            </Link>
          </>
        )}

        {/* Recycle Bin - Bottom */}
        <div style={{ marginTop: 'auto' }} />
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />
        <Link to="/recycle-bin" className={`sidebar-item ${location.pathname === '/recycle-bin' ? 'active' : ''}`} onClick={onClose}>
          <Trash2 size={20} />
          <span>回收站</span>
        </Link>
      </nav>

      <div style={{ padding: '0 24px 24px' }}>
        <button onClick={onLogout} className="sidebar-item" style={{ background: 'none', border: 'none', width: '100%', padding: '10px 0' }}>
          <LogOut size={20} />
          <span>退出登录</span>
        </button>
      </div>
    </aside>
  );
};

// User Stats Card Component
const UserStatsCard: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { token } = useAuthStore();
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('/api/user/stats', {
          headers: { Authorization: `Bearer ${token}` }
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
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>上传文件</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{displayStats.uploadCount}</div>
      </div>
      <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>存储</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatBytes(displayStats.storageUsed)}</div>
      </div>
      <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>分享</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-blue)' }}>{displayStats.shareCount || 0}</div>
      </div>
    </div>
  );
};


const TopBar: React.FC<{ user: any, onMenuClick: () => void }> = ({ user, onMenuClick }) => {
  const navigate = useNavigate();

  // Removed unused crumbs and shouldHideBreadcrumb to fix build errors.


  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="menu-toggle" onClick={onMenuClick}>
          <Menu size={24} />
        </button>

        <UserStatsCard onClick={() => navigate('/dashboard')} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
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

        <div
          className="hidden-mobile-flex"
          onClick={() => navigate('/dashboard')}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 12px', borderRadius: '10px', transition: 'background 0.2s' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{user.username}</span>
          <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>
            {user.role === 'Admin' ? '系统管理员' : user.role === 'Lead' ? '部门主管' : '普通用户'}
          </span>
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
        </div>
      </div>
    </header>
  );
};

const HomeRedirect: React.FC<{ user: any }> = ({ user }) => {
  if (user.role === 'Admin') {
    return <Navigate to="/admin" replace />;
  }

  // Extract department code from name like '市场部 (MS)'
  const deptMatch = user.department_name?.match(/\(([^)]+)\)/);
  const deptCode = deptMatch ? deptMatch[1] : null;

  if (deptCode) {
    return <Navigate to={`/dept/${deptCode}`} replace />;
  }

  return <Navigate to="/files" replace />;
};

export default App;
