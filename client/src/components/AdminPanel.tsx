import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, ShieldCheck, Settings, ChevronRight } from 'lucide-react';
import SystemDashboard from './SystemDashboard';
import UserManagement from './UserManagement';
import DepartmentManagement from './DepartmentManagement';
import AdminSettings from './Admin/AdminSettings';
import { useLanguage } from '../i18n/useLanguage';

type AdminTab = 'dashboard' | 'users' | 'depts' | 'settings';

const AdminPanel: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();

    // Determine active tab from URL path (last segment)
    // Default to 'dashboard' if path is just '/admin' or unknown
    const pathSegment = location.pathname.split('/').pop() || 'dashboard';
    const activeTab = ['dashboard', 'users', 'depts', 'settings'].includes(pathSegment) ? pathSegment as AdminTab : 'dashboard';

    const menuItems = [
        { id: 'dashboard', label: t('admin.overview'), icon: LayoutDashboard },
        { id: 'users', label: t('admin.members'), icon: Users },
        { id: 'depts', label: t('admin.depts_permissions'), icon: ShieldCheck },
        { id: 'settings', label: t('admin.system_settings'), icon: Settings }
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <SystemDashboard />;
            case 'users': return <UserManagement />;
            case 'depts': return <DepartmentManagement />;
            case 'settings': return <AdminSettings />;
            default: return <SystemDashboard />;
        }
    };

    return (
        <div className="admin-panel-container">
            {/* 二级侧边导航 */}
            <div className="admin-sidebar">
                <div className="hint admin-sidebar-title">{t('admin.control_panel')}</div>
                <div className="admin-menu">
                    {menuItems.map(item => (
                        <div
                            key={item.id}
                            onClick={() => navigate(`/admin/${item.id}`)}
                            className={`admin-menu-item ${activeTab === item.id ? 'active' : ''}`}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <item.icon size={18} />
                                <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                            </div>
                            {activeTab === item.id && <ChevronRight size={14} className="hidden-mobile" />}
                        </div>
                    ))}
                </div>
            </div>

            {/* 主内容区 - Removing padding for settings to allow edge-to-edge design */}
            <div className="admin-content" style={{ padding: activeTab === 'settings' ? 0 : 40 }}>
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPanel;
