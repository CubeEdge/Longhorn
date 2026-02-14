#!/usr/bin/env node
/**
 * Migration Script: Sync product_family from products to tickets
 * Purpose: Populate product_family field in ticket tables based on associated product
 * Date: 2026-02-12
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath);

console.log('========================================');
console.log('Product Family Migration Script');
console.log('========================================\n');

// Migration statistics
const stats = {
    inquiry_tickets: { updated: 0, skipped: 0, errors: 0 },
    rma_tickets: { updated: 0, skipped: 0, errors: 0 },
    dealer_repairs: { updated: 0, skipped: 0, errors: 0 }
};

try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION');

    // ==========================================
    // 1. Migrate Inquiry Tickets
    // ==========================================
    console.log('Processing inquiry_tickets...');
    
    const inquiryTickets = db.prepare(`
        SELECT t.id, t.product_id, p.product_family
        FROM inquiry_tickets t
        LEFT JOIN products p ON t.product_id = p.id
        WHERE t.product_id IS NOT NULL
          AND (t.product_family IS NULL OR t.product_family = '')
    `).all();

    const updateInquiry = db.prepare('UPDATE inquiry_tickets SET product_family = ? WHERE id = ?');
    
    for (const ticket of inquiryTickets) {
        try {
            if (ticket.product_family) {
                updateInquiry.run(ticket.product_family, ticket.id);
                stats.inquiry_tickets.updated++;
            } else {
                // Product exists but has no family assigned
                updateInquiry.run('Unknown', ticket.id);
                stats.inquiry_tickets.updated++;
            }
        } catch (e) {
            console.error(`  Error updating inquiry ticket ${ticket.id}:`, e.message);
            stats.inquiry_tickets.errors++;
        }
    }

    // Count skipped (no product_id)
    const inquirySkipped = db.prepare(`
        SELECT COUNT(*) as count FROM inquiry_tickets WHERE product_id IS NULL
    `).get();
    stats.inquiry_tickets.skipped = inquirySkipped.count;

    console.log(`  Updated: ${stats.inquiry_tickets.updated}`);
    console.log(`  Skipped (no product): ${stats.inquiry_tickets.skipped}`);
    console.log(`  Errors: ${stats.inquiry_tickets.errors}\n`);

    // ==========================================
    // 2. Migrate RMA Tickets
    // ==========================================
    console.log('Processing rma_tickets...');
    
    const rmaTickets = db.prepare(`
        SELECT t.id, t.product_id, p.product_family
        FROM rma_tickets t
        LEFT JOIN products p ON t.product_id = p.id
        WHERE t.product_id IS NOT NULL
          AND (t.product_family IS NULL OR t.product_family = '')
    `).all();

    const updateRma = db.prepare('UPDATE rma_tickets SET product_family = ? WHERE id = ?');
    
    for (const ticket of rmaTickets) {
        try {
            if (ticket.product_family) {
                updateRma.run(ticket.product_family, ticket.id);
                stats.rma_tickets.updated++;
            } else {
                updateRma.run('Unknown', ticket.id);
                stats.rma_tickets.updated++;
            }
        } catch (e) {
            console.error(`  Error updating RMA ticket ${ticket.id}:`, e.message);
            stats.rma_tickets.errors++;
        }
    }

    const rmaSkipped = db.prepare(`
        SELECT COUNT(*) as count FROM rma_tickets WHERE product_id IS NULL
    `).get();
    stats.rma_tickets.skipped = rmaSkipped.count;

    console.log(`  Updated: ${stats.rma_tickets.updated}`);
    console.log(`  Skipped (no product): ${stats.rma_tickets.skipped}`);
    console.log(`  Errors: ${stats.rma_tickets.errors}\n`);

    // ==========================================
    // 3. Migrate Dealer Repairs
    // ==========================================
    console.log('Processing dealer_repairs...');
    
    const dealerRepairs = db.prepare(`
        SELECT t.id, t.product_id, p.product_family
        FROM dealer_repairs t
        LEFT JOIN products p ON t.product_id = p.id
        WHERE t.product_id IS NOT NULL
          AND (t.product_family IS NULL OR t.product_family = '')
    `).all();

    const updateDealer = db.prepare('UPDATE dealer_repairs SET product_family = ? WHERE id = ?');
    
    for (const ticket of dealerRepairs) {
        try {
            if (ticket.product_family) {
                updateDealer.run(ticket.product_family, ticket.id);
                stats.dealer_repairs.updated++;
            } else {
                updateDealer.run('Unknown', ticket.id);
                stats.dealer_repairs.updated++;
            }
        } catch (e) {
            console.error(`  Error updating dealer repair ${ticket.id}:`, e.message);
            stats.dealer_repairs.errors++;
        }
    }

    const dealerSkipped = db.prepare(`
        SELECT COUNT(*) as count FROM dealer_repairs WHERE product_id IS NULL
    `).get();
    stats.dealer_repairs.skipped = dealerSkipped.count;

    console.log(`  Updated: ${stats.dealer_repairs.updated}`);
    console.log(`  Skipped (no product): ${stats.dealer_repairs.skipped}`);
    console.log(`  Errors: ${stats.dealer_repairs.errors}\n`);

    // ==========================================
    // 4. Verify Results
    // ==========================================
    console.log('Verification:');
    
    const inquiryVerify = db.prepare(`
        SELECT product_family, COUNT(*) as count 
        FROM inquiry_tickets 
        WHERE product_family IS NOT NULL 
        GROUP BY product_family
    `).all();
    console.log('  Inquiry tickets by family:', inquiryVerify);

    const rmaVerify = db.prepare(`
        SELECT product_family, COUNT(*) as count 
        FROM rma_tickets 
        WHERE product_family IS NOT NULL 
        GROUP BY product_family
    `).all();
    console.log('  RMA tickets by family:', rmaVerify);

    const dealerVerify = db.prepare(`
        SELECT product_family, COUNT(*) as count 
        FROM dealer_repairs 
        WHERE product_family IS NOT NULL 
        GROUP BY product_family
    `).all();
    console.log('  Dealer repairs by family:', dealerVerify);

    // Commit transaction
    db.exec('COMMIT');

    console.log('\n========================================');
    console.log('Migration completed successfully!');
    console.log('========================================');
    console.log('\nSummary:');
    console.log(`  Inquiry Tickets: ${stats.inquiry_tickets.updated} updated, ${stats.inquiry_tickets.skipped} skipped`);
    console.log(`  RMA Tickets: ${stats.rma_tickets.updated} updated, ${stats.rma_tickets.skipped} skipped`);
    console.log(`  Dealer Repairs: ${stats.dealer_repairs.updated} updated, ${stats.dealer_repairs.skipped} skipped`);

} catch (error) {
    console.error('\n========================================');
    console.error('Migration failed!');
    console.error('========================================');
    console.error(error.message);
    
    // Rollback on error
    try {
        db.exec('ROLLBACK');
        console.log('Transaction rolled back.');
    } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError.message);
    }
    
    process.exit(1);
} finally {
    db.close();
}
