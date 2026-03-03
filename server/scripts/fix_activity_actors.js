/**
 * One-time fix: Patch empty actor_name in ticket_activities
 * and convert creation activity content from JSON to readable text.
 *
 * Run: node scripts/fix_activity_actors.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(DB_PATH);

console.log('[FixActors] Patching empty actor_name in ticket_activities...');

// 1. Fix all activities with empty actor_name by looking up users table
const emptyActors = db.prepare(
    "SELECT ta.id, ta.actor_id FROM ticket_activities ta WHERE ta.actor_id IS NOT NULL AND (ta.actor_name IS NULL OR ta.actor_name = '')"
).all();

console.log(`[FixActors] Found ${emptyActors.length} activities with empty actor_name`);

let patched = 0;
for (const act of emptyActors) {
    const user = db.prepare(
        'SELECT COALESCE(display_name, username) as name FROM users WHERE id = ?'
    ).get(act.actor_id);

    if (user && user.name) {
        db.prepare('UPDATE ticket_activities SET actor_name = ? WHERE id = ?')
            .run(user.name, act.id);
        patched++;
    }
}
console.log(`[FixActors] Patched ${patched} actor names`);

// 2. Fix creation activities that have JSON content instead of readable text
const creationActs = db.prepare(
    "SELECT ta.id, ta.ticket_id, ta.content, ta.activity_type FROM ticket_activities ta WHERE ta.activity_type = 'status_change' AND ta.content LIKE '{%from_node%null%}'"
).all();

console.log(`[FixActors] Found ${creationActs.length} creation activities to convert`);

let converted = 0;
for (const act of creationActs) {
    try {
        const meta = JSON.parse(act.content);
        if (meta.from_node === null) {
            const ticket = db.prepare('SELECT ticket_number, ticket_type FROM tickets WHERE id = ?').get(act.ticket_id);
            const content = `创建了${ticket?.ticket_type === 'RMA' ? 'RMA' : ''}工单 ${ticket?.ticket_number || ''}`;
            db.prepare(
                "UPDATE ticket_activities SET activity_type = 'system_event', content = ?, metadata = ? WHERE id = ?"
            ).run(content, JSON.stringify({ ...meta, event_type: 'creation' }), act.id);
            converted++;
        }
    } catch (e) {
        // content is not JSON, skip
    }
}
console.log(`[FixActors] Converted ${converted} creation activities`);

// 3. Backfill creation activities for tickets that don't have one
const missingCreation = db.prepare(`
    SELECT t.id, t.ticket_number, t.ticket_type, t.created_at, t.created_by, t.assigned_to, t.priority,
           COALESCE(u.display_name, u.username, 'system') as creator_name
    FROM tickets t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.id NOT IN (SELECT ticket_id FROM ticket_activities WHERE activity_type = 'system_event' AND metadata LIKE '%creation%')
`).all();

console.log(`[FixActors] Found ${missingCreation.length} tickets missing creation activity`);

let backfilled = 0;
for (const t of missingCreation) {
    const label = t.ticket_type === 'rma' ? 'RMA' : '';
    db.prepare(`
        INSERT INTO ticket_activities (ticket_id, activity_type, content, metadata, actor_id, actor_name, actor_role, visibility, created_at)
        VALUES (?, 'system_event', ?, ?, ?, ?, 'MS', 'all', ?)
    `).run(
        t.id,
        `创建了${label}工单 ${t.ticket_number}`,
        JSON.stringify({ event_type: 'creation', ticket_type: t.ticket_type, assigned_to: t.assigned_to, priority: t.priority }),
        t.created_by || 1,
        t.creator_name,
        t.created_at
    );
    backfilled++;
}
console.log(`[FixActors] Backfilled ${backfilled} creation activities`);

db.close();
console.log('[FixActors] Done!');
