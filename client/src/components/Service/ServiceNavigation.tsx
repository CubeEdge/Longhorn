/**
 * Service Navigation Component
 * 
 * Unified navigation architecture for Service module
 * Features:
 * - Collapsible section groups
 * - Active state highlighting
 * - Badge support for unread counts
 * - macOS26 glass morphism style
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  ClipboardList,
  Wrench,
  Building,
  Users,
  Box,
  Package,
  Book,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Settings,
  Activity,
  Sparkles
} from 'lucide-react';
import { useLanguage } from '../../i18n/useLanguage';
import { useAuthStore } from '../../store/useAuthStore';
import { useViewAs } from '../Workspace/ViewAsComponents';

// Navigation section type
interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  badge?: number;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
  defaultExpanded?: boolean;
}

// Storage key for expanded state
const NAV_EXPANDED_KEY = 'longhorn_service_nav_expanded';

const ServiceNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { user } = useAuthStore();
  
  // P2: View As support - use actingUser for permission checks
  const { viewingAs } = useViewAs();
  const actingUser = viewingAs || user;
  const actingRole = actingUser?.role;
  const actingDeptCode = viewingAs?.department_code || (user as any)?.department_code;

  // 穿透授权：判断用户是否有 CRM 全局访问权限
  const hasCrmAccess = (() => {
    if (!actingUser) return true; // 未知角色默认显示
    if (actingRole === 'Admin' || actingRole === 'Exec') return true;
    // MS/GE departments have full CRM access
    if (actingDeptCode === 'MS' || actingDeptCode === 'GE') return true;
    return false;
  })();

  // Load expanded state from localStorage
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(NAV_EXPANDED_KEY);
      return saved ? JSON.parse(saved) : { workbench: true, archives: true, techHub: true };
    } catch {
      return { workbench: true, archives: true, techHub: true };
    }
  });

  // Navigation structure
  const sections: NavSection[] = useMemo(() => [
    {
      id: 'overview',
      title: '',
      items: [
        { id: 'overview', label: '服务概览', icon: LayoutDashboard, path: '/service/overview' },
      ],
      defaultExpanded: true
    },
    {
      id: 'workbench',
      title: '工作台',
      items: [
        // Inquiry/SVC: OP/RD 隐藏 (PRD §2.1 工单可见性分级)，通过 Mentioned 列表进入
        ...(hasCrmAccess ? [
          { id: 'inquiry', label: t('sidebar.inquiry_tickets') || '咨询工单', icon: MessageSquare, path: '/service/inquiry-tickets' },
        ] : []),
        { id: 'rma', label: t('sidebar.rma_tickets') || 'RMA返厂单', icon: ClipboardList, path: '/service/rma-tickets' },
        ...(hasCrmAccess ? [
          { id: 'dealer-repairs', label: t('sidebar.dealer_repairs') || '经销商维修单', icon: Wrench, path: '/service/dealer-repairs' },
        ] : []),
      ],
      defaultExpanded: true
    },
    {
      id: 'customer-info',
      title: '客户和经销商信息',
      items: [
        // 仅 MS/Admin/Exec 可见
        ...(hasCrmAccess ? [
          { id: 'dealers', label: t('sidebar.archives_dealers') || '渠道和经销商', icon: Building, path: '/service/dealers' },
          { id: 'customers', label: t('sidebar.archives_customers') || '客户档案', icon: Users, path: '/service/customers' },
          { id: 'dealer-operations', label: t('sidebar.dealer_operations') || '经销商配件运营', icon: Package, path: '/service/dealer-operations' },
        ] : []),
      ],
      defaultExpanded: true
    },
    {
      id: 'product-info',
      title: '产品和配件信息',
      items: [
        // MS/OP 可查看
        ...(hasCrmAccess || actingDeptCode === 'OP' ? [
          { id: 'product-models', label: t('sidebar.product_models') || '产品目录', icon: Package, path: '/service/product-models' },
          { id: 'products', label: t('sidebar.archives_assets') || '设备台账', icon: Box, path: '/service/products' },
          { id: 'parts', label: t('sidebar.parts') || '配件管理', icon: Package, path: '/service/parts' },
        ] : []),
      ],
      defaultExpanded: true
    },
    {
      id: 'techHub',
      title: '技术中心',
      items: [
        { id: 'wiki', label: 'Kinefinity Wiki', icon: Book, path: '/tech-hub/wiki?line=A' },
        { id: 'bokeh', label: 'Bokeh 智能助手', icon: Sparkles, path: '/tech-hub/bokeh' },
      ],
      defaultExpanded: true
    },
    {
      id: 'admin',
      title: '管理',
      items: [
        { id: 'activity', label: '活动日志', icon: Activity, path: '/service/admin/activity' },
        { id: 'settings', label: '系统设置', icon: Settings, path: '/service/admin/settings' },
      ],
      defaultExpanded: false
    }
  ], [t]);

  // Toggle section expansion
  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections(prev => {
      const section = sections.find(s => s.id === sectionId);
      const currentState = prev[sectionId] ?? section?.defaultExpanded ?? true;
      const newState = { ...prev, [sectionId]: !currentState };
      localStorage.setItem(NAV_EXPANDED_KEY, JSON.stringify(newState));
      return newState;
    });
  }, [sections]);

  // Check if path is active
  const isPathActive = useCallback((path: string) => {
    // Handle wiki special case
    if (path.includes('wiki') && location.pathname.startsWith('/tech-hub/wiki')) return true;
    if (path.includes('bokeh') && location.pathname.startsWith('/tech-hub/bokeh')) return true;
    
    // Handle ticket detail page with ctx parameter
    if (location.pathname.startsWith('/service/tickets/')) {
      const ctx = new URLSearchParams(location.search).get('ctx');
      if (path === '/service/inquiry-tickets') return ctx === 'search-inquiry';
      if (path === '/service/rma-tickets') return ctx === 'search-rma';
      if (path === '/service/dealer-repairs') return ctx === 'search-svc';
    }
    
    // Normal path matching
    return location.pathname.startsWith(path.split('?')[0]);
  }, [location.pathname, location.search]);

  // Handle navigation
  const handleNavigate = useCallback((path: string) => {
    // Special handling for wiki to clear state
    if (path.includes('wiki')) {
      localStorage.removeItem('wiki-last-article');
    }
    navigate(path);
  }, [navigate]);

  return (
    <nav className="service-navigation">
      {sections.map((section) => {
        const isExpanded = expandedSections[section.id] ?? section.defaultExpanded ?? true;
        const hasTitle = section.title.length > 0;

        return (
          <div key={section.id} className="nav-section">
            {/* Section Header */}
            {hasTitle && (
              <div
                className="nav-section-header"
                onClick={() => toggleSection(section.id)}
              >
                <span className="nav-section-title">{section.title}</span>
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            )}

            {/* Section Items */}
            {(isExpanded || !hasTitle) && (
              <div className="nav-section-items">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isPathActive(item.path);

                  return (
                    <div
                      key={item.id}
                      className={`nav-item ${active ? 'active' : ''}`}
                      onClick={() => handleNavigate(item.path)}
                    >
                      <Icon size={18} />
                      <span className="nav-item-label">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="nav-item-badge">{item.badge > 99 ? '99+' : item.badge}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        .service-navigation {
          display: flex;
          flex-direction: column;
          padding: 8px;
          gap: 4px;
          height: 100%;
          overflow-y: auto;
        }

        .nav-section {
          display: flex;
          flex-direction: column;
        }

        .nav-section + .nav-section {
          margin-top: 4px;
        }

        .nav-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 16px;
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: color 0.2s;
          user-select: none;
        }

        .nav-section-header:hover {
          color: var(--text-secondary);
        }

        .nav-section-title {
          flex: 1;
        }

        .nav-section-items {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }

        .nav-item:hover {
          background: var(--glass-bg-hover);
          color: var(--text-main);
        }

        .nav-item.active {
          background: var(--accent-blue);
          color: #000;
          font-weight: 500;
        }

        .nav-item-label {
          flex: 1;
          font-size: 0.9rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .nav-item-badge {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: #FF453A;
          color: white;
          font-size: 0.7rem;
          font-weight: 600;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Scrollbar styling */
        .service-navigation::-webkit-scrollbar {
          width: 6px;
        }

        .service-navigation::-webkit-scrollbar-track {
          background: transparent;
        }

        .service-navigation::-webkit-scrollbar-thumb {
          background: var(--glass-border);
          border-radius: 3px;
        }

        .service-navigation::-webkit-scrollbar-thumb:hover {
          background: var(--text-tertiary);
        }
      `}</style>
    </nav>
  );
};

export default ServiceNavigation;

// Export hook for using navigation state externally
export const useServiceNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const currentSection = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/inquiry-tickets')) return 'inquiry';
    if (path.includes('/rma-tickets')) return 'rma';
    if (path.includes('/dealer-repairs')) return 'dealer-repairs';
    if (path.includes('/dealers')) return 'dealers';
    if (path.includes('/customers')) return 'customers';
    if (path.includes('/products')) return 'products';
    if (path.includes('/product-models')) return 'product-models';
    if (path.includes('/parts')) return 'parts';
    if (path.includes('/inventory')) return 'inventory';
    if (path.includes('/wiki')) return 'wiki';
    if (path.includes('/bokeh')) return 'bokeh';
    if (path.includes('/admin')) return 'admin';
    return 'overview';
  }, [location.pathname]);

  const navigateTo = useCallback((section: string) => {
    const pathMap: Record<string, string> = {
      overview: '/service/overview',
      inquiry: '/service/inquiry-tickets',
      rma: '/service/rma-tickets',
      'dealer-repairs': '/service/dealer-repairs',
      dealers: '/service/dealers',
      customers: '/service/customers',
      products: '/service/products',
      'product-models': '/service/product-models',
      parts: '/service/parts',
      'dealer-operations': '/service/dealer-operations',
      wiki: '/tech-hub/wiki?line=A',
      bokeh: '/tech-hub/bokeh',
      admin: '/service/admin/settings'
    };
    const path = pathMap[section];
    if (path) navigate(path);
  }, [navigate]);

  return { currentSection, navigateTo };
};
