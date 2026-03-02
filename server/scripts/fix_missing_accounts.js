const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(__dirname, '..', 'longhorn.db');
const db = new Database(dbPath);
const isDryRun = process.argv.includes('--dry-run');

console.log(`Using database at: ${dbPath} (DRY RUN: ${isDryRun})`);

function fixTickets() {
    let updatedCount = 0;
    const ticketsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tickets'").get();

    if (ticketsTableExists) {
        console.log("Checking unified 'tickets' table...");
        const tickets = db.prepare(`
            SELECT id, ticket_number, account_id, reporter_name 
            FROM tickets 
            WHERE account_id IS NULL AND reporter_name IS NOT NULL
        `).all();

        for (const ticket of tickets) {
            let extractedName = ticket.reporter_name;
            if (extractedName && extractedName.trim() !== '') {
                const account = db.prepare(`SELECT id, name FROM accounts WHERE name COLLATE NOCASE = ?`).get(extractedName.trim());
                if (account) {
                    if (!isDryRun) {
                        db.prepare(`
                            UPDATE tickets 
                            SET account_id = ?, reporter_name = NULL 
                            WHERE id = ?
                        `).run(account.id, ticket.id);
                    }
                    console.log(`[tickets] Linked ticket ${ticket.ticket_number} (reporter: ${extractedName}) to account ${account.name} (ID: ${account.id})`);
                    updatedCount++;
                } else {
                    console.log(`[tickets] No account match for reporter: ${extractedName} on ticket ${ticket.ticket_number}`);
                }
            }
        }
    }

    const inquiryTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='inquiry_tickets'").get();
    if (inquiryTableExists) {
        console.log("Checking legacy 'inquiry_tickets' table...");
        const inquiryTickets = db.prepare(`
            SELECT id, ticket_number, account_id, customer_name, reporter_snapshot 
            FROM inquiry_tickets 
            WHERE account_id IS NULL AND (customer_name IS NOT NULL OR reporter_snapshot IS NOT NULL)
        `).all();

        for (const ticket of inquiryTickets) {
            let extractedName = ticket.customer_name;
            if (ticket.reporter_snapshot) {
                try {
                    const snap = JSON.parse(ticket.reporter_snapshot);
                    if (snap && snap.name) {
                        extractedName = snap.name;
                    }
                } catch (e) { }
            }

            if (extractedName && extractedName.trim() !== '') {
                const account = db.prepare(`SELECT id, name FROM accounts WHERE name COLLATE NOCASE = ?`).get(extractedName.trim());
                if (account) {
                    if (!isDryRun) {
                        db.prepare(`
                            UPDATE inquiry_tickets 
                            SET account_id = ?, customer_name = NULL, reporter_snapshot = NULL 
                            WHERE id = ?
                        `).run(account.id, ticket.id);
                    }
                    console.log(`[inquiry_tickets] Linked ticket ${ticket.ticket_number} (reporter: ${extractedName}) to account ${account.name} (ID: ${account.id})`);
                    updatedCount++;
                } else {
                    console.log(`[inquiry_tickets] No account match for reporter: ${extractedName} on ticket ${ticket.ticket_number}`);
                }
            }
        }
    }

    console.log(`Fix complete. Updated ${updatedCount} tickets.`);
}

try {
    db.transaction(fixTickets)();
} catch (err) {
    console.error("Error during migration:", err);
} finally {
    db.close();
}
