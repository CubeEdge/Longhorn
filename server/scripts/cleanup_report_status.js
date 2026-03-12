/**
 * Cleanup script to normalize repair_reports and proforma_invoices status
 * Only two valid statuses should exist: 'published' and 'draft'
 * 
 * Rules:
 * - approved/pending_review -> draft (not yet published)
 * - rejected -> draft (can be re-edited)
 * - any other status -> draft
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(dbPath);

console.log('Cleaning up document status...\n');

// Check current status distribution for repair_reports
const reportStatuses = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM repair_reports 
    WHERE is_deleted = 0 
    GROUP BY status
`).all();

console.log('=== Current Repair Reports Status Distribution ===');
reportStatuses.forEach(s => console.log(`  ${s.status}: ${s.count}`));

// Check current status distribution for proforma_invoices
const piStatuses = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM proforma_invoices 
    WHERE is_deleted = 0 
    GROUP BY status
`).all();

console.log('\n=== Current PI Status Distribution ===');
piStatuses.forEach(s => console.log(`  ${s.status}: ${s.count}`));

// Fix repair_reports: convert non-standard status to draft
const fixedReports = db.prepare(`
    UPDATE repair_reports 
    SET status = 'draft', updated_at = CURRENT_TIMESTAMP
    WHERE status NOT IN ('published', 'draft') AND is_deleted = 0
`).run();

console.log(`\n✅ Fixed ${fixedReports.changes} repair reports with non-standard status`);

// Fix proforma_invoices: convert non-standard status to draft
const fixedPIs = db.prepare(`
    UPDATE proforma_invoices 
    SET status = 'draft', updated_at = CURRENT_TIMESTAMP
    WHERE status NOT IN ('published', 'draft') AND is_deleted = 0
`).run();

console.log(`✅ Fixed ${fixedPIs.changes} PIs with non-standard status`);

// Verify final status distribution
const finalReportStatuses = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM repair_reports 
    WHERE is_deleted = 0 
    GROUP BY status
`).all();

console.log('\n=== Final Repair Reports Status Distribution ===');
finalReportStatuses.forEach(s => console.log(`  ${s.status}: ${s.count}`));

const finalPIStatuses = db.prepare(`
    SELECT status, COUNT(*) as count 
    FROM proforma_invoices 
    WHERE is_deleted = 0 
    GROUP BY status
`).all();

console.log('\n=== Final PI Status Distribution ===');
finalPIStatuses.forEach(s => console.log(`  ${s.status}: ${s.count}`));

console.log('\n✨ Cleanup complete!');
db.close();
