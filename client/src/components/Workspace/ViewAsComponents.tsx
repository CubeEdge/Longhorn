/**
 * View As Component (以其他用户视角查看)
 * P2 架构升级 - 仅管理员可用
 */

import React, { useState, useEffect } from 'react';
import { Eye, X, Search, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import axios from 'axios';

// ==============================
// Types
// ==============================

interface UserOption {
  id: number;
  name: string;
  role: string;
  department?: string;
  dealer_name?: string;
}

// ==============================
// View As Indicator
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
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 16px',
      background: 'rgba(255, 215, 0, 0.95)',
      borderRadius: 8,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: 9999
    }}>
      <Eye size={18} color="#000" />
      <span style={{ color: '#000', fontSize: 14, fontWeight: 500 }}>
        正在以 <strong>{viewingAs.name}</strong> 视角查看
      </span>
      <button
        onClick={onExit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          background: 'rgba(0,0,0,0.2)',
          border: 'none',
          borderRadius: 4,
          color: '#000',
          fontSize: 12,
          cursor: 'pointer'
        }}
      >
        <X size={14} />
        退出
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

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const groupedUsers = {
    Admin: filteredUsers.filter(u => u.role === 'Admin'),
    Employee: filteredUsers.filter(u => u.role === 'Employee'),
    Market: filteredUsers.filter(u => u.role === 'Market'),
    Dealer: filteredUsers.filter(u => u.role === 'Dealer')
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
      onClick={onClose}
    >
      <div 
        style={{
          width: 400,
          maxHeight: '70vh',
          background: 'rgba(30, 30, 30, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <Shield size={20} color="#FFD700" />
          <span style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>
            选择用户视角
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: 4
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: '8px 12px'
          }}>
            <Search size={16} color="#666" />
            <input
              type="text"
              placeholder="搜索用户..."
              value={search}
              onChange={e => setSearch(e.target.value)}
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
        </div>

        {/* User List */}
        <div style={{ 
          maxHeight: 400, 
          overflow: 'auto',
          padding: '0 8px 8px'
        }}>
          {Object.entries(groupedUsers).map(([role, roleUsers]) => 
            roleUsers.length > 0 && (
              <div key={role} style={{ marginBottom: 8 }}>
                <div style={{ 
                  fontSize: 11, 
                  color: '#888', 
                  padding: '8px',
                  textTransform: 'uppercase'
                }}>
                  {role} ({roleUsers.length})
                </div>
                {roleUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => onSelect(user)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      padding: '10px 12px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: 'rgba(255,215,0,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFD700',
                      fontSize: 14,
                      fontWeight: 500
                    }}>
                      {user.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#fff' }}>
                        {user.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        {user.department || user.dealer_name || user.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
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
  const [viewingAs, setViewingAs] = useState<UserOption | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);

  const canUseViewAs = user?.role === 'Admin';

  // Load available users for View As
  useEffect(() => {
    if (!canUseViewAs || !token) return;
    
    const fetchUsers = async () => {
      try {
        const res = await axios.get('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const users = res.data.map((u: any) => ({
          id: u.id,
          name: u.display_name || u.username,
          role: u.role,
          department: u.department_name,
          dealer_name: u.dealer_name
        }));
        setAvailableUsers(users);
      } catch (err) {
        console.error('[ViewAs] Failed to fetch users:', err);
      }
    };
    
    fetchUsers();
  }, [canUseViewAs, token]);

  // Restore View As state from session on mount
  useEffect(() => {
    const savedViewAsId = sessionStorage.getItem('viewAsUserId');
    if (savedViewAsId && availableUsers.length > 0) {
      const targetUser = availableUsers.find(u => String(u.id) === savedViewAsId);
      if (targetUser) {
        setViewingAs(targetUser);
      }
    }
  }, [availableUsers]);

  const startViewAs = (targetUser: UserOption) => {
    setViewingAs(targetUser);
    setIsOpen(false);
    
    // Store in session for API requests
    sessionStorage.setItem('viewAsUserId', String(targetUser.id));
    
    // Reload page to apply new permissions
    window.location.reload();
  };

  const exitViewAs = () => {
    setViewingAs(null);
    sessionStorage.removeItem('viewAsUserId');
    
    // Reload page to restore original permissions
    window.location.reload();
  };

  const getViewAsHeader = () => {
    const viewAsId = sessionStorage.getItem('viewAsUserId');
    return viewAsId ? { 'X-View-As-User': viewAsId } : {};
  };

  return {
    canUseViewAs,
    viewingAs,
    isOpen,
    setIsOpen,
    startViewAs,
    exitViewAs,
    getViewAsHeader,
    availableUsers
  };
};

export default {
  ViewAsIndicator,
  ViewAsSelector,
  useViewAs
};
