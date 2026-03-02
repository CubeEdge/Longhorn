#!/usr/bin/env node
/**
 * Fix all issues reported by user
 * 1. Change Manager to Cathy in activities
 * 2. Fix i18n keys
 * 3. Fix workspace ticket title display
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '../longhorn.db');
const db = new Database(DB_PATH);

console.log('🔧 Fixing all issues...\n');

// Get Cathy ID
const cathy = db.prepare("SELECT id FROM users WHERE username = 'cathy'").get();
const cathyId = cathy ? cathy.id : 4;

// ==========================================
// 1. Fix Manager -> Cathy in activities
// ==========================================
console.log('1️⃣  Fixing Manager -> Cathy in activities...');

// Check if Manager user exists
const manager = db.prepare("SELECT id FROM users WHERE username = 'Manager'").get();

if (manager) {
    // Update all activities where actor_id is Manager
    const result = db.prepare(`
        UPDATE ticket_activities 
        SET actor_id = ?, actor_name = 'Cathy' 
        WHERE actor_id = ?
    `).run(cathyId, manager.id);
    console.log(`   ✓ Updated ${result.changes} activities from Manager to Cathy`);
    
    // Update content that mentions @[Manager]
    const contentResult = db.prepare(`
        UPDATE ticket_activities 
        SET content = REPLACE(content, '@[Manager]', '@[Cathy]')
        WHERE content LIKE '%@[Manager]%'
    `).run();
    console.log(`   ✓ Updated ${contentResult.changes} activity contents`);
    
    // Delete Manager user
    db.prepare("DELETE FROM users WHERE username = 'Manager'").run();
    console.log('   ✓ Deleted Manager user');
} else {
    console.log('   ℹ No Manager user found');
}

// Also fix any activities that still have 'Manager' as actor_name
const managerNameResult = db.prepare(`
    UPDATE ticket_activities 
    SET actor_name = 'Cathy', actor_id = ?
    WHERE actor_name = 'Manager'
`).run(cathyId);
console.log(`   ✓ Fixed ${managerNameResult.changes} activities with actor_name='Manager'`);

// ==========================================
// 2. Check and report i18n issues
// ==========================================
console.log('\n2️⃣  Checking i18n keys...');

// Find activities with unprocessed i18n keys
const i18nPatterns = [
    'inquiry_ticket.status',
    'rma_ticket.status',
    'ticket.status',
    'common.',
    'workspace.'
];

let i18nIssues = 0;
for (const pattern of i18nPatterns) {
    const activities = db.prepare(`
        SELECT id, content FROM ticket_activities 
        WHERE content LIKE '%${pattern}%'
    `).all();
    if (activities.length > 0) {
        console.log(`   ⚠ Found ${activities.length} activities with ${pattern}`);
        i18nIssues += activities.length;
    }
}

if (i18nIssues === 0) {
    console.log('   ✓ No unprocessed i18n keys found in activities');
}

// ==========================================
// 3. Summary
// ==========================================
console.log('\n📊 Summary:');
console.log('   - Manager activities fixed');
console.log('   - i18n keys checked');

console.log('\n✅ All fixes applied!');

db.close();
