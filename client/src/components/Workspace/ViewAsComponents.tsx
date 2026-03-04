import React, { useState, useEffect } from 'react';
import { Eye, X, Search, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useViewAsStore } from '../../store/useViewAsStore';

// ==============================
// Types
// ==============================

interface UserOption {
  id: number;
  name: string;
  role: string;
  department?: string;
  department_code?: string;  // P2: For CRM access check
  dealer_name?: string;
}

// ==============================
// Constants & Utils
// ==============================

const PINNED_USERS = ['Cathy', 'Bishan', '张承', '伍帅', 'Effy', 'Jihua'];
const CLICK_FREQS_KEY = 'longhorn_viewas_freqs';

const getClickFreqs = (): Record<number, number> => {
  try {
    return JSON.parse(localStorage.getItem(CLICK_FREQS_KEY) || '{}');
  } catch {
    return {};
  }
};

const trackClick = (userId: number) => {
  try {
    const freqs = getClickFreqs();
    freqs[userId] = (freqs[userId] || 0) + 1;
    localStorage.setItem(CLICK_FREQS_KEY, JSON.stringify(freqs));
  } catch { }
};

// ==============================
// View As Indicator (顶部全宽横幅)
// ==============================

interface ViewAsIndicatorProps {
  viewingAs: UserOption | null;
  onExit: () => void;
}

export const ViewAsIndicator: React.FC<ViewAsIndicatorProps> = ({
  viewingAs,
  onExit
}) => {
  if (!viewingAs) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '8px 20px',
      background: '#FFD700', // Kine Yellow
      boxShadow: '0 -2px 10px rgba(0,0,0,0.2)',
      zIndex: 10001,
      animation: 'slideUp 0.3s ease-out'
    }}>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Eye size={18} color="#000" />
        <span style={{ color: '#000', fontSize: 13, fontWeight: 700, letterSpacing: '0.02em' }}>
          正在以账户 <span style={{ textDecoration: 'underline' }}>{viewingAs.name}</span> ({viewingAs.role}) 身份预览。所有操作将记录为该用户。
        </span>
      </div>
      <button
        onClick={onExit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 12px',
          background: 'rgba(0,0,0,0.85)',
          border: 'none',
          borderRadius: 6,
          color: '#FFD700',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
      >
        <X size={14} />
        退出预览
      </button>
    </div>
  );
};

// ==============================
// View As Selector
// ==============================

interface ViewAsSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (user: UserOption) => void;
  users: UserOption[];
}

export const ViewAsSelector: React.FC<ViewAsSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  users
}) => {
  const [search, setSearch] = useState('');
  const freqs = getClickFreqs();

  if (!isOpen) return null;

  // Sorting logic
  const sortedUsers = [...users].sort((a, b) => {
    // 1. Pinned users first
    const aPinned = PINNED_USERS.some(name => a.name.includes(name));
    const bPinned = PINNED_USERS.some(name => b.name.includes(name));
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // 2. Frequency
    const aFreq = freqs[a.id] || 0;
    const bFreq = freqs[b.id] || 0;
    if (aFreq !== bFreq) return bFreq - aFreq;

    // 3. Name
    return a.name.localeCompare(b.name);
  });

  const filteredUsers = sortedUsers.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.department || '').toLowerCase().includes(search.toLowerCase())
  );

  // Dynamic Grouping - pinned users go to top '⭐ 常用' group
  const groups: Record<string, UserOption[]> = {};
  const pinnedGroup: UserOption[] = [];
  filteredUsers.forEach(u => {
    const isPinned = PINNED_USERS.some(name => u.name.includes(name));
    if (isPinned) {
      pinnedGroup.push(u);
    } else {
      const groupName = u.department || u.dealer_name || u.role || 'Other';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(u);
    }
  });
  // Merge: pinned first, then department groups
  const allGroups: Record<string, UserOption[]> = {};
  if (pinnedGroup.length > 0) {
    allGroups['⭐ 常用'] = pinnedGroup;
  }
  Object.entries(groups).forEach(([k, v]) => { allGroups[k] = v; });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10002,
        backdropFilter: 'blur(5px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 440,
          maxHeight: '80vh',
          background: 'rgba(30,30,30,0.98)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={20} color="#FFD700" />
            <span style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>选择用户视角</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 10,
            padding: '10px 14px',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <Search size={18} color="#999" />
            <input
              autoFocus
              type="text"
              placeholder="搜索姓名、角色或部门..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: 15,
                width: '100%'
              }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px' }}>
          {Object.entries(allGroups).map(([groupName, groupUsers]) => (
            <div key={groupName} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#666',
                padding: '10px 12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {groupName} ({groupUsers.length})
              </div>
              {groupUsers.map(u => {
                const isPinned = PINNED_USERS.some(name => u.name.includes(name));
                return (
                  <button
                    key={u.id}
                    onClick={() => onSelect(u)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      width: '100%',
                      padding: '12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: isPinned ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isPinned ? '#FFD700' : '#fff',
                      fontSize: 15,
                      fontWeight: 700,
                      border: isPinned ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent'
                    }}>
                      {u.name[0]}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{u.name}</span>
                        {isPinned && <Shield size={12} color="#FFD700" />}
                      </div>
                      <div style={{ fontSize: 13, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {u.role} {u.department ? `· ${u.department}` : ''}
                      </div>
                    </div>
                    {(freqs[u.id] || 0) > 0 && (
                      <div style={{ fontSize: 10, color: '#444' }}>
                        ★ {freqs[u.id]}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>未找到匹配用户</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==============================
// View As Hook
// ==============================

export const useViewAs = () => {
  const { user, token } = useAuthStore();
  const { isSelectorOpen, setSelectorOpen } = useViewAsStore();
  const [viewingAs, setViewingAs] = useState<UserOption | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);

  // Allow View As if user is Admin OR currently viewing as someone (so they can switch)
  const isViewingAs = !!sessionStorage.getItem('viewAsUserId');
  const canUseViewAs = user?.role === 'Admin' || isViewingAs;

  // Load available users - use fetch() to bypass axios interceptor (which adds X-View-As-User header)
  useEffect(() => {
    if (!canUseViewAs || !token) return;

    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const mappedUsers = data.map((u: any) => ({
          id: u.id,
          name: u.display_name || u.username,
          role: u.role,
          department: u.department_name,
          department_code: u.dept_code,  // P2: For CRM access check
          dealer_name: u.dealer_name
        }));
        setAvailableUsers(mappedUsers);
      } catch (err) {
        console.error('[ViewAs] Failed to fetch users:', err);
      }
    };

    fetchUsers();
  }, [canUseViewAs, token]);

  // Restore state
  useEffect(() => {
    const savedViewAsId = sessionStorage.getItem('viewAsUserId');
    if (savedViewAsId && availableUsers.length > 0) {
      const targetUser = availableUsers.find(u => String(u.id) === savedViewAsId);
      if (targetUser) setViewingAs(targetUser);
    }
  }, [availableUsers]);

  const startViewAs = (targetUser: UserOption) => {
    trackClick(targetUser.id);
    setViewingAs(targetUser);
    setSelectorOpen(false);
    sessionStorage.setItem('viewAsUserId', String(targetUser.id));
    // Also set in localStorage so the axios interceptor in main.tsx picks it up
    localStorage.setItem('longhorn_view_as_user', String(targetUser.id));
    window.location.reload();
  };

  const exitViewAs = () => {
    setViewingAs(null);
    sessionStorage.removeItem('viewAsUserId');
    localStorage.removeItem('longhorn_view_as_user');
    window.location.reload();
  };

  return {
    canUseViewAs,
    viewingAs,
    isOpen: isSelectorOpen,
    setIsOpen: setSelectorOpen,
    startViewAs,
    exitViewAs,
    availableUsers
  };
};

export default {
  ViewAsIndicator,
  ViewAsSelector,
  useViewAs
};
