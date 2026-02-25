/**
 * Test script: Import a dongqiudi article and verify the results
 * Run on server: node test_import.js
 */
const axios = require('axios');
const { marked } = require('marked');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TEST_URL = 'https://www.dongqiudi.com/articles/5682287.html';
const IMAGES_DIR = '/Volumes/fileserver/Service/Knowledge/Images';

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
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Referer': baseUrl || new URL(fullSrc).origin,
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
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
            console.log(`  [EXISTS] ${filename}`);
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
                console.log(`  [SAVED WebP] ${filename} (${(fs.statSync(filepath).size / 1024).toFixed(1)}KB)`);
            } catch (convertErr) {
                console.log(`  [CONVERT FAIL] ${convertErr.message}`);
                if (fs.existsSync(tempPngPath)) {
                    const pngFilename = filename.replace('.webp', '.png');
                    fs.renameSync(tempPngPath, path.join(outputDir, pngFilename));
                    return { original: src, local: `/data/knowledge_images/${pngFilename}` };
                }
                return null;
            }
        } else {
            fs.writeFileSync(filepath, buffer);
            console.log(`  [SAVED GIF] ${filename} (${(buffer.length / 1024).toFixed(1)}KB)`);
        }

        return { original: src, local: `/data/knowledge_images/${filename}` };
    } catch (err) {
        console.log(`  [FAIL] ${src} - ${err.message}`);
        return null;
    }
}

async function downloadMarkdownImages(markdown, outputDir) {
    const downloadedImages = [];
    const matches = markdown.matchAll(/!\[[^\]]*\]\(\s*([^\)\s]+)\s*\)/g);
    for (const match of matches) {
        const src = match[1];
        const localMapping = await saveImageLocally(src, null, outputDir);
        if (localMapping) downloadedImages.push(localMapping);
    }
    return downloadedImages;
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

(async () => {
    console.log('=== Test Import: dongqiudi ===\n');

    // Step 1: Fetch from Jina
    console.log('1. Fetching from Jina Reader...');
    let markdown;
    try {
        const response = await axios.get(`https://r.jina.ai/${TEST_URL}`, {
            headers: {
                'Accept': 'text/plain',
                'X-No-Cache': 'true',
                'X-Target-Selector': 'article, main, [role="main"], .article-content, .post-content, .entry-content, .content, #content, .main-content'
            },
            timeout: 45000
        });
        markdown = response.data;
    } catch (e) {
        if (e.response && e.response.status === 422) {
            console.log('   422 fallback - retrying without selector...');
            const resp2 = await axios.get(`https://r.jina.ai/${TEST_URL}`, {
                headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' },
                timeout: 45000
            });
            markdown = resp2.data;
        } else {
            console.log('   FATAL:', e.message);
            process.exit(1);
        }
    }
    console.log(`   Markdown length: ${markdown.length} chars`);

    // Step 2: Extract title
    const lines = markdown.split('\n').map(l => l.trim()).filter(Boolean);
    let detectedTitle = '';
    for (const line of lines) {
        if (line.startsWith('# ')) {
            detectedTitle = line.replace(/^#+\s*/, '').trim();
            break;
        }
    }
    if (!detectedTitle && lines.length > 0 && lines[0].length < 250) {
        detectedTitle = lines[0].trim();
    }
    if (detectedTitle) {
        detectedTitle = detectedTitle
            .replace(/^Title:\s*/i, '')
            .split(/\s+[|–—]\s+|\s+-\s+/)[0]
            .trim();
    }
    console.log(`\n2. Detected title: "${detectedTitle}"`);

    // Step 3: Count images in markdown
    const imgMatches = [...markdown.matchAll(/!\[[^\]]*\]\(\s*([^\)\s]+)\s*\)/g)];
    console.log(`\n3. Images in markdown: ${imgMatches.length}`);
    imgMatches.forEach((m, i) => console.log(`   [${i}] ${m[1].substring(0, 80)}`));

    // Step 4: Download images
    console.log('\n4. Downloading images...');
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });
    const downloadedImages = await downloadMarkdownImages(markdown, IMAGES_DIR);
    console.log(`   Downloaded: ${downloadedImages.length}/${imgMatches.length}`);

    // Step 5: Replace URLs and convert to HTML
    let finalMarkdown = markdown;
    downloadedImages.forEach(img => {
        finalMarkdown = finalMarkdown.split(img.original).join(img.local);
    });
    const htmlContent = marked.parse(finalMarkdown);
    console.log(`\n5. HTML content length: ${htmlContent.length}`);

    // Step 6: Check for <img> tags in HTML
    const imgTags = [...htmlContent.matchAll(/<img[^>]*src="([^"]*)"[^>]*>/g)];
    console.log(`   <img> tags in HTML: ${imgTags.length}`);
    imgTags.forEach((m, i) => console.log(`   [${i}] src="${m[1]}"`));

    // Step 7: Remove content title
    const cleanedContent = removeContentTitle(htmlContent);
    console.log(`\n6. After removeContentTitle:`);
    // Check first heading
    const firstHeading = cleanedContent.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    if (firstHeading) {
        console.log(`   First heading remaining: "${firstHeading[0].replace(/<[^>]+>/g, '').trim()}"`);
    } else {
        console.log('   No headings remaining (all removed or none existed)');
    }
    console.log(`   Content starts with: "${cleanedContent.substring(0, 100)}..."`);

    // Step 8: Verify image files exist
    console.log('\n7. Verifying image files on disk...');
    downloadedImages.forEach(img => {
        const filename = img.local.replace('/data/knowledge_images/', '');
        const fullPath = path.join(IMAGES_DIR, filename);
        const exists = fs.existsSync(fullPath);
        const size = exists ? (fs.statSync(fullPath).size / 1024).toFixed(1) : 0;
        console.log(`   ${exists ? '✅' : '❌'} ${filename} (${size}KB)`);
    });

    // Step 9: Check static route would work
    console.log('\n8. Static route verification:');
    console.log(`   Images saved to: ${IMAGES_DIR}`);
    console.log(`   Static route: /data/knowledge_images -> ${IMAGES_DIR}`);
    if (downloadedImages.length > 0) {
        const testFile = downloadedImages[0].local.replace('/data/knowledge_images/', '');
        const testPath = path.join(IMAGES_DIR, testFile);
        console.log(`   Test: ${testPath} exists = ${fs.existsSync(testPath)}`);
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Title: "${detectedTitle}"`);
    console.log(`Images: ${downloadedImages.length} downloaded out of ${imgMatches.length}`);
    console.log(`First heading removed: ${htmlContent.length > cleanedContent.length ? 'YES' : 'NO'}`);
    console.log(`Content type: HTML (via marked)`);
})();
