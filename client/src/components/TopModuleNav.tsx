/**
 * Top Module Navigation Component
 * 
 * macOS 26 style glassmorphic tab bar for switching between Service and Files modules.
 * Respects role-based access control - Dealers only see Service module.
 */

import React from 'react';
import { Headphones, FolderOpen } from 'lucide-react';
import { useLanguage } from '../i18n/useLanguage';
import type { ModuleType } from '../hooks/useNavigationState';

interface TopModuleNavProps {
  currentModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  canAccessFiles: boolean;
}

const TopModuleNav: React.FC<TopModuleNavProps> = ({
  currentModule,
  onModuleChange,
  canAccessFiles,
}) => {
  const { t } = useLanguage();

  // If user can only access Service (Dealer), don't show the nav
  if (!canAccessFiles) {
    return null;
  }

  return (
    <div className="top-module-nav">
      <div className="glass-tabs">
        <button
          className={`glass-tab ${currentModule === 'service' ? 'active' : ''}`}
          onClick={() => onModuleChange('service')}
        >
          <Headphones size={16} />
          <span>{t('nav.service')}</span>
        </button>
        
        <button
          className={`glass-tab ${currentModule === 'files' ? 'active' : ''}`}
          onClick={() => onModuleChange('files')}
        >
          <FolderOpen size={16} />
          <span>{t('nav.files')}</span>
        </button>
      </div>
      
      <style>{`
        .top-module-nav {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px 0;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--glass-border);
        }
        
        .top-module-nav .glass-tabs {
          display: inline-flex;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          -webkit-backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 4px;
          gap: 4px;
        }
        
        .top-module-nav .glass-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: var(--radius-md);
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition-smooth);
          border: none;
          background: transparent;
        }
        
        .top-module-nav .glass-tab:hover {
          color: var(--text-main);
          background: var(--glass-bg-light);
        }
        
        .top-module-nav .glass-tab.active {
          background: var(--accent-blue);
          color: #000;
          box-shadow: 0 2px 8px rgba(255, 210, 0, 0.3);
        }
        
        .top-module-nav .glass-tab.active svg {
          stroke-width: 2.5;
        }
        
        /* Mobile: Smaller padding */
        @media (max-width: 768px) {
          .top-module-nav .glass-tab {
            padding: 8px 16px;
            font-size: 0.85rem;
          }
          
          .top-module-nav .glass-tab span {
            display: none;
          }
          
          .top-module-nav .glass-tab svg {
            width: 20px;
            height: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default TopModuleNav;
