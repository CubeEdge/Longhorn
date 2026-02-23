const fs = require('fs');

// 1. Update settings.js
let settingsCode = fs.readFileSync('server/service/routes/settings.js', 'utf-8');
settingsCode = settingsCode.replace(/settings\.backup_enabled = Boolean\(settings\.backup_enabled\);/, "settings.ai_search_history_limit = parseInt(settings.ai_search_history_limit) || 10;\n                settings.backup_enabled = Boolean(settings.backup_enabled);");

settingsCode = settingsCode.replace(/backup_enabled = @backup_enabled,/, "ai_search_history_limit = @ai_search_history_limit,\n                        backup_enabled = @backup_enabled,");

settingsCode = settingsCode.replace(/backup_enabled: settings\.backup_enabled \? 1 : 0,/, "ai_search_history_limit: Math.min(30, Math.max(1, parseInt(settings.ai_search_history_limit) || 10)),\n                    backup_enabled: settings.backup_enabled ? 1 : 0,");

fs.writeFileSync('server/service/routes/settings.js', settingsCode);

// 2. Update AdminSettings.tsx
let adminSettingsCode = fs.readFileSync('client/src/components/Admin/AdminSettings.tsx', 'utf-8');
adminSettingsCode = adminSettingsCode.replace(/ai_system_prompt\?: string;\s*\/\//, "ai_system_prompt?: string;  //\n    ai_search_history_limit?: number;");

const limitInputUi = `
                        {/* 搜索历史快照数量限制 */}
                        <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <Database size={18} color="#FFD700" />
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#fff' }}>搜索历史快照存储上限</h4>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>设定每个用户终端最多保留的历史搜索快照数 (默认10条，最大30条)</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="number"
                                        min={1}
                                        max={30}
                                        value={settings.ai_search_history_limit || 10}
                                        onChange={e => setSettings({ ...settings, ai_search_history_limit: parseInt(e.target.value) || 10 })}
                                        style={{
                                            width: '80px', padding: '8px 12px', borderRadius: '8px',
                                            border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff'
                                        }}
                                    />
                                    <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }}>条</span>
                                </div>
                            </div>
                        </div>
`;

adminSettingsCode = adminSettingsCode.replace(/{/\* Web Search Settings \*/}/, limitInputUi + "\n\n                        {/* Web Search Settings */}");
fs.writeFileSync('client/src/components/Admin/AdminSettings.tsx', adminSettingsCode);

// 3. Add public settings API to system.js
let systemJsCode = fs.readFileSync('server/service/routes/system.js', 'utf-8');
const publicSettingsEndpoint = `
    /**
     * GET /api/v1/system/public-settings
     * Get public system settings for clients
     */
    router.get('/public-settings', authenticate, (req, res) => {
        try {
            const settings = db.prepare('SELECT system_name, ai_search_history_limit FROM system_settings LIMIT 1').get();
            res.json({
                success: true,
                data: {
                    system_name: settings?.system_name || 'Longhorn System',
                    ai_search_history_limit: settings?.ai_search_history_limit || 10
                }
            });
        } catch (err) {
            console.error('[System] Public settings error:', err);
            res.status(500).json({
                success: false,
                error: { code: 'SERVER_ERROR', message: err.message }
            });
        }
    });

`;

systemJsCode = systemJsCode.replace(/return router;/, publicSettingsEndpoint + "\n    return router;");
fs.writeFileSync('server/service/routes/system.js', systemJsCode);

console.log('Update settings implementation complete!');
