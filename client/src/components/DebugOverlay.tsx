/**
 * Debug Overlay (X光模式)
 * P2 架构升级 - 用于开发和测试时显示权限代码
 * 
 * 使用方法:
 * 1. 在Admin设置中开启 [ 🐞 UI Debug Mode ]
 * 2. 界面元素上会显示权限标签如 [Permission: TICKET_APPROVE]
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// ==============================
// Types
// ==============================

interface DebugContextType {
  isDebugMode: boolean;
  toggleDebugMode: () => void;
  setDebugMode: (value: boolean) => void;
}

interface DebugBadgeProps {
  type: 'permission' | 'mask' | 'role' | 'field';
  code: string;
  children: React.ReactNode;
}

// ==============================
// Debug Context
// ==============================

const DebugContext = createContext<DebugContextType>({
  isDebugMode: false,
  toggleDebugMode: () => {},
  setDebugMode: () => {}
});

export const useDebugMode = () => useContext(DebugContext);

// ==============================
// Debug Provider
// ==============================

const DEBUG_MODE_KEY = 'longhorn_debug_mode';

export const DebugProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDebugMode, setIsDebugMode] = useState(() => {
    try {
      return localStorage.getItem(DEBUG_MODE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleDebugMode = useCallback(() => {
    setIsDebugMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem(DEBUG_MODE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const setDebugMode = useCallback((value: boolean) => {
    setIsDebugMode(value);
    try {
      localStorage.setItem(DEBUG_MODE_KEY, String(value));
    } catch {}
  }, []);

  return (
    <DebugContext.Provider value={{ isDebugMode, toggleDebugMode, setDebugMode }}>
      {children}
    </DebugContext.Provider>
  );
};

// ==============================
// Debug Badge Component
// ==============================

export const DebugBadge: React.FC<DebugBadgeProps> = ({ type, code, children }) => {
  const { isDebugMode } = useDebugMode();

  if (!isDebugMode) {
    return <>{children}</>;
  }

  const getLabel = () => {
    switch (type) {
      case 'permission':
        return `Permission: ${code}`;
      case 'mask':
        return `Mask: ${code}`;
      case 'role':
        return `Role: ${code}`;
      case 'field':
        return `Field: ${code}`;
      default:
        return code;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'permission':
        return '#10B981'; // Green
      case 'mask':
        return '#F59E0B'; // Amber
      case 'role':
        return '#3B82F6'; // Blue
      case 'field':
        return '#8B5CF6'; // Purple
      default:
        return '#6B7280';
    }
  };

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {children}
      <span
        style={{
          marginLeft: 6,
          padding: '2px 6px',
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'monospace',
          color: getColor(),
          background: `${getColor()}15`,
          border: `1px solid ${getColor()}40`,
          borderRadius: 4,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      >
        [{getLabel()}]
      </span>
    </span>
  );
};

// ==============================
// Debug Toggle Button (for Admin Settings)
// ==============================

export const DebugModeToggle: React.FC = () => {
  const { isDebugMode, toggleDebugMode } = useDebugMode();

  return (
    <button
      onClick={toggleDebugMode}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        background: isDebugMode ? 'rgba(16, 185, 129, 0.15)' : 'var(--glass-bg-hover)',
        border: `1px solid ${isDebugMode ? 'rgba(16, 185, 129, 0.4)' : 'var(--glass-border)'}`,
        borderRadius: 10,
        color: isDebugMode ? '#10B981' : 'var(--text-main)',
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s',
        width: '100%'
      }}
    >
      <span style={{ fontSize: 16 }}>🐞</span>
      <span style={{ flex: 1, textAlign: 'left' }}>
        {isDebugMode ? 'UI Debug Mode: 开启' : 'UI Debug Mode: 关闭'}
      </span>
      <span
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          background: isDebugMode ? '#10B981' : 'var(--glass-bg-hover)',
          position: 'relative',
          transition: 'background 0.2s'
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: isDebugMode ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
          }}
        />
      </span>
    </button>
  );
};

// ==============================
// Debug Info Panel (Floating)
// ==============================

export const DebugInfoPanel: React.FC = () => {
  const { isDebugMode } = useDebugMode();

  if (!isDebugMode) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 20,
        padding: 16,
        background: 'rgba(0, 0, 0, 0.85)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: 12,
        zIndex: 9998,
        maxWidth: 280,
        backdropFilter: 'blur(10px)'
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: '#10B981', marginBottom: 12 }}>
        🐞 Debug Mode Active
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: '#10B981' }}>●</span> Permission: 权限检查点
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: '#F59E0B' }}>●</span> Mask: 数据脱敏点
        </div>
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: '#3B82F6' }}>●</span> Role: 角色检查点
        </div>
        <div>
          <span style={{ color: '#8B5CF6' }}>●</span> Field: 字段权限点
        </div>
      </div>
    </div>
  );
};

export default {
  DebugProvider,
  useDebugMode,
  DebugBadge,
  DebugModeToggle,
  DebugInfoPanel
};
