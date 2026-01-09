module.exports = {
    apps: [{
        name: "longhorn",
        script: "./index.js",
        instances: "max",     // Use all available CPU cores
        exec_mode: "cluster", // Enable cluster mode
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: "production",
            PORT: 4000
        },
        // Important: Force PM2 to use the current directory as CWD to ensure relative paths (disk/db) work if any modules rely on process.cwd()
        cwd: "."
    }]
}
