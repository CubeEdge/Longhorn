const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

console.log('Starting FORENSIC PROBE v7...');

// 1. Check User Mapping
console.log('\n[Phase 1] Verifying Users Table:');
const users = db.prepare('SELECT id, username FROM users').all();
users.forEach(u => console.log(`   - ID:${u.id} Name:"${u.username}"`));

// 2. Dump Sample Paths from DB with HEX
console.log('\n[Phase 2] Dumping DB Path Samples (Hex):');
const samples = db.prepare(`
    SELECT path, uploader_id 
    FROM file_stats 
    WHERE path LIKE '%运营部%' OR path LIKE '%(OP)%' 
    LIMIT 5
`).all();

function toHex(str) {
    return Buffer.from(str).toString('hex').match(/../g).join(' ');
}

samples.forEach(s => {
    console.log(`\n   Path: "${s.path}"`);
    console.log(`   UID: ${s.uploader_id}`);
    console.log(`   HEX: ${toHex(s.path)}`);
});

// 3. Simulate UI resolvePath logic
console.log('\n[Phase 3] Simulating UI "resolvePath" logic (Expected):');
const DEPT_CODE_MAP = {
    'MS': '市场部 (MS)',
    'OP': '运营部 (OP)'
};

function simulateResolve(requestPath) {
    const segments = requestPath.split('/').filter(Boolean);
    if (segments.length > 0) {
        const firstSegmentUpper = segments[0].toUpperCase();
        if (DEPT_CODE_MAP[firstSegmentUpper]) {
            segments[0] = DEPT_CODE_MAP[firstSegmentUpper];
        }
    }
    const resolved = segments.join('/');
    const normalized = resolved.normalize('NFC');
    console.log(`   Input: "${requestPath}"`);
    console.log(`   Resolved (NFC): "${normalized}"`);
    console.log(`   HEX: ${toHex(normalized)}`);
}

simulateResolve('OP/202510/202601');

console.log('\n[Diagnostic Done] Please provide the full output above.');
db.close();
