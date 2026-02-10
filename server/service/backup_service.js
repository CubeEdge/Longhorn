const fs = require('fs-extra');
const path = require('path');

class BackupService {
    constructor(db, diskPath) {
        this.db = db;
        this.diskPath = diskPath; // DISK_A
        this.timer = null;
        this.defaultConfig = {
            enabled: true,
            frequency: 1440, // Minutes (24h)
            retention: 7,    // Days
            path: path.join(diskPath, '.backups', 'db')
        };
    }

    // Initialize the service: Load config and verify directories
    init() {
        this.reload();
        console.log('[Backup] Service initialized.');
    }

    // Reload configuration from DB and restart scheduler
    reload() {
        try {
            const row = this.db.prepare('SELECT * FROM system_settings LIMIT 1').get();
            const config = { ...this.defaultConfig };

            if (row) {
                if (row.backup_enabled !== undefined) config.enabled = Boolean(row.backup_enabled);
                if (row.backup_frequency) config.frequency = parseInt(row.backup_frequency) || 1440;
                if (row.backup_retention_days) config.retention = parseInt(row.backup_retention_days) || 7;
                // Ideally backup_path could be configurable, but for security usually restricted to internal
                // If row.backup_path exists, use it? For now use default relative to DiskA to avoid path traversal
                // config.path = ... 
            }

            this.config = config;
            this.ensureBackupDir();
            this.schedule();
        } catch (err) {
            console.error('[Backup] Failed to load config:', err);
            // Fallback to default
            this.config = this.defaultConfig;
            this.schedule();
        }
    }

    ensureBackupDir() {
        try {
            fs.ensureDirSync(this.config.path);
        } catch (e) {
            console.error('[Backup] Failed to create backup dir:', e);
        }
    }

    // Schedule the next backup
    schedule() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        if (!this.config.enabled) {
            console.log('[Backup] Disabled by config.');
            return;
        }

        console.log(`[Backup] Scheduled every ${this.config.frequency} minutes. Retention: ${this.config.retention} days.`);

        // Convert frequency to ms
        const intervalMs = this.config.frequency * 60 * 1000;

        // Initial run check? No, just interval. 
        // Or align to next hour? For now simple interval.
        this.timer = setInterval(() => {
            this.performBackup();
        }, intervalMs);
    }

    async performBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `longhorn-${timestamp}.db`;
        const backupPath = path.join(this.config.path, fileName);

        console.log(`[Backup] Starting backup to ${backupPath}...`);

        try {
            await this.db.backup(backupPath);
            console.log(`[Backup] Success: ${fileName}`);
            this.cleanOldBackups();
            return { success: true, path: backupPath };
        } catch (err) {
            console.error('[Backup] Failed:', err);
            return { success: false, error: err.message };
        }
    }

    cleanOldBackups() {
        const retentionDays = this.config.retention;
        const now = Date.now();
        const retentionMs = retentionDays * 24 * 3600 * 1000;

        fs.readdir(this.config.path, (err, files) => {
            if (err) return;
            files.forEach(file => {
                if (!file.endsWith('.db')) return;
                const filePath = path.join(this.config.path, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    if (now - stats.mtimeMs > retentionMs) {
                        fs.unlink(filePath, () => console.log(`[Backup] Pruned old backup: ${file}`));
                    }
                });
            });
        });
    }

    // Manual Trigger
    trigger() {
        return this.performBackup();
    }
}

module.exports = BackupService;
