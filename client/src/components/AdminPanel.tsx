import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, Settings, ChevronRight } from 'lucide-react';
import SystemDashboard from './SystemDashboard';
import UserManagement from './UserManagement';
import DepartmentManagement from './DepartmentManagement';
import AdminSettings from './Admin/AdminSettings';
import { useLanguage } from '../i18n/useLanguage';

type AdminTab = 'dashboard' | 'users' | 'depts' | 'settings' | 'intelligence' | 'health' | 'audit' | 'backup' | 'prompts';

interface AdminPanelProps {
    moduleType?: 'service' | 'files';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ moduleType = 'files' }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();

    // 路由前缀根据模块类型判断
    const routePrefix = moduleType === 'service' ? '/service/admin' : '/admin';

    // Determine active tab from URL path or stored memory
    const pathSegment = location.pathname.split('/').pop() || 'dashboard';

    // Memory logic
    const [activeTab, setActiveTab] = React.useState<AdminTab>(() => {
        // 1. Priority: Check URL path first
        if (['dashboard', 'users', 'depts', 'settings', 'intelligence', 'health', 'audit', 'backup', 'prompts'].includes(pathSegment)) {
            return pathSegment as AdminTab;
        }

        // 2. Fallback: Check memory
        const storageKey = moduleType === 'service' ? 'longhorn_service_admin_tab' : 'longhorn_admin_active_tab';
        const remembered = localStorage.getItem(storageKey) as AdminTab;
        if (remembered && ['dashboard', 'users', 'depts', 'settings', 'intelligence', 'health', 'audit', 'backup', 'prompts'].includes(remembered)) {
            return remembered;
        }

        // 3. Default
        return 'dashboard';
    });

    React.useEffect(() => {
        const seg = location.pathname.split('/').pop() || 'dashboard';
        if (['dashboard', 'users', 'depts', 'settings', 'intelligence', 'health', 'audit', 'backup', 'prompts'].includes(seg)) {
            setActiveTab(seg as AdminTab);
            const storageKey = moduleType === 'service' ? 'longhorn_service_admin_tab' : 'longhorn_admin_active_tab';
            localStorage.setItem(storageKey, seg);
        }
    }, [location.pathname, moduleType]);

    // Unified menu items (Removing duplicates with top tabs)
    const menuItems = [
        { id: 'dashboard', label: t('admin.overview') || '概览', icon: LayoutDashboard },
        { id: 'users', label: t('admin.members') || '成员管理', icon: Users },
        { id: 'depts', label: t('admin.depts_permissions') || '权限管理', icon: ShieldCheck },
        { id: 'settings', label: '系统设置', icon: Settings }, // Only one settings entry
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
