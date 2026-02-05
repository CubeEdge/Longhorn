import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, Settings, ChevronRight } from 'lucide-react';
import SystemDashboard from './SystemDashboard';
import UserManagement from './UserManagement';
import DepartmentManagement from './DepartmentManagement';
import AdminSettings from './Admin/AdminSettings';
import { useLanguage } from '../i18n/useLanguage';

type AdminTab = 'dashboard' | 'users' | 'depts' | 'settings' | 'intelligence' | 'health';

const AdminPanel: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();

    // Determine active tab from URL path or stored memory
    const pathSegment = location.pathname.split('/').pop() || 'dashboard';

    // Memory logic
    const [activeTab, setActiveTab] = React.useState<AdminTab>(() => {
        const remembered = localStorage.getItem('longhorn_admin_active_tab') as AdminTab;
        if (remembered && ['dashboard', 'users', 'depts', 'settings', 'intelligence', 'health'].includes(remembered)) {
            return remembered;
        }
        return (['dashboard', 'users', 'depts', 'settings', 'intelligence', 'health'].includes(pathSegment) ? pathSegment as AdminTab : 'dashboard');
    });

    React.useEffect(() => {
        const seg = location.pathname.split('/').pop() || 'dashboard';
        if (['dashboard', 'users', 'depts', 'settings', 'intelligence', 'health'].includes(seg)) {
            setActiveTab(seg as AdminTab);
            localStorage.setItem('longhorn_admin_active_tab', seg);
        }
    }, [location.pathname]);

    // Unified menu items (Removing duplicates with top tabs)
    const menuItems = [
        { id: 'dashboard', label: t('admin.overview') || '概览', icon: LayoutDashboard },
        { id: 'users', label: t('admin.members') || '成员管理', icon: Users },
        { id: 'depts', label: t('admin.depts_permissions') || '权限管理', icon: ShieldCheck },
        { id: 'settings', label: '系统设置', icon: Settings }, // Only one settings entry
    ];

    // Map internal settings tabs to 'settings' sidebar id for highlighting
    const getSidebarActiveId = (tab: AdminTab) => {
        if (['settings', 'intelligence', 'health'].includes(tab)) return 'settings';
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
                return <AdminSettings initialTab={activeTab === 'settings' ? 'general' : activeTab === 'intelligence' ? 'intelligence' : 'health'} />;
            default: return <SystemDashboard />;
        }
    };

    // Hide sidebar for all settings tabs (they have their own top navigation)
    const shouldShowSidebar = !['settings', 'intelligence', 'health'].includes(activeTab);

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
                                onClick={() => navigate(`/admin/${item.id}`)}
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
            <div className="admin-content" style={{ padding: ['settings', 'intelligence', 'health'].includes(activeTab) ? 0 : 40 }}>
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPanel;
