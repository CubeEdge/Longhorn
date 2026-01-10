import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
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
  Network
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

import ShareCollectionPage from './components/ShareCollectionPage';

// Main Layout Component for authenticated users
const MainLayout: React.FC<{ user: any }> = ({ user }) => {
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

          {/* Root Directory (Admin) */}
          <Route path="/root" element={user?.role === 'Admin' ? <RootDirectoryView /> : <Navigate to="/" />} />

          {/* Quick Access */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/starred" element={<StarredPage />} />
          <Route path="/recent" element={<RecentPage />} />
          <Route path="/shares" element={<SharesPage />} />
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Personal & Department Spaces */}
          <Route path="/personal/*" element={<FileBrowser key="personal" mode="personal" />} />
          <Route path="/personal" element={<FileBrowser key="personal-root" mode="personal" />} />
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

const Sidebar: React.FC<{ role: string, isOpen: boolean, onClose: () => void }> = ({ role, isOpen, onClose }) => {
  const location = useLocation();
  const { token } = useAuthStore();
  const [accessibleDepts, setAccessibleDepts] = React.useState<any[]>([]);
  const { t } = useLanguage();

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
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <h2 className="sidebar-title">{t('app.name')}</h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t('app.slogan')}</p>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Quick Access */}
        <Link to="/starred" className={`sidebar-item ${location.pathname === '/starred' ? 'active' : ''}`} onClick={onClose}>
          <Star size={18} />
          <span>{t('sidebar.favorites')}</span>
        </Link>
        <Link to="/shares" className={`sidebar-item ${location.pathname === '/shares' ? 'active' : ''}`} onClick={onClose}>
          <Share2 size={18} />
          <span>{t('share.my_shares')}</span>
        </Link>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />

        {/* Personal Space */}
        <Link to="/personal" className={`sidebar-item ${location.pathname === '/personal' ? 'active' : ''}`} onClick={onClose}>
          <User size={18} />
          <span>{t('sidebar.personal')}</span>
        </Link>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />

        {/* Departments */}
        {accessibleDepts.map((dept: any) => {
          const code = getDeptCode(dept.name);
          const Icon = deptIcons[code] || Box;

          // Translation Logic:
          // 1. Try to get translation for "dept.CODE"
          const transKey = `dept.${code}`;
          const translated = t(transKey as any);
          // 2. If translation exists (and isn't just the key), format as "Name (CODE)"
          // 3. Otherwise fall back to original database name (e.g. "Custom Dept (CD)")
          const displayName = translated !== transKey ? `${translated} (${code})` : dept.name;

          const isActive = location.pathname.startsWith(`/dept/${code}`) || location.pathname.includes(encodeURIComponent(code));
          return (
            <Link key={dept.name} to={`/dept/${code}`} className={`sidebar-item ${isActive ? 'active' : ''}`} onClick={onClose}>
              <Icon size={20} />
              <span>{displayName}</span>
            </Link>
          );
        })}

        {/*Admin */}
        {role === 'Admin' && (
          <>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />
            <Link to="/admin" className={`sidebar-item ${location.pathname.startsWith('/admin') ? 'active' : ''}`} onClick={onClose}>
              <Network size={18} />
              <span>{t('sidebar.system_admin')}</span>
            </Link>
          </>
        )}

        {/* Department Management - For Lead Users */}
        {role === 'Lead' && (
          <>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />
            <Link to="/department-dashboard" className={`sidebar-item ${location.pathname === '/department-dashboard' ? 'active' : ''}`} onClick={onClose}>
              <Network size={20} />
              <span>{t('admin.dept_manage')}</span>
            </Link>
          </>
        )}

        {/* Recycle Bin - Bottom */}
        <div style={{ marginTop: 'auto' }} />

        {/* Language Selector - Mobile Only */}
        <div className="hidden-desktop" style={{ padding: '8px 16px', marginBottom: '8px' }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            background: 'rgba(255,255,255,0.05)',
            padding: '8px',
            borderRadius: '10px',
            justifyContent: 'center'
          }}>
            {(['zh', 'en', 'de', 'ja'] as const).map((lang) => {
              const langEmoji: { [key: string]: string } = { zh: '🇨🇳', en: '🇺🇸', de: '🇩🇪', ja: '🇯🇵' };
              const { language: currentLanguage, setLanguage } = useLanguage();
              return (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  style={{
                    background: currentLanguage === lang ? 'var(--accent-blue)' : 'transparent',
                    color: currentLanguage === lang ? '#000' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  {langEmoji[lang]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: '1px', background: 'rgba(0,0,0,0.1)', margin: '12px 16px' }} />
        <Link to="/recycle-bin" className={`sidebar-item ${location.pathname === '/recycle-bin' ? 'active' : ''}`} onClick={onClose}>
          <Trash2 size={20} />
          <span>{t('browser.recycle')}</span>
        </Link>
        <div style={{ marginTop: 'auto', padding: '16px', fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.4, textAlign: 'center' }}>
          Longhorn v{__APP_VERSION__} · {__APP_BUILD_TIME__}
        </div>
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


const TopBar: React.FC<{ user: any, onMenuClick: () => void }> = ({ user, onMenuClick }) => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const { language: currentLanguage, setLanguage, t } = useLanguage();

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="menu-toggle" onClick={onMenuClick}>
          <Menu size={24} />
        </button>

        {/* Stats card hidden on mobile to save space */}
        <div className="hidden-mobile">
          <UserStatsCard onClick={() => navigate('/dashboard')} />
        </div>

      </div>

      {/* Center: Daily Word - always centered, visible on all screens */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <DailyWordBadge />
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
          ref={dropdownRef}
          className="hidden-mobile-flex"
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
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{user.username}</span>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>
              {user.role === 'Admin' ? t('role.admin') : user.role === 'Lead' ? t('role.lead') : t('role.member')}
            </span>
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
                lineHeight: '1.4'
              }}>
                <div>Longhorn v{__APP_VERSION__}</div>
                <div style={{ opacity: 0.7 }}>Build: {__APP_BUILD_TIME__}</div>
                <div style={{ opacity: 0.4, fontSize: '0.65rem' }}>{__APP_COMMIT__}</div>
              </div>
            </div>
          )}
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
