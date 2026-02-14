const fs = require('fs-extra');
const path = require('path');

class BackupService {
    constructor(db, diskPath) {
        this.db = db;
        this.diskPath = diskPath;
        this.primaryTimer = null;
        this.secondaryTimer = null;
        
        // Primary Backup Config (fileserver)
        this.primaryConfig = {
            enabled: true,
            frequency: 1440, // Minutes (24h)
            retention: 7,    // Days
            path: '/Volumes/fileserver/System/Backups/db',
            label: '主备份'
        };
        
        // Secondary Backup Config (local server directory)
        this.secondaryConfig = {
            enabled: true,
            frequency: 4320, // Minutes (72h = 3 days)
            retention: 30,   // Days
            path: path.join(__dirname, '../backups/secondary'),
            label: '次级备份'
        };
    }

    // Initialize the service: Load config and verify directories
    init() {
        this.reload();
        console.log('[Backup] Service initialized with dual backup support.');
    }

    // Reload configuration from DB and restart schedulers
    reload() {
        try {
            const row = this.db.prepare('SELECT * FROM system_settings LIMIT 1').get();

            if (row) {
                // Primary backup settings
                if (row.backup_enabled !== undefined) this.primaryConfig.enabled = Boolean(row.backup_enabled);
                if (row.backup_frequency) this.primaryConfig.frequency = parseInt(row.backup_frequency) || 1440;
                if (row.backup_retention_days) this.primaryConfig.retention = parseInt(row.backup_retention_days) || 7;
                
                // Secondary backup settings
                if (row.secondary_backup_enabled !== undefined) this.secondaryConfig.enabled = Boolean(row.secondary_backup_enabled);
                if (row.secondary_backup_frequency) this.secondaryConfig.frequency = parseInt(row.secondary_backup_frequency) || 4320;
                if (row.secondary_backup_retention_days) this.secondaryConfig.retention = parseInt(row.secondary_backup_retention_days) || 30;
            }

            this.ensureBackupDirs();
            this.schedule();
        } catch (err) {
            console.error('[Backup] Failed to load config:', err);
            this.schedule();
        }
    }

    ensureBackupDirs() {
        try {
            fs.ensureDirSync(this.primaryConfig.path);
            fs.ensureDirSync(this.secondaryConfig.path);
        } catch (e) {
            console.error('[Backup] Failed to create backup dirs:', e);
        }
    }

    // Schedule both backups
    schedule() {
        // Clear existing timers
        if (this.primaryTimer) {
            clearInterval(this.primaryTimer);
            this.primaryTimer = null;
        }
        if (this.secondaryTimer) {
            clearInterval(this.secondaryTimer);
            this.secondaryTimer = null;
        }

        // Schedule primary backup
        if (this.primaryConfig.enabled) {
            console.log(`[Backup] Primary scheduled every ${this.primaryConfig.frequency} minutes. Retention: ${this.primaryConfig.retention} days.`);
            const primaryIntervalMs = this.primaryConfig.frequency * 60 * 1000;
            this.primaryTimer = setInterval(() => {
                this.performBackup('primary');
            }, primaryIntervalMs);
        } else {
            console.log('[Backup] Primary backup disabled.');
        }

        // Schedule secondary backup
        if (this.secondaryConfig.enabled) {
            console.log(`[Backup] Secondary scheduled every ${this.secondaryConfig.frequency} minutes. Retention: ${this.secondaryConfig.retention} days.`);
            const secondaryIntervalMs = this.secondaryConfig.frequency * 60 * 1000;
            this.secondaryTimer = setInterval(() => {
                this.performBackup('secondary');
            }, secondaryIntervalMs);
        } else {
            console.log('[Backup] Secondary backup disabled.');
        }
    }

    async performBackup(type = 'primary') {
        const config = type === 'primary' ? this.primaryConfig : this.secondaryConfig;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const prefix = type === 'primary' ? 'longhorn' : 'longhorn-secondary';
        const fileName = `${prefix}-${timestamp}.db`;
        const backupPath = path.join(config.path, fileName);

        console.log(`[Backup] [${config.label}] Starting backup to ${backupPath}...`);

        try {
            await this.db.backup(backupPath);
            console.log(`[Backup] [${config.label}] Success: ${fileName}`);
            this.cleanOldBackups(type);
            return { success: true, path: backupPath, type, label: config.label };
        } catch (err) {
            console.error(`[Backup] [${config.label}] Failed:`, err);
            return { success: false, error: err.message, type, label: config.label };
        }
    }

    cleanOldBackups(type = 'primary') {
        const config = type === 'primary' ? this.primaryConfig : this.secondaryConfig;
        const retentionDays = config.retention;
        const now = Date.now();
        const retentionMs = retentionDays * 24 * 3600 * 1000;

        fs.readdir(config.path, (err, files) => {
            if (err) return;
            const prefix = type === 'primary' ? 'longhorn-' : 'longhorn-secondary-';
            files.forEach(file => {
                if (!file.endsWith('.db') || !file.startsWith(prefix)) return;
                const filePath = path.join(config.path, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    if (now - stats.mtimeMs > retentionMs) {
                        fs.unlink(filePath, () => console.log(`[Backup] [${config.label}] Pruned old backup: ${file}`));
                    }
                });
            });
        });
    }

    // Manual Trigger for primary backup (backward compatible)
    trigger() {
        return this.performBackup('primary');
    }

    // Manual Trigger for specific type
    triggerType(type) {
        return this.performBackup(type);
    }

    // Get backup status and file lists
    getStatus() {
        const getBackups = (config, type) => {
            try {
                const prefix = type === 'primary' ? 'longhorn-' : 'longhorn-secondary-';
                const files = fs.readdirSync(config.path)
                    .filter(f => f.endsWith('.db') && f.startsWith(prefix))
                    .map(f => {
                        const stat = fs.statSync(path.join(config.path, f));
                        return {
                            name: f,
                            size: stat.size,
                            created_at: stat.mtime.toISOString(),
                            path: path.join(config.path, f)
                        };
                    })
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                return files;
            } catch (e) {
                return [];
            }
        };

        return {
            primary: {
                enabled: this.primaryConfig.enabled,
                frequency: this.primaryConfig.frequency,
                retention: this.primaryConfig.retention,
                path: this.primaryConfig.path,
                label: this.primaryConfig.label,
                backups: getBackups(this.primaryConfig, 'primary')
            },
            secondary: {
                enabled: this.secondaryConfig.enabled,
                frequency: this.secondaryConfig.frequency,
                retention: this.secondaryConfig.retention,
                path: this.secondaryConfig.path,
                label: this.secondaryConfig.label,
                backups: getBackups(this.secondaryConfig, 'secondary')
            }
        };
    }
}

module.exports = BackupService;
