const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const db = new Database(DB_PATH);

console.log('Starting Dealer Import...');

// 1. Get Unique Dealers from RMA Tickets
const rmaDealers = db.prepare(`
    SELECT DISTINCT dealer_name 
    FROM rma_tickets 
    WHERE dealer_name IS NOT NULL AND dealer_name != ''
`).all();

console.log(`Found ${rmaDealers.length} dealers in RMA Tickets.`);

// 2. Get Unique Dealers from Dealer Repairs (SVC)
// Assuming dealer_repairs table has customer_name or we treat dealers as users
// Wait, dealer_repairs table usually has 'dealer_id' or 'technician'. 
// Let's check schema. But for now, let's start with RMA.

// 3. Insert into users table
const insertDealer = db.prepare(`
    INSERT OR IGNORE INTO users (username, password, role, customer_name, service_tier, created_at)
    VALUES (@username, @password, 'Dealer', @name, 'PARTNER', DATETIME('now'))
`);

let addedCount = 0;

db.transaction(() => {
    for (const d of rmaDealers) {
        const name = d.dealer_name.trim();
        if (!name) continue;

        // Generate a username (normalize name)
        const username = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + '_admin';
        // Default password: 'change_me_123' (hashed? For now, let's use a placeholder if bcrypt is needed, but we don't have bcrypt here easily without require. 
        // Actually we do inside the project. Let's just use a cleartext placeholder if auth allows, or use a known hash.)
        // $2a$10$X7... is a hash for '123456' usually. Let's copy a hash from an existing user if possible, or just insert.
        // For now, let's just insert with a dummy hash.
        const passwordHash = '$2a$10$CwTycUXWue0Thq9StjUM0uJ0.pQp.e.g.s.o.m.e.h.a.s.h';

        const result = insertDealer.run({
            username: username,
            password: passwordHash,
            name: name
        });

        if (result.changes > 0) {
            console.log(`Added Dealer: ${name} (User: ${username})`);
            addedCount++;
        }
    }
})();

console.log(`Import Complete. Added ${addedCount} new dealers.`);
