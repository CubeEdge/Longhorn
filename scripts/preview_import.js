const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../server/longhorn.db');
const db = new Database(dbPath);
const csvPath = path.join(__dirname, '../testdocs/parts_ac.csv');

try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n');

    // 获取当前整机名库
    const products = db.prepare("SELECT id, name_zh, name_en FROM product_models WHERE is_active = 1").all();

    const preview_parts_master = [];
    const preview_sku_prices = [];
    const preview_model_parts = [];

    // 精准 CSV 解析正则（安全包裹引号内的逗号）
    const parseCsvLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') { inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
            else { current += char; }
        }
        result.push(current);
        return result;
    };

    function findModelId(text) {
        if (!text) return [];
        // 处理比如 MAVO Edge/MAVO mark2 的斜杠兼容
        const keywords = text.split(/[\/、,]/).map(t => t.trim().toLowerCase());
        const matched = [];
        const matchedIds = new Set();

        products.forEach(p => {
            const nameZh = p.name_zh ? p.name_zh.toLowerCase() : '';
            const nameEn = p.name_en ? p.name_en.toLowerCase() : '';
            
            keywords.forEach(key => {
                if (!key || key.length < 2) return; // 过滤脏串
                if (nameZh.includes(key) || nameEn.includes(key) || key.includes(nameZh) || key.includes(nameEn)) {
                    if (!matchedIds.has(p.id)) {
                        matched.push(p);
                        matchedIds.add(p.id);
                    }
                }
            });
        });
        return matched;
    }

    let startData = false;
    let mockId = 1;

    lines.forEach((line) => {
        if (!line.trim()) return;
        const fields = parseCsvLine(line.trim());
        
        // 定位表头
        if (fields.includes('SKU')) { startData = true; return; }
        if (!startData) return;

        // 获取列 (索引因为前方有一个空列，向后移 1 位)
        const index_num = fields[1];
        const compatibleText = fields[2];
        const sku = fields[3];
        const materialId = fields[4];
        const nameZh = fields[5];
        const nameEn = fields[6];
        const extNameZh = fields[7];
        const extNameEn = fields[8];
        
        // 清洗价格
        const cleanPrice = (val) => val ? val.replace(/[^\d.]/g, '') : '0';
        const cny = cleanPrice(fields[9]);
        const usd = cleanPrice(fields[10]);
        const eur = cleanPrice(fields[11]);

        if (!sku || sku.trim().length === 0) return;

        const models = findModelId(compatibleText);

        // 1. parts_master 预览
        preview_parts_master.push({
            id: `[自动分配]`,
            sku: sku.trim(),
            material_id: materialId ? materialId.trim() : null,
            name_internal: nameZh ? nameZh.trim() : '',
            name_internal_en: nameEn ? nameEn.trim() : null,
            name_external: extNameZh ? extNameZh.trim() : (nameZh ? nameZh.trim() : ''),
            name_external_en: extNameEn ? extNameEn.trim() : null,
            category: models.map(m => m.name_zh).join('/') || '通用配件'
        });

        // 2. sku_prices 预览
        preview_sku_prices.push({
            sku: sku.trim(),
            price_cny: parseFloat(cny) || 0,
            price_usd: parseFloat(usd) || 0,
            price_eur: parseFloat(eur) || 0
        });

        // 3. product_model_parts 预览
        models.forEach(m => {
            preview_model_parts.push({
                product_model: m.name_zh,
                part_sku: sku.trim(),
                part_name: nameZh ? nameZh.trim() : ''
            });
        });

        mockId++;
    });

    // 格式化输出为 Markdown
    let output = `# 📊 数据导入预期值预览报告\n\n`;
    output += `> 此报告由 Dry-Run 解析脚本生成，为您验证数据级联在三张表中的真实归宿。数据源: \`testdocs/parts_ac.csv\`\n\n`;

    output += `## 1️⃣ \`parts_master\` (配件主档案 - 基础项)\n\n`;
    output += `| 模拟ID | SKU | 物料ID | 内部名称(CN) | 对外名称(CN) | 归属分类(关联联动) |\n`;
    output += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    preview_parts_master.forEach(p => {
        output += `| ${p.id} | ${p.sku} | ${p.material_id || '-'} | ${p.name_internal} | ${p.name_external} | \`${p.category}\` |\n`;
    });

    output += `\n## 2️⃣ \`sku_prices\` (财务价格中枢)\n\n`;
    output += `| 配件SKU | CNY 价格 | USD 价格 | EUR 价格 |\n`;
    output += `| :--- | :--- | :--- | :--- |\n`;
    preview_sku_prices.forEach(p => {
        output += `| ${p.sku} | **¥ ${p.price_cny.toFixed(2)}** | $ ${p.price_usd.toFixed(2)} | € ${p.price_eur.toFixed(2)} |\n`;
    });

    output += `\n## 3️⃣ \`product_model_parts\` (BOM 强关联关系表 - **最核心联动**)\n\n`;
    output += `| 🟢 匹配到的标准整机 | 配件SKU | 配件名称 |\n`;
    output += `| :--- | :--- | :--- |\n`;
    if (preview_model_parts.length === 0) {
        output += `| *暂无机型成功匹配* | - | - |\n`;
    } else {
        preview_model_parts.forEach(p => {
            output += `| **${p.product_model}** | ${p.part_sku} | ${p.part_name} |\n`;
        });
    }

    const reportPath = path.join(__dirname, '../import_preview.md');
    fs.writeFileSync(reportPath, output);
    console.log(`✅ Preview report generated at: import_preview.md`);

} catch (err) {
    console.error('Preview failed:', err);
} finally {
    db.close();
}
