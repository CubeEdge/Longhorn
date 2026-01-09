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
        <div style={{ display: 'flex', height: '100%', gap: 32 }}>
            {/* 二级侧边导航 */}
            <div style={{
                width: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '0 8px',
                borderRight: '1px solid var(--glass-border)'
            }}>
                <div className="hint" style={{ padding: '0 16px 16px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 1 }}>{t('admin.control_panel')}</div>
                {menuItems.map(item => (
                    <div
                        key={item.id}
                        onClick={() => setActiveTab(item.id as AdminTab)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            paddingLeft: activeTab === item.id ? '12px' : '16px',
                            borderRadius: 12,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: activeTab === item.id ? 'rgba(255, 210, 0, 0.15)' : 'transparent',
                            borderLeft: activeTab === item.id ? '4px solid var(--accent-blue)' : '4px solid transparent',
                            color: activeTab === item.id ? 'var(--text-main)' : 'var(--text-secondary)',
                            fontWeight: activeTab === item.id ? 700 : 500
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <item.icon size={18} />
                            <span style={{ fontSize: '0.9rem' }}>{item.label}</span>
                        </div>
                        {activeTab === item.id && <ChevronRight size={14} />}
                    </div>
                ))}
            </div>

            {/* 主内容区 */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 10 }}>
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPanel;
