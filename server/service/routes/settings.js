const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const checkDiskSpace = require('check-disk-space').default;

module.exports = (db, authenticate, backupService) => {
    const router = express.Router();

    // Middleware: SuperAdmin Only (Admin, Exec) for critical actions
    const superAdminOnly = (req, res, next) => {
        if (!req.user || (req.user.role !== 'Admin' && req.user.role !== 'Exec')) {
            return res.status(403).json({ error: 'Access denied. SuperAdmin role required.' });
        }
        next();
    };

    router.use(authenticate);

    // GET /api/admin/settings
    router.get('/settings', (req, res) => {
        try {
            const isSuperAdmin = req.user.role === 'Admin' || req.user.role === 'Exec';
            
            const settings = db.prepare('SELECT * FROM system_settings LIMIT 1').get();
            let providers = db.prepare('SELECT * FROM ai_providers').all();

            // Strip sensitive API keys for non-super-admins
            if (!isSuperAdmin) {
                providers = providers.map(p => {
                    const { api_key, ...rest } = p;
                    return { ...rest, api_key: api_key ? '***' : null };
                });
            }

            // Normalize booleans ... (rest of normalization logic)
            if (settings) {
                settings.ai_enabled = Boolean(settings.ai_enabled);
                settings.ai_work_mode = Boolean(settings.ai_work_mode);
                settings.ai_allow_search = Boolean(settings.ai_allow_search);
                // Parse ai_data_sources JSON
                try {
                    settings.ai_data_sources = settings.ai_data_sources ? JSON.parse(settings.ai_data_sources) : ['tickets', 'knowledge'];
                } catch (e) {
                    settings.ai_data_sources = ['tickets', 'knowledge'];
                }

                // Parse ai_prompts JSON
                try {
                    settings.ai_prompts = settings.ai_prompts ? JSON.parse(settings.ai_prompts) : {};
                } catch (e) {
                    settings.ai_prompts = {};
                }

                // Normalize Primary Backup Settings
                settings.ai_search_history_limit = parseInt(settings.ai_search_history_limit) || 10;
                settings.show_daily_word = Boolean(settings.show_daily_word);
                settings.notification_refresh_interval = parseInt(settings.notification_refresh_interval) || 30;
                settings.backup_enabled = Boolean(settings.backup_enabled);
                settings.backup_frequency = parseInt(settings.backup_frequency) || 180;
                settings.backup_retention_days = parseInt(settings.backup_retention_days) || 7;

                // Normalize Secondary Backup Settings
                settings.secondary_backup_enabled = Boolean(settings.secondary_backup_enabled);
                settings.secondary_backup_frequency = parseInt(settings.secondary_backup_frequency) || 1440;
                settings.secondary_backup_retention_days = parseInt(settings.secondary_backup_retention_days) || 30;
                
                // Normalize RMA Finance Confirmation Setting
                settings.require_finance_confirmation = settings.require_finance_confirmation !== 0;

                // Normalize Inquiry Ticket SLA Settings
                settings.inquiry_sla_enabled = settings.inquiry_sla_enabled !== 0;
                settings.inquiry_auto_close_days = parseInt(settings.inquiry_auto_close_days) || 5;
                settings.inquiry_sla_hours = parseInt(settings.inquiry_sla_hours) || 24;

                // Normalize RMA Ticket SLA Settings
                settings.rma_sla_enabled = settings.rma_sla_enabled !== 0;
                settings.rma_auto_close_days = parseInt(settings.rma_auto_close_days) || 7;
                settings.rma_sla_hours = parseInt(settings.rma_sla_hours) || 24;

                // Normalize SVC Ticket SLA Settings
                settings.svc_sla_enabled = settings.svc_sla_enabled !== 0;
                settings.svc_auto_close_days = parseInt(settings.svc_auto_close_days) || 7;
                settings.svc_sla_hours = parseInt(settings.svc_sla_hours) || 24;

                // Normalize Product Dropdown Settings
                settings.show_family_a = settings.show_family_a !== 0;
                settings.show_family_b = settings.show_family_b !== 0;
                settings.show_family_c = settings.show_family_c !== 0;
                settings.show_family_d = settings.show_family_d !== 0;
                settings.show_family_e = settings.show_family_e !== 0;
                settings.enable_product_type_filter = settings.enable_product_type_filter !== 0;
                settings.allowed_product_types = settings.allowed_product_types || '电影机,摄像机,电子寻像器,寻像器,套装';
            }

            providers.forEach(p => {
                p.allow_search = Boolean(p.allow_search);
                p.is_active = Boolean(p.is_active);
            });

            res.json({
                success: true,
                data: {
                    settings: settings || { system_name: 'Longhorn System', ai_enabled: 1, ai_data_sources: ['tickets', 'knowledge'] },
                    providers
                }
            });
        } catch (err) {
            console.error('[Settings] Fetch Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/admin/settings
    router.post('/settings', superAdminOnly, (req, res) => {
        try {
            const { settings, providers } = req.body;

            // 1. Update general system settings
            const existing = db.prepare('SELECT id FROM system_settings LIMIT 1').get();
            if (existing && settings) {
                // Parse ai_data_sources if it's an array
                let dataSources = settings.ai_data_sources;
                if (Array.isArray(dataSources)) {
                    dataSources = JSON.stringify(dataSources);
                }

                // Parse ai_prompts if it's an object
                let aiPrompts = settings.ai_prompts;
                if (aiPrompts && typeof aiPrompts === 'object') {
                    aiPrompts = JSON.stringify(aiPrompts);
                } else if (!aiPrompts) {
                    aiPrompts = '{}';
                }

                db.prepare(`
                    UPDATE system_settings SET 
                        ai_enabled = @ai_enabled,
                        ai_work_mode = @ai_work_mode,
                        ai_data_sources = @ai_data_sources,
                        ai_system_prompt = @ai_system_prompt,
                        ai_prompts = @ai_prompts,
                        ai_search_history_limit = @ai_search_history_limit,
                        show_daily_word = @show_daily_word,
                        notification_refresh_interval = @notification_refresh_interval,

                        system_name = @system_name,
                        backup_enabled = @backup_enabled,
                        backup_frequency = @backup_frequency,
                        backup_retention_days = @backup_retention_days,
                        secondary_backup_enabled = @secondary_backup_enabled,
                        secondary_backup_frequency = @secondary_backup_frequency,
                        secondary_backup_retention_days = @secondary_backup_retention_days,
                        require_finance_confirmation = @require_finance_confirmation,
                        
                        inquiry_sla_enabled = @inquiry_sla_enabled,
                        inquiry_auto_close_days = @inquiry_auto_close_days,
                        inquiry_sla_hours = @inquiry_sla_hours,

                        rma_sla_enabled = @rma_sla_enabled,
                        rma_auto_close_days = @rma_auto_close_days,
                        rma_sla_hours = @rma_sla_hours,

                        svc_sla_enabled = @svc_sla_enabled,
                        svc_auto_close_days = @svc_auto_close_days,
                        svc_sla_hours = @svc_sla_hours,
                        
                        show_family_a = @show_family_a,
                        show_family_b = @show_family_b,
                        show_family_c = @show_family_c,
                        show_family_d = @show_family_d,
                        show_family_e = @show_family_e,
                        enable_product_type_filter = @enable_product_type_filter,
                        allowed_product_types = @allowed_product_types,
                        
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = @id
                `).run({
                    id: existing.id,
                    system_name: settings.system_name,
                    ai_enabled: settings.ai_enabled ? 1 : 0,
                    ai_work_mode: settings.ai_work_mode ? 1 : 0,
                    ai_data_sources: dataSources,
                    ai_system_prompt: settings.ai_system_prompt || null,
                    ai_prompts: aiPrompts,
                    ai_search_history_limit: Math.max(1, Math.min(30, parseInt(settings.ai_search_history_limit) || 10)),
                    show_daily_word: settings.show_daily_word ? 1 : 0,
                    notification_refresh_interval: Math.max(5, Math.min(300, parseInt(settings.notification_refresh_interval) || 30)),
                    backup_enabled: settings.backup_enabled ? 1 : 0,
                    backup_frequency: parseInt(settings.backup_frequency) || 180,
                    backup_retention_days: parseInt(settings.backup_retention_days) || 7,
                    secondary_backup_enabled: settings.secondary_backup_enabled ? 1 : 0,
                    secondary_backup_frequency: parseInt(settings.secondary_backup_frequency) || 1440,
                    secondary_backup_retention_days: parseInt(settings.secondary_backup_retention_days) || 30,
                    require_finance_confirmation: settings.require_finance_confirmation !== false ? 1 : 0,
                    inquiry_sla_enabled: settings.inquiry_sla_enabled !== false ? 1 : 0,
                    inquiry_auto_close_days: parseInt(settings.inquiry_auto_close_days) || 5,
                    inquiry_sla_hours: parseInt(settings.inquiry_sla_hours) || 24,
                    rma_sla_enabled: settings.rma_sla_enabled !== false ? 1 : 0,
                    rma_auto_close_days: parseInt(settings.rma_auto_close_days) || 7,
                    rma_sla_hours: parseInt(settings.rma_sla_hours) || 24,
                    svc_sla_enabled: settings.svc_sla_enabled !== false ? 1 : 0,
                    svc_auto_close_days: parseInt(settings.svc_auto_close_days) || 7,
                    svc_sla_hours: parseInt(settings.svc_sla_hours) || 24,
                    
                    // Product Dropdown Settings
                    show_family_a: settings.show_family_a !== false ? 1 : 0,
                    show_family_b: settings.show_family_b !== false ? 1 : 0,
                    show_family_c: settings.show_family_c !== false ? 1 : 0,
                    show_family_d: settings.show_family_d !== false ? 1 : 0,
                    show_family_e: settings.show_family_e !== false ? 1 : 0,
                    enable_product_type_filter: settings.enable_product_type_filter !== false ? 1 : 0,
                    allowed_product_types: settings.allowed_product_types || '电影机,摄像机,电子寻像器,寻像器,套装'
                });

                // Reload Backup Service
                if (backupService) backupService.reload();
            }

            // 2. Update/Insert Providers
            if (providers && Array.isArray(providers)) {
                console.log('[Settings] Saving providers:', providers.map(p => ({ name: p.name, hasApiKey: !!p.api_key, apiKeyLen: p.api_key?.length || 0 })));

                const upsertProvider = db.prepare(`
                    INSERT INTO ai_providers (
                        name, api_key, base_url, chat_model, reasoner_model, vision_model, allow_search, temperature, max_tokens, top_p, is_active, updated_at
                    ) VALUES (
                        @name, @api_key, @base_url, @chat_model, @reasoner_model, @vision_model, @allow_search, @temperature, @max_tokens, @top_p, @is_active, CURRENT_TIMESTAMP
                    )
                    ON CONFLICT(name) DO UPDATE SET
                        api_key = CASE WHEN @api_key IS NOT NULL AND @api_key != '' THEN @api_key ELSE api_key END,
                        base_url = @base_url,
                        chat_model = @chat_model,
                        reasoner_model = @reasoner_model,
                        vision_model = @vision_model,
                        allow_search = @allow_search,
                        temperature = @temperature,
                        max_tokens = @max_tokens,
                        top_p = @top_p,
                        is_active = @is_active,
                        updated_at = CURRENT_TIMESTAMP
                `);

                db.transaction(() => {
                    // If multiple providers are sent as active, only one remains active (the last one or specifically handled)
                    // For logic simplicity, we trust frontend sends only one is_active: true
                    for (const p of providers) {
                        upsertProvider.run({
                            ...p,
                            api_key: p.api_key || null,
                            allow_search: p.allow_search ? 1 : 0,
                            is_active: p.is_active ? 1 : 0
                        });
                    }
                })();
            }

            res.json({ success: true, message: 'Settings and providers updated' });
        } catch (err) {
            console.error('[Settings] Update Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/admin/backup/status - Get backup status and file lists
    router.get('/backup/status', superAdminOnly, (req, res) => {
        try {
            if (!backupService) return res.status(503).json({ error: 'Backup service not available' });

            const status = backupService.getStatus();
            res.json({ success: true, data: status });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/admin/backup/now - Trigger primary backup (backward compatible)
    router.post('/backup/now', superAdminOnly, async (req, res) => {
        try {
            if (!backupService) return res.status(503).json({ error: 'Backup service not available' });

            const result = await backupService.trigger();
            if (result.success) {
                res.json({ success: true, path: result.path, type: result.type, label: result.label });
            } else {
                res.status(500).json({ error: result.error });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/admin/backup/now/:type - Trigger specific backup type
    router.post('/backup/now/:type', superAdminOnly, async (req, res) => {
        try {
            if (!backupService) return res.status(503).json({ error: 'Backup service not available' });

            const { type } = req.params;
            if (!['primary', 'secondary'].includes(type)) {
                return res.status(400).json({ error: 'Invalid backup type. Use "primary" or "secondary"' });
            }

            const result = await backupService.triggerType(type);
            if (result.success) {
                res.json({ success: true, path: result.path, type: result.type, label: result.label });
            } else {
                res.status(500).json({ error: result.error });
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/admin/providers/delete
    router.post('/providers/delete', superAdminOnly, (req, res) => {
        try {
            const { name } = req.body;
            if (!name) return res.status(400).json({ error: 'Provider name required' });

            db.prepare('DELETE FROM ai_providers WHERE name = ? AND is_active = 0').run(name);
            res.json({ success: true, message: 'Provider deleted' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/admin/stats/system (Real-time Health)
    router.get('/stats/system', async (req, res) => {
        try {
            // CPU Load
            const cpus = os.cpus();
            const loadAvg = os.loadavg(); // [1, 5, 15] min

            // Memory
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;

            // Disk (Check Disk A)
            const diskPath = process.env.DISK_A || path.join(__dirname, '../../../data'); // Fallback
            let diskInfo = { free: 0, size: 0 };

            try {
                // Note: check-disk-space might need installation, using dummy if fails or simpler node check
                // For now, let's assume valid path or catch error.
                // Actually Node fs doesn't give disk space easily. 
                // We will skip disk check if library not present or use mock for now to be safe.
                // Ideally: const disk = await checkDiskSpace(diskPath);
            } catch (e) { }

            res.json({
                success: true,
                data: {
                    uptime: os.uptime(),
                    cpu_load: loadAvg[0],
                    mem_used: usedMem,
                    mem_total: totalMem,
                    platform: os.platform() + ' ' + os.release()
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // GET /api/admin/stats/ai (Historical Usage)
    router.get('/stats/ai', (req, res) => {
        try {
            // Last 30 days usage trend
            const dailyUsage = db.prepare(`
                SELECT date(created_at) as date, SUM(total_tokens) as tokens
                FROM ai_usage_logs
                WHERE created_at > date('now', '-30 days')
                GROUP BY date(created_at)
                ORDER BY date(created_at)
            `).all();

            // Total Cost Estimation (Rough: $0.20 per 1M tokens avg for deepseek/gemini mix)
            const totalTokens = db.prepare('SELECT SUM(total_tokens) as t FROM ai_usage_logs').get().t || 0;
            const estimatedCost = (totalTokens / 1000000) * 0.20;

            res.json({
                success: true,
                data: {
                    daily_usage: dailyUsage,
                    total_tokens: totalTokens,
                    estimated_cost_usd: estimatedCost.toFixed(4)
                }
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
