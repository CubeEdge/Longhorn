const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'startup_error.txt');
const indexFile = path.join(__dirname, 'index.js');

console.log('--- Attempting to start server directly ---');
fs.writeFileSync(logFile, `[${new Date().toISOString()}] Starting debug launch...\n`);

const child = spawn('node', [indexFile], {
    stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout/stderr
    env: process.env // Inherit env (important for DISK_A etc)
});

child.stdout.on('data', (data) => {
    const msg = data.toString();
    console.log('[stdout]', msg);
    fs.appendFileSync(logFile, `[STDOUT] ${msg}`);
});

child.stderr.on('data', (data) => {
    const msg = data.toString();
    console.error('[stderr]', msg);
    fs.appendFileSync(logFile, `[STDERR] ${msg}`);
});

child.on('close', (code) => {
    const msg = `Server exited with code ${code}`;
    console.log(msg);
    fs.appendFileSync(logFile, `[EXIT] ${msg}\n`);
});

console.log(`Watching for errors... Check ${logFile} if it crashes.`);
