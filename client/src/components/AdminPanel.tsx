import React, { useState } from 'react';
import {
    LayoutDashboard,
    Users as UsersIcon,
    Network,
    Settings,
    ChevronRight
} from 'lucide-react';
import Dashboard from './Dashboard';
import UserManagement from './UserManagement';
import DepartmentManagement from './DepartmentManagement';

type AdminTab = 'dashboard' | 'users' | 'depts' | 'settings';

const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

    const menuItems = [
        { id: 'dashboard', label: '概览仪表盘', icon: LayoutDashboard },
        { id: 'users', label: '成员账号管理', icon: UsersIcon },
        { id: 'depts', label: '组织与权限控制', icon: Network },
        { id: 'settings', label: '系统设置', icon: Settings },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <Dashboard />;
            case 'users': return <UserManagement />;
            case 'depts': return <DepartmentManagement />;
            case 'settings': return (
                <div className="fade-in" style={{ padding: 40, textAlign: 'center' }}>
                    <p className="hint">更多系统配置项正在集成中...</p>
                </div>
            );
            default: return <Dashboard />;
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
                <div className="hint" style={{ padding: '0 16px 16px', fontSize: '0.75rem', fontWeight: 700, letterSpacing: 1 }}>管理控制台</div>
                {menuItems.map(item => (
                    <div
                        key={item.id}
                        onClick={() => setActiveTab(item.id as AdminTab)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            borderRadius: 12,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: activeTab === item.id ? 'var(--accent-blue)' : 'transparent',
                            color: activeTab === item.id ? 'black' : 'var(--text-secondary)',
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
