/**
 * Direct import test - bypasses HTTP auth, calls the actual import logic
 * Run on server: node test_direct_import.js
 */
const axios = require('axios');
const { marked } = require('marked');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Database = require('better-sqlite3');

const TEST_URL = 'https://www.dongqiudi.com/articles/5682287.html';
const IMAGES_DIR = '/Volumes/fileserver/Service/Knowledge/Images';
const DB_PATH = './longhorn.db';

// Copy of saveImageLocally from knowledge.js
async function saveImageLocally(src, baseUrl, outputDir) {
    if (!src) return null;
    try {
        let fullSrc = src;
        if (baseUrl && !src.startsWith('http')) {
            const base = new URL(baseUrl);
            fullSrc = src.startsWith('/') ? `${base.origin}${src}` : `${base.origin}/${src}`;
        }
        if (!fullSrc.startsWith('http') || fullSrc.startsWith('data:')) return null;
        const response = await axios.get(fullSrc, {
            responseType: 'arraybuffer', timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': baseUrl || new URL(fullSrc).origin,
                'Accept': 'image/avif,image/webp,image/*,*/*;q=0.8'
            }
        });
        const buffer = Buffer.from(response.data);
        if (buffer.length < 1024) return null;
        const hash = crypto.createHash('md5').update(buffer).digest('hex').substring(0, 12);
        const isGif = fullSrc.toLowerCase().includes('.gif') || response.headers['content-type'] === 'image/gif';
        const ext = isGif ? 'gif' : 'webp';
        const filename = `web_${hash}.${ext}`;
        const filepath = path.join(outputDir, filename);
        if (fs.existsSync(filepath)) {
            return { original: src, local: `/data/knowledge_images/${filename}` };
        }
        if (!isGif) {
            const tempPngPath = filepath.replace('.webp', '.png');
            fs.writeFileSync(tempPngPath, buffer);
            try {
                execSync(`python3 -c "
import sys
from PIL import Image
img = Image.open('${tempPngPath}')
if img.mode in ('RGBA', 'LA', 'P'):
    bg = Image.new('RGB', img.size, (255,255,255))
    if img.mode == 'P': img = img.convert('RGBA')
    if img.mode in ('RGBA', 'LA'): bg.paste(img, mask=img.split()[-1])
    img = bg
elif img.mode != 'RGB':
    img = img.convert('RGB')
img.save('${filepath}', 'WEBP', quality=85, method=6)
"`, { encoding: 'utf8', timeout: 10000 });
                fs.unlinkSync(tempPngPath);
            } catch (e) {
                if (fs.existsSync(tempPngPath)) fs.renameSync(tempPngPath, filepath.replace('.webp', '.png'));
                return null;
            }
        } else {
            fs.writeFileSync(filepath, buffer);
        }
        return { original: src, local: `/data/knowledge_images/${filename}` };
    } catch (err) {
        return null;
    }
}

function removeContentTitle(content) {
    if (!content) return content;
    let removed = false;
    content = content.replace(/<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>/i, (match) => {
        if (!removed) { removed = true; return ''; }
        return match;
    });
    content = content.replace(/^\s+/, '').replace(/\n{3,}/g, '\n\n');
    return content.trim();
}

function generateSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
}

(async () => {
    console.log('=== Direct Import Test ===\n');

    // 1. Fetch from Jina (with 422 fallback)
    console.log('1. Fetching from Jina...');
    let response, markdown;
    try {
        response = await axios.get(`https://r.jina.ai/${TEST_URL}`, {
            headers: {
                'Accept': 'text/plain', 'X-No-Cache': 'true',
                'X-Target-Selector': 'article, main, [role="main"], .article-content, .post-content, .entry-content, .content, #content, .main-content'
            },
            timeout: 45000
        });
        markdown = response.data;
    } catch (e) {
        if (e.response && e.response.status === 422) {
            console.log('   422 fallback...');
            response = await axios.get(`https://r.jina.ai/${TEST_URL}`, {
                headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' }, timeout: 45000
            });
            markdown = response.data;
        } else throw e;
    }
    console.log(`   Got ${markdown.length} chars`);

    // 2. Extract title
    const lines = markdown.split('\n').map(l => l.trim()).filter(Boolean);
    let detectedTitle = '';
    for (const line of lines) {
        if (line.startsWith('# ')) { detectedTitle = line.replace(/^#+\s*/, '').trim(); break; }
    }
    if (!detectedTitle && lines.length > 0 && lines[0].length < 250) detectedTitle = lines[0].trim();
    if (detectedTitle) {
        detectedTitle = detectedTitle.replace(/^Title:\s*/i, '').split(/\s+[|–—]\s+|\s+-\s+/)[0].trim();
    }
    const articleTitle = detectedTitle || 'Web Import';
    console.log(`2. Title: "${articleTitle}"`);

    // 3. Download images
    console.log('3. Downloading images...');
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const imgMatches = [...markdown.matchAll(/!\[[^\]]*\]\(\s*([^\)\s]+)\s*\)/g)];
    const downloadedImages = [];
    for (const match of imgMatches) {
        const result = await saveImageLocally(match[1], null, IMAGES_DIR);
        if (result) downloadedImages.push(result);
    }
    console.log(`   ${downloadedImages.length}/${imgMatches.length} images downloaded`);

    // 4. Replace URLs and clean Jina metadata and truncate comment section
    let finalMarkdown = markdown;
    downloadedImages.forEach(img => { finalMarkdown = finalMarkdown.split(img.original).join(img.local); });

    finalMarkdown = finalMarkdown
        .replace(/^Title:\s*.+$/gm, '')
        .replace(/^URL Source:\s*.+$/gm, '')
        .replace(/^Markdown Content:\s*$/gm, '');

    const commentMarkers = [
        /^.*热门评论/m, /^.*精彩评论/m, /^.*用户评论/m, /^.*全部评论/m,
        /^.*相关推荐/m, /^.*相关文章/m, /^.*猜你喜欢/m, /^.*更多精彩/m,
        /^.*Popular Comments/im, /^.*Related Articles/im, /^.*You May Also Like/im,
        /^.*Leave a [Cc]omment/m, /^.*Comments?\s*\(\d+\)/m,
        /^.*上一篇[:：]/m, /^.*下一篇[:：]/m
    ];
    for (const marker of commentMarkers) {
        const match = finalMarkdown.match(marker);
        if (match) {
            const idx = finalMarkdown.indexOf(match[0]);
            if (idx > finalMarkdown.length * 0.2) {
                console.log(`[Knowledge Import] Truncating at comment marker: "${match[0].trim().substring(0, 40)}"`);
                finalMarkdown = finalMarkdown.substring(0, idx).trim();
                break;
            }
        }
    }
    finalMarkdown = finalMarkdown.replace(/^\n{2,}/, '\n');

    // 5. Convert to HTML
    const htmlContent = marked.parse(finalMarkdown);
    console.log(`4. HTML length: ${htmlContent.length}`);

    // 6. Remove content title
    const cleanedContent = removeContentTitle(htmlContent);
    const firstImg = cleanedContent.match(/<img[^>]*src="([^"]*)"[^>]*>/);
    console.log(`5. First img src: ${firstImg ? firstImg[1] : 'NO IMAGES'}`);
    console.log(`   Content starts: "${cleanedContent.substring(0, 150).replace(/\n/g, '\\n')}"`);

    // 7. Insert into DB
    const db = new Database(DB_PATH);
    const slug = generateSlug(articleTitle);
    const existing = db.prepare('SELECT id FROM knowledge_articles WHERE slug = ?').get(slug);
    if (existing) {
        console.log(`\n6. Article already exists (id=${existing.id}), deleting...`);
        db.prepare('DELETE FROM knowledge_articles WHERE id = ?').run(existing.id);
    }

    const cleanSummary = cleanedContent.replace(/<[^>]+>/g, '').replace(/[#*`><]/g, '').replace(/\s+/g, ' ').trim().substring(0, 300);
    const result = db.prepare(`
        INSERT INTO knowledge_articles (
            title, slug, summary, content, category,
            product_line, product_models, tags, visibility, status,
            source_type, source_reference, source_url,
            chapter_number, section_number,
            created_by, created_at, updated_at, published_at
        ) VALUES (
            @title, @slug, @summary, @content, @category,
            @product_line, @product_models, @tags, @visibility, 'Published',
            'URL', @source_reference, @source_url,
            1, 1,
            @created_by, datetime('now'), datetime('now'), datetime('now')
        )
    `).run({
        title: articleTitle,
        slug,
        summary: cleanSummary,
        content: cleanedContent,
        category: 'Application Note',
        product_line: 'GENERIC',
        product_models: '[]',
        tags: JSON.stringify(['Web Import', 'Application Note']),
        visibility: 'Internal',
        source_reference: articleTitle,
        source_url: TEST_URL,
        created_by: 1
    });

    const articleId = result.lastInsertRowid;
    console.log(`\n6. Inserted article id=${articleId}`);

    // 8. Verify by reading back
    const article = db.prepare('SELECT id, title, substr(content, 1, 300) as preview FROM knowledge_articles WHERE id = ?').get(articleId);
    console.log(`\n=== VERIFICATION ===`);
    console.log(`ID: ${article.id}`);
    console.log(`Title: "${article.title}"`);
    console.log(`Content preview: "${article.preview}"`);

    // Check for issues
    const issues = [];
    if (article.title.includes(' - ') || article.title.includes(' – ')) issues.push('Title still has site suffix!');
    if (article.preview.includes('<h1>')) issues.push('Content still has H1!');
    if (!article.preview.includes('<img')) issues.push('No images in first 300 chars');
    if (article.preview.includes('Title:') || article.preview.includes('URL Source:')) issues.push('Jina metadata not cleaned!');

    if (issues.length === 0) {
        console.log('\n✅ ALL CHECKS PASSED!');
    } else {
        console.log('\n❌ ISSUES FOUND:');
        issues.forEach(i => console.log(`   - ${i}`));
    }

    console.log(`\nView at: https://opware.kineraw.com/tech-hub/wiki/${articleId}`);
    db.close();
})();
