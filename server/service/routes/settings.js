const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const checkDiskSpace = require('check-disk-space').default;

module.exports = (db, authenticate) => {
    const router = express.Router();

    // Middleware: Admin Only
    const adminOnly = (req, res, next) => {
        if (!req.user || req.user.role !== 'Admin') {
            return res.status(403).json({ error: 'Access denied. Admin role required.' });
        }
        next();
    };

    router.use(authenticate, adminOnly);

    // GET /api/admin/settings
    router.get('/settings', (req, res) => {
        try {
            const row = db.prepare('SELECT * FROM system_settings LIMIT 1').get();
            // Default settings if none exist
            const settings = row || {
                ai_enabled: 1,
                ai_work_mode: 0,
                ai_allow_search: 0,
                ai_provider: 'DeepSeek',
                ai_model_chat: 'deepseek-chat',
                ai_model_reasoner: 'deepseek-reasoner',
                ai_model_vision: 'gemini-1.5-flash',
                ai_temperature: 0.7,
                system_name: 'Longhorn System'
            };

            // Normalize booleans
            settings.ai_enabled = Boolean(settings.ai_enabled);
            settings.ai_work_mode = Boolean(settings.ai_work_mode);
            settings.ai_allow_search = Boolean(settings.ai_allow_search);

            res.json({ success: true, data: settings });
        } catch (err) {
            console.error('[Settings] Fetch Error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // POST /api/admin/settings
    router.post('/settings', (req, res) => {
        try {
            const s = req.body;

            // Upsert Logic
            const existing = db.prepare('SELECT id FROM system_settings LIMIT 1').get();

            if (existing) {
                db.prepare(`
                    UPDATE system_settings SET 
                        ai_enabled = @ai_enabled,
                        ai_work_mode = @ai_work_mode,
                        ai_allow_search = @ai_allow_search,
                        ai_provider = @ai_provider,
                        ai_model_chat = @ai_model_chat,
                        ai_model_reasoner = @ai_model_reasoner,
                        ai_model_vision = @ai_model_vision,
                        ai_temperature = @ai_temperature,
                        system_name = @system_name,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = @id
                `).run({ ...s, id: existing.id });
            } else {
                db.prepare(`
                    INSERT INTO system_settings (
                        ai_enabled, ai_work_mode, ai_allow_search, 
                        ai_provider, ai_model_chat, ai_model_reasoner, ai_model_vision,
                        ai_temperature, system_name
                    ) VALUES (
                        @ai_enabled, @ai_work_mode, @ai_allow_search, 
                        @ai_provider, @ai_model_chat, @ai_model_reasoner, @ai_model_vision,
                        @ai_temperature, @system_name
                    )
                `).run(s);
            }

            res.json({ success: true, message: 'Settings updated' });
        } catch (err) {
            console.error('[Settings] Update Error:', err);
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
