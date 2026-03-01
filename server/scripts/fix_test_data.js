const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath, { verbose: console.log });

console.log('--- Fixing Ticket Account IDs ---');

const fixTable = (tableName, nameColumn, idCol = 'account_id') => {
    try {
        const tickets = db.prepare(`SELECT id, ${nameColumn} FROM ${tableName} WHERE ${idCol} IS NULL AND ${nameColumn} IS NOT NULL`).all();
        let updated = 0;

        const updateStmt = db.prepare(`UPDATE ${tableName} SET ${idCol} = ? WHERE id = ?`);

        for (const ticket of tickets) {
            const name = ticket[nameColumn];
            if (!name) continue;
            const lowerName = name.toLowerCase();

            let matchId = null;
            if (lowerName.includes('netflix')) matchId = 1;
            else if (lowerName.includes('arri')) matchId = 2;
            else if (lowerName.includes('panavision')) matchId = 3;
            else if (lowerName.includes('indie')) matchId = 4;

            if (matchId) {
                updateStmt.run(matchId, ticket.id);
                updated++;
                console.log(`Updated ${tableName} ID ${ticket.id} (${name}) -> Account ID ${matchId}`);
            } else {
                console.log(`No match found for ${tableName} ID ${ticket.id} (${name})`);
            }
        }
        console.log(`${tableName} updated: ${updated} records.`);
    } catch (e) {
        console.log(`Error processing ${tableName}: ${e.message}`);
    }
};

const runTx = db.transaction(() => {
    fixTable('tickets', 'reporter_name', 'account_id');
    fixTable('inquiry_tickets', 'customer_name', 'account_id');
    fixTable('inquiry_tickets', 'customer_contact', 'account_id');
    fixTable('rma_tickets_new', 'reporter_name', 'customer_id');
    fixTable('dealer_repairs_new', 'customer_name', 'account_id');
});

runTx();
console.log('--- Done ---');
db.close();
