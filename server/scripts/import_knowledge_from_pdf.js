#!/usr/bin/env node
/**
 * Import knowledge base from PDF manuals
 * Usage: node import_knowledge_from_pdf.js <pdf_file_path>
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const pdfParse = require('pdf-parse');

// Initialize database
const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath);

/**
 * Generate URL-safe slug from Chinese/English text
 */
function generateSlug(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s\u4e00-\u9fa5-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .substring(0, 100);
}

/**
 * Clean text content
 */
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

/**
 * Split PDF content into chapters/sections
 * Heuristic: Split by chapter numbers or major headings
 */
function splitIntoSections(text, productModel) {
    const sections = [];
    
    // Strategy 1: Split by numbered chapters (e.g., "第一章", "1.", "1 ")
    // Strategy 2: Split by major headings with specific patterns
    
    // For MAVO Edge manual, try pattern like:
    // "第X章", "X.", or major section breaks
    
    const lines = text.split('\n');
    let currentSection = null;
    let currentTitle = '';
    let currentContent = [];
    
    const chapterPatterns = [
        /^第[一二三四五六七八九十百]+章[\s:：](.+)/,
        /^第\s*\d+\s*章[\s:：](.+)/,
        /^\d+[\.\s]+(.+)/,
        /^[A-Z\s]{3,}$/  // All caps titles
    ];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let isChapterStart = false;
        let detectedTitle = '';
        
        for (const pattern of chapterPatterns) {
            const match = line.match(pattern);
            if (match) {
                isChapterStart = true;
                detectedTitle = match[1] || line;
                break;
            }
        }
        
        // If chapter detected, save previous section and start new one
        if (isChapterStart && currentContent.length > 20) {
            if (currentTitle) {
                sections.push({
                    title: currentTitle,
                    content: cleanText(currentContent.join('\n'))
                });
            }
            currentTitle = detectedTitle.trim();
            currentContent = [line];
        } else {
            currentContent.push(line);
        }
    }
    
    // Save last section
    if (currentTitle && currentContent.length > 20) {
        sections.push({
            title: currentTitle,
            content: cleanText(currentContent.join('\n'))
        });
    }
    
    // Fallback: If no chapters detected, split by page breaks or size
    if (sections.length === 0) {
        console.log('⚠️  No chapters detected, using fallback split by content size');
        const chunkSize = 2000; // ~2000 chars per section
        const words = text.split(/\n+/);
        let chunk = [];
        let chunkIndex = 1;
        
        for (const word of words) {
            chunk.push(word);
            if (chunk.join('\n').length > chunkSize) {
                const content = cleanText(chunk.join('\n'));
                const firstLine = content.split('\n')[0].substring(0, 50);
                sections.push({
                    title: `${productModel} 操作说明 - Part ${chunkIndex}`,
                    content: content
                });
                chunk = [];
                chunkIndex++;
            }
        }
        
        if (chunk.length > 0) {
            sections.push({
                title: `${productModel} 操作说明 - Part ${chunkIndex}`,
                content: cleanText(chunk.join('\n'))
            });
        }
    }
    
    return sections;
}

/**
 * Parse PDF and extract knowledge articles
 */
async function parsePDF(filePath) {
    console.log(`📄 Reading PDF: ${filePath}`);
    
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    console.log(`📊 PDF Info:`);
    console.log(`   Pages: ${pdfData.numpages}`);
    console.log(`   Text length: ${pdfData.text.length} chars`);
    
    // Detect product model from filename
    const filename = path.basename(filePath);
    let productModel = 'Unknown';
    let productLine = 'Cinema';
    
    if (filename.includes('Edge 6K') || filename.includes('Edge6K')) {
        productModel = 'MAVO Edge 6K';
        productLine = 'Cinema';
    } else if (filename.includes('Edge 8K') || filename.includes('Edge8K')) {
        productModel = 'MAVO Edge 8K';
        productLine = 'Cinema';
    } else if (filename.includes('MAVO')) {
        productModel = 'MAVO';
        productLine = 'Cinema';
    } else if (filename.includes('Eagle')) {
        productModel = 'Eagle';
        productLine = 'Eagle';
    }
    
    console.log(`🎯 Detected product: ${productModel} (${productLine})`);
    
    // Split into sections
    const sections = splitIntoSections(pdfData.text, productModel);
    
    console.log(`📑 Split into ${sections.length} sections`);
    
    const articles = sections.map((section, index) => {
        const title = `${productModel}: ${section.title}`;
        return {
            title: title,
            slug: generateSlug(title),
            summary: section.content.substring(0, 200).trim(),
            content: section.content,
            category: 'Manual',
            product_line: productLine,
            product_models: JSON.stringify([productModel]),
            tags: JSON.stringify([productModel, 'Manual', '操作说明书']),
            visibility: 'Dealer',  // Manuals visible to dealers
            status: 'Published',
            source_file: filename
        };
    });
    
    return articles;
}

/**
 * Insert articles into database
 */
function insertArticles(articles) {
    console.log(`\n💾 Inserting ${articles.length} articles into database...`);
    
    // Disable foreign key constraints temporarily
    db.pragma('foreign_keys = OFF');
    
    const insertStmt = db.prepare(`
        INSERT INTO knowledge_articles (
            title, slug, summary, content, category, 
            product_line, product_models, tags, visibility, status,
            created_by, created_at, updated_at
        ) VALUES (
            @title, @slug, @summary, @content, @category,
            @product_line, @product_models, @tags, @visibility, @status,
            1, datetime('now'), datetime('now')
        )
    `);
    
    const checkDuplicateStmt = db.prepare('SELECT id FROM knowledge_articles WHERE slug = ?');
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    for (const article of articles) {
        try {
            // Check duplicate
            const existing = checkDuplicateStmt.get(article.slug);
            if (existing) {
                console.log(`⏭️  Skip duplicate: ${article.title}`);
                skipCount++;
                continue;
            }
            
            // Validate content
            if (!article.content || article.content.length < 50) {
                console.log(`⚠️  Skip empty content: ${article.title}`);
                skipCount++;
                continue;
            }
            
            insertStmt.run(article);
            console.log(`✅ Inserted: ${article.title.substring(0, 60)}...`);
            successCount++;
        } catch (err) {
            console.error(`❌ Failed to insert: ${article.title}`);
            console.error(`   Error: ${err.message}`);
            failCount++;
        }
    }
    
    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');
    
    console.log(`\n📊 Import Complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Skipped: ${skipCount}`);
    console.log(`   Failed: ${failCount}`);
    
    return { successCount, skipCount, failCount };
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node import_knowledge_from_pdf.js <pdf_file_path>');
        console.log('Example: node import_knowledge_from_pdf.js "../input docs/MAVO Edge 6K操作说明书.pdf"');
        process.exit(1);
    }
    
    const pdfPath = args[0];
    
    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ File not found: ${pdfPath}`);
        process.exit(1);
    }
    
    try {
        const articles = await parsePDF(pdfPath);
        const result = insertArticles(articles);
        
        console.log(`\n✨ All done! Knowledge base updated.`);
        
        db.close();
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

main();
