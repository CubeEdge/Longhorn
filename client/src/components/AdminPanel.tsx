import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Users, ShieldCheck, Settings, ChevronRight,
    Bot, Activity, Database, Eye, MessageSquare, FolderOpen
} from 'lucide-react';
import SystemDashboard from './SystemDashboard';
import UserManagement from './Admin/UserManagement';
import DepartmentManagement from './DepartmentManagement';
import AdminSettings from './Admin/AdminSettings';
import { useLanguage } from '../i18n/useLanguage';
import { useAuthStore } from '../store/useAuthStore';

type AdminTab = 'users' | 'depts' | 'settings' | 'intelligence' | 'health' | 'audit' | 'backup' | 'prompts' | 'file-overview';

interface MenuSection {
    sectionId: string;
    sectionLabel: string;
    items: { id: string; label: string; icon: React.ElementType }[];
}

// Unified Settings Panel - Independent Module with sidebar navigation
const AdminPanel: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();
    const { user } = useAuthStore();
    const isSuperAdmin = user?.role === 'Admin' || user?.role === 'Exec';
    const isLead = user?.role === 'Lead';

    const routePrefix = '/settings';

    // Determine active tab from URL path
    const rawSegment = location.pathname.replace('/settings', '').replace(/^\//, '') || '';
    const validTabs: AdminTab[] = ['users', 'depts', 'settings', 'intelligence', 'health', 'audit', 'backup', 'prompts', 'file-overview'];
    const defaultTab: AdminTab = isLead ? 'users' : 'settings';
    const activeTab: AdminTab = (validTabs.includes(rawSegment as AdminTab) ? rawSegment : defaultTab) as AdminTab;

    // Redirect to default tab if on root /settings
    React.useEffect(() => {
        if (location.pathname === '/settings' || location.pathname === '/settings/') {
            navigate(`${routePrefix}/${defaultTab}`, { replace: true });
        }
    }, [location.pathname, defaultTab, navigate, routePrefix]);

    // Persist tab to localStorage
    React.useEffect(() => {
        localStorage.setItem('longhorn_settings_tab', activeTab);
    }, [activeTab]);

    // Build menu sections with permission control
    const menuSections: MenuSection[] = [
        // Organization
        {
            sectionId: 'organization',
            sectionLabel: '组织',
            items: [
                // Admin/Exec sees all depts, Lead sees own dept only
                ...(isSuperAdmin || isLead ? [{ id: 'users', label: t('admin.members') || '人员管理', icon: Users }] : []),
                // Dept & permissions: Admin/Exec/Lead can access (Lead has limited scope)
                ...(isSuperAdmin || isLead ? [{ id: 'depts', label: t('admin.depts_permissions') || '部门和权限', icon: ShieldCheck }] : []),
            ]
        },
        // System Settings
        {
            sectionId: 'system',
            sectionLabel: '系统',
            items: [
                { id: 'settings', label: t('admin.common_settings') || '通用设置', icon: Settings },
                ...(isSuperAdmin ? [
                    { id: 'intelligence', label: t('admin.smart_assistant') || '智能助手', icon: Bot },
                    { id: 'prompts', label: '协作助理配置', icon: MessageSquare },
                    { id: 'health', label: t('admin.system_health') || '系统健康', icon: Activity },
                    { id: 'backup', label: '数据备份', icon: Database },
                    { id: 'audit', label: t('admin.audit_logs') || '审计日志', icon: Eye },
                ] : []),
            ]
        },
        // Files Overview (Admin/Exec only)
        ...(isSuperAdmin ? [{
            sectionId: 'files',
            sectionLabel: '文件',
            items: [
                { id: 'file-overview', label: '文件概览', icon: FolderOpen }
            ]
        }] : []),
    ].filter(s => s.items.length > 0);

    const renderContent = () => {
        switch (activeTab) {
            case 'users': return <UserManagement />;
            case 'depts': return <DepartmentManagement />;
            case 'settings': return <AdminSettings initialTab="general" hideTabBar />;
            case 'intelligence': return <AdminSettings initialTab="intelligence" hideTabBar />;
            case 'health': return <AdminSettings initialTab="health" hideTabBar />;
            case 'audit': return <AdminSettings initialTab="audit" hideTabBar />;
            case 'backup': return <AdminSettings initialTab="backup" hideTabBar />;
            case 'prompts': return <AdminSettings initialTab="prompts" hideTabBar />;
            case 'file-overview': return <SystemDashboard />;
            default: return <AdminSettings initialTab="general" hideTabBar />;
        }
    };

    return (
        <div className="admin-panel-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Settings Sidebar - always visible, styled to match Service sidebar */}
            <div className="admin-sidebar" style={{
                width: 220,
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--glass-border)',
                padding: '16px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                flexShrink: 0,
                position: 'relative'
            }}>
                {/* Brand section - matches Service sidebar */}
                <div className="sidebar-brand" style={{ padding: '0 16px 16px' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFD700', letterSpacing: '-0.5px', margin: 0 }}>Longhorn</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Kinefinity Service Hub</p>
                </div>
                {/* Menu sections - styled to match Service sidebar */}
                <nav className="admin-menu" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                    {menuSections.map(section => (
                        <React.Fragment key={section.sectionId}>
                            {/* Section title - matches Service sidebar-section-title */}
                            <div className="sidebar-section-title" style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: 'var(--text-tertiary)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                padding: '12px 16px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>{section.sectionLabel}</div>
                            {/* Menu items - matches Service sidebar-item */}
                            {section.items.map(item => (
                                <div
                                    key={item.id}
                                    onClick={() => navigate(`${routePrefix}/${item.id}`)}
                                    className={`sidebar-item ${activeTab === item.id ? 'active' : ''}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '8px 16px',
                                        margin: '2px 12px',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        background: activeTab === item.id ? 'var(--accent-blue)' : 'transparent',
                                        color: activeTab === item.id ? '#000' : 'var(--text-secondary)',
                                        fontWeight: activeTab === item.id ? 500 : 400,
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <item.icon size={18} />
                                    <span style={{ flex: 1 }}>{item.label}</span>
                                    {activeTab === item.id && <ChevronRight size={14} className="hidden-mobile" />}
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                </nav>
            </div>

            {/* Main Content Area */}
            <div className="admin-content" style={{ padding: 0 }}>
                {renderContent()}
            </div>
        </div>
    );
};

export default AdminPanel;
