/**
 * Knowledge Base Import from Excel
 * 从Excel文件导入知识库条目
 * 
 * 使用方法:
 *   node server/scripts/import_knowledge_from_excel.js --file "EAGLE知识库.xlsx"
 *   node server/scripts/import_knowledge_from_excel.js --all  (导入所有Excel)
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');

// 数据库连接
const dbPath = path.join(__dirname, '../longhorn.db');
const db = new Database(dbPath);

// 禁用外键约束（导入时）
db.pragma('foreign_keys = OFF');

// 配置
const INPUT_DOCS_DIR = path.join(__dirname, '../../input docs');
const KNOWLEDGE_FILES = [
    'EAGLE知识库.xlsx',
    'Knowledge base_Edge.xlsx',
    '固件Knowledge Base.xlsx'
];

/**
 * 生成URL友好的slug
 */
function generateSlug(title) {
    return title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 100);
}

/**
 * 清理文本（移除空白和特殊字符）
 */
function cleanText(text) {
    if (!text) return null;
    const cleaned = String(text).trim();
    return cleaned === '' || cleaned === 'NaN' ? null : cleaned;
}

/**
 * 解析EAGLE知识库.xlsx
 */
function parseEagleKnowledge(filePath) {
    console.log(`\n📖 解析 EAGLE知识库.xlsx...`);
    
    const workbook = XLSX.readFile(filePath);
    const articles = [];
    
    // 解析"知识库"工作表 (FAQ类型)
    if (workbook.SheetNames.includes('知识库')) {
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets['知识库'], { header: 1 });
        
        for (let i = 1; i < sheet.length; i++) {
            const row = sheet[i];
            const question = cleanText(row[1]);
            const externalAnswer = cleanText(row[2]);
            const internalAnswer = cleanText(row[3]);
            
            if (question && (externalAnswer || internalAnswer)) {
                // 合并内外部答案到content
                let content = '';
                if (externalAnswer) {
                    content += `## 外部回答\n\n${externalAnswer}\n\n`;
                }
                if (internalAnswer) {
                    content += `## 内部回答 ⚠️\n\n${internalAnswer}`;
                }
                
                // 确保content不为空
                if (!content.trim()) {
                    content = externalAnswer || internalAnswer || question;
                }
                
                articles.push({
                    title: question,
                    slug: generateSlug(question),
                    summary: externalAnswer ? externalAnswer.substring(0, 200) : null,
                    content: content || externalAnswer || internalAnswer,
                    category: 'FAQ',
                    product_line: 'Eagle',
                    product_models: JSON.stringify(['Eagle HDMI', 'Eagle SDI']),
                    tags: JSON.stringify(['Eagle', 'FAQ']),
                    visibility: 'Internal',
                    status: 'Published'
                });
            }
        }
    }
    
    // 解析"Troubleshooting"工作表
    if (workbook.SheetNames.includes('Troubleshooting')) {
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets['Troubleshooting'], { header: 1 });
        
        for (let i = 1; i < sheet.length; i++) {
            const row = sheet[i];
            const phenomenon = cleanText(row[1]);
            const steps = cleanText(row[2]);
            
            if (phenomenon && steps) {
                articles.push({
                    title: `故障排查: ${phenomenon}`,
                    slug: generateSlug(`troubleshoot-${phenomenon}`),
                    summary: `${phenomenon}的故障排查步骤`,
                    content: `## 问题现象\n\n${phenomenon}\n\n## 排查步骤\n\n${steps}`,
                    category: 'Troubleshooting',
                    product_line: 'Eagle',
                    product_models: JSON.stringify(['Eagle HDMI', 'Eagle SDI']),
                    tags: JSON.stringify(['Eagle', '故障排查', '维修']),
                    visibility: 'Dealer',
                    status: 'Published'
                });
            }
        }
    }
    
    // 解析"兼容性"工作表
    ['Eagle HDMI画面兼容性', 'Type-C供电', 'Eagle HDMI元数据'].forEach(sheetName => {
        if (workbook.SheetNames.includes(sheetName)) {
            const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            
            // 提取表头
            const headers = sheet[0] || [];
            
            // 转换为Markdown表格
            let tableContent = '| ' + headers.map(h => cleanText(h) || '').join(' | ') + ' |\n';
            tableContent += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
            
            for (let i = 1; i < sheet.length; i++) {
                const row = sheet[i];
                if (row && row.some(cell => cleanText(cell))) {
                    tableContent += '| ' + row.map(cell => cleanText(cell) || '').join(' | ') + ' |\n';
                }
            }
            
            articles.push({
                title: sheetName,
                slug: generateSlug(sheetName),
                summary: `Eagle HDMI ${sheetName.replace('Eagle HDMI', '')}兼容性列表`,
                content: `## ${sheetName}\n\n${tableContent}`,
                category: 'Compatibility',
                product_line: 'Eagle',
                product_models: JSON.stringify(['Eagle HDMI']),
                tags: JSON.stringify(['Eagle', '兼容性', sheetName]),
                visibility: 'Public',
                status: 'Published'
            });
        }
    });
    
    console.log(`✅ EAGLE知识库: 解析到 ${articles.length} 条知识`);
    return articles;
}

/**
 * 解析Knowledge base_Edge.xlsx
 */
function parseEdgeKnowledge(filePath) {
    console.log(`\n📖 解析 Knowledge base_Edge.xlsx...`);
    
    const workbook = XLSX.readFile(filePath);
    const articles = [];
    
    // 问题分类映射
    const categoryMap = {
        '基础知识': 'Manual',
        '机器稳定性': 'Troubleshooting',
        '素材': 'Troubleshooting',
        '监看': 'Troubleshooting',
        'SSD': 'Troubleshooting',
        '音频': 'Troubleshooting',
        '兼容性': 'Compatibility',
        '时码': 'FAQ',
        '硬件&结构': 'Manual',
        '生产': 'Internal',
        '生产工艺变更表': 'Internal',
        '卡口': 'FAQ'
    };
    
    workbook.SheetNames.forEach(sheetName => {
        if (sheetName === '生产' || sheetName === '生产工艺变更表') {
            // 跳过生产相关的内部表
            return;
        }
        
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        const category = categoryMap[sheetName] || 'FAQ';
        
        // 提取所有有效行
        let content = `## ${sheetName}\n\n`;
        
        for (let i = 0; i < sheet.length; i++) {
            const row = sheet[i];
            if (row && row.some(cell => cleanText(cell))) {
                const text = row.map(cell => cleanText(cell) || '').join(' | ');
                if (text.trim()) {
                    content += text + '\n\n';
                }
            }
        }
        
        if (content.length > 50) {
            articles.push({
                title: `MAVO Edge: ${sheetName}`,
                slug: generateSlug(`edge-${sheetName}`),
                summary: `MAVO Edge ${sheetName}相关知识`,
                content: content,
                category: category,
                product_line: 'Cinema',
                product_models: JSON.stringify(['MAVO Edge 8K', 'MAVO Edge 6K']),
                tags: JSON.stringify(['MAVO Edge', sheetName]),
                visibility: category === 'Internal' ? 'Internal' : 'Dealer',
                status: 'Published'
            });
        }
    });
    
    console.log(`✅ Edge知识库: 解析到 ${articles.length} 条知识`);
    return articles;
}

/**
 * 导入知识到数据库
 */
function importArticles(articles) {
    console.log(`\n💾 开始导入 ${articles.length} 条知识到数据库...`);
    
    // 先检查是否有用户，如果没有则创建一个系统用户
    let adminUserId;
    try {
        const user = db.prepare('SELECT id FROM users LIMIT 1').get();
        if (user) {
            adminUserId = user.id;
        } else {
            // 创建系统用户
            const result = db.prepare(`
                INSERT INTO users (username, email, password_hash, role, user_type, department)
                VALUES ('system', 'system@kinefinity.com', 'N/A', 'Admin', 'Employee', '系统')
            `).run();
            adminUserId = result.lastInsertRowid;
            console.log(`✨ 创建系统用户 ID: ${adminUserId}`);
        }
    } catch (err) {
        console.error('⚠️  获取用户失败，使用ID=1:', err.message);
        adminUserId = 1;
    }
    
    const stmt = db.prepare(`
        INSERT INTO knowledge_articles (
            title, slug, summary, content,
            category, subcategory, tags,
            product_line, product_models,
            visibility, status, published_at,
            created_by, created_at
        ) VALUES (
            ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?
        )
    `);
    
    let successCount = 0;
    let skipCount = 0;
    
    const now = new Date().toISOString();
    
    for (const article of articles) {
        try {
            // 验证content不为空
            if (!article.content || article.content.trim().length === 0) {
                console.log(`⏭️  跳过空内容: ${article.title}`);
                skipCount++;
                continue;
            }
            
            // 检查是否已存在
            const existing = db.prepare('SELECT id FROM knowledge_articles WHERE slug = ?').get(article.slug);
            
            if (existing) {
                console.log(`⏭️  跳过重复: ${article.title}`);
                skipCount++;
                continue;
            }
            
            stmt.run(
                article.title,
                article.slug,
                article.summary,
                article.content,
                article.category,
                null, // subcategory
                article.tags,
                article.product_line,
                article.product_models,
                article.visibility,
                article.status,
                article.status === 'Published' ? now : null,
                adminUserId,
                now
            );
            
            successCount++;
            console.log(`✅ 导入: ${article.title.substring(0, 60)}`);
            
        } catch (err) {
            console.error(`❌ 导入失败 [${article.title.substring(0, 40)}]:`, err.message);
        }
    }
    
    console.log(`\n📊 导入完成!`);
    console.log(`  成功: ${successCount}`);
    console.log(`  跳过: ${skipCount}`);
    console.log(`  失败: ${articles.length - successCount - skipCount}`);
}

/**
 * 主函数
 */
function main() {
    const args = process.argv.slice(2);
    const allArticles = [];
    
    if (args.includes('--all')) {
        // 导入所有文件
        KNOWLEDGE_FILES.forEach(filename => {
            const filePath = path.join(INPUT_DOCS_DIR, filename);
            if (fs.existsSync(filePath)) {
                console.log(`\n🔍 处理文件: ${filename}`);
                
                if (filename.includes('EAGLE')) {
                    allArticles.push(...parseEagleKnowledge(filePath));
                } else if (filename.includes('Edge')) {
                    allArticles.push(...parseEdgeKnowledge(filePath));
                }
            } else {
                console.log(`⚠️  文件不存在: ${filename}`);
            }
        });
    } else {
        // 导入单个文件
        const fileArg = args.find(arg => arg.startsWith('--file='));
        if (!fileArg) {
            console.log('用法:');
            console.log('  node import_knowledge_from_excel.js --all');
            console.log('  node import_knowledge_from_excel.js --file="EAGLE知识库.xlsx"');
            process.exit(1);
        }
        
        const filename = fileArg.split('=')[1].replace(/['"]/g, '');
        const filePath = path.join(INPUT_DOCS_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            console.error(`❌ 文件不存在: ${filePath}`);
            process.exit(1);
        }
        
        if (filename.includes('EAGLE')) {
            allArticles.push(...parseEagleKnowledge(filePath));
        } else if (filename.includes('Edge')) {
            allArticles.push(...parseEdgeKnowledge(filePath));
        } else {
            console.error('❌ 不支持的文件格式');
            process.exit(1);
        }
    }
    
    // 导入到数据库
    if (allArticles.length > 0) {
        importArticles(allArticles);
    } else {
        console.log('⚠️  没有解析到任何知识条目');
    }
    
    db.close();
}

// 运行
main();
