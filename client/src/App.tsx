import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import {
  Users,
  Share2,
  LogOut,
  HardDrive,
  Camera,
  Film,
  Code,
  Box,
  ChevronRight,
  Info,
  Menu,
  Star,
  Clock,
  Trash2
} from 'lucide-react';
import { useAuthStore } from './store/useAuthStore';
import FileBrowser from './components/FileBrowser';
import AdminPanel from './components/AdminPanel';
import Login from './components/Login';
import RecycleBin from './components/RecycleBin';

const App: React.FC = () => {
  const { user, logout } = useAuthStore();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  if (!user || typeof user !== 'object' || !user.role) {
    return <Login />;
  }

  return (
    <Router>
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
            <Routes>
              <Route path="/" element={<HomeRedirect user={user} />} />
              <Route path="/admin/*" element={user.role === 'Admin' ? <AdminPanel /> : <Navigate to="/" />} />
              <Route path="/dept/:deptCode" element={<FileBrowser />} />
              <Route path="/files" element={<FileBrowser />} />
              <Route path="/recent" element={<FileBrowser mode="recent" />} />
              <Route path="/starred" element={<FileBrowser mode="starred" />} />
              <Route path="/shared" element={<div className="hint"><Info size={16} /> 共享链接管理即将上线</div>} />
              <Route path="/recycle" element={<RecycleBin />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
};

const Sidebar: React.FC<{ role: string, onLogout: () => void, isOpen: boolean, onClose: () => void }> = ({ role, onLogout, isOpen, onClose }) => {
  const location = useLocation();

  const menuItems = [
    { path: '/files', label: '所有文件', icon: HardDrive },
    { path: '/recent', label: '最近访问', icon: Clock },
    { path: '/starred', label: '星标文件', icon: Star },
    { path: '/dept/MS', label: '市场部 (MS)', icon: Camera },
    { path: '/dept/OP', label: '运营部 (OP)', icon: Film },
    { path: '/dept/RD', label: '研发中心 (RD)', icon: Code },
    { path: '/dept/GE', label: '综合管理 (GE)', icon: Box },
    { path: '/shared', label: '共享链接管理', icon: Share2 },
    { path: '/recycle', label: '回收站', icon: Trash2 },
  ];

  if (role === 'Admin') {
    menuItems.push({ path: '/admin', label: '系统后台', icon: Users });
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <h2 className="sidebar-title">Longhorn</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Kinefinity 本地数据中心</p>
      </div>

      <nav style={{ flex: 1 }}>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={onClose}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </Link>
        ))}
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

const TopBar: React.FC<{ user: any, onMenuClick: () => void }> = ({ user, onMenuClick }) => {
  return (
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button className="menu-toggle" onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <span>根目录</span> <ChevronRight size={14} /> <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>主文件库</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }} className="hidden-mobile">
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user.username}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
            {user.role === 'Admin' ? '系统管理员' : user.role === 'Lead' ? '部门主管' : '普通用户'}
          </span>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'var(--accent-blue)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, boxShadow: 'var(--shadow-sm)' }}>
          {user?.username?.substring(0, 1).toUpperCase() || '?'}
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
