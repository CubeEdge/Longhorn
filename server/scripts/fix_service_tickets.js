/**
 * 修复Service工单数据
 * 
 * 1. 应用所有未运行的迁移
 * 2. 修复经销商维修单ID格式 (DRP-* → SVC-D-*)
 * 3. 为经销商维修单补充详细内容
 * 4. 修改RMA单，区分经销商返厂和直客返厂
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const db = new Database(path.join(__dirname, '../longhorn.db'));

console.log('=== 开始修复Service工单数据 ===\n');

// Step 1: 应用所有迁移
console.log('Step 1: 应用所有未运行的迁移...');
const migrationsDir = path.join(__dirname, '../service/migrations');
const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

for (const file of files) {
    const applied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file);
    
    if (!applied) {
        console.log(`  应用迁移: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        const statements = sql.split(';').filter(s => s.trim());
        
        for (const stmt of statements) {
            try {
                db.exec(stmt);
            } catch (err) {
                if (!err.message.includes('duplicate column name') && 
                    !err.message.includes('already exists')) {
                    console.error(`    错误: ${err.message}`);
                }
            }
        }
        
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
        console.log(`  ✓ ${file} 应用成功`);
    }
}

console.log('\nStep 2: 创建经销商维修单示例数据...');

// 获取经销商ID映射
const dealers = db.prepare("SELECT id, name FROM accounts WHERE account_type = 'DEALER' ORDER BY id").all();
const dealerMap = {};
dealers.forEach(d => dealerMap[d.name] = d.id);

console.log('经销商ID映射:', dealerMap);

// 获取客户ID
const customers = db.prepare("SELECT id, name FROM accounts WHERE account_type IN ('ORGANIZATION', 'INDIVIDUAL') ORDER BY id").all();
const customerMap = {};
customers.forEach(c => customerMap[c.name] = c.id);

console.log('客户数量:', customers.length);

// 经销商维修单示例数据
const dealerRepairs = [
    {
        dealer: 'ProAV UK',
        customer: 'BBC Studios',
        product: 'Edge8K',
        sn: '8624-A012',
        problem: 'SDI输出无信号，客户反映拍摄时SDI监视器突然黑屏',
        repair: '检测发现SDI模块接口松动，重新固定接口并更换SDI模块板',
        parts: [{ name: 'SDI模块板', sku: 'S1-011-013-01', qty: 1, price: 69 }],
        status: 'Completed',
        date: '2026-02-05'
    },
    {
        dealer: 'ProAV UK',
        customer: 'CVP UK',
        product: 'Edge8K',
        sn: '8624-A033',
        problem: '录制4K 120fps时偶发死机重启',
        repair: '测试确认为固件8021版本兼容性问题，升级固件至8023版本，测试稳定',
        parts: [],
        status: 'Completed',
        date: '2026-02-08'
    },
    {
        dealer: 'ProAV UK',
        customer: 'Warner Bros UK',
        product: 'Edge6K',
        sn: '6124-B005',
        problem: 'ND滤镜切换时有明显异响',
        repair: '拆解检查发现ND电机齿轮有轻微磨损，更换ND电机模块',
        parts: [{ name: 'ND电机模块', sku: 'S1-015-008-01', qty: 1, price: 129 }],
        status: 'Completed',
        date: '2026-02-10'
    },
    {
        dealer: 'Gafpa Gear',
        customer: 'German Film Academy',
        product: 'Edge8K',
        sn: '8624-C021',
        problem: '机身发热严重，长时间拍摄后自动关机',
        repair: '检测散热风扇转速异常，更换散热风扇组件，测试温度控制正常',
        parts: [{ name: '散热风扇组件', sku: 'S1-016-002-01', qty: 1, price: 89 }],
        status: 'Completed',
        date: '2026-02-07'
    },
    {
        dealer: 'Gafpa Gear',
        customer: 'Netflix EU',
        product: 'mark2',
        sn: 'M2-5012',
        problem: '触摸屏失灵，无法点击菜单',
        repair: '重新校准触摸屏并升级系统软件，恢复正常',
        parts: [],
        status: 'Completed',
        date: '2026-02-09'
    },
    {
        dealer: '1SV',
        customer: 'Los Angeles Film School',
        product: 'Edge8K',
        sn: '8624-D018',
        problem: 'KineMAG Nano存储卡无法识别',
        repair: '清洁存储卡槽并更新固件，测试存储卡识别正常',
        parts: [],
        status: 'Completed',
        date: '2026-02-06'
    },
    {
        dealer: '1SV',
        customer: 'Hollywood Rentals',
        product: 'TERRA4K',
        sn: 'T4K-8901',
        problem: '画面出现间歇性横条纹',
        repair: '检测发现Sensor接口接触不良，重新固定Sensor模块并清洁接口',
        parts: [],
        status: 'Completed',
        date: '2026-02-11'
    },
    {
        dealer: 'DP Gadget',
        customer: 'Singapore Media Corp',
        product: 'Edge6K',
        sn: '6124-E009',
        problem: '音频录制有电流噪声',
        repair: '检查音频输入接口，发现XLR接口有氧化，清洁接口并更换音频模块',
        parts: [{ name: '音频输入模块', sku: 'S1-012-005-01', qty: 1, price: 79 }],
        status: 'Completed',
        date: '2026-02-08'
    },
    {
        dealer: 'ProAV UK',
        customer: 'ITV Studios',
        product: 'Edge8K',
        sn: '8624-A045',
        problem: '开机后显示屏无显示，但机器运行正常',
        repair: '检测发现显示屏排线松动，重新连接排线并加固',
        parts: [],
        status: 'Completed',
        date: '2026-02-12'
    },
    {
        dealer: 'Gafpa Gear',
        customer: 'Bavaria Film',
        product: 'Edge8K',
        sn: '8624-C032',
        problem: '时码同步不稳定',
        repair: '检查时码输入模块，发现BNC接口接触不良，更换时码模块',
        parts: [{ name: '时码输入模块', sku: 'S1-013-007-01', qty: 1, price: 99 }],
        status: 'Completed',
        date: '2026-02-10'
    }
];

// 生成经销商维修单编号
function generateSvcNumber(yearMonth, seq) {
    const seqStr = seq < 10000 ? String(seq).padStart(4, '0') : seq.toString(16).toUpperCase().padStart(4, '0');
    return `SVC-D-${yearMonth}-${seqStr}`;
}

const now = new Date();
const yearMonth = `${String(now.getFullYear() % 100).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;

// 清空现有的经销商维修单
db.prepare('DELETE FROM dealer_repairs').run();
db.prepare('DELETE FROM dealer_repair_sequences').run();

let svcSeq = 1;
dealerRepairs.forEach((repair, idx) => {
    const dealerId = dealerMap[repair.dealer];
    
    if (!dealerId) {
        console.log(`  警告: 找不到经销商 ${repair.dealer}`);
        return;
    }
    
    const ticketNumber = generateSvcNumber(yearMonth, svcSeq++);
    
    const result = db.prepare(`
        INSERT INTO dealer_repairs (
            ticket_number, dealer_id, customer_name,
            serial_number,
            problem_description, repair_content,
            status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        ticketNumber,
        dealerId,
        repair.customer,
        repair.sn,
        repair.problem,
        repair.repair,
        repair.status,
        repair.date,
        repair.date
    );
    
    console.log(`  ✓ 创建: ${ticketNumber} - ${repair.dealer} - ${repair.customer}`);
    
    // 添加配件记录（如果parts表存在）
    if (repair.parts && repair.parts.length > 0) {
        try {
            repair.parts.forEach(part => {
                db.prepare(`
                    INSERT INTO dealer_repair_parts (dealer_repair_id, part_name, quantity, unit_price)
                    VALUES (?, ?, ?, ?)
                `).run(result.lastInsertRowid, part.name, part.qty, part.price);
            });
            console.log(`    + 配件: ${repair.parts.map(p => p.name).join(', ')}`);
        } catch (err) {
            console.log(`    ! 配件记录跳过（parts表可能未创建）`);
        }
    }
});

// 更新序号表
db.prepare(`
    INSERT INTO dealer_repair_sequences (year_month, last_sequence)
    VALUES (?, ?)
`).run(yearMonth, svcSeq - 1);

console.log(`\n完成! 共创建 ${dealerRepairs.length} 条经销商维修单\n`);

// Step 3: 修复RMA单
console.log('Step 3: 创建/修复RMA单示例数据...');

const rmaTickets = [
    {
        channel: 'D',
        dealer: 'ProAV UK',
        customer: 'BBC Studios',
        product: 'Edge8K',
        sn: '8624-A007',
        problem: '主板故障，经销商无法维修，需返厂更换主板',
        repair: '检测确认主板HDMI输出芯片烧毁，更换主板',
        parts: [{ name: 'Edge 8K主板', sku: 'S1-001-002-01', price: 799 }],
        warranty: false,
        status: 'Completed',
        priority: 'R2',
        date: '2026-02-03'
    },
    {
        channel: 'D',
        dealer: 'Gafpa Gear',
        customer: 'German Film Academy',
        product: 'Edge8K',
        sn: '8624-C015',
        problem: 'Sensor出现坏点，经销商检测后建议返厂更换',
        repair: '检测确认Sensor有2个坏点，更换Sensor模块',
        parts: [{ name: 'Edge 8K Sensor', sku: 'S1-019-003-01', price: 2499 }],
        warranty: true,
        status: 'Completed',
        priority: 'R2',
        date: '2026-02-05'
    },
    {
        channel: 'D',
        dealer: '1SV',
        customer: 'Los Angeles Film School',
        product: 'Edge6K',
        sn: '6124-D022',
        problem: '相机摔落后无法开机，经销商判断需返厂全面检测',
        repair: '检测发现主板和电源模块损坏，更换主板和电源模块',
        parts: [
            { name: 'Edge 6K主板', sku: 'S1-001-003-01', price: 699 },
            { name: '电源模块', sku: 'S1-020-001-01', price: 299 }
        ],
        warranty: false,
        status: 'Completed',
        priority: 'R3',
        date: '2026-02-07'
    },
    {
        channel: 'C',
        dealer: null,
        customer: '北京电影学院',
        product: 'Edge8K',
        sn: '8624-CN01',
        problem: '国内直客，录制时素材号重复，怀疑存储模块问题',
        repair: '检测存储控制芯片异常，更换存储控制模块',
        parts: [{ name: '存储控制模块', sku: 'S1-018-004-01', price: 399 }],
        warranty: true,
        status: 'Completed',
        priority: 'R2',
        date: '2026-02-04'
    },
    {
        channel: 'C',
        dealer: null,
        customer: '上海广播电视台',
        product: 'TERRA4K',
        sn: 'T4K-CN12',
        problem: '国内直客，老机型返厂维修，风扇异响',
        repair: '更换散热风扇组件',
        parts: [{ name: '散热风扇组件', sku: 'S1-016-002-01', price: 89 }],
        warranty: false,
        status: 'Completed',
        priority: 'R3',
        date: '2026-02-09'
    },
    {
        channel: 'D',
        dealer: 'ProAV UK',
        customer: 'Warner Bros UK',
        product: 'Edge8K',
        sn: '8624-A029',
        problem: '固件升级失败导致无法启动，经销商远程协助无效',
        repair: '重新刷写固件并恢复出厂设置',
        parts: [],
        warranty: true,
        status: 'Completed',
        priority: 'R1',
        date: '2026-02-06'
    },
    {
        channel: 'D',
        dealer: 'Gafpa Gear',
        customer: 'Bavaria Film',
        product: 'mark2',
        sn: 'M2-5023',
        problem: '液晶屏出现条纹，经销商判断需更换屏幕',
        repair: '更换液晶显示屏模块',
        parts: [{ name: 'mark2 液晶屏', sku: 'S2-021-001-01', price: 599 }],
        warranty: false,
        status: 'InRepair',
        priority: 'R2',
        date: '2026-02-10'
    }
];

// 生成RMA编号
function generateRmaNumber(channel, yearMonth, seq) {
    const seqStr = seq < 10000 ? String(seq).padStart(4, '0') : seq.toString(16).toUpperCase().padStart(4, '0');
    return `RMA-${channel}-${yearMonth}-${seqStr}`;
}

// 清空现有RMA
db.prepare('DELETE FROM rma_tickets').run();
db.prepare('DELETE FROM rma_ticket_sequences').run();

const rmaSeqMap = {}; // 按channel分别计数

rmaTickets.forEach((rma, idx) => {
    const dealerId = rma.dealer ? dealerMap[rma.dealer] : null;
    
    // 初始化序号
    if (!rmaSeqMap[rma.channel]) {
        rmaSeqMap[rma.channel] = 1;
    }
    
    const ticketNumber = generateRmaNumber(rma.channel, yearMonth, rmaSeqMap[rma.channel]++);
    
    db.prepare(`
        INSERT INTO rma_tickets (
            ticket_number, channel_code,
            dealer_id, reporter_name,
            serial_number,
            problem_description, repair_content,
            is_warranty, status, repair_priority,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        ticketNumber,
        rma.channel,
        dealerId,
        rma.customer,
        rma.sn,
        rma.problem,
        rma.repair,
        rma.warranty ? 1 : 0,
        rma.status,
        rma.priority,
        rma.date,
        rma.date
    );
    
    const channelName = rma.channel === 'D' ? '经销商返厂' : '直客返厂';
    const dealerInfo = rma.dealer ? ` (${rma.dealer})` : '';
    console.log(`  ✓ 创建: ${ticketNumber} - ${channelName}${dealerInfo} - ${rma.customer}`);
});

// 更新RMA序号表
Object.keys(rmaSeqMap).forEach(channel => {
    db.prepare(`
        INSERT INTO rma_ticket_sequences (channel_code, year_month, last_sequence)
        VALUES (?, ?, ?)
    `).run(channel, yearMonth, rmaSeqMap[channel] - 1);
});

console.log(`\n完成! 共创建 ${rmaTickets.length} 条RMA返厂单\n`);

// 统计
console.log('=== 数据统计 ===');
const dealerRepairCount = db.prepare('SELECT COUNT(*) as cnt FROM dealer_repairs').get().cnt;
const rmaCount = db.prepare('SELECT COUNT(*) as cnt FROM rma_tickets').get().cnt;
const rmaDealerCount = db.prepare("SELECT COUNT(*) as cnt FROM rma_tickets WHERE channel_code = 'D'").get().cnt;
const rmaCustomerCount = db.prepare("SELECT COUNT(*) as cnt FROM rma_tickets WHERE channel_code = 'C'").get().cnt;

console.log(`经销商维修单: ${dealerRepairCount}`);
console.log(`RMA返厂单总数: ${rmaCount}`);
console.log(`  - 经销商返厂(D): ${rmaDealerCount}`);
console.log(`  - 直客返厂(C): ${rmaCustomerCount}`);

console.log('\n=== 修复完成 ===');

db.close();
