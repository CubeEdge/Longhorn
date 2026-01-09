import React, { useState } from 'react';
import { LayoutDashboard, Users, ShieldCheck, Settings, ChevronRight } from 'lucide-react';
import SystemDashboard from './SystemDashboard';
import UserManagement from './UserManagement';
import DepartmentManagement from './DepartmentManagement';
import { useLanguage } from '../i18n/useLanguage';

type AdminTab = 'dashboard' | 'users' | 'depts' | 'settings';

const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
    const { t } = useLanguage();

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
            case 'settings': return (
                <div className="fade-in" style={{ padding: 40, textAlign: 'center' }}>
                    <p className="hint">{t('admin.settings_placeholder')}</p>
                </div>
            );
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
                            onClick={() => setActiveTab(item.id as AdminTab)}
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

            {/* 主内容区 */}
            <div className="admin-content">
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPanel;
