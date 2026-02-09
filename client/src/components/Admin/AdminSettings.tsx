import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, Server, Cpu, Activity, Database, Bot, RefreshCcw, Plus, Trash2, Eye, EyeOff, CheckCircle, FileText } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/useLanguage';
import KnowledgeAuditLog from '../KnowledgeAuditLog';

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
}

type AdminTab = 'general' | 'intelligence' | 'health' | 'audit';

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

const LAST_TAB_KEY = 'service_settings_last_tab';

const AdminSettings: React.FC<AdminSettingsProps> = ({ initialTab, moduleType = 'files' }) => {
    const { token } = useAuthStore();
    const navigate = useNavigate();
    const { t } = useLanguage();
    
    // 路由前缀根据模块类型
    const routePrefix = moduleType === 'service' ? '/service/admin' : '/admin';
    
    // 从 localStorage读取上次访问的tab
    const getLastTab = (): AdminTab => {
        const saved = localStorage.getItem(LAST_TAB_KEY);
        return (saved as AdminTab) || 'general';
    };
    
    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab || getLastTab());
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [providers, setProviders] = useState<AIProvider[]>([]);
    const [activeProviderIndex, setActiveProviderIndex] = useState(0);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showApiKey, setShowApiKey] = useState(false);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    const handleTabChange = (tabId: string) => {
        const newTab = tabId as AdminTab;
        setActiveTab(newTab);
        // 保存到localStorage
        localStorage.setItem(LAST_TAB_KEY, newTab);
        // Sync with route for persistence
        const routeId = tabId === 'general' ? 'settings' : tabId;
        navigate(`${routePrefix}/${routeId}`);
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settingsRes, statsRes] = await Promise.all([
                axios.get('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/admin/stats/system', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setSettings(settingsRes.data.data.settings);
            setProviders(settingsRes.data.data.providers || []);
            setStats(statsRes.data.data);

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
        let interval: any;
        if (activeTab === 'health') {
            interval = setInterval(fetchStats, 5000);
        }
        return () => clearInterval(interval);
    }, [activeTab]);

    const fetchStats = async () => {
        try {
            const res = await axios.get('/api/admin/stats/system', { headers: { Authorization: `Bearer ${token}` } });
            setStats(res.data.data);
        } catch (err) { console.error(err); }
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        try {
            await axios.post('/api/admin/settings', { settings, providers }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (err) {
            console.error('Failed to save settings:', err);
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
            alert("Cannot delete the active provider. Please set another provider as active first.");
            return;
        }
        if (!window.confirm(`Delete ${p.name}?`)) return;

        try {
            await axios.post('/api/admin/providers/delete', { name: p.name }, { headers: { Authorization: `Bearer ${token}` } });
            const newProviders = providers.filter((_, i) => i !== index);
            setProviders(newProviders);
            setActiveProviderIndex(0);
        } catch (err) {
            console.error('Delete provider failed');
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

    if (loading && !settings) return <div className="p-8 text-center text-gray-500">Loading Configuration...</div>;

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
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12 }}>
                    {[
                        { id: 'general', label: t('admin.settings_general'), icon: Server },
                        { id: 'intelligence', label: t('admin.intelligence_center'), icon: Bot },
                        { id: 'health', label: t('admin.system_health'), icon: Activity },
                        { id: 'audit', label: '审计日志', icon: FileText }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id as any)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 16px', borderRadius: 8, border: 'none',
                                background: activeTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.5)',
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
                                background: '#FFD700', color: 'black',
                                border: 'none', padding: '8px 20px', borderRadius: 8,
                                fontWeight: 600, cursor: saving ? 'wait' : 'pointer',
                                opacity: saving ? 0.7 : 1
                            }}
                        >
                            {saving ? <RefreshCcw className="animate-spin" size={16} /> : <Save size={16} />}
                            {t('common.save_all_changes')}
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div style={{ background: 'rgba(30,30,32,0.6)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', minHeight: 400 }}>

                {/* === AI INTELLIGENCE TAB === */}
                {activeTab === 'intelligence' && settings && (
                    <div style={{ display: 'flex', minHeight: 500 }}>
                        {/* LEFT: Provider Sidebar */}
                        <div style={{ width: 240, borderRight: '1px solid rgba(255,255,255,0.1)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                            <div className="hint" style={{ paddingLeft: 8 }}>{t('admin.global_policy')}</div>
                            <div className="setting-card-mini">
                                <span style={{ fontSize: '0.8rem' }}>{t('admin.ai_enabled')}</span>
                                <Switch checked={settings.ai_enabled} onChange={v => setSettings({ ...settings, ai_enabled: v })} />
                            </div>
                            <div className="setting-card-mini">
                                <span style={{ fontSize: '0.8rem' }}>{t('admin.work_mode')}</span>
                                <Switch checked={settings.ai_work_mode} onChange={v => setSettings({ ...settings, ai_work_mode: v })} />
                            </div>
                            
                            {/* Data Sources Selection */}
                            <div style={{ marginTop: 12, paddingLeft: 8 }}>
                                <div className="hint" style={{ fontSize: '0.75rem', marginBottom: 8 }}>Bokeh 数据源</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                                        <input
                                            type="checkbox"
                                            checked={settings.ai_data_sources?.includes('tickets') ?? true}
                                            onChange={(e) => {
                                                const sources = settings.ai_data_sources || [];
                                                if (e.target.checked) {
                                                    setSettings({ ...settings, ai_data_sources: [...sources, 'tickets'] });
                                                } else {
                                                    setSettings({ ...settings, ai_data_sources: sources.filter(s => s !== 'tickets') });
                                                }
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        工单历史
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
                                        <input
                                            type="checkbox"
                                            checked={settings.ai_data_sources?.includes('knowledge') ?? true}
                                            onChange={(e) => {
                                                const sources = settings.ai_data_sources || [];
                                                if (e.target.checked) {
                                                    setSettings({ ...settings, ai_data_sources: [...sources, 'knowledge'] });
                                                } else {
                                                    setSettings({ ...settings, ai_data_sources: sources.filter(s => s !== 'knowledge') });
                                                }
                                            }}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        Kinefinity 知识库
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', opacity: 0.5 }}>
                                        <input
                                            type="checkbox"
                                            checked={settings.ai_data_sources?.includes('web_search') ?? false}
                                            disabled
                                            style={{ cursor: 'not-allowed' }}
                                        />
                                        实时网络搜索 (待开放)
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Selected Provider Detail */}
                        <div style={{ flex: 1, padding: 32 }}>
                            {currentP ? (
                                <div className="fade-in">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                                        <h3 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 12 }}>
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

                                            <div style={{ border: '1px solid rgba(255,215,0,0.1)', background: 'rgba(255,215,0,0.02)', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                <div className="setting-field">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                        <label style={{ margin: 0 }}>{t('admin.temperature')}</label>
                                                        <span style={{ fontSize: '0.8rem', color: '#FFD700', fontWeight: 600 }}>{currentP.temperature?.toFixed(1) || '0.7'}</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="1.5"
                                                        step="0.1"
                                                        value={currentP.temperature ?? 0.7}
                                                        onChange={e => updateProviderField(activeProviderIndex, 'temperature', parseFloat(e.target.value))}
                                                        style={{ width: '100%', accentColor: '#FFD700' }}
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
                                            <h4 style={{ color: '#FFD700', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('admin.model_routing')}</h4>

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
                )}

                {/* === HEALTH TAB === */}
                {activeTab === 'health' && stats && (
                    <div style={{ padding: 32 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
                            <StatCard label="Uptime" value={`${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`} icon={<Activity color="#10b981" />} />
                            <StatCard label="CPU Load (1m)" value={`${stats.cpu_load.toFixed(2)}`} subtext="Target: < 4.0" icon={<Cpu color="#3b82f6" />} />
                            <StatCard label="Memory Usage" value={`${(stats.mem_used / 1024 / 1024 / 1024).toFixed(2)} GB`} subtext={`Total: ${(stats.mem_total / 1024 / 1024 / 1024).toFixed(2)} GB`} icon={<Database color="#f59e0b" />} />
                            <StatCard label="Platform" value={stats.platform} icon={<Server color="#8b5cf6" />} />
                        </div>
                    </div>
                )}

                {/* === GENERAL TAB === */}
                {activeTab === 'general' && settings && (
                    <div style={{ padding: 32 }}>
                        <div className="setting-field">
                            <label>System Name</label>
                            <input type="text" className="text-input" value={settings.system_name} onChange={e => setSettings({ ...settings, system_name: e.target.value })} />
                        </div>
                    </div>
                )}

                {/* === AUDIT TAB === */}
                {activeTab === 'audit' && (
                    <div style={{ padding: '24px', background: 'transparent' }}>
                        <KnowledgeAuditLog />
                    </div>
                )}
            </div>

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
                    background: rgba(255,215,0,0.1);
                    border-color: rgba(255,215,0,0.3);
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
                    border: 1px solid rgba(255,255,255,0.1);
                    color: rgba(255,255,255,0.6);
                }
                .active-toggle-btn.active {
                    background: #10b981;
                    color: white;
                    border-color: #10b981;
                }

                .setting-card { display: flex; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 16px; border-radius: 12px; }
                .setting-card-mini { display: flex; align-items: center; justify-content: space-between; padding: 8px; opacity: 0.7; }
                .setting-label { font-weight: 600; color: white; margin-bottom: 2px; }
                .setting-desc { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
                .setting-field { margin-bottom: 0px; }
                .setting-field label { display: block; font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
                .text-input { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 10px 12px; border-radius: 8px; font-size: 0.95rem; outline: none; transition: border 0.2s; }
                .text-input:focus { border-color: #FFD700; }
                .divider { height: 1px; background: rgba(255,255,255,0.1); margin: 16px 0; }
            `}</style>
        </div >
    );
};

const Switch: React.FC<{ checked: boolean, onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <div onClick={() => onChange(!checked)} style={{ width: 40, height: 22, background: checked ? '#10b981' : 'rgba(255,255,255,0.2)', borderRadius: 11, position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
        <div style={{ width: 18, height: 18, background: 'white', borderRadius: '50%', position: 'absolute', top: 2, left: checked ? 20 : 2, transition: 'left 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
    </div>
);

const StatCard: React.FC<{ label: string, value: string, subtext?: string, icon: React.ReactNode }> = ({ label, value, subtext, icon }) => (
    <div style={{ background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, opacity: 0.8 }}>{icon}<span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>{label}</span></div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>{value}</div>
        {subtext && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{subtext}</div>}
    </div>
);

export default AdminSettings;
