module.exports = {
    apps: [{
        name: 'longhorn',
        script: './index.js',
        cwd: './server',

        // Cluster mode: Use all available CPU cores
        instances: 'max',  // M1 Mac Mini = 8 cores
        exec_mode: 'cluster',

        // Graceful reload
        wait_ready: true,
        listen_timeout: 10000,
        kill_timeout: 5000,

        // Auto restart on crash
        autorestart: true,
        max_restarts: 10,
        restart_delay: 1000,

        // Memory limit (restart if exceeded)
        max_memory_restart: '500M',

        // Environment
        env: {
            NODE_ENV: 'production',
            PORT: 4000
        },

        // Logging
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        error_file: './logs/longhorn-error.log',
        out_file: './logs/longhorn-out.log',
        merge_logs: true,

        // Watch for changes (optional, enable for auto-reload on code changes)
        watch: false,
        ignore_watch: ['node_modules', 'logs', '.chunks', '*.db', '*.db-wal', '*.db-shm']
    }]
};
