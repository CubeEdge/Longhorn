#!/usr/bin/env node
/**
 * 诊断知识库导入问题
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'longhorn.db');
const db = new Database(DB_PATH);

console.log('🔍 知识库导入诊断\n');

// 1. 检查最近创建的文章
console.log('📚 最近创建的10篇文章:');
const recent = db.prepare(`
    SELECT id, title, product_line, product_models, category, status, created_at
    FROM knowledge_articles
    ORDER BY created_at DESC
    LIMIT 10
`).all();

recent.forEach(a => {
    console.log(`  [${a.id}] ${a.title}`);
    console.log(`      产品线: ${a.product_line} | 型号: ${a.product_models} | ${a.category} | ${a.created_at}`);
});

// 2. 检查所有产品型号
console.log('\n🏷️  数据库中的所有产品型号:');
const models = db.prepare(`
    SELECT DISTINCT product_models, COUNT(*) as count
    FROM knowledge_articles
    WHERE product_models IS NOT NULL
    GROUP BY product_models
    ORDER BY count DESC
`).all();

models.forEach(m => {
    console.log(`  ${m.product_models}: ${m.count}篇`);
});

// 3. 检查是否有Mark 2或LF相关的内容
console.log('\n🔎 搜索 Mark 2 / LF 关键词:');
const searchResults = db.prepare(`
    SELECT id, title, product_models, created_at
    FROM knowledge_articles
    WHERE title LIKE '%Mark%' OR title LIKE '%LF%' OR title LIKE '%MARK%'
       OR product_models LIKE '%Mark%' OR product_models LIKE '%LF%'
    LIMIT 20
`).all();

if (searchResults.length > 0) {
    searchResults.forEach(a => {
        console.log(`  [${a.id}] ${a.title} - ${a.product_models} (${a.created_at})`);
    });
} else {
    console.log('  ❌ 未找到任何 Mark 2 或 LF 相关文章');
}

// 4. 按产品线统计
console.log('\n📊 按产品线统计:');
const byLine = db.prepare(`
    SELECT product_line, COUNT(*) as count
    FROM knowledge_articles
    GROUP BY product_line
    ORDER BY count DESC
`).all();

byLine.forEach(l => {
    console.log(`  ${l.product_line || '(空)'}: ${l.count}篇`);
});

// 5. 检查source_type和source_reference
console.log('\n📝 按来源类型统计:');
const bySource = db.prepare(`
    SELECT source_type, source_reference, COUNT(*) as count
    FROM knowledge_articles
    WHERE source_type IS NOT NULL
    GROUP BY source_type, source_reference
    ORDER BY count DESC
    LIMIT 20
`).all();

bySource.forEach(s => {
    console.log(`  ${s.source_type || '(空)'} - ${s.source_reference || '(无)'}: ${s.count}篇`);
});

// 6. 检查最近的Manual类文章
console.log('\n📖 最近的Manual类文章（前15篇）:');
const manuals = db.prepare(`
    SELECT id, title, product_models, source_reference, created_at
    FROM knowledge_articles
    WHERE category = 'Manual'
    ORDER BY created_at DESC
    LIMIT 15
`).all();

manuals.forEach(m => {
    console.log(`  [${m.id}] ${m.title}`);
    console.log(`      型号: ${m.product_models} | 来源: ${m.source_reference || '(空)'}`);
});

db.close();
console.log('\n✅ 诊断完成');
