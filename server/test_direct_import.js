/**
 * Phase 1: Clean article 750 content (remove breadcrumbs, nav, TOC)
 * Phase 2: Call Longhorn's Bokeh API to translate + format
 * 
 * Usage: node test_direct_import.js
 */

const path = require('path');
const Database = require('better-sqlite3');
const http = require('http');

const DB_PATH = path.join(__dirname, 'longhorn.db');
const ARTICLE_ID = 750;

// ──────── Content Cleaning Logic ────────

function cleanImportedContent(html) {
    if (!html) return html;

    // === Phase 1: Remove leading breadcrumb navigation ===
    // Pattern: <ul> containing <li><a>...</a></li> then <li>CurrentPage</li> </ul>
    html = html.replace(/^\s*<ul>\s*(?:<li>[\s\S]*?<\/li>\s*)*<\/ul>/i, '');

    // Remove standalone "Print" paragraph (Jina artifact)
    html = html.replace(/<p>\s*Print\s*<\/p>/gi, '');

    // === Phase 2: Remove trailing navigation and sidebar ===
    const navPatterns = [
        /<p>\s*<a[^>]*>Previous\s/i,
        /<p>\s*<a[^>]*>Next\s/i,
        /<p>\s*How Can We Help/i,
        /<p>\s*Search\s*<\/p>/i,
        /<p>\s*Table of Contents\s*<\/p>/i,
        /<hr\s*\/?>\s*<pre>/i,
    ];

    for (const pattern of navPatterns) {
        const match = html.match(pattern);
        if (match) {
            const idx = html.indexOf(match[0]);
            if (idx > html.length * 0.15) {
                console.log(`  [Clean] Truncating at: "${match[0].substring(0, 60).replace(/<[^>]+>/g, '')}..."`);
                html = html.substring(0, idx).trim();
            }
        }
    }

    // === Phase 3: Remove ALL headings (h1-h3) ===
    html = html.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/gi, '');

    // === Phase 4: Strip remaining page-level noise ===
    html = html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/\s+style\s*=\s*"[^"]*"/gi, '')
        .replace(/\s+class\s*=\s*"[^"]*"/gi, '');

    // === Phase 5: Clean up whitespace ===
    html = html.replace(/^\s+/, '').replace(/\n{3,}/g, '\n\n').trim();

    return html;
}

// ──────── Bokeh API Call ────────

function callBokehApi(articleId) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ mode: 'full' });

        const options = {
            hostname: 'localhost',
            port: 3456,
            path: `/api/v1/knowledge/${articleId}/format`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Cookie': 'auth_token=admin_session'  // Will need proper auth
            }
        };

        console.log(`  [Bokeh] POST /api/v1/knowledge/${articleId}/format`);

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`  [Bokeh] Response: ${res.statusCode}`);
                try {
                    const result = JSON.parse(data);
                    resolve(result);
                } catch (e) {
                    resolve({ raw: data.substring(0, 200) });
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(120000);
        req.write(postData);
        req.end();
    });
}

// ──────── Main ────────

async function main() {
    console.log('=== Article 750 Direct Fix ===\n');

    // 1. Open DB
    const db = new Database(DB_PATH);
    const article = db.prepare('SELECT id, title, content FROM knowledge_articles WHERE id = ?').get(ARTICLE_ID);

    if (!article) {
        console.error(`Article ${ARTICLE_ID} not found!`);
        process.exit(1);
    }

    console.log(`[DB] Article ${article.id}: "${article.title}"`);
    console.log(`[DB] Original content length: ${article.content.length}\n`);

    // 2. Clean raw HTML
    console.log('[Phase 1] Cleaning HTML content...');
    const cleanedHtml = cleanImportedContent(article.content);
    console.log(`[Phase 1] Cleaned content length: ${cleanedHtml.length}`);
    console.log(`[Phase 1] Content preview:\n---\n${cleanedHtml.substring(0, 400)}\n---\n`);

    // 3. Update DB with cleaned content (reset format_status so Bokeh will re-process)
    console.log('[Phase 2] Updating article with cleaned content...');
    db.prepare(`
        UPDATE knowledge_articles 
        SET content = ?, formatted_content = NULL, format_status = 'none'
        WHERE id = ?
    `).run(cleanedHtml, ARTICLE_ID);
    console.log('[Phase 2] ✅ Content cleaned and saved. Bokeh format_status reset to "none".\n');

    // 4. Verify
    const updated = db.prepare('SELECT length(content) as len, format_status FROM knowledge_articles WHERE id = ?').get(ARTICLE_ID);
    console.log(`[Verify] Content length: ${updated.len}, format_status: ${updated.format_status}`);

    db.close();

    // 5. Now trigger Bokeh via API
    console.log('\n[Phase 3] Triggering Bokeh optimization via API...');
    console.log('  Note: You can trigger Bokeh from the UI by clicking "Bokeh 美化排版" button.\n');

    console.log('=== Done ===');
    console.log(`Next step: Open article ${ARTICLE_ID} in the browser and click Bokeh optimize.`);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
