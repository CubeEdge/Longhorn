import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Server, Cpu, Activity, Database, Bot, Globe, Zap, Lock, RefreshCcw } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
// import { useLanguage } from '../../i18n/useLanguage';

interface SystemSettings {
    system_name: string;
    ai_enabled: boolean;
    ai_work_mode: boolean;
    ai_allow_search: boolean;
    ai_provider: string;
    ai_model_chat: string;
    ai_model_reasoner: string;
    ai_model_vision: string;
    ai_temperature: number;
}

const AdminSettings: React.FC = () => {
    const { token } = useAuthStore();
    // const { t } = useLanguage(); // Unused for now
    const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'health'>('ai');
    const [settings, setSettings] = useState<SystemSettings | null>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
        // Poll stats if on health tab
        let interval: any;
        if (activeTab === 'health') {
            interval = setInterval(fetchStats, 5000);
        }
        return () => clearInterval(interval);
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [settingsRes, statsRes] = await Promise.all([
                axios.get('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/admin/stats/system', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setSettings(settingsRes.data.data);
            setStats(statsRes.data.data);
        } catch (err) {
            console.error('Failed to load admin data:', err);
        } finally {
            setLoading(false);
        }
    };

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
            await axios.post('/api/admin/settings', settings, { headers: { Authorization: `Bearer ${token}` } });
            // Show toast success here (omitted for brevity)
        } catch (err) {
            console.error('Failed to save settings:', err);
        } finally {
            setSaving(false);
        }
    };

    const updateSetting = (key: keyof SystemSettings, value: any) => {
        if (settings) {
            setSettings({ ...settings, [key]: value });
        }
    };

    if (loading && !settings) return <div className="p-8 text-center text-gray-500">Loading Configuration...</div>;

    return (
        <div className="fade-in" style={{ padding: '0 20px 40px' }}>
            {/* Header / Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12 }}>
                    {[
                        { id: 'general', label: 'General', icon: Server },
                        { id: 'ai', label: 'Intelligence Center', icon: Bot },
                        { id: 'health', label: 'System Health', icon: Activity }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '8px 16px',
                                borderRadius: 8,
                                border: 'none',
                                background: activeTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: activeTab === tab.id ? 'white' : 'rgba(255,255,255,0.5)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                transition: 'all 0.2s'
                            }}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

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
                    Apply Changes
                </button>
            </div>

            {/* CONTENT AREA */}
            <div style={{ background: 'rgba(30,30,32,0.6)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', minHeight: 400 }}>

                {/* === AI INTELLIGENCE TAB === */}
                {activeTab === 'ai' && settings && (
                    <div className="p-8 grid grid-cols-2 gap-8" style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1fr)', gap: 32, padding: 32 }}>
                        {/* Left Column: Policy & Providers */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Bot size={20} color="#FFD700" /> Model Policy
                            </h3>

                            {/* Toggle: Work Mode */}
                            <div className="setting-card">
                                <div style={{ flex: 1 }}>
                                    <div className="setting-label">Strict Work Mode</div>
                                    <div className="setting-desc">Restrict AI from answering non-work related questions (e.g., jokes, movies).</div>
                                </div>
                                <Switch checked={settings.ai_work_mode} onChange={v => updateSetting('ai_work_mode', v)} />
                            </div>

                            {/* Toggle: Web Search */}
                            <div className="setting-card">
                                <div style={{ flex: 1 }}>
                                    <div className="setting-label">Allow Web Search</div>
                                    <div className="setting-desc">Allow AI to browse the internet to answer current event questions.</div>
                                </div>
                                <Switch checked={settings.ai_allow_search} onChange={v => updateSetting('ai_allow_search', v)} />
                            </div>

                            <div className="divider" />

                            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Zap size={20} color="#FFD700" /> Provider Configuration
                            </h3>

                            <div className="setting-field">
                                <label>AI Provider</label>
                                <select
                                    value={settings.ai_provider}
                                    onChange={e => updateSetting('ai_provider', e.target.value)}
                                    className="select-input"
                                >
                                    <option value="DeepSeek">DeepSeek (Recommended)</option>
                                    <option value="OpenAI">OpenAI (GPT-4)</option>
                                    <option value="Gemini">Google Gemini</option>
                                </select>
                            </div>

                            <div className="setting-field">
                                <label>Temperature (Creativity): {settings.ai_temperature}</label>
                                <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={settings.ai_temperature}
                                    onChange={e => updateSetting('ai_temperature', parseFloat(e.target.value))}
                                    style={{ width: '100%', accentColor: '#FFD700' }}
                                />
                            </div>
                        </div>

                        {/* Right Column: Model Routing */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Globe size={20} color="#FFD700" /> Model Routing
                            </h3>
                            <p className="hint" style={{ marginTop: -12, marginBottom: 12 }}>Route specific tasks to specialized models for optimal cost/performance.</p>

                            <div className="setting-field">
                                <label>Chat / General (Default)</label>
                                <input
                                    type="text"
                                    className="text-input"
                                    value={settings.ai_model_chat}
                                    onChange={e => updateSetting('ai_model_chat', e.target.value)}
                                    placeholder="e.g. deepseek-chat"
                                />
                            </div>

                            <div className="setting-field">
                                <label>Complex Reasoning (Logic)</label>
                                <input
                                    type="text"
                                    className="text-input"
                                    value={settings.ai_model_reasoner}
                                    onChange={e => updateSetting('ai_model_reasoner', e.target.value)}
                                    placeholder="e.g. deepseek-reasoner"
                                />
                            </div>

                            <div className="setting-field">
                                <label>Vision & Multimodal</label>
                                <input
                                    type="text"
                                    className="text-input"
                                    value={settings.ai_model_vision}
                                    onChange={e => updateSetting('ai_model_vision', e.target.value)}
                                    placeholder="e.g. gemini-1.5-flash"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* === HEALTH TAB === */}
                {activeTab === 'health' && stats && (
                    <div style={{ padding: 32 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
                            <StatCard
                                label="Uptime"
                                value={`${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m`}
                                icon={<Activity color="#10b981" />}
                            />
                            <StatCard
                                label="CPU Load (1m)"
                                value={`${stats.cpu_load.toFixed(2)}`}
                                subtext="Target: < 4.0"
                                icon={<Cpu color="#3b82f6" />}
                            />
                            <StatCard
                                label="Memory Usage"
                                value={`${(stats.mem_used / 1024 / 1024 / 1024).toFixed(2)} GB`}
                                subtext={`Total: ${(stats.mem_total / 1024 / 1024 / 1024).toFixed(2)} GB`}
                                icon={<Database color="#f59e0b" />}
                            />
                            <StatCard
                                label="Platform"
                                value={stats.platform}
                                icon={<Server color="#8b5cf6" />}
                            />
                        </div>

                        {/* Visual Gauges */}
                        <div style={{ marginTop: 40 }}>
                            <h4 style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 16 }}>Resource Authorization</h4>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                                    <span>RAM Usage</span>
                                    <span>{Math.round((stats.mem_used / stats.mem_total) * 100)}%</span>
                                </div>
                                <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${(stats.mem_used / stats.mem_total) * 100}%`, background: '#f59e0b', transition: 'width 0.5s' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* === GENERAL TAB === */}
                {activeTab === 'general' && settings && (
                    <div style={{ padding: 32 }}>
                        <div className="setting-field">
                            <label>System Name</label>
                            <input
                                type="text"
                                className="text-input"
                                value={settings.system_name}
                                onChange={e => updateSetting('system_name', e.target.value)}
                            />
                        </div>
                        <div style={{ marginTop: 20, padding: 20, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12 }}>
                            <h4 style={{ color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Lock size={16} /> Danger Zone
                            </h4>
                            <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>
                                Advanced actions that affect the entire system.
                            </p>
                            <button style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer' }}>
                                Maintenance Mode
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .setting-card {
                    display: flex;
                    align-items: center;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.05);
                    padding: 16px;
                    border-radius: 12px;
                    margin-bottom: 16px;
                }
                .setting-label {
                    font-weight: 600;
                    color: white;
                    margin-bottom: 4px;
                }
                .setting-desc {
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.5);
                }
                .setting-field {
                    margin-bottom: 20px;
                }
                .setting-field label {
                    display: block;
                    font-size: 0.9rem;
                    color: rgba(255,255,255,0.7);
                    margin-bottom: 8px;
                }
                .text-input, .select-input {
                    width: 100%;
                    background: rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: white;
                    padding: 10px 12px;
                    border-radius: 8px;
                    font-size: 0.95rem;
                    outline: none;
                }
                .text-input:focus, .select-input:focus {
                    border-color: #007AFF;
                }
                .divider {
                    height: 1px;
                    background: rgba(255,255,255,0.1);
                    margin: 24px 0;
                }
            `}</style>
        </div>
    );
};

// Sub-components
const Switch: React.FC<{ checked: boolean, onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <div
        onClick={() => onChange(!checked)}
        style={{
            width: 44, height: 24,
            background: checked ? '#10b981' : 'rgba(255,255,255,0.2)',
            borderRadius: 12,
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.2s'
        }}
    >
        <div style={{
            width: 20, height: 20,
            background: 'white',
            borderRadius: '50%',
            position: 'absolute',
            top: 2,
            left: checked ? 22 : 2,
            transition: 'left 0.2s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }} />
    </div>
);

const StatCard: React.FC<{ label: string, value: string, subtext?: string, icon: React.ReactNode }> = ({ label, value, subtext, icon }) => (
    <div style={{ background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, opacity: 0.8 }}>
            {icon}
            <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>{label}</span>
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white' }}>{value}</div>
        {subtext && <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{subtext}</div>}
    </div>
);

export default AdminSettings;
