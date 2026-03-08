import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, Settings, ChevronRight } from 'lucide-react';
import SystemDashboard from './SystemDashboard';
import UserManagement from './UserManagement';
import DepartmentManagement from './DepartmentManagement';
import AdminSettings from './Admin/AdminSettings';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../store/useAuthStore';

import { useViewAsStore } from '../store/useViewAsStore';

type AdminTab = 'dashboard' | 'users' | 'depts' | 'settings' | 'intelligence' | 'health' | 'audit' | 'backup' | 'prompts' | 'view-as';

interface AdminPanelProps {
    moduleType?: 'service' | 'files';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ moduleType = 'files' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();
    const { user } = useAuthStore();
    const isSuperAdmin = user?.role === 'Admin' || user?.role === 'Exec';
    const isLead = user?.role === 'Lead';

    // 路由前缀根据模块类型判断
    const routePrefix = moduleType === 'service' ? '/service/admin' : '/admin';

    // Service 模块不使用 dashboard (文件统计不相关)
    // Service 模块默认进入 settings
    const defaultTab = moduleType === 'service' ? 'settings' : (isSuperAdmin ? 'dashboard' : 'settings');

    // Determine active tab from URL path or stored memory
    const pathSegment = location.pathname.split('/').pop() || defaultTab;

    // Memory logic
    const [activeTab, setActiveTab] = React.useState<AdminTab>(() => {
        // 1. Priority: Check URL path first
        const validTabs = moduleType === 'service'
            ? ['users', 'depts', 'settings', 'intelligence', 'health', 'audit', 'backup', 'prompts']
            : ['dashboard', 'users', 'depts', 'settings', 'intelligence', 'health', 'audit', 'backup', 'prompts'];

        if (validTabs.includes(pathSegment)) {
            return pathSegment as AdminTab;
        }

        // 2. Fallback: Check memory
        const storageKey = moduleType === 'service' ? 'longhorn_service_admin_tab' : 'longhorn_admin_active_tab';
        const remembered = localStorage.getItem(storageKey) as AdminTab;
        if (remembered && validTabs.includes(remembered) && (isSuperAdmin || isLead || remembered === 'settings')) {
            return remembered;
        }

        // 3. Default
        return defaultTab as AdminTab;
    });

    React.useEffect(() => {
        const seg = location.pathname.split('/').pop() || defaultTab;
        const validTabs = moduleType === 'service'
            ? ['users', 'depts', 'settings', 'intelligence', 'health', 'audit', 'backup', 'prompts']
            : ['dashboard', 'users', 'depts', 'settings', 'intelligence', 'health', 'audit', 'backup', 'prompts'];
        if (validTabs.includes(seg)) {
            setActiveTab(seg as AdminTab);
            const storageKey = moduleType === 'service' ? 'longhorn_service_admin_tab' : 'longhorn_admin_active_tab';
            localStorage.setItem(storageKey, seg);
        }
    }, [location.pathname, moduleType, defaultTab]);

    // Unified menu items - Service 模块不显示 dashboard
    const menuItems = [
        // Files 模块: 显示 dashboard（含文件统计）
        // Service 模块: 不显示 dashboard（无意义）
        ...(isSuperAdmin && moduleType === 'files' ? [
            { id: 'dashboard', label: t('admin.overview') || '概览', icon: LayoutDashboard }
        ] : []),
        ...(isSuperAdmin ? [
            { id: 'users', label: t('admin.members') || '成员账号', icon: Users },
            { id: 'depts', label: t('admin.depts_permissions') || '部门和权限', icon: ShieldCheck }
        ] : []),
        { id: 'settings', label: t('admin.system_settings') || '系统设置', icon: Settings },
    ];

    // Map internal settings tabs to 'settings' sidebar id for highlighting
    const getSidebarActiveId = (tab: AdminTab) => {
        if (['settings', 'intelligence', 'health', 'audit', 'backup', 'prompts'].includes(tab)) return 'settings';
        return tab;
    };

    const sidebarActiveId = getSidebarActiveId(activeTab);

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <SystemDashboard />;
            case 'users': return <UserManagement />;
            case 'depts': return <DepartmentManagement />;
            case 'settings':
            case 'intelligence':
            case 'health':
            case 'audit':
            case 'backup':
            case 'prompts':
                return <AdminSettings
                    initialTab={activeTab === 'settings' ? 'general' : activeTab === 'intelligence' ? 'intelligence' : activeTab === 'health' ? 'health' : activeTab === 'audit' ? 'audit' : activeTab === 'backup' ? 'backup' : 'prompts'}
                    moduleType={moduleType}
                />;
            default: return <SystemDashboard />;
        }
    };

    // Hide sidebar for all settings tabs (they have their own top navigation)
    const shouldShowSidebar = !['settings', 'intelligence', 'health', 'audit', 'backup', 'prompts'].includes(activeTab);

    return (
        <div className="admin-panel-container">
            {/* 二级侧边导航 */}
            {shouldShowSidebar && (
                <div className="admin-sidebar">
                    <div className="hint admin-sidebar-title">{t('admin.control_panel')}</div>
                    <div className="admin-menu">
                        {menuItems.map(item => (
                            <div
                                key={item.id}
                                onClick={() => {
                                    if (item.id === 'settings') {
                                        const settingsStorageKey = moduleType === 'service' ? 'longhorn_service_settings_tab' : 'longhorn_files_settings_tab';
                                        const savedSubTab = localStorage.getItem(settingsStorageKey);
                                        const subRoute = (savedSubTab === 'general' || !savedSubTab) ? 'settings' : savedSubTab;
                                        navigate(`${routePrefix}/${subRoute}`);
                                    } else if (item.id === 'view-as') {
                                        useViewAsStore.getState().setSelectorOpen(true);
                                    } else {
                                        navigate(`${routePrefix}/${item.id}`);
                                    }
                                }}
                                className={`admin-menu-item ${sidebarActiveId === item.id ? 'active' : ''}`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <item.icon size={18} />
                                    <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                                </div>
                                {sidebarActiveId === item.id && <ChevronRight size={14} className="hidden-mobile" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 主内容区 - Removing padding for settings to allow edge-to-edge design */}
            <div className="admin-content" style={{ padding: ['settings', 'intelligence', 'health', 'audit', 'backup', 'prompts'].includes(activeTab) ? 0 : 40 }}>
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPanel;
