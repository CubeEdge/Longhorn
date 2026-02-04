const path = require('path');
const Database = require('better-sqlite3');
const AIService = require('../service/ai_service');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_PATH = path.join(__dirname, '../longhorn.db');

async function verify() {
    console.log('[Verify] Starting AI Verification...');

    // 1. Setup DB
    const db = new Database(DB_PATH);

    // 2. Setup AI Service
    const aiService = new AIService(db);

    // 3. Test Ticket Parsing
    const testText = "Client from Shanghai complaining about their MAVO Edge 8K (SN: K2109001) overheating after 30 mins. Urgency: High. Contact: wang@film.cn";
    console.log(`[Verify] Testing Ticket Parsing with text: "${testText}"`);

    try {
        const result = await aiService.parseTicket(testText);
        console.log('[Verify] Parsing Result:', JSON.stringify(result, null, 2));

        if (result.product_model.includes('MAVO') && result.urgency === 'High') {
            console.log('[Verify] ✅ Ticket Parse Success');
        } else {
            console.error('[Verify] ❌ Ticket Parse Result Unexpected');
        }

        // 4. Verify Usage Log
        // Wait a bit for async insert
        await new Promise(r => setTimeout(r, 1000));

        const log = db.prepare('SELECT * FROM ai_usage_logs ORDER BY id DESC LIMIT 1').get();
        if (log) {
            console.log('[Verify] ✅ Usage Logged:', log);
        } else {
            console.error('[Verify] ❌ No Usage Log found');
        }

    } catch (err) {
        console.error('[Verify] ❌ Failed:', err);
    }
}

verify();
