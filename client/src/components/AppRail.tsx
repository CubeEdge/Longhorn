import React from 'react';
import { Headphones, FolderOpen, Network, LogOut } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../store/useAuthStore';
import type { ModuleType } from '../hooks/useNavigationState';

interface AppRailProps {
    currentModule: ModuleType;
    onModuleChange: (module: ModuleType) => void;
    canAccessFiles: boolean;
    userRole: string;
}

const AppRail: React.FC<AppRailProps> = ({
    currentModule,
    onModuleChange,
    canAccessFiles,
    userRole
}) => {
    const { t } = useLanguage();
    const { logout } = useAuthStore();

    return (
        <div className="app-rail">
            {/* Brand / Logo Area */}
            <div className="rail-brand">
                <div className="brand-logo">L</div>
            </div>

            {/* Main Navigation Items */}
            <nav className="rail-nav">
                {/* Service Module */}
                <button
                    className={`rail-item ${currentModule === 'service' ? 'active' : ''}`}
                    onClick={() => onModuleChange('service')}
                    title={t('nav.service')}
                >
                    <Headphones size={24} />
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

                {/* Admin Module (if Admin) */}
                {userRole === 'Admin' && (
                    <button
                        className={`rail-item ${window.location.pathname.startsWith('/admin') ? 'active' : ''}`}
                        onClick={() => window.location.href = '/admin'}
                        title={t('sidebar.system_admin')}
                    >
                        <Network size={24} />
                        <span className="rail-label">Admin</span>
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

        .rail-brand {
          margin-bottom: 24px;
        }

        .brand-logo {
          width: 40px;
          height: 40px;
          background: var(--accent-blue);
          color: #000;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 20px;
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
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-main);
        }

        .rail-item.active {
          background: var(--accent-blue);
          color: #000;
          box-shadow: 0 4px 12px rgba(255, 210, 0, 0.3);
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
