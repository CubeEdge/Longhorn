#!/usr/bin/env node
/**
 * Enhanced PDF Knowledge Importer with Intelligent Chapter Detection
 * Supports: Chapter titles, Markdown headers, numbered sections, TOC parsing
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const pdf = require('pdf-parse');

// Initialize database
const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath);

/**
 * Generate URL-safe slug
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
 * Enhanced chapter detection with multiple strategies
 */
function splitIntoSections(text, productModel, pdfInfo) {
    console.log(`🔍 Analyzing ${text.length} characters for chapter patterns...`);
    
    const sections = [];
    
    // Enhanced chapter detection patterns (ordered by priority)
    const chapterPatterns = [
        // Chinese chapter patterns
        { regex: /^第[一二三四五六七八九十百千]+章[\s:：](.+)$/m, priority: 1, type: 'chinese_chapter' },
        { regex: /^第\s*\d+\s*章[\s:：](.+)$/m, priority: 1, type: 'numbered_chapter' },
        
        // Numbered sections (1., 1.1, etc.)
        { regex: /^(\d+\.\d+\.?\d*)\s+(.+)$/m, priority: 2, type: 'subsection' },  // 1.1 或 1.1.1
        { regex: /^(\d+\.)\s+(.+)$/m, priority: 2, type: 'section' },  // 1. 标题
        
        // Markdown-style headers
        { regex: /^#{1,3}\s+(.+)$/m, priority: 1, type: 'markdown' },
        
        // All caps titles (3+ characters, common in English manuals)
        { regex: /^([A-Z][A-Z\s]{2,})$/m, priority: 3, type: 'caps_title' },
        
        // Chinese numbered items
        { regex: /^[一二三四五六七八九十]+[、.]\\s*(.+)$/m, priority: 2, type: 'chinese_number' }
    ];
    
    const lines = text.split('\n');
    let currentTitle = '';
    let currentContent = [];
    let sectionIndex = 0;
    let detectionLog = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        let isChapterStart = false;
        let detectedTitle = '';
        let matchPriority = 999;
        let matchType = '';
        
        // Try each pattern
        for (const pattern of chapterPatterns) {
            const match = line.match(pattern.regex);
            if (match && pattern.priority <= matchPriority) {
                isChapterStart = true;
                matchPriority = pattern.priority;
                matchType = pattern.type;
                
                // Extract title based on pattern
                if (match[2]) {
                    detectedTitle = match[2].trim();  // For numbered sections
                } else if (match[1]) {
                    detectedTitle = match[1].trim();
                } else {
                    detectedTitle = line;
                }
                
                // Validate title (not too short, not just numbers/symbols)
                if (detectedTitle.length < 2 || /^[\d\.\s]+$/.test(detectedTitle)) {
                    isChapterStart = false;
                }
            }
        }
        
        // Additional heuristics: detect potential headers by context
        if (!isChapterStart && currentContent.length > 50) {
            // Check if line looks like a title (short, no ending punctuation, capitalized)
            if (line.length > 3 && line.length < 80 && 
                !line.match(/[。！？；,，]$/) &&
                (line[0] === line[0].toUpperCase() || /^[一-龥]/.test(line))) {
                
                // Look ahead to see if next few lines are content (not another title)
                let nextLinesAreContent = false;
                for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine.length > 40) {
                        nextLinesAreContent = true;
                        break;
                    }
                }
                
                if (nextLinesAreContent) {
                    isChapterStart = true;
                    detectedTitle = line;
                    matchType = 'heuristic';
                    matchPriority = 3;
                }
            }
        }
        
        // Save section if we found a chapter start and have enough content
        if (isChapterStart && currentContent.length > 30) {
            if (currentTitle) {
                const content = cleanText(currentContent.join('\n'));
                if (content.length > 100) {  // Minimum content length
                    sections.push({
                        title: currentTitle,
                        content: content,
                        index: sectionIndex++,
                        type: detectionLog[detectionLog.length - 1]?.type || 'unknown'
                    });
                    console.log(`   ✓ [${matchType}] Section ${sectionIndex}: ${currentTitle.substring(0, 45)}...`);
                }
            }
            currentTitle = detectedTitle;
            currentContent = [line];
            detectionLog.push({ type: matchType, title: detectedTitle });
        } else {
            currentContent.push(line);
        }
    }
    
    // Save last section
    if (currentTitle && currentContent.length > 30) {
        const content = cleanText(currentContent.join('\n'));
        if (content.length > 100) {
            sections.push({
                title: currentTitle,
                content: content,
                index: sectionIndex++
            });
            console.log(`   ✓ Final section ${sectionIndex}: ${currentTitle.substring(0, 45)}...`);
        }
    }
    
    // Fallback: If no chapters detected or too few, use intelligent chunking
    if (sections.length === 0) {
        console.log('⚠️  No chapters detected, using intelligent semantic chunking');
        return intelligentSemanticChunking(text, productModel);
    } else if (sections.length < 3 && text.length > 10000) {
        console.log(`⚠️  Only ${sections.length} chapters found for ${text.length} chars, may need review`);
    }
    
    console.log(`✅ Successfully detected ${sections.length} chapters`);
    console.log(`📊 Detection types: ${detectionLog.map(d => d.type).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`);
    return sections;
}

/**
 * Intelligent semantic chunking fallback
 * Uses paragraph breaks and semantic coherence rather than fixed size
 */
function intelligentSemanticChunking(text, productModel) {
    const sections = [];
    const paragraphs = text.split(/\n\s*\n/);  // Split by double newlines (paragraph breaks)
    let chunk = [];
    let chunkIndex = 1;
    const targetSize = 1500;  // Target chars per chunk
    const maxSize = 2500;     // Max chars per chunk
    
    console.log(`📦 Chunking ${paragraphs.length} paragraphs into sections...`);
    
    for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed || trimmed.length < 10) continue;
        
        chunk.push(trimmed);
        const currentSize = chunk.join('\n\n').length;
        
        // Split if we've reached a good size
        if (currentSize > targetSize) {
            const content = cleanText(chunk.join('\n\n'));
            if (content.length > 100) {
                // Try to extract a meaningful title from first line
                const firstLine = content.split('\n')[0];
                let title;
                
                if (firstLine.length < 60 && !firstLine.match(/[。！？]$/)) {
                    // First line looks like a title
                    title = `${productModel}: ${firstLine}`;
                } else {
                    // Extract first few words as title
                    const words = firstLine.split(/\s+/).slice(0, 8).join(' ');
                    title = `${productModel} - Part ${chunkIndex}: ${words}${words.length < firstLine.length ? '...' : ''}`;
                }
                
                sections.push({
                    title: title,
                    content: content,
                    index: chunkIndex - 1,
                    type: 'semantic_chunk'
                });
                console.log(`   ✓ Chunk ${chunkIndex}: ${title.substring(0, 50)}...`);
                chunkIndex++;
            }
            chunk = [];
        }
        
        // Force split if too large (safety)
        if (currentSize > maxSize) {
            chunk = [];
        }
    }
    
    // Save last chunk
    if (chunk.length > 0) {
        const content = cleanText(chunk.join('\n\n'));
        if (content.length > 100) {
            const firstLine = content.split('\n')[0];
            const words = firstLine.split(/\s+/).slice(0, 8).join(' ');
            const title = `${productModel} - Part ${chunkIndex}: ${words}${words.length < firstLine.length ? '...' : ''}`;
            
            sections.push({
                title: title,
                content: content,
                index: chunkIndex - 1,
                type: 'semantic_chunk'
            });
            console.log(`   ✓ Final chunk ${chunkIndex}: ${title.substring(0, 50)}...`);
        }
    }
    
    console.log(`📦 Created ${sections.length} semantic chunks`);
    return sections;
}

/**
 * Parse PDF and extract knowledge articles
 */
async function parsePDF(filePath) {
    console.log(`📄 Reading PDF: ${filePath}`);
    
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdf(dataBuffer);
    
    console.log(`📊 PDF Metadata:`);
    console.log(`   Pages: ${pdfData.numpages}`);
    console.log(`   Text length: ${pdfData.text.length} characters`);
    console.log(`   Info:`, pdfData.info ? JSON.stringify(pdfData.info, null, 2) : 'N/A');
    
    // Detect product model from filename
    const filename = path.basename(filePath);
    let productModel = 'Unknown';
    let productLine = 'A';
    
    if (filename.includes('Edge 6K') || filename.includes('Edge6K')) {
        productModel = 'MAVO Edge 6K';
        productLine = 'A';
    } else if (filename.includes('Edge 8K') || filename.includes('Edge8K')) {
        productModel = 'MAVO Edge 8K';
        productLine = 'A';
    } else if (filename.includes('mark2') || filename.includes('Mark2')) {
        productModel = 'MAVO mark2';
        productLine = 'A';
    } else if (filename.includes('MAVO LF') || filename.includes('LF')) {
        productModel = 'MAVO LF';
        productLine = 'B';
    } else if (filename.includes('Terra 4K')) {
        productModel = 'Terra 4K';
        productLine = 'B';
    } else if (filename.includes('Terra 6K')) {
        productModel = 'Terra 6K';
        productLine = 'B';
    } else if (filename.includes('Eagle')) {
        productModel = 'Eagle';
        productLine = 'C';
    }
    
    console.log(`🎯 Detected product: ${productModel} (Family ${productLine})`);
    
    // Split into sections with enhanced detection
    const sections = splitIntoSections(pdfData.text, productModel, pdfData.info);
    
    console.log(`📑 Total sections extracted: ${sections.length}`);
    
    const articles = sections.map((section) => {
        const title = `${productModel}: ${section.title}`;
        return {
            title: title,
            slug: generateSlug(title),
            summary: section.content.substring(0, 200).trim(),
            content: section.content,
            category: 'Manual',
            product_line: productLine,
            product_models: JSON.stringify([productModel]),
            tags: JSON.stringify([productModel, 'Manual', '操作说明书', section.type || 'chapter']),
            visibility: 'Dealer',
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
                console.log(`⏭️  Skip duplicate: ${article.title.substring(0, 60)}...`);
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
            console.log(`✅ Inserted: ${article.title.substring(0, 70)}...`);
            successCount++;
        } catch (err) {
            console.error(`❌ Failed to insert: ${article.title}`);
            console.error(`   Error: ${err.message}`);
            failCount++;
        }
    }
    
    // Re-enable foreign keys
    db.pragma('foreign_keys = ON');
    
    console.log(`\n📊 Import Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ⏭️  Skipped: ${skipCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    
    return { successCount, skipCount, failCount };
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node import_knowledge_from_pdf_enhanced.js <pdf_file_path>');
        console.log('Example: node import_knowledge_from_pdf_enhanced.js "../input docs/MAVO Edge 6K操作说明书.pdf"');
        process.exit(1);
    }
    
    const pdfPath = args[0];
    
    if (!fs.existsSync(pdfPath)) {
        console.error(`❌ File not found: ${pdfPath}`);
        process.exit(1);
    }
    
    try {
        console.log('🚀 Enhanced PDF Knowledge Importer\n');
        const articles = await parsePDF(pdfPath);
        const result = insertArticles(articles);
        
        console.log(`\n✨ Import Complete! Total knowledge articles in database:`);
        const total = db.prepare('SELECT COUNT(*) as count FROM knowledge_articles').get();
        console.log(`   📚 ${total.count} articles`);
        
        db.close();
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    }
}

main();
