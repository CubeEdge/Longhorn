/**
 * 数据迁移和丰富脚本
 * 1. 验证 dealer_id 映射
 * 2. 添加示例客户（机构、个人）
 * 3. 设置 parent_dealer_id 关联
 * 4. 添加示例工单
 * 5. 删除旧的 dealers 表
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(dbPath);

console.log('=== 数据迁移和丰富脚本 ===\n');

// 临时禁用外键约束
db.exec('PRAGMA foreign_keys = OFF');

// 1. 检查并建立 dealers -> accounts 的 ID 映射
console.log('1. 检查经销商ID映射...');

// 检查 dealers 表是否存在
let dealers = [];
try {
    dealers = db.prepare('SELECT id, name, code FROM dealers').all();
    console.log('旧 dealers 表:');
    dealers.forEach(d => console.log(`  id=${d.id}, name=${d.name}, code=${d.code}`));
} catch (e) {
    console.log('旧 dealers 表已删除，跳过映射');
}

const accountDealers = db.prepare("SELECT id, name, dealer_code FROM accounts WHERE account_type = 'DEALER'").all();

console.log('\n新 accounts 表 (DEALER):');
accountDealers.forEach(a => console.log(`  id=${a.id}, name=${a.name}, code=${a.dealer_code}`));

// 建立名称映射
const nameToAccountId = {};
accountDealers.forEach(a => {
    nameToAccountId[a.name] = a.id;
    nameToAccountId[a.dealer_code] = a.id;
});

const dealerIdMapping = {};
dealers.forEach(d => {
    const accountId = nameToAccountId[d.name] || nameToAccountId[d.code];
    if (accountId) {
        dealerIdMapping[d.id] = accountId;
    }
});

console.log('\nID映射关系 (旧dealers.id -> 新accounts.id):');
Object.entries(dealerIdMapping).forEach(([oldId, newId]) => {
    console.log(`  ${oldId} -> ${newId}`);
});

// 2. 更新工单中的 dealer_id
console.log('\n2. 更新工单中的 dealer_id...');
const tables = ['inquiry_tickets', 'rma_tickets', 'dealer_repairs', 'issues'];

tables.forEach(table => {
    try {
        const records = db.prepare(`SELECT id, dealer_id FROM ${table} WHERE dealer_id IS NOT NULL`).all();
        let updated = 0;
        records.forEach(r => {
            const newId = dealerIdMapping[r.dealer_id];
            if (newId && newId !== r.dealer_id) {
                db.prepare(`UPDATE ${table} SET dealer_id = ? WHERE id = ?`).run(newId, r.id);
                updated++;
            }
        });
        console.log(`  ${table}: ${records.length} 条记录, 更新 ${updated} 条`);
    } catch (e) {
        console.log(`  ${table}: 跳过 (${e.message})`);
    }
});

// 3. 添加示例客户
console.log('\n3. 添加示例客户...');

const sampleOrganizations = [
    { name: 'Warner Bros Studios', email: 'production@warnerbros.com', country: 'USA', region: '海外', dealer_id: 1, industry: '["Film Production","Entertainment"]' },
    { name: 'Netflix Production', email: 'gear@netflix.com', country: 'USA', region: '海外', dealer_id: 1, industry: '["Streaming","Content Production"]' },
    { name: 'BBC Studios', email: 'technical@bbc.co.uk', country: 'UK', region: '海外', dealer_id: 7, industry: '["Broadcasting","Documentary"]' },
    { name: '横店影视基地', email: 'equipment@hengdian.cn', country: 'China', region: '国内', dealer_id: null, industry: '["Film Production","Theme Park"]' },
    { name: '中央电视台', email: 'tech@cctv.com', country: 'China', region: '国内', dealer_id: null, industry: '["Broadcasting","News"]' },
    { name: 'ARD Germany', email: 'technik@ard.de', country: 'Germany', region: '海外', dealer_id: 2, industry: '["Broadcasting"]' },
    { name: 'Framestore VFX', email: 'production@framestore.com', country: 'UK', region: '海外', dealer_id: 7, industry: '["VFX","Post Production"]' },
];

const sampleIndividuals = [
    { name: 'John Smith', email: 'john.smith@gmail.com', country: 'USA', region: '海外', dealer_id: 1, notes: 'Independent filmmaker' },
    { name: 'Hans Mueller', email: 'hans.mueller@web.de', country: 'Germany', region: '海外', dealer_id: 2, notes: 'Documentary DP' },
    { name: '李明', email: 'liming@163.com', country: 'China', region: '国内', dealer_id: null, notes: '独立制片人' },
    { name: '张伟', email: 'zhangwei@qq.com', country: 'China', region: '国内', dealer_id: null, notes: '婚庆摄影师' },
    { name: 'Sarah Johnson', email: 'sarah.j@outlook.com', country: 'UK', region: '海外', dealer_id: 7, notes: 'Freelance cinematographer' },
    { name: 'Takeshi Yamamoto', email: 'takeshi@yahoo.co.jp', country: 'Japan', region: '海外', dealer_id: 6, notes: 'Commercial director' },
];

// 插入机构客户
let orgCount = 0;
sampleOrganizations.forEach(org => {
    const existing = db.prepare("SELECT id FROM accounts WHERE name = ? AND account_type = 'ORGANIZATION'").get(org.name);
    if (!existing) {
        db.prepare(`
            INSERT INTO accounts (name, email, account_type, country, region, parent_dealer_id, industry_tags, service_tier)
            VALUES (?, ?, 'ORGANIZATION', ?, ?, ?, ?, 'STANDARD')
        `).run(org.name, org.email, org.country, org.region, org.dealer_id, org.industry);
        orgCount++;
    }
});
console.log(`  新增机构客户: ${orgCount}`);

// 插入个人客户
let indCount = 0;
sampleIndividuals.forEach(ind => {
    const existing = db.prepare("SELECT id FROM accounts WHERE name = ? AND account_type = 'INDIVIDUAL'").get(ind.name);
    if (!existing) {
        db.prepare(`
            INSERT INTO accounts (name, email, account_type, country, region, parent_dealer_id, notes, service_tier)
            VALUES (?, ?, 'INDIVIDUAL', ?, ?, ?, ?, 'STANDARD')
        `).run(ind.name, ind.email, ind.country, ind.region, ind.dealer_id, ind.notes);
        indCount++;
    }
});
console.log(`  新增个人客户: ${indCount}`);

// 4. 为客户添加联系人
console.log('\n4. 添加示例联系人...');

const customers = db.prepare("SELECT id, name, email FROM accounts WHERE account_type IN ('ORGANIZATION', 'INDIVIDUAL')").all();
let contactCount = 0;

customers.forEach(cust => {
    const existingContact = db.prepare('SELECT id FROM contacts WHERE account_id = ?').get(cust.id);
    if (!existingContact) {
        const contactName = cust.name.includes(' ') ? cust.name.split(' ')[0] : cust.name;
        db.prepare(`
            INSERT INTO contacts (account_id, name, email, status, is_primary)
            VALUES (?, ?, ?, 'ACTIVE', 1)
        `).run(cust.id, contactName, cust.email);
        contactCount++;
    }
});
console.log(`  新增联系人: ${contactCount}`);

// 5. 添加示例工单
console.log('\n5. 添加示例工单...');

// 获取客户和联系人
const orgAccounts = db.prepare("SELECT a.id, a.name, a.parent_dealer_id, c.id as contact_id FROM accounts a LEFT JOIN contacts c ON a.id = c.account_id WHERE a.account_type = 'ORGANIZATION' LIMIT 5").all();
const indAccounts = db.prepare("SELECT a.id, a.name, a.parent_dealer_id, c.id as contact_id FROM accounts a LEFT JOIN contacts c ON a.id = c.account_id WHERE a.account_type = 'INDIVIDUAL' LIMIT 5").all();
const dealerAccounts = db.prepare("SELECT id, name, dealer_code FROM accounts WHERE account_type = 'DEALER'").all();

// 生成工单号
function generateTicketNumber(prefix) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${date}-${random}`;
}

// 添加咨询工单
const inquiryTickets = [
    { account: orgAccounts[0], type: 'TechnicalSupport', problem: 'MAVO Edge 6K 开机后显示固件错误，无法正常启动', channel: 'Email' },
    { account: orgAccounts[1], type: 'Consultation', problem: '想了解 MAVO Edge 8K 的 ProRes RAW 输出规格', channel: 'Phone' },
    { account: indAccounts[0], type: 'WarrantyQuery', problem: '购买的 MAVO Edge 保修期查询，序列号 KN2024001', channel: 'WeChat' },
    { account: indAccounts[1], type: 'RepairRequest', problem: '镜头卡口有松动，拍摄时画面会抖动', channel: 'Email' },
    { account: orgAccounts[2], type: 'TechnicalSupport', problem: 'SDI 输出信号不稳定，偶尔会出现雪花点', channel: 'Phone' },
];

let inquiryCount = 0;
inquiryTickets.forEach(t => {
    if (t.account) {
        const ticketNumber = generateTicketNumber('INQ');
        db.prepare(`
            INSERT INTO inquiry_tickets (
                ticket_number, account_id, contact_id, dealer_id,
                customer_name, service_type, channel, problem_summary,
                status, created_by, handler_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'InProgress', 1, 1)
        `).run(
            ticketNumber, t.account.id, t.account.contact_id, t.account.parent_dealer_id,
            t.account.name, t.type, t.channel, t.problem
        );
        inquiryCount++;
    }
});
console.log(`  新增咨询工单: ${inquiryCount}`);

// 添加 RMA 工单
const rmaTickets = [
    { account: orgAccounts[0], category: 'Sensor', problem: '传感器坏点过多，影响拍摄质量', serial: 'KN-E6K-2024-0001' },
    { account: orgAccounts[2], category: 'Power', problem: '电池仓接触不良，电池经常松脱', serial: 'KN-E6K-2024-0025' },
    { account: indAccounts[2], category: 'Recording', problem: 'CFast 卡槽读写速度异常，经常报错', serial: 'KN-E8K-2024-0102' },
];

let rmaCount = 0;
rmaTickets.forEach(t => {
    if (t.account) {
        const ticketNumber = generateTicketNumber('RMA');
        db.prepare(`
            INSERT INTO rma_tickets (
                ticket_number, account_id, contact_id, dealer_id,
                reporter_name, issue_category, problem_description, serial_number,
                status, is_warranty, submitted_by, assigned_to
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', 1, 1, 1)
        `).run(
            ticketNumber, t.account.id, t.account.contact_id, t.account.parent_dealer_id,
            t.account.name, t.category, t.problem, t.serial
        );
        rmaCount++;
    }
});
console.log(`  新增RMA工单: ${rmaCount}`);

// 添加经销商维修工单
const dealerRepairs = [
    { dealer: dealerAccounts[0], category: 'Lens Mount', problem: '客户送修：镜头卡口断裂，需更换', serial: 'KN-E6K-2023-0555' },
    { dealer: dealerAccounts[1], category: 'Display', problem: 'LCD 显示屏有亮线，影响监看', serial: 'KN-E8K-2024-0077' },
    { dealer: dealerAccounts[6], category: 'Cooling', problem: '散热风扇异响，需检修', serial: 'KN-E6K-2024-0088' },
];

let repairCount = 0;
dealerRepairs.forEach(t => {
    if (t.dealer) {
        const ticketNumber = generateTicketNumber('DRP');
        db.prepare(`
            INSERT INTO dealer_repairs (
                ticket_number, dealer_id, 
                issue_category, problem_description, serial_number,
                status
            ) VALUES (?, ?, ?, ?, ?, 'Received')
        `).run(ticketNumber, t.dealer.id, t.category, t.problem, t.serial);
        repairCount++;
    }
});
console.log(`  新增经销商维修单: ${repairCount}`);

// 6. 删除旧的 dealers 表
console.log('\n6. 删除旧的 dealers 表...');
try {
    // 先检查是否有其他表引用 dealers
    const fkCheck = db.prepare("PRAGMA foreign_key_list(issues)").all();
    const hasDealerFK = fkCheck.some(fk => fk.table === 'dealers');
    
    if (!hasDealerFK) {
        db.exec('DROP TABLE IF EXISTS dealers');
        console.log('  dealers 表已删除');
    } else {
        console.log('  跳过删除：存在外键约束');
    }
} catch (e) {
    console.log(`  删除失败: ${e.message}`);
}

// 7. 输出统计
console.log('\n=== 数据统计 ===');
const stats = {
    dealers: db.prepare("SELECT COUNT(*) as cnt FROM accounts WHERE account_type = 'DEALER'").get().cnt,
    organizations: db.prepare("SELECT COUNT(*) as cnt FROM accounts WHERE account_type = 'ORGANIZATION'").get().cnt,
    individuals: db.prepare("SELECT COUNT(*) as cnt FROM accounts WHERE account_type = 'INDIVIDUAL'").get().cnt,
    contacts: db.prepare("SELECT COUNT(*) as cnt FROM contacts").get().cnt,
    inquiryTickets: db.prepare("SELECT COUNT(*) as cnt FROM inquiry_tickets").get().cnt,
    rmaTickets: db.prepare("SELECT COUNT(*) as cnt FROM rma_tickets").get().cnt,
    dealerRepairs: db.prepare("SELECT COUNT(*) as cnt FROM dealer_repairs").get().cnt,
};

console.log(`经销商账户: ${stats.dealers}`);
console.log(`机构客户: ${stats.organizations}`);
console.log(`个人客户: ${stats.individuals}`);
console.log(`联系人: ${stats.contacts}`);
console.log(`咨询工单: ${stats.inquiryTickets}`);
console.log(`RMA工单: ${stats.rmaTickets}`);
console.log(`经销商维修单: ${stats.dealerRepairs}`);

console.log('\n✅ 数据迁移和丰富完成!');
db.close();
