#!/usr/bin/env node
/**
 * Migration Script: Populate Installed Base fields from existing data
 * 
 * This script:
 * 1. Executes the SQL migration to add new columns
 * 2. Infers current_owner_id from tickets
 * 3. Calculates warranty dates based on available data
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'longhorn.db');
const SQL_MIGRATION = path.join(__dirname, '015_extend_products_installed_base.sql');

function runMigration() {
    console.log('🚀 Starting Installed Base migration...\n');
    
    const db = new Database(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON');
    
    try {
        // Step 1: Execute SQL migration
        console.log('📦 Step 1: Adding new columns...');
        const sql = fs.readFileSync(SQL_MIGRATION, 'utf8');
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const stmt of statements) {
            try {
                db.exec(stmt);
                console.log('  ✓ Executed:', stmt.substring(0, 60).replace(/\n/g, ' ') + '...');
            } catch (e) {
                if (e.message.includes('duplicate column name')) {
                    console.log('  ⚠ Column already exists, skipping');
                } else {
                    throw e;
                }
            }
        }
        
        // Step 2: Infer current_owner_id from tickets
        console.log('\n🔍 Step 2: Inferring current_owner_id from tickets...');
        const products = db.prepare('SELECT id, serial_number FROM products').all();
        let ownerUpdated = 0;
        
        for (const product of products) {
            // Find the most recent ticket for this product
            const latestTicket = db.prepare(`
                SELECT t.account_id, a.account_type, t.created_at
                FROM tickets t
                JOIN accounts a ON t.account_id = a.id
                WHERE t.product_id = ? AND t.account_id IS NOT NULL
                ORDER BY t.created_at DESC
                LIMIT 1
            `).get(product.id);
            
            if (latestTicket) {
                // For dealers, we need to find the end customer
                let ownerId = latestTicket.account_id;
                let warrantySource = 'DIRECT_SHIPMENT';
                
                if (latestTicket.account_type === 'DEALER') {
                    // Try to find end customer through this dealer
                    const endCustomer = db.prepare(`
                        SELECT a.id
                        FROM tickets t
                        JOIN accounts a ON t.account_id = a.id
                        WHERE t.product_id = ? AND a.account_type != 'DEALER'
                        ORDER BY t.created_at DESC
                        LIMIT 1
                    `).get(product.id);
                    
                    if (endCustomer) {
                        ownerId = endCustomer.id;
                        warrantySource = 'DEALER_FALLBACK';
                    } else {
                        // No end customer found, dealer is the owner
                        warrantySource = 'DIRECT_SHIPMENT';
                    }
                } else {
                    // Direct sale to end customer
                    warrantySource = 'DIRECT_SHIPMENT';
                }
                
                // Update product with owner info
                db.prepare(`
                    UPDATE products 
                    SET current_owner_id = ?,
                        warranty_source = ?,
                        sales_channel = ?
                    WHERE id = ?
                `).run(ownerId, warrantySource, latestTicket.account_type === 'DEALER' ? 'DEALER' : 'DIRECT', product.id);
                
                ownerUpdated++;
            }
        }
        console.log(`  ✓ Updated ${ownerUpdated} products with owner information`);
        
        // Step 3: Calculate warranty dates
        console.log('\n📅 Step 3: Calculating warranty dates...');
        let warrantyUpdated = 0;
        
        for (const product of products) {
            const prod = db.prepare('SELECT current_owner_id, created_at, warranty_source FROM products WHERE id = ?').get(product.id);
            
            if (!prod.current_owner_id) continue;
            
            // Determine warranty start date
            let warrantyStart = null;
            
            // Try to get from invoice date if available
            const invoiceDate = db.prepare(`
                SELECT MIN(t.created_at) as first_ticket_date
                FROM tickets t
                WHERE t.product_id = ? AND t.account_id = ?
            `).get(product.id, prod.current_owner_id);
            
            if (invoiceDate && invoiceDate.first_ticket_date) {
                warrantyStart = invoiceDate.first_ticket_date.split(' ')[0]; // Get date part
            } else if (prod.created_at) {
                // Fallback to product creation date
                warrantyStart = prod.created_at.split(' ')[0];
            }
            
            if (warrantyStart) {
                // Calculate warranty end date (default 24 months)
                const startDate = new Date(warrantyStart);
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + 24);
                
                const warrantyEnd = endDate.toISOString().split('T')[0];
                
                // Determine warranty status
                const now = new Date();
                const warrantyStatus = endDate > now ? 'ACTIVE' : 'EXPIRED';
                
                db.prepare(`
                    UPDATE products 
                    SET warranty_start_date = ?,
                        warranty_end_date = ?,
                        warranty_status = ?,
                        warranty_months = 24
                    WHERE id = ?
                `).run(warrantyStart, warrantyEnd, warrantyStatus, product.id);
                
                warrantyUpdated++;
            }
        }
        console.log(`  ✓ Updated ${warrantyUpdated} products with warranty information`);
        
        // Step 4: Set product SKU based on model
        console.log('\n🏷️  Step 4: Setting product SKUs...');
        const skuMap = {
            'MAVO Edge 8K': 'K2-8K-BODY',
            'MAVO Edge 6K': 'K2-6K-BODY',
            'MAVO mark2 LF': 'K2-LF-MK2',
            'MAVO LF': 'K2-LF-BODY',
            'Terra 4K': 'T4K-BODY',
            'Eagle SDI': 'EVF-SDI',
            'Eagle HDMI': 'EVF-HDMI',
            'MC Board 8K': 'PCB-MAIN-8K',
            'PD KineBAT 75': 'BAT-75W'
        };
        
        let skuUpdated = 0;
        for (const [model, sku] of Object.entries(skuMap)) {
            const result = db.prepare(`
                UPDATE products 
                SET product_sku = ?
                WHERE model_name = ? AND (product_sku IS NULL OR product_sku = '')
            `).run(sku, model);
            skuUpdated += result.changes;
        }
        console.log(`  ✓ Updated ${skuUpdated} products with SKU`);
        
        // Summary
        console.log('\n📊 Migration Summary:');
        console.log('  - Products with owner:', db.prepare("SELECT COUNT(*) as cnt FROM products WHERE current_owner_id IS NOT NULL").get().cnt);
        console.log('  - Products with warranty:', db.prepare("SELECT COUNT(*) as cnt FROM products WHERE warranty_start_date IS NOT NULL").get().cnt);
        console.log('  - Products with SKU:', db.prepare("SELECT COUNT(*) as cnt FROM products WHERE product_sku IS NOT NULL").get().cnt);
        
        console.log('\n✅ Migration completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run if called directly
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration };
