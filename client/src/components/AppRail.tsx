import React from 'react';
import { Users, FolderOpen, LogOut } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../store/useAuthStore';
import type { ModuleType } from '../hooks/useNavigationState';

interface AppRailProps {
  currentModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  canAccessFiles: boolean;
  userRole: string; // Kept in interface to avoid breaking caller, but unused in component
}

const AppRail: React.FC<AppRailProps> = ({
  currentModule,
  onModuleChange,
  canAccessFiles,
  // userRole - removed unused destructuring
}) => {
  const { t } = useLanguage();
  const { logout } = useAuthStore();

  return (
    <div className="app-rail">
      {/* Brand / Logo Area */}
      <div className="rail-brand" style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            backgroundColor: 'var(--accent-blue)',
            mask: 'url(/kine_logo.png) center/contain no-repeat',
            WebkitMask: 'url(/kine_logo.png) center/contain no-repeat'
          }}
          title="Kinefinity"
        />
      </div>

      {/* Main Navigation Items */}
      <nav className="rail-nav">
        {/* Service Module */}
        <button
          className={`rail-item ${currentModule === 'service' ? 'active' : ''}`}
          onClick={() => onModuleChange('service')}
          title={t('nav.service')}
        >
          <Users size={24} />
          <span className="rail-label">{t('nav.service')}</span>
        </button>

        {/* Files Module (only if accessible) */}
        {canAccessFiles && (
          <button
            className={`rail-item ${currentModule === 'files' ? 'active' : ''}`}
            onClick={() => onModuleChange('files')}
            title={t('nav.files')}
          >
            <FolderOpen size={24} />
            <span className="rail-label">{t('nav.files')}</span>
          </button>
        )}

      </nav>

      {/* Bottom Actions */}
      <div className="rail-bottom">
        <button className="rail-item" onClick={logout} title={t('auth.logout')}>
          <LogOut size={20} />
        </button>
      </div>

      <style>{`
        .app-rail {
          width: 72px;
          height: 100vh;
          background: #000000;
          border-right: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 0;
          flex-shrink: 0;
          z-index: 50;
        }

        .rail-nav {
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex: 1;
          width: 100%;
          align-items: center;
        }

        .rail-bottom {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: auto;
        }

        .rail-item {
          width: 48px;
          height: 48px;
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .rail-item:hover {
          background: var(--glass-bg-hover);
          color: var(--text-main);
        }

        .rail-item.active {
          background: var(--accent-blue);
          color: #000;
          box-shadow: 0 4px 12px rgba(var(--accent-rgb), 0.3);
        }

        .rail-label {
          font-size: 10px;
          margin-top: 2px;
          font-weight: 500;
          display: none; /* Icon only for cleanliness, can enable if needed */
        }
      `}</style>
    </div>
  );
};

export default AppRail;
