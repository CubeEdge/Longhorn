import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, Server, Database, Bot, RefreshCcw, Plus, Trash2, Eye, EyeOff, CheckCircle, X, AlertTriangle, Sparkles, Sun, Moon, Monitor } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import { useToast } from '../../store/useToast';
import { useThemeStore } from '../../store/useThemeStore';
interface AIProvider {
    name: string;
    api_key: string;
    base_url: string;
    chat_model: string;
    reasoner_model: string;
    vision_model: string;
    allow_search: boolean;
    temperature: number;
    max_tokens: number;
    top_p: number;
    is_active: boolean;
}

interface SystemSettings {
    system_name: string;
    ai_enabled: boolean;
    ai_work_mode: boolean;
    ai_data_sources: string[];  // ["tickets", "knowledge", "web_search"]
    ai_system_prompt?: string;  // 自定义 Bokeh 系统提示词
    ai_prompts?: any; // custom prompts for specific scenarios
    ai_search_history_limit?: number; // 默认 10
    show_daily_word?: boolean; // 显示每日一词徽章
    // Primary Backup
    backup_enabled: boolean;
    backup_frequency: number;
    backup_retention_days: number;
    // Secondary Backup
    secondary_backup_enabled: boolean;
    secondary_backup_frequency: number;
    secondary_backup_retention_days: number;
}

type AdminTab = 'general' | 'intelligence' | 'health' | 'audit' | 'backup' | 'prompts';

interface AdminSettingsProps {
    initialTab?: AdminTab;
    moduleType?: 'service' | 'files';
}

const PREDEFINED_MODELS: Record<string, { chat: string[], reasoner: string[], vision: string[] }> = {
    'DeepSeek': {
        chat: ['deepseek-chat', 'deepseek-reasoner'],
        reasoner: ['deepseek-reasoner', 'deepseek-chat'],
        vision: ['deepseek-chat']
    },
    'Gemini': {
        chat: [
            // Gemini 3 系列 (推荐/预览)
            'gemini-3-flash-preview',
            'gemini-3-pro-preview',
            // Gemini 2.5 系列 (稳定/GA)
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            // 别名
            'gemini-flash-latest',
            'gemini-pro-latest',
            // 旧版本 (保留向下兼容)
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro',
            'gemini-2.0-flash-exp'
        ],
        reasoner: [
            'gemini-pro-latest',
            'gemini-3-pro-preview',
            'gemini-2.5-pro',
            'gemini-flash-latest',
            'gemini-2.0-flash-thinking-exp-01-21',
            'gemini-1.5-pro'
        ],
        vision: [
            'gemini-3-flash-preview',
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
        ]
    },
    'OpenAI': {
        chat: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        reasoner: ['o1-preview', 'o1-mini', 'o3-mini'],
        vision: ['gpt-4o']
    }
};

// Map field names to PREDEFINED_MODELS keys
const FIELD_TO_MODEL_KEY: Record<string, string> = {
    'chat_model': 'chat',
    'reasoner_model': 'reasoner',
    'vision_model': 'vision'
};



let cachedSettings: SystemSettings | null = null;
let cachedProviders: AIProvider[] = [];


const AdminSettings: React.FC<AdminSettingsProps> = ({ initialTab, moduleType = 'files' }) => {
    const { token } = useAuthStore();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { theme, setTheme } = useThemeStore();

    // 路由前缀根据模块类型
    const routePrefix = moduleType === 'service' ? '/service/admin' : '/admin';

    // 根据模块类型获取独立的持久化 key
    const getStorageKey = () => moduleType === 'service' ? 'longhorn_service_settings_tab' : 'longhorn_files_settings_tab';

    // 从 localStorage读取上次访问的tab
    const getLastTab = (): AdminTab => {
        const saved = localStorage.getItem(getStorageKey());
        return (saved as AdminTab) || 'general';
    };

    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab || getLastTab());
    const [settings, setSettings] = useState<SystemSettings | null>(cachedSettings);
    const [providers, setProviders] = useState<AIProvider[]>(cachedProviders);
    const [activeProviderIndex, setActiveProviderIndex] = useState(0);

    const [loading, setLoading] = useState(!cachedSettings);
    const [saving, setSaving] = useState(false);
    const { showToast } = useToast();
    const [backingUpPrimary, setBackingUpPrimary] = useState(false);
    const [backingUpSecondary, setBackingUpSecondary] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);
    const [backupResult, setBackupResult] = useState<{ success: boolean, message: string, path?: string } | null>(null);

    // Backup status state
    const [backupStatus, setBackupStatus] = useState<{
        primary: {
            enabled: boolean;
            frequency: number;
            retention: number;
            path: string;
            label: string;
            backups: { name: string; size: number; created_at: string; path: string }[];
        };
        secondary: {
            enabled: boolean;
            frequency: number;
            retention: number;
            path: string;
            label: string;
            backups: { name: string; size: number; created_at: string; path: string }[];
        };
    } | null>(null);

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmLabel?: string;
        cancelLabel?: string;
        isDanger?: boolean;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Restore modal state
    const [restoreModal, setRestoreModal] = useState<{
        isOpen: boolean;
        type: 'primary' | 'secondary';
        selectedBackup: string | null;
    }>({ isOpen: false, type: 'primary', selectedBackup: null });

    // Prompt editor modal state
    const [showPromptModal, setShowPromptModal] = useState(false);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    const handleTabChange = (tabId: string) => {
        const newTab = tabId as AdminTab;
        setActiveTab(newTab);
        // 保存到localStorage
        localStorage.setItem(getStorageKey(), newTab);
        // Sync with route for persistence
        const routeId = tabId === 'general' ? 'settings' : tabId;
        navigate(`${routePrefix}/${routeId}`);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settingsRes] = await Promise.all([
                axios.get('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setSettings(settingsRes.data.data.settings);
            setProviders(settingsRes.data.data.providers || []);

            // Update cache
            cachedSettings = settingsRes.data.data.settings;
            cachedProviders = settingsRes.data.data.providers || [];

            // Auto-select active provider
            const activeIdx = Math.max(0, (settingsRes.data.data.providers || []).findIndex((p: AIProvider) => p.is_active));
            setActiveProviderIndex(activeIdx);
        } catch (err) {
            console.error('Failed to load admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        if (activeTab === 'backup') {
            fetchBackupStatus();
        }
    }, [activeTab]);

    const fetchBackupStatus = async () => {
        try {
            const res = await axios.get('/api/admin/backup/status', { headers: { Authorization: `Bearer ${token}` } });
            setBackupStatus(res.data.data);
        } catch (err) { console.error('Failed to fetch backup status:', err); }
    };

    // Show confirm dialog
    const showConfirm = (title: string, message: string, onConfirm: () => void, options?: { confirmLabel?: string; cancelLabel?: string; isDanger?: boolean }) => {
        setConfirmDialog({
            isOpen: true,
            title,
            message,
            onConfirm,
            confirmLabel: options?.confirmLabel,
            cancelLabel: options?.cancelLabel,
            isDanger: options?.isDanger
        });
    };

    // Close confirm dialog
    const closeConfirm = (confirmed: boolean) => {
        if (confirmed && confirmDialog.onConfirm) {
            confirmDialog.onConfirm();
        }
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
    };

    // Handle backup with confirmation
    const handleBackupWithConfirm = (type: 'primary' | 'secondary') => {
        const isPrimary = type === 'primary';
        showConfirm(
            isPrimary ? '确认主备份' : '确认次级备份',
            isPrimary
                ? '即将执行主备份，备份文件将存储至 fileserver SSD。此操作可能需要几分钟，请确保系统正常运行。'
                : '即将执行次级备份，备份文件将存储至系统盘。此操作可能需要几分钟，请确保系统正常运行。',
            () => handleManualBackupTyped(type),
            { confirmLabel: '开始备份', cancelLabel: '取消' }
        );
    };



    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            console.log('[AdminSettings] Saving providers:', providers.map(p => ({ name: p.name, hasApiKey: !!p.api_key })));
            await axios.post('/api/admin/settings', { settings, providers }, { headers: { Authorization: `Bearer ${token}` } });
            // Show success message
            showToast('设置已保存成功！', 'success');
            // Reload settings to reflect changes
            const res = await axios.get('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success && res.data.data?.settings) {
                setSettings(res.data.data.settings);
                setProviders(res.data.data.providers || []);
                cachedSettings = res.data.data.settings;
                cachedProviders = res.data.data.providers || [];
            }

            // Notify other components (like DailyWordBadge) to refetch their settings
            window.dispatchEvent(new Event('system-settings-updated'));
        } catch (err: any) {
            console.error('Failed to save settings:', err);
            showToast('保存失败: ' + (err.response?.data?.error || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    const addProvider = () => {
        const newProvider: AIProvider = {
            name: `New Provider ${providers.length + 1}`,
            api_key: '',
            base_url: 'https://api.openai.com/v1',
            chat_model: 'gpt-4o',
            reasoner_model: 'o1-preview',
            vision_model: 'gpt-4o',
            allow_search: false,
            temperature: 0.7,
            max_tokens: 4096,
            top_p: 1.0,
            is_active: false
        };
        setProviders([...providers, newProvider]);
        setActiveProviderIndex(providers.length);
    };

    const deleteProvider = async (index: number) => {
        const p = providers[index];
        if (p.is_active) {
            showToast("Cannot delete the active provider. Please set another provider as active first.", "error");
            return;
        }
        if (!window.confirm(`Delete ${p.name}?`)) return;

        try {
            await axios.post('/api/admin/providers/delete', { name: p.name }, { headers: { Authorization: `Bearer ${token}` } });
            const newProviders = providers.filter((_, i) => i !== index);
            setProviders(newProviders);
            setActiveProviderIndex(0);
            showToast("模型已删除", "success");
        } catch (err) {
            console.error('Delete provider failed');
            showToast("删除失败", "error");
        }
    };

    const handleManualBackup = async () => {
        handleBackupWithConfirm('primary');
    };

    const handleManualBackupTyped = async (type: 'primary' | 'secondary') => {
        if (type === 'primary') {
            setBackingUpPrimary(true);
        } else {
            setBackingUpSecondary(true);
        }
        try {
            const endpoint = type === 'primary' ? '/api/admin/backup/now' : '/api/admin/backup/now/secondary';
            const res = await axios.post(endpoint, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data.success) {
                setBackupResult({
                    success: true,
                    message: `${res.data.label} 成功完成！`,
                    path: res.data.path
                });
                // Refresh backup status to show the new backup in the list
                fetchBackupStatus();
            } else {
                setBackupResult({
                    success: false,
                    message: '备份失败: ' + res.data.error
                });
            }
        } catch (err) {
            console.error('Backup failed:', err);
            setBackupResult({
                success: false,
                message: '备份请求失败，请检查控制台。'
            });
        } finally {
            if (type === 'primary') {
                setBackingUpPrimary(false);
            } else {
                setBackingUpSecondary(false);
            }
        }
    };

    const setProviderActive = (index: number) => {
        const newProviders = providers.map((p, i) => ({
            ...p,
            is_active: i === index
        }));
        setProviders(newProviders);
    };

    const updateProviderField = (index: number, field: keyof AIProvider, value: any) => {
        const newProviders = [...providers];
        newProviders[index] = { ...newProviders[index], [field]: value };
        setProviders(newProviders);
    };

    // Removed early return for loading to prevent header flashing. Now handled inside the content area.

    const currentP = providers[activeProviderIndex];

    const ModelSelect: React.FC<{ label: string, field: keyof AIProvider, current: string }> = ({ label, field, current }) => {
        // Fix: Map field name (e.g. 'chat_model') to PREDEFINED_MODELS key (e.g. 'chat')
        const modelKey = FIELD_TO_MODEL_KEY[field as string] || field;
        const standardOptions = PREDEFINED_MODELS[currentP.name]?.[modelKey as keyof (typeof PREDEFINED_MODELS)['DeepSeek']];
        const isStandard = !!standardOptions;

        return (
            <div className="setting-field">
                <label>{label}</label>
                {isStandard ? (
                    <select
                        className="text-input"
                        value={current}
                        onChange={e => updateProviderField(activeProviderIndex, field, e.target.value)}
                    >
                        {standardOptions.map(m => <option key={m} value={m}>{m}</option>)}
                        {!standardOptions.includes(current) && <option value={current}>{current} (Custom)</option>}
                    </select>
                ) : (
                    <input
                        type="text"
                        className="text-input"
                        value={current}
                        onChange={e => updateProviderField(activeProviderIndex, field, e.target.value)}
                        placeholder={`e.g. ${field === 'chat_model' ? 'gpt-4o' : 'o1-preview'}`}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="fade-in" style={{ padding: '0 20px 40px' }}>
            {/* Header / Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 4, background: 'var(--glass-bg-hover)', padding: 4, borderRadius: 12 }}>
                    {[
                        { id: 'general', label: '通用', icon: Server },
                        { id: 'intelligence', label: 'Bokeh 智能设置', icon: Bot },
                        { id: 'backup', label: '备份管理', icon: Database }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id as any)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 16px', borderRadius: 8, border: 'none',
                                background: activeTab === tab.id ? 'var(--glass-bg-hover)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--text-main)' : 'var(--text-secondary)',
                                cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500, transition: 'all 0.2s'
                            }}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                    {activeTab !== 'audit' && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'transparent', color: 'var(--accent-blue)',
                                border: '1px solid rgba(var(--accent-rgb), 0.4)',
                                padding: '8px 20px', borderRadius: 10,
                                fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
                                opacity: saving ? 0.7 : 1,
                                transition: 'all 0.2s',
                                backdropFilter: 'blur(10px)'
                            }}
                            onMouseEnter={(e) => {
                                if (!saving) {
                                    e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.1)';
                                    e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb), 0.8)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!saving) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb), 0.4)';
                                }
                            }}
                        >
                            {saving ? <RefreshCcw className="animate-spin" size={16} /> : <Save size={16} />}
                            {t('common.save_all_changes')}
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div style={{ background: 'var(--glass-bg)', borderRadius: 16, border: '1px solid var(--glass-border)', minHeight: 400 }}>
                {loading && !settings ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                        <RefreshCcw className="animate-spin" size={24} style={{ marginBottom: 16 }} />
                        Loading Configuration...
                    </div>
                ) : (
                    <>
                        {/* === AI INTELLIGENCE TAB === */}
                        {activeTab === 'intelligence' && settings && (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', minHeight: 500 }}>
                                    {/* LEFT: Provider Sidebar */}
                                    <div style={{ width: 240, borderRight: '1px solid var(--glass-border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div className="hint" style={{ marginBottom: 8, paddingLeft: 8 }}>{t('admin.ai_providers')}</div>
                                        {providers.map((p, i) => (
                                            <div
                                                key={i}
                                                onClick={() => setActiveProviderIndex(i)}
                                                className={`provider-item ${activeProviderIndex === i ? 'active' : ''}`}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{p.name}</span>
                                                        {p.is_active && <CheckCircle size={14} color="#10b981" />}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{p.chat_model}</div>
                                                </div>
                                                {activeProviderIndex === i && i > 2 && ( // Only allow delete custom ones (0-2 are DeepSeek, Gemini, OpenAI)
                                                    <Trash2 size={14} color="#ef4444" onClick={(e) => { e.stopPropagation(); deleteProvider(i); }} style={{ cursor: 'pointer' }} />
                                                )}
                                            </div>
                                        ))}
                                        <button className="add-provider-btn" onClick={addProvider}>
                                            <Plus size={16} /> {t('admin.add_custom_provider')}
                                        </button>

                                        <div className="divider" />
                                    </div>

                                    {/* RIGHT: Selected Provider Detail */}
                                    <div style={{ flex: 1, padding: 32 }}>
                                        {currentP ? (
                                            <div className="fade-in">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                                                    <h3 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <Bot size={24} color="#FFD700" />
                                                        <input
                                                            className="edit-name-input"
                                                            value={currentP.name}
                                                            onChange={(e) => updateProviderField(activeProviderIndex, 'name', e.target.value)}
                                                        />
                                                    </h3>
                                                    <button
                                                        className={`active-toggle-btn ${currentP.is_active ? 'active' : ''}`}
                                                        onClick={() => setProviderActive(activeProviderIndex)}
                                                    >
                                                        {currentP.is_active ? t('admin.currently_active') : t('admin.set_as_active')}
                                                    </button>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                                        <div className="setting-field">
                                                            <label>{t('admin.api_key')}</label>
                                                            <div style={{ position: 'relative' }}>
                                                                <input
                                                                    type={showApiKey ? "text" : "password"}
                                                                    className="text-input"
                                                                    value={currentP.api_key || ''}
                                                                    placeholder={t('admin.enter_api_key')}
                                                                    onChange={e => updateProviderField(activeProviderIndex, 'api_key', e.target.value)}
                                                                />
                                                                <div
                                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                                    style={{ position: 'absolute', right: 12, top: 10, cursor: 'pointer', opacity: 0.5 }}
                                                                >
                                                                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="setting-field">
                                                            <label>{t('admin.api_base_url')}</label>
                                                            <input
                                                                type="text"
                                                                className="text-input"
                                                                value={currentP.base_url}
                                                                onChange={e => updateProviderField(activeProviderIndex, 'base_url', e.target.value)}
                                                            />
                                                        </div>

                                                        <div className="setting-card" style={{ padding: '12px 16px' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <div className="setting-label">{t('admin.allow_web_search')}</div>
                                                                <div className="setting-desc">{t('admin.allow_web_search_desc')}</div>
                                                            </div>
                                                            <Switch checked={currentP.allow_search} onChange={v => updateProviderField(activeProviderIndex, 'allow_search', v)} />
                                                        </div>

                                                        <div style={{ border: '1px solid rgba(var(--accent-rgb),0.1)', background: 'rgba(var(--accent-rgb),0.02)', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                            <div className="setting-field">
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                                    <label style={{ margin: 0 }}>{t('admin.temperature')}</label>
                                                                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-blue)', fontWeight: 600 }}>{currentP.temperature?.toFixed(1) || '0.7'}</span>
                                                                </div>
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="1.5"
                                                                    step="0.1"
                                                                    value={currentP.temperature ?? 0.7}
                                                                    onChange={e => updateProviderField(activeProviderIndex, 'temperature', parseFloat(e.target.value))}
                                                                    style={{ width: '100%', accentColor: 'var(--accent-blue)' }}
                                                                />
                                                            </div>

                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                                                <div className="setting-field">
                                                                    <label>{t('admin.max_tokens')}</label>
                                                                    <input
                                                                        type="number"
                                                                        className="text-input"
                                                                        value={currentP.max_tokens ?? 4096}
                                                                        onChange={e => updateProviderField(activeProviderIndex, 'max_tokens', parseInt(e.target.value))}
                                                                    />
                                                                </div>
                                                                <div className="setting-field">
                                                                    <label>{t('admin.top_p')}</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.1"
                                                                        min="0"
                                                                        max="1"
                                                                        className="text-input"
                                                                        value={currentP.top_p ?? 1.0}
                                                                        onChange={e => updateProviderField(activeProviderIndex, 'top_p', parseFloat(e.target.value))}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                                        <h4 style={{ color: 'var(--accent-blue)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.model_routing')}</h4>

                                                        <ModelSelect label={t('admin.chat_model')} field="chat_model" current={currentP.chat_model} />
                                                        <ModelSelect label={t('admin.reasoning_model')} field="reasoner_model" current={currentP.reasoner_model} />
                                                        <ModelSelect label={t('admin.vision_model')} field="vision_model" current={currentP.vision_model} />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                                                {t('admin.select_provider')}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* === AI SCENARIOS PROMPTS TAB === */}
                                <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32, borderTop: '1px solid var(--glass-border)' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                            <Sparkles size={24} color="#10B981" />
                                            AI 场景提示词管理
                                        </h2>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            定制 Bokeh AI 在不同工作场景下的默认行为。您可以针对具体功能单独修改提示词，设置保存后立即生效。
                                        </p>
                                    </div>

                                    {[
                                        {
                                            key: 'ticket_parse',
                                            title: '工单智能解析 (Smart Assist)',
                                            desc: '从用户原始描述（如邮件、聊天记录）中自动提取客户、产品型号、序列号及故障信息的规则。',
                                            variables: '无内置变量，直接处理整段原始文本。',
                                            defaultPrompt: '您是 Bokeh，Kinefinity 的专业 AI 服务助手。您的任务是从原始文本中提取工单信息并返回 JSON 格式...'
                                        },
                                        {
                                            key: 'knowledge_translate',
                                            title: '知识库外文翻译 (知识库导入/优化)',
                                            isDefault: 'ai_system_prompt', // special legacy handling if needed, but not required
                                            desc: '提取并自动格式化外部文章标题和内容的规则。',
                                            variables: '{{targetLang}} 目标语言, {{articleTitle}} 文章原文标题',
                                            defaultPrompt: '将以下内容翻译为 {{targetLang}}，保留所有的 HTML 结构和 Markdown 语法。文章的原标题是: {{articleTitle}}。保持专业、准确的技术术语翻译。'
                                        },
                                        {
                                            key: 'knowledge_layout',
                                            title: '知识库全文排版优化',
                                            desc: '在知识库导入或编辑器内应用全文优化时的指令。',
                                            variables: '{{articleTitle}} 标题, {{content}} 文章源码',
                                            defaultPrompt: '请对以下知识库文章《{{articleTitle}}》进行全文排版优化。修复错别字、改善语句通顺度，并合理使用 Markdown 或 HTML 标签。不要删减核心技术内容，确保排版美观、层次清晰。'
                                        },
                                        {
                                            key: 'knowledge_optimize',
                                            title: '知识库微调优化 (对话框局部指令)',
                                            desc: '当用户在编辑器输入像"将标题设为黄色"这样的局部调整命令时，AI 如何处理这些样式的规则。',
                                            variables: '{{articleTitle}} 标题, {{instruction}} 用户指令, {{content}} 选段源码, {{styleGuide}} 内置颜色排版指南, {{sizeGuide}} 内置尺寸排版指南',
                                            defaultPrompt: '您正在编辑文章《{{articleTitle}}》。用户的指令是：“{{instruction}}”。\n请根据以下选段源码：\n{{content}}\n\n并参考内建的排版指南：\n颜色体系：{{styleGuide}}\n尺寸规范：{{sizeGuide}}\n只返回修改后的代码，不包含任何多余解释。'
                                        },
                                        {
                                            key: 'knowledge_summary',
                                            title: '知识库全段自动摘要',
                                            desc: '使用 AI 为知识文章生成280字简短概述的规则。',
                                            variables: '{{articleTitle}} 文章标题, {{content}} 文章纯文本',
                                            defaultPrompt: '请为文章《{{articleTitle}}》撰写一段不超过280字的中文摘要。要求：客观、准确总结核心论点，不使用冗余前缀，直接输出摘要内容。'
                                        },
                                        {
                                            key: 'ticket_summary',
                                            title: '历史工单搜索总结',
                                            desc: '根据所有匹配的历史工单，对用户的搜索提问进行归纳回答的规则。',
                                            variables: '{{query}} 用户搜索词, {{context}} 相关工单列表',
                                            defaultPrompt: '用户问：“{{query}}”。\n根据以下历史工单内容进行分析并回答：\n{{context}}\n如果工单内容中未提及，请明确说明无法获取信息，切勿捏造。'
                                        }
                                    ].map(scenario => {
                                        // Extract current value safely
                                        let currentVal = '';
                                        if (scenario.key === 'ai_system_prompt') {
                                            currentVal = settings.ai_system_prompt || '';
                                        } else {
                                            currentVal = settings.ai_prompts?.[scenario.key] || '';
                                        }

                                        return (
                                            <div key={scenario.key} style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 24 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                                    <div>
                                                        <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-blue)', marginBottom: 4 }}>{scenario.title}</h3>
                                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{scenario.desc}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (scenario.key === 'ai_system_prompt') {
                                                                setSettings({ ...settings, ai_system_prompt: '' });
                                                            } else {
                                                                const newPrompts = { ...settings.ai_prompts };
                                                                delete newPrompts[scenario.key];
                                                                setSettings({ ...settings, ai_prompts: newPrompts });
                                                            }
                                                        }}
                                                        style={{
                                                            background: 'transparent',
                                                            border: '1px solid var(--glass-border)',
                                                            color: 'var(--text-secondary)',
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            fontSize: '0.8rem',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-secondary)' }}
                                                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                                                        title="清空后将自动使用后台内置规则"
                                                    >
                                                        恢复系统默认
                                                    </button>
                                                </div>
                                                <div style={{ marginBottom: 12 }}>
                                                    <div style={{ fontSize: '0.8rem', color: '#10B981', marginBottom: 8, fontFamily: 'monospace' }}>可用变量: {scenario.variables}</div>
                                                    <textarea
                                                        value={currentVal}
                                                        onChange={e => {
                                                            if (scenario.key === 'ai_system_prompt') {
                                                                setSettings({ ...settings, ai_system_prompt: e.target.value });
                                                            } else {
                                                                setSettings({
                                                                    ...settings,
                                                                    ai_prompts: {
                                                                        ...(settings.ai_prompts || {}),
                                                                        [scenario.key]: e.target.value
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                        placeholder={scenario.defaultPrompt || "保持为空将使用系统默认提示词..."}
                                                        style={{
                                                            width: '100%',
                                                            minHeight: 120,
                                                            background: 'var(--glass-bg-light)',
                                                            border: '1px solid var(--glass-border)',
                                                            borderRadius: 8,
                                                            padding: 16,
                                                            color: 'var(--text-main)',
                                                            fontSize: '0.9rem',
                                                            lineHeight: 1.6,
                                                            resize: 'vertical',
                                                            fontFamily: 'monospace'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* General Assistant Prompt (from existing string) */}
                                    <div style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: 24 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                            <div>
                                                <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-blue)', marginBottom: 4 }}>全局聊天助手规范 (General Chat Rules)</h3>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>此系统提示词将在全局提问、文章问答等无特定格式要求的场景下生效。</p>
                                            </div>
                                            <button
                                                onClick={() => setSettings({ ...settings, ai_system_prompt: '' })}
                                                style={{
                                                    background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)',
                                                    padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.borderColor = 'var(--text-secondary)' }}
                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
                                            >
                                                恢复系统默认
                                            </button>
                                        </div>
                                        <div style={{ marginBottom: 12 }}>
                                            <textarea
                                                value={settings.ai_system_prompt || ''}
                                                onChange={e => setSettings({ ...settings, ai_system_prompt: e.target.value })}
                                                placeholder="保持为空将使用系统内置的客服/技术辅助对话身份..."
                                                style={{
                                                    width: '100%', minHeight: 120, background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                                                    borderRadius: 8, padding: 16, color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: 1.6, resize: 'vertical', fontFamily: 'monospace'
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* === BACKUP TAB === */}
                        {activeTab === 'backup' && settings && (
                            <div style={{ padding: 32 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
                                    {/* Primary Backup Column - Settings + Dashboard */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                        {/* Primary Backup Settings */}
                                        <div style={{
                                            background: 'rgba(16, 185, 129, 0.08)',
                                            padding: '16px 20px',
                                            borderRadius: 12,
                                            border: '1px solid rgba(16, 185, 129, 0.25)',
                                            marginBottom: 8
                                        }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10B981', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Database size={18} />
                                                主备份 (Primary)
                                            </h3>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                                存储于 fileserver SSD，用于日常快速恢复
                                            </div>
                                        </div>

                                        <div className="setting-card" style={{ minHeight: '72px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div className="setting-label">启用主备份</div>
                                                <div className="setting-desc">自动备份到 fileserver SSD</div>
                                            </div>
                                            <Switch checked={settings.backup_enabled} onChange={v => setSettings({ ...settings, backup_enabled: v })} activeColor="#10B981" />
                                        </div>

                                        <div className="setting-field">
                                            <label>备份频率 (小时)</label>
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="text-input"
                                                    value={Math.floor(settings.backup_frequency / 60)}
                                                    onChange={e => setSettings({ ...settings, backup_frequency: (parseInt(e.target.value) || 1) * 60 })}
                                                    min={1}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                                {[1, 3, 6, 12, 24].map(hours => (
                                                    <button
                                                        key={hours}
                                                        onClick={() => setSettings({ ...settings, backup_frequency: hours * 60 })}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: 8,
                                                            border: '1px solid var(--glass-border)',
                                                            background: settings.backup_frequency === hours * 60 ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                            color: settings.backup_frequency === hours * 60 ? '#10B981' : 'var(--text-secondary)',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {hours}h
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="setting-field">
                                            <label>保留策略 (天数)</label>
                                            <input
                                                type="number"
                                                className="text-input"
                                                value={settings.backup_retention_days}
                                                onChange={e => setSettings({ ...settings, backup_retention_days: parseInt(e.target.value) || 7 })}
                                            />
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
                                                超过此时间的旧备份文件将被自动清理。
                                            </div>
                                        </div>

                                        {/* Primary Backup Dashboard Card */}
                                        {backupStatus && (
                                            <div
                                                onClick={() => setRestoreModal({ isOpen: true, type: 'primary', selectedBackup: null })}
                                                style={{
                                                    background: 'rgba(16, 185, 129, 0.05)',
                                                    padding: 28,
                                                    borderRadius: 20,
                                                    border: '1px solid rgba(16, 185, 129, 0.15)',
                                                    backdropFilter: 'blur(10px)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    marginTop: 'auto'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                                                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.25)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)';
                                                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.15)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#10B981' }}>
                                                    <Database size={22} />
                                                    主备份状态
                                                </h3>

                                                {/* Stats Grid */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>备份总数</div>
                                                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#10B981' }}>{backupStatus.primary.backups.length}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>总空间</div>
                                                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                            {(backupStatus.primary.backups.reduce((acc, b) => acc + b.size, 0) / 1024 / 1024).toFixed(1)} MB
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>最近备份</div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                                                            {backupStatus.primary.backups[0]
                                                                ? new Date(backupStatus.primary.backups[0].created_at).toLocaleDateString('zh-CN')
                                                                : '无'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>自动备份</div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: backupStatus.primary.enabled ? '#10B981' : '#EF4444' }}>
                                                            {backupStatus.primary.enabled ? '已启用' : '已禁用'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleManualBackup();
                                                    }}
                                                    disabled={backingUpPrimary}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px',
                                                        borderRadius: 12,
                                                        background: 'transparent',
                                                        color: '#10B981',
                                                        border: '1px solid rgba(16, 185, 129, 0.4)',
                                                        fontWeight: 600,
                                                        fontSize: '0.9rem',
                                                        cursor: backingUpPrimary ? 'wait' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!backingUpPrimary) {
                                                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                                                            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.7)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!backingUpPrimary) {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                                                        }
                                                    }}
                                                >
                                                    {backingUpPrimary ? <RefreshCcw className="animate-spin" size={16} /> : <Save size={16} />}
                                                    {backingUpPrimary ? '备份中...' : '立即主备份'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Secondary Backup Column - Settings + Dashboard */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                        {/* Secondary Backup Settings */}
                                        <div style={{
                                            background: 'var(--glass-bg-light)',
                                            padding: '16px 20px',
                                            borderRadius: 12,
                                            border: '1px solid var(--glass-border)',
                                            marginBottom: 8
                                        }}>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Database size={18} />
                                                次级备份 (Secondary)
                                            </h3>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                                                存储于系统盘，用于 fileserver 故障时恢复
                                            </div>
                                        </div>

                                        <div className="setting-card" style={{ minHeight: '72px' }}>
                                            <div style={{ flex: 1 }}>
                                                <div className="setting-label">启用次级备份</div>
                                                <div className="setting-desc">自动备份到系统本地磁盘</div>
                                            </div>
                                            <Switch checked={settings.secondary_backup_enabled} onChange={v => setSettings({ ...settings, secondary_backup_enabled: v })} activeColor="#FFFFFF" />
                                        </div>

                                        <div className="setting-field">
                                            <label>备份频率 (小时)</label>
                                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <input
                                                    type="number"
                                                    className="text-input"
                                                    value={Math.floor(settings.secondary_backup_frequency / 60)}
                                                    onChange={e => setSettings({ ...settings, secondary_backup_frequency: (parseInt(e.target.value) || 1) * 60 })}
                                                    min={1}
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                                                {[3, 6, 12, 24, 72, 168].map(hours => (
                                                    <button
                                                        key={hours}
                                                        onClick={() => setSettings({ ...settings, secondary_backup_frequency: hours * 60 })}
                                                        style={{
                                                            padding: '6px 12px',
                                                            borderRadius: 8,
                                                            border: '1px solid var(--glass-border)',
                                                            background: settings.secondary_backup_frequency === hours * 60 ? 'var(--glass-bg-hover)' : 'transparent',
                                                            color: settings.secondary_backup_frequency === hours * 60 ? 'var(--text-main)' : 'var(--text-secondary)',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {hours >= 24 ? `${hours / 24}d` : `${hours}h`}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="setting-field">
                                            <label>保留策略 (天数)</label>
                                            <input
                                                type="number"
                                                className="text-input"
                                                value={settings.secondary_backup_retention_days}
                                                onChange={e => setSettings({ ...settings, secondary_backup_retention_days: parseInt(e.target.value) || 30 })}
                                            />
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
                                                建议设置比主备份更长的保留期。
                                            </div>
                                        </div>

                                        {/* Secondary Backup Dashboard Card */}
                                        {backupStatus && (
                                            <div
                                                onClick={() => setRestoreModal({ isOpen: true, type: 'secondary', selectedBackup: null })}
                                                style={{
                                                    background: 'var(--glass-bg-light)',
                                                    padding: 28,
                                                    borderRadius: 20,
                                                    border: '1px solid var(--glass-border)',
                                                    backdropFilter: 'blur(10px)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    marginTop: 'auto'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                                    e.currentTarget.style.borderColor = 'var(--glass-bg-hover)';
                                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'var(--glass-bg-light)';
                                                    e.currentTarget.style.borderColor = 'var(--glass-bg-hover)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-main)' }}>
                                                    <Database size={22} />
                                                    次级备份状态
                                                </h3>

                                                {/* Stats Grid */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>备份总数</div>
                                                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>{backupStatus.secondary.backups.length}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>总空间</div>
                                                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                                            {(backupStatus.secondary.backups.reduce((acc, b) => acc + b.size, 0) / 1024 / 1024).toFixed(1)} MB
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>最近备份</div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-main)' }}>
                                                            {backupStatus.secondary.backups[0]
                                                                ? new Date(backupStatus.secondary.backups[0].created_at).toLocaleDateString('zh-CN')
                                                                : '无'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 4 }}>自动备份</div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: backupStatus.secondary.enabled ? '#10B981' : '#EF4444' }}>
                                                            {backupStatus.secondary.enabled ? '已启用' : '已禁用'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleBackupWithConfirm('secondary');
                                                    }}
                                                    disabled={backingUpSecondary}
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px',
                                                        borderRadius: 12,
                                                        background: 'transparent',
                                                        color: 'var(--text-main)',
                                                        border: '1px solid rgba(255, 255, 255, 0.4)',
                                                        fontWeight: 600,
                                                        fontSize: '0.9rem',
                                                        cursor: backingUpSecondary ? 'wait' : 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (!backingUpSecondary) {
                                                            e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                                            e.currentTarget.style.borderColor = 'var(--text-secondary)';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (!backingUpSecondary) {
                                                            e.currentTarget.style.background = 'transparent';
                                                            e.currentTarget.style.borderColor = 'var(--text-tertiary)';
                                                        }
                                                    }}
                                                >
                                                    {backingUpSecondary ? <RefreshCcw className="animate-spin" size={16} /> : <Save size={16} />}
                                                    {backingUpSecondary ? '备份中...' : '立即次级备份'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Backup Info - Simplified */}
                                    <div style={{ padding: '20px 0', borderTop: '1px solid var(--glass-border)', gridColumn: '1 / -1' }}>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>
                                            备份机制说明
                                        </h4>
                                        <ul style={{ paddingLeft: 0, listStyle: 'none', fontSize: '0.85rem', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <li>• 使用 SQLite Online Backup API，支持运行中热备份，无须停机</li>
                                            <li>• 主备份存储于 fileserver SSD，次级备份存储于系统盘</li>
                                            <li>• 建议开启自动备份，主备份保留 7 天，次级备份保留 30 天</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* === GENERAL TAB === */}
                        {activeTab === 'general' && settings && (
                            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* 界面设置 */}
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>{t('admin.ui_settings')}</div>

                                    <div className="setting-card" style={{ minHeight: '72px', marginBottom: 16 }}>
                                        <div style={{ flex: 1 }}>
                                            <div className="setting-label">颜色主题 (外观)</div>
                                            <div className="setting-desc">切换系统的深浅色模式或跟随系统。该设置仅在当前浏览器生效。</div>
                                        </div>
                                        <div style={{ display: 'flex', background: 'var(--glass-bg-light)', padding: 4, borderRadius: 12, border: '1px solid var(--glass-border)' }}>
                                            {[
                                                { id: 'light', icon: Sun, label: '浅色' },
                                                { id: 'dark', icon: Moon, label: '深色' },
                                                { id: 'system', icon: Monitor, label: '跟随系统' }
                                            ].map(mode => (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => setTheme(mode.id as 'light' | 'dark' | 'system')}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                        padding: '6px 16px', borderRadius: 8, border: 'none',
                                                        background: theme === mode.id ? 'var(--accent-blue)' : 'transparent',
                                                        color: theme === mode.id ? 'var(--bg-main)' : 'var(--text-secondary)',
                                                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s'
                                                    }}
                                                >
                                                    <mode.icon size={16} />
                                                    {mode.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="setting-card" style={{ minHeight: '72px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div className="setting-label">{t('admin.show_daily_word')}</div>
                                            <div className="setting-desc">{t('admin.show_daily_word_desc')}</div>
                                        </div>
                                        <Switch
                                            checked={settings.show_daily_word || false}
                                            onChange={v => {
                                                setSettings({ ...settings, show_daily_word: v });
                                            }}
                                        />
                                    </div>

                                    <div style={{ height: '1px', background: 'var(--glass-bg-hover)', marginTop: 24, marginBottom: 24 }} />

                                    {/* 智能助手核心控制 */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 12 }}>智能助手核心控制</div>

                                    {/* AI Enabled Wrapper */}
                                    <div style={{ background: 'var(--glass-bg-light)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden', marginBottom: 16 }}>
                                        <div className="setting-card" style={{ border: 'none', borderRadius: 0, padding: '16px 20px', minHeight: 'auto' }}>
                                            <div style={{ flex: 1 }}>
                                                <div className="setting-label">Bokeh智能 启用</div>
                                            </div>
                                            <Switch checked={settings.ai_enabled} onChange={v => setSettings({ ...settings, ai_enabled: v })} activeColor="#10B981" />
                                        </div>
                                        <div style={{ background: 'var(--glass-bg-light)', padding: '12px 20px', fontSize: '0.8rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--glass-border)', lineHeight: 1.5 }}>
                                            启用后，整个协作平台内的智能问答、工单总结、场景写作等 AI 相关功能将被激活。关闭则隐藏所有 AI 入口。
                                        </div>
                                    </div>

                                    {/* Data Sources Wrapper */}
                                    <div style={{ background: 'var(--glass-bg-light)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden', marginBottom: 16 }}>
                                        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div className="setting-label">Bokeh 感知范围</div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 20 }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.ai_data_sources?.includes('tickets') ?? true}
                                                        onChange={(e) => {
                                                            const sources = settings.ai_data_sources || [];
                                                            if (e.target.checked) setSettings({ ...settings, ai_data_sources: [...sources, 'tickets'] });
                                                            else setSettings({ ...settings, ai_data_sources: sources.filter(s => s !== 'tickets') });
                                                        }}
                                                    />
                                                    工单历史
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={settings.ai_data_sources?.includes('knowledge') ?? true}
                                                        onChange={(e) => {
                                                            const sources = settings.ai_data_sources || [];
                                                            if (e.target.checked) setSettings({ ...settings, ai_data_sources: [...sources, 'knowledge'] });
                                                            else setSettings({ ...settings, ai_data_sources: sources.filter(s => s !== 'knowledge') });
                                                        }}
                                                    />
                                                    Kinefinity 知识库
                                                </label>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'not-allowed', fontSize: '0.9rem', color: 'var(--text-tertiary)', opacity: 0.5 }}>
                                                    <input type="checkbox" disabled />
                                                    实时网络搜索 (待开放)
                                                </label>
                                            </div>
                                        </div>
                                        <div style={{ background: 'var(--glass-bg-light)', padding: '12px 20px', fontSize: '0.8rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--glass-border)', lineHeight: 1.5 }}>
                                            决定 Bokeh 智能助手可访问和检索的数据池。建议全选以保证 AI 能给出准确的公司上下文。
                                        </div>
                                    </div>

                                    {/* History Limit Wrapper */}
                                    <div style={{ background: 'var(--glass-bg-light)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden', marginBottom: 16 }}>
                                        <div className="setting-card" style={{ border: 'none', borderRadius: 0, padding: '16px 20px', minHeight: 'auto' }}>
                                            <div style={{ flex: 1 }}>
                                                <div className="setting-label">知识中心搜索历史条数</div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <input
                                                    type="number"
                                                    min={1} max={30}
                                                    value={settings.ai_search_history_limit || 10}
                                                    onChange={e => setSettings({ ...settings, ai_search_history_limit: Math.max(1, Math.min(30, parseInt(e.target.value) || 10)) })}
                                                    style={{ width: '60px', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg-light)', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ background: 'var(--glass-bg-light)', padding: '12px 20px', fontSize: '0.8rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--glass-border)', lineHeight: 1.5 }}>
                                            控制所有员工的全局搜索历史保留的数量 (最大 30 条)。保留过多的历史虽然方便但是可能降低终端设备加载性能。
                                        </div>
                                    </div>

                                    {/* Global AI Work Mode Wrapper */}
                                    <div style={{ background: 'var(--glass-bg-light)', borderRadius: 12, border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                                        <div className="setting-card" style={{ border: 'none', borderRadius: 0, padding: '16px 20px', minHeight: 'auto' }}>
                                            <div style={{ flex: 1 }}>
                                                <div className="setting-label">工作模式 (全局策略)</div>
                                            </div>
                                            <Switch checked={settings.ai_work_mode ?? true} onChange={v => setSettings({ ...settings, ai_work_mode: v })} activeColor="#10B981" />
                                        </div>
                                        <div style={{ background: 'var(--glass-bg-light)', padding: '12px 20px', fontSize: '0.8rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--glass-border)', lineHeight: 1.5 }}>
                                            开启后，Bokeh 智能助手将进入专业协作状态。它将优先调取知识库和工单历史进行回答，且回复风格更加严谨、聚焦技术支持。
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}



                        {/* === MODALS === */}
                        {backupResult && (
                            <BackupResultModal
                                result={backupResult}
                                onClose={() => setBackupResult(null)}
                            />
                        )}

                        {/* Confirm Dialog */}
                        {confirmDialog.isOpen && (
                            <div
                                onClick={() => closeConfirm(false)}
                                style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(12px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001,
                                    animation: 'fadeIn 0.2s ease'
                                }}
                            >
                                <div
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        background: 'rgba(30, 30, 30, 0.95)',
                                        border: confirmDialog.isDanger ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(var(--accent-rgb), 0.2)',
                                        width: '90%', maxWidth: '420px',
                                        borderRadius: '20px',
                                        padding: '0',
                                        boxShadow: confirmDialog.isDanger
                                            ? '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(239, 68, 68, 0.1)'
                                            : '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(var(--accent-rgb), 0.1)',
                                        animation: 'scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{
                                        padding: '24px 28px 20px',
                                        borderBottom: '1px solid var(--glass-border)',
                                        display: 'flex', alignItems: 'center', gap: '16px'
                                    }}>
                                        <div style={{
                                            background: confirmDialog.isDanger
                                                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.1))'
                                                : 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.15), rgba(255, 180, 0, 0.1))',
                                            padding: '12px', borderRadius: '14px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            boxShadow: confirmDialog.isDanger
                                                ? '0 4px 12px rgba(239, 68, 68, 0.1)'
                                                : '0 4px 12px rgba(var(--accent-rgb), 0.1)'
                                        }}>
                                            {confirmDialog.isDanger
                                                ? <AlertTriangle size={24} color="#EF4444" strokeWidth={2} />
                                                : <Database size={24} color="#FFD700" strokeWidth={2} />
                                            }
                                        </div>
                                        <h3 style={{
                                            margin: 0, fontSize: '18px', fontWeight: 600,
                                            color: 'var(--text-main)', letterSpacing: '-0.3px'
                                        }}>
                                            {confirmDialog.title.replace(/^⚠️\s*/, '')}
                                        </h3>
                                    </div>

                                    {/* Message */}
                                    <div style={{ padding: '20px 28px 24px' }}>
                                        <p style={{
                                            margin: 0, color: 'var(--text-secondary)',
                                            lineHeight: 1.6, fontSize: '15px', whiteSpace: 'pre-line'
                                        }}>
                                            {confirmDialog.message.replace(/⚠️\s*/g, '')}
                                        </p>
                                    </div>

                                    {/* Buttons */}
                                    <div style={{
                                        display: 'flex', gap: '12px',
                                        padding: '0 28px 24px', justifyContent: 'flex-end'
                                    }}>
                                        <button
                                            onClick={() => closeConfirm(false)}
                                            style={{
                                                padding: '12px 24px',
                                                background: 'var(--glass-bg-hover)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '12px',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer', fontSize: '15px', fontWeight: 500,
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                minWidth: '90px'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                                e.currentTarget.style.borderColor = 'var(--glass-bg-hover)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                                e.currentTarget.style.borderColor = 'var(--glass-bg-hover)';
                                            }}
                                        >
                                            {confirmDialog.cancelLabel || '取消'}
                                        </button>
                                        <button
                                            onClick={() => closeConfirm(true)}
                                            style={{
                                                padding: '12px 24px',
                                                background: confirmDialog.isDanger
                                                    ? 'linear-gradient(135deg, #EF4444, #DC2626)'
                                                    : 'linear-gradient(135deg, #FFD700, #FFC000)',
                                                border: 'none', borderRadius: '12px',
                                                color: confirmDialog.isDanger ? 'var(--text-main)' : 'var(--bg-main)',
                                                cursor: 'pointer', fontSize: '15px', fontWeight: 600,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                minWidth: '90px',
                                                boxShadow: confirmDialog.isDanger
                                                    ? '0 4px 15px rgba(239, 68, 68, 0.3)'
                                                    : '0 4px 15px rgba(var(--accent-rgb), 0.3)'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                e.currentTarget.style.boxShadow = confirmDialog.isDanger
                                                    ? '0 6px 20px rgba(239, 68, 68, 0.4)'
                                                    : '0 6px 20px rgba(var(--accent-rgb), 0.4)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.transform = 'translateY(0)';
                                                e.currentTarget.style.boxShadow = confirmDialog.isDanger
                                                    ? '0 4px 15px rgba(239, 68, 68, 0.3)'
                                                    : '0 4px 15px rgba(var(--accent-rgb), 0.3)';
                                            }}
                                        >
                                            <CheckCircle size={16} strokeWidth={2.5} />
                                            {confirmDialog.confirmLabel || '确认'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Restore Modal */}
                        {restoreModal.isOpen && backupStatus && (
                            <div
                                onClick={() => setRestoreModal({ isOpen: false, type: 'primary', selectedBackup: null })}
                                style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(20px)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000,
                                    animation: 'fadeIn 0.2s ease'
                                }}
                            >
                                <div
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        background: 'rgba(28, 28, 30, 0.98)',
                                        border: '1px solid var(--glass-border)',
                                        width: '90%', maxWidth: '600px', maxHeight: '80vh',
                                        borderRadius: '24px',
                                        padding: '0',
                                        boxShadow: '0 32px 96px rgba(0, 0, 0, 0.6)',
                                        animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                        overflow: 'hidden',
                                        display: 'flex', flexDirection: 'column'
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{
                                        padding: '28px 32px 24px',
                                        borderBottom: '1px solid var(--glass-border)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{
                                                background: restoreModal.type === 'primary'
                                                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.1))'
                                                    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                                                padding: '12px', borderRadius: '14px',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}>
                                                <Database size={24} color={restoreModal.type === 'primary' ? '#10B981' : 'var(--text-main)'} strokeWidth={2} />
                                            </div>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-main)' }}>
                                                    {restoreModal.type === 'primary' ? '主备份恢复' : '次级备份恢复'}
                                                </h3>
                                                <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
                                                    选择一个备份文件进行恢复
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setRestoreModal({ isOpen: false, type: 'primary', selectedBackup: null })}
                                            style={{
                                                background: 'transparent', border: 'none', color: 'var(--text-secondary)',
                                                cursor: 'pointer', padding: '8px', borderRadius: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                                        >
                                            <X size={24} />
                                        </button>
                                    </div>

                                    {/* Backup List */}
                                    <div style={{ padding: '24px 32px', overflowY: 'auto', maxHeight: '400px' }}>
                                        {(restoreModal.type === 'primary' ? backupStatus.primary.backups : backupStatus.secondary.backups).length === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
                                                <Database size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                                                <p>暂无备份文件</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                {(restoreModal.type === 'primary' ? backupStatus.primary.backups : backupStatus.secondary.backups).map((backup, index) => (
                                                    <div
                                                        key={backup.name}
                                                        onClick={() => {
                                                            showConfirm(
                                                                '危险操作：恢复数据库',
                                                                `您确定要恢复此备份吗？\n\n备份文件：${backup.name}\n备份时间：${new Date(backup.created_at).toLocaleString('zh-CN')}\n文件大小：${(backup.size / 1024 / 1024).toFixed(1)} MB\n\n警告：这将覆盖当前数据库，所有现有数据将被替换。建议在恢复前执行一次手动备份。`,
                                                                () => {
                                                                    console.log('Restoring from:', backup.path);
                                                                    setBackupResult({
                                                                        success: true,
                                                                        message: '恢复功能开发中，请联系管理员手动恢复。'
                                                                    });
                                                                    setRestoreModal({ isOpen: false, type: 'primary', selectedBackup: null });
                                                                },
                                                                { confirmLabel: '确认恢复', cancelLabel: '取消', isDanger: true }
                                                            );
                                                        }}
                                                        style={{
                                                            background: 'var(--glass-bg-light)',
                                                            border: '1px solid var(--glass-border)',
                                                            borderRadius: '16px',
                                                            padding: '20px',
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                                            e.currentTarget.style.borderColor = restoreModal.type === 'primary' ? 'rgba(16, 185, 129, 0.3)' : 'var(--glass-bg-hover)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.background = 'var(--glass-bg-light)';
                                                            e.currentTarget.style.borderColor = 'var(--glass-bg-hover)';
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                                            <div style={{
                                                                width: 40, height: 40, borderRadius: 10,
                                                                background: restoreModal.type === 'primary' ? 'rgba(16, 185, 129, 0.1)' : 'var(--glass-bg-hover)',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                            }}>
                                                                <Database size={20} color={restoreModal.type === 'primary' ? '#10B981' : 'var(--text-main)'} />
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                                                                    {index === 0 ? '最新备份' : `备份 #${index + 1}`}
                                                                </div>
                                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                                    {new Date(backup.created_at).toLocaleString('zh-CN')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: 4 }}>
                                                                {(backup.size / 1024 / 1024).toFixed(1)} MB
                                                            </div>
                                                            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                                                点击恢复
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div style={{
                                        padding: '20px 32px 28px',
                                        borderTop: '1px solid var(--glass-border)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <div style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
                                            共 {(restoreModal.type === 'primary' ? backupStatus.primary.backups : backupStatus.secondary.backups).length} 个备份文件
                                        </div>
                                        <button
                                            onClick={() => setRestoreModal({ isOpen: false, type: 'primary', selectedBackup: null })}
                                            style={{
                                                padding: '12px 24px',
                                                background: 'var(--glass-bg-hover)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '12px',
                                                color: 'var(--text-secondary)',
                                                cursor: 'pointer', fontSize: '14px', fontWeight: 500,
                                                transition: 'all 0.2s'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                                e.currentTarget.style.color = 'var(--text-main)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'var(--glass-bg-hover)';
                                                e.currentTarget.style.color = 'var(--text-secondary)';
                                            }}
                                        >
                                            关闭
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
            {/* Prompt Editor Modal */}
            <PromptEditorModal
                isOpen={showPromptModal}
                currentPrompt={settings?.ai_system_prompt || ''}
                onClose={() => setShowPromptModal(false)}
                onSave={(prompt) => {
                    setSettings({ ...settings!, ai_system_prompt: prompt });
                    setShowPromptModal(false);
                }}
            />

            <style>{`
                .provider-item {
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    border-radius: 10px;
                    cursor: pointer;
                    background: transparent;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                .provider-item:hover {
                    background: rgba(255,255,255,0.05);
                }
                .provider-item.active {
                    background: rgba(var(--accent-rgb),0.1);
                    border-color: rgba(var(--accent-rgb),0.3);
                }
                .add-provider-btn {
                    margin-top: 12px;
                    padding: 10px;
                    background: rgba(255,255,255,0.05);
                    border: 1px dashed rgba(255,255,255,0.2);
                    color: white;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    cursor: pointer;
                }
                .add-provider-btn:hover { background: rgba(255,255,255,0.1); }
                
                .edit-name-input {
                    background: transparent;
                    border: 1px solid transparent;
                    color: white;
                    font-size: 1.4rem;
                    font-weight: 600;
                    padding: 4px 8px;
                    border-radius: 6px;
                    width: auto;
                    outline: none;
                }
                .edit-name-input:focus {
                    background: rgba(255,255,255,0.05);
                    border-color: rgba(255,255,255,0.2);
                }

                .active-toggle-btn {
                    padding: 8px 16px;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid var(--glass-border);
                    color: rgba(255,255,255,0.6);
                }
                .active-toggle-btn.active {
                    background: #FFD700;
                    color: black;
                    border-color: #FFD700;
                    font-weight: 700;
                }

                .setting-card { 
                    display: flex; 
                    align-items: center; 
                    background: rgba(255,255,255,0.02); 
                    border: 1px solid var(--glass-border); 
                    padding: 20px; 
                    border-radius: 16px; 
                    backdrop-filter: blur(10px);
                }
                .setting-card-mini { display: flex; align-items: center; justify-content: space-between; padding: 8px; opacity: 0.7; }
                .setting-label { font-weight: 600; color: white; margin-bottom: 2px; }
                .setting-desc { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
                .setting-field { margin-bottom: 12px; }
                .setting-field label { display: block; font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-bottom: 8px; }
                .text-input { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); color: white; padding: 12px; border-radius: 10px; font-size: 0.95rem; outline: none; transition: border 0.2s; }
                .text-input:focus { border-color: #FFD700; }
                .divider { height: 1px; background: rgba(255,255,255,0.1); margin: 16px 0; }
            `}</style>
        </div >
    );
};

const Switch: React.FC<{ checked: boolean, onChange: (v: boolean) => void, activeColor?: string }> = ({ checked, onChange, activeColor = 'var(--accent-blue)' }) => (
    <div onClick={() => onChange(!checked)} style={{ width: 44, height: 24, background: checked ? activeColor : 'var(--glass-bg-hover)', borderRadius: 12, position: 'relative', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div style={{ width: 20, height: 20, background: checked ? 'black' : 'var(--text-main)', borderRadius: '50%', position: 'absolute', top: 2, left: checked ? 22 : 2, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
    </div>
);



// Prompt Editor Modal Component
interface PromptEditorModalProps {
    isOpen: boolean;
    currentPrompt: string;
    onClose: () => void;
    onSave: (prompt: string) => void;
}

const PromptEditorModal: React.FC<PromptEditorModalProps> = ({ isOpen, currentPrompt, onClose, onSave }) => {
    const [prompt, setPrompt] = useState(currentPrompt || '');

    useEffect(() => {
        setPrompt(currentPrompt || '');
    }, [currentPrompt, isOpen]);

    if (!isOpen) return null;

    const defaultPrompt = `你是 Bokeh，Kinefinity 的专业技术支持助手。
                你拥有访问 Kinefinity 服务数据库的权限。
                当前上下文：
                - 页面：{{ path }}
                - 标题：{{ title }}
                - 活跃数据源：{{ dataSources }}

                **重要规则：**
                1. **必须完全基于下方提供的知识库文章和工单数据回答**。如果提供的内容中没有相关信息，明确告知用户"根据现有知识库资料，暂未找到相关信息"。
                2. 禁止编造知识库中没有的信息，禁止依赖训练数据中的通用知识。
                3. 回答时引用知识库文章标题和链接（如"根据[MAVO Edge 6K: 1.1 端口说明](/tech-hub/wiki/mavo-edge-6k-1-1-端口说明)..."）。
                4. 如果历史工单中有相关信息，引用工单编号（如 [K2602-0001]）。
                5. 保持回答简洁、专业、有帮助。
                6. 人设："空灵、冷静、响应迅速"。提及 Kinefinity 支持时用"我们"。

                {{ context }}`;

    const handleReset = () => {
        if (confirm('确定要重置为默认提示词吗？')) {
            setPrompt('');
        }
    };

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: 720, maxHeight: '85vh',
                    background: 'rgba(28,28,30,0.98)', border: '1px solid var(--glass-border)',
                    borderRadius: 20, padding: 28,
                    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Bot size={22} color="#FFD700" />
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                            Bokeh 回答策略设置
                        </h3>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                        自定义系统提示词，控制 Bokeh 的回答风格和数据引用规则。
                        <br />支持变量：{'{{context}}'} - 检索到的知识库/工单内容, {'{{dataSources}}'} - 数据源列表, {'{{path}}'} - 当前页面路径, {'{{title}}'} - 页面标题
                    </div>
                </div>

                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={defaultPrompt}
                    style={{
                        flex: 1, minHeight: 320,
                        background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border)',
                        borderRadius: 12, padding: 16,
                        color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: 1.6,
                        fontFamily: 'monospace',
                        resize: 'none', outline: 'none'
                    }}
                />

                {!prompt && (
                    <div style={{ fontSize: '0.75rem', color: 'rgba(var(--accent-rgb),0.7)', marginTop: 8 }}>
                        留空将使用默认提示词
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleReset}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 10,
                            background: 'transparent',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        重置默认
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 10,
                            background: 'transparent',
                            border: '1px solid var(--glass-border)',
                            color: 'var(--text-main)',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={() => onSave(prompt)}
                        style={{
                            padding: '10px 24px',
                            borderRadius: 10,
                            background: 'var(--accent-blue)',
                            border: 'none',
                            color: 'black',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
};

const BackupResultModal: React.FC<{ result: { success: boolean, message: string, path?: string }, onClose: () => void }> = ({ result, onClose }) => {
    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
                animation: 'fadeIn 0.2s ease-out'
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: 480, background: 'rgba(28,28,30,0.95)', border: '1px solid var(--glass-border)',
                    borderRadius: 24, padding: 32, boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                    textAlign: 'center'
                }}
            >
                <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: result.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {result.success ? <CheckCircle size={32} color="#10b981" /> : <X size={32} color="#ef4444" />}
                    </div>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 16, color: 'var(--text-main)' }}>
                    {result.success ? '备份成功' : '操作失败'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
                    {result.message}
                </p>
                {result.path && (
                    <div style={{
                        background: 'var(--glass-bg-hover)', padding: 16, borderRadius: 12,
                        fontSize: '0.85rem', color: 'var(--accent-blue)', fontFamily: 'monospace',
                        wordBreak: 'break-all', marginBottom: 32, border: '1px solid rgba(var(--accent-rgb),0.1)'
                    }}>
                        {result.path}
                    </div>
                )}
                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '14px',
                        height: 'auto',
                        borderRadius: 12,
                        background: 'transparent',
                        border: '1px solid rgba(var(--accent-rgb), 0.4)',
                        color: 'var(--accent-blue)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb), 0.8)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb), 0.4)';
                    }}
                >
                    关闭窗口
                </button>
            </div>
        </div>
    );
};

export default AdminSettings;
