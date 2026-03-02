/**
 * Fix Manager -> Cathy migration
 * Updates all ticket activities where actor_name = 'Manager' to 'Cathy'
 */

const db = require('better-sqlite3')('longhorn.db');

console.log('🔍 Finding Manager user...');
const managerUser = db.prepare(`
    SELECT id, username 
    FROM users 
    WHERE username = 'Manager'
`).get();

if (!managerUser) {
    console.log('❌ Manager user not found');
    process.exit(0);
}

console.log(`✓ Found Manager user (ID: ${managerUser.id})`);

console.log('\n🔍 Finding Cathy user...');
const cathyUser = db.prepare(`
    SELECT id, username 
    FROM users 
    WHERE username = 'cathy' OR username = 'Cathy'
`).get();

if (!cathyUser) {
    console.log('❌ Cathy user not found');
    process.exit(0);
}

console.log(`✓ Found Cathy user (ID: ${cathyUser.id})`);

// Find all activities with Manager as actor
console.log('\n📋 Finding activities with Manager as actor...');
const managerActivities = db.prepare(`
    SELECT id, ticket_id, actor_id, actor_name 
    FROM ticket_activities 
    WHERE actor_name = 'Manager'
`).all();

console.log(`Found ${managerActivities.length} activities`);

if (managerActivities.length > 0) {
    console.log('\n✏️  Updating activities...');
    
    // Update activities to use Cathy instead of Manager
    const updateStmt = db.prepare(`
        UPDATE ticket_activities 
        SET actor_id = ?, actor_name = ?
        WHERE actor_name = 'Manager'
    `);
    
    const result = updateStmt.run(cathyUser.id, 'Cathy');
    console.log(`✓ Updated ${result.changes} activities`);
}

// Also check for @Manager mentions in content
console.log('\n📋 Finding activities with @Manager mentions...');
const mentionActivities = db.prepare(`
    SELECT id, ticket_id, content 
    FROM ticket_activities 
    WHERE content LIKE '%@Manager%'
`).all();

console.log(`Found ${mentionActivities.length} activities with @Manager mentions`);

if (mentionActivities.length > 0) {
    console.log('\n✏️  Replacing @Manager with @Cathy...');
    
    const updateMentionStmt = db.prepare(`
        UPDATE ticket_activities 
        SET content = REPLACE(content, '@Manager', '@Cathy')
        WHERE content LIKE '%@Manager%'
    `);
    
    const result = updateMentionStmt.run();
    console.log(`✓ Updated ${result.changes} activity mentions`);
}

console.log('\n✅ Migration complete!');
console.log('\n📊 Summary:');
console.log(`   - Activities with actor_name='Manager': ${managerActivities.length}`);
console.log(`   - Activities with @Manager mentions: ${mentionActivities.length}`);
console.log(`   - All updated to use 'Cathy' instead`);

db.close();
