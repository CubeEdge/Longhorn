/**
 * One-time migration: Fix missing participants from @mentions in ticket activities.
 * Scans all ticket_activities for @mentions and ensures corresponding
 * ticket_participants records exist.
 * 
 * Run: node scripts/fix_missing_participants.js
 */

const Database = require('better-sqlite3');
const path = require('path');

// Use the standard DB path
const DB_PATH = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(DB_PATH);

function parseMentions(content) {
    if (!content) return [];
    // Match @Username (Latin + CJK chars)
    const regex = /@([\w\u4e00-\u9fff]+)/g;
    const mentions = [];
    let m;
    while ((m = regex.exec(content)) !== null) {
        const user = db.prepare(
            'SELECT id, COALESCE(display_name, username) as name FROM users WHERE username = ? OR display_name = ?'
        ).get(m[1], m[1]);
        if (user) mentions.push({ user_id: user.id, name: user.name });
    }
    return mentions;
}

console.log('[FixParticipants] Starting scan...');

const acts = db.prepare(
    "SELECT id, ticket_id, content, actor_id, created_at FROM ticket_activities WHERE content LIKE '%@%' ORDER BY ticket_id"
).all();

console.log(`[FixParticipants] Found ${acts.length} activities with @mentions`);

let added = 0;
let skipped = 0;

for (const a of acts) {
    for (const u of parseMentions(a.content)) {
        const exists = db.prepare(
            'SELECT id FROM ticket_participants WHERE ticket_id = ? AND user_id = ?'
        ).get(a.ticket_id, u.user_id);

        if (!exists) {
            try {
                db.prepare(
                    'INSERT INTO ticket_participants (ticket_id, user_id, role, added_by, join_method, joined_at) VALUES (?, ?, ?, ?, ?, ?)'
                ).run(a.ticket_id, u.user_id, 'mentioned', a.actor_id, 'mention', a.created_at);
                console.log(`  + Added ${u.name} (${u.user_id}) to ticket ${a.ticket_id}`);
                added++;
            } catch (e) {
                console.error(`  Error adding ${u.name} to ticket ${a.ticket_id}:`, e.message);
            }
        } else {
            skipped++;
        }
    }
}

console.log(`[FixParticipants] Done. Added: ${added}, Already existed: ${skipped}`);
db.close();
