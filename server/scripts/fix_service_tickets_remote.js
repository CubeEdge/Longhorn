/**
 * 远程服务器专用：修复Service工单数据
 * 不删除现有数据，只清空并重新创建
 */

const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../longhorn.db'));

console.log('=== 修复远程服务器Service工单数据 ===\n');

// 获取经销商ID映射
const dealers = db.prepare("SELECT id, name FROM accounts WHERE account_type = 'DEALER' ORDER BY id").all();
const dealerMap = {};
dealers.forEach(d => dealerMap[d.name] = d.id);

console.log('经销商列表:');
dealers.forEach(d => console.log(`  - ${d.name}: ID ${d.id}`));
console.log('');

// 经销商维修单示例数据
const dealerRepairs = [
    {
        dealer: 'ProAV UK',
        customer: 'BBC Studios',
        sn: '8624-A012',
        problem: 'SDI输出无信号，客户反映拍摄时SDI监视器突然黑屏',
        repair: '检测发现SDI模块接口松动，重新固定接口并更换SDI模块板',
        status: 'Completed',
        date: '2026-02-05'
    },
    {
        dealer: 'ProAV UK',
        customer: 'CVP UK',
        sn: '8624-A033',
        problem: '录制4K 120fps时偶发死机重启',
        repair: '测试确认为固件8021版本兼容性问题，升级固件至8023版本，测试稳定',
        status: 'Completed',
        date: '2026-02-08'
    },
    {
        dealer: 'ProAV UK',
        customer: 'Warner Bros UK',
        sn: '6124-B005',
        problem: 'ND滤镜切换时有明显异响',
        repair: '拆解检查发现ND电机齿轮有轻微磨损，更换ND电机模块',
        status: 'Completed',
        date: '2026-02-10'
    },
    {
        dealer: 'Gafpa Gear',
        customer: 'German Film Academy',
        sn: '8624-C021',
        problem: '机身发热严重，长时间拍摄后自动关机',
        repair: '检测散热风扇转速异常，更换散热风扇组件，测试温度控制正常',
        status: 'Completed',
        date: '2026-02-07'
    },
    {
        dealer: 'Gafpa Gear',
        customer: 'Netflix EU',
        sn: 'M2-5012',
        problem: '触摸屏失灵，无法点击菜单',
        repair: '重新校准触摸屏并升级系统软件，恢复正常',
        status: 'Completed',
        date: '2026-02-09'
    },
    {
        dealer: '1SV',
        customer: 'Los Angeles Film School',
        sn: '8624-D018',
        problem: 'KineMAG Nano存储卡无法识别',
        repair: '清洁存储卡槽并更新固件，测试存储卡识别正常',
        status: 'Completed',
        date: '2026-02-06'
    },
    {
        dealer: '1SV',
        customer: 'Hollywood Rentals',
        sn: 'T4K-8901',
        problem: '画面出现间歇性横条纹',
        repair: '检测发现Sensor接口接触不良，重新固定Sensor模块并清洁接口',
        status: 'Completed',
        date: '2026-02-11'
    },
    {
        dealer: 'DP Gadget',
        customer: 'Singapore Media Corp',
        sn: '6124-E009',
        problem: '音频录制有电流噪声',
        repair: '检查音频输入接口，发现XLR接口有氧化，清洁接口并更换音频模块',
        status: 'Completed',
        date: '2026-02-08'
    },
    {
        dealer: 'ProAV UK',
        customer: 'ITV Studios',
        sn: '8624-A045',
        problem: '开机后显示屏无显示，但机器运行正常',
        repair: '检测发现显示屏排线松动，重新连接排线并加固',
        status: 'Completed',
        date: '2026-02-12'
    },
    {
        dealer: 'Gafpa Gear',
        customer: 'Bavaria Film',
        sn: '8624-C032',
        problem: '时码同步不稳定',
        repair: '检查时码输入模块，发现BNC接口接触不良，更换时码模块',
        status: 'Completed',
        date: '2026-02-10'
    }
];

// 生成编号
function generateSvcNumber(yearMonth, seq) {
    const seqStr = seq < 10000 ? String(seq).padStart(4, '0') : seq.toString(16).toUpperCase().padStart(4, '0');
    return `SVC-D-${yearMonth}-${seqStr}`;
}

const now = new Date();
const yearMonth = `${String(now.getFullYear() % 100).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}`;

console.log('清空现有经销商维修单...');
db.prepare('DELETE FROM dealer_repairs').run();
db.prepare('DELETE FROM dealer_repair_sequences').run();

console.log('\n创建经销商维修单:');
let svcSeq = 1;
dealerRepairs.forEach(repair => {
    const dealerId = dealerMap[repair.dealer];
    
    if (!dealerId) {
        console.log(`  ⚠️  找不到经销商 ${repair.dealer}`);
        return;
    }
    
    const ticketNumber = generateSvcNumber(yearMonth, svcSeq++);
    
    db.prepare(`
        INSERT INTO dealer_repairs (
            ticket_number, dealer_id, customer_name,
            serial_number, problem_description, repair_content,
            status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        ticketNumber, dealerId, repair.customer,
        repair.sn, repair.problem, repair.repair,
        repair.status, repair.date, repair.date
    );
    
    console.log(`  ✓ ${ticketNumber} - ${repair.dealer} - ${repair.customer}`);
});

db.prepare('INSERT INTO dealer_repair_sequences (year_month, last_sequence) VALUES (?, ?)').run(yearMonth, svcSeq - 1);

console.log(`\n完成! 共创建 ${dealerRepairs.length} 条经销商维修单`);

// RMA返厂单
const rmaTickets = [
    {
        channel: 'D',
        dealer: 'ProAV UK',
        customer: 'BBC Studios',
        sn: '8624-A007',
        problem: '主板故障，经销商无法维修，需返厂更换主板',
        repair: '检测确认主板HDMI输出芯片烧毁，更换主板',
        warranty: false,
        status: 'Completed',
        priority: 'R2',
        date: '2026-02-03'
    },
    {
        channel: 'D',
        dealer: 'Gafpa Gear',
        customer: 'German Film Academy',
        sn: '8624-C015',
        problem: 'Sensor出现坏点，经销商检测后建议返厂更换',
        repair: '检测确认Sensor有2个坏点，更换Sensor模块',
        warranty: true,
        status: 'Completed',
        priority: 'R2',
        date: '2026-02-05'
    },
    {
        channel: 'D',
        dealer: '1SV',
        customer: 'Los Angeles Film School',
        sn: '6124-D022',
        problem: '相机摔落后无法开机，经销商判断需返厂全面检测',
        repair: '检测发现主板和电源模块损坏，更换主板和电源模块',
        warranty: false,
        status: 'Completed',
        priority: 'R3',
        date: '2026-02-07'
    },
    {
        channel: 'C',
        dealer: null,
        customer: '北京电影学院',
        sn: '8624-CN01',
        problem: '国内直客，录制时素材号重复，怀疑存储模块问题',
        repair: '检测存储控制芯片异常，更换存储控制模块',
        warranty: true,
        status: 'Completed',
        priority: 'R2',
        date: '2026-02-04'
    },
    {
        channel: 'C',
        dealer: null,
        customer: '上海广播电视台',
        sn: 'T4K-CN12',
        problem: '国内直客，老机型返厂维修，风扇异响',
        repair: '更换散热风扇组件',
        warranty: false,
        status: 'Completed',
        priority: 'R3',
        date: '2026-02-09'
    },
    {
        channel: 'D',
        dealer: 'ProAV UK',
        customer: 'Warner Bros UK',
        sn: '8624-A029',
        problem: '固件升级失败导致无法启动，经销商远程协助无效',
        repair: '重新刷写固件并恢复出厂设置',
        warranty: true,
        status: 'Completed',
        priority: 'R1',
        date: '2026-02-06'
    },
    {
        channel: 'D',
        dealer: 'Gafpa Gear',
        customer: 'Bavaria Film',
        sn: 'M2-5023',
        problem: '液晶屏出现条纹，经销商判断需更换屏幕',
        repair: '更换液晶显示屏模块',
        warranty: false,
        status: 'InRepair',
        priority: 'R2',
        date: '2026-02-10'
    }
];

function generateRmaNumber(channel, yearMonth, seq) {
    const seqStr = seq < 10000 ? String(seq).padStart(4, '0') : seq.toString(16).toUpperCase().padStart(4, '0');
    return `RMA-${channel}-${yearMonth}-${seqStr}`;
}

console.log('\n清空现有RMA返厂单...');
db.prepare('DELETE FROM rma_tickets').run();
db.prepare('DELETE FROM rma_ticket_sequences').run();

console.log('\n创建RMA返厂单:');
const rmaSeqMap = {};

rmaTickets.forEach(rma => {
    const dealerId = rma.dealer ? dealerMap[rma.dealer] : null;
    
    if (!rmaSeqMap[rma.channel]) {
        rmaSeqMap[rma.channel] = 1;
    }
    
    const ticketNumber = generateRmaNumber(rma.channel, yearMonth, rmaSeqMap[rma.channel]++);
    
    db.prepare(`
        INSERT INTO rma_tickets (
            ticket_number, channel_code, dealer_id, reporter_name,
            serial_number, problem_description, repair_content,
            is_warranty, status, repair_priority,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        ticketNumber, rma.channel, dealerId, rma.customer,
        rma.sn, rma.problem, rma.repair,
        rma.warranty ? 1 : 0, rma.status, rma.priority,
        rma.date, rma.date
    );
    
    const channelName = rma.channel === 'D' ? '经销商返厂' : '直客返厂';
    const dealerInfo = rma.dealer ? ` (${rma.dealer})` : '';
    console.log(`  ✓ ${ticketNumber} - ${channelName}${dealerInfo} - ${rma.customer}`);
});

Object.keys(rmaSeqMap).forEach(channel => {
    db.prepare('INSERT INTO rma_ticket_sequences (channel_code, year_month, last_sequence) VALUES (?, ?, ?)').run(channel, yearMonth, rmaSeqMap[channel] - 1);
});

console.log(`\n完成! 共创建 ${rmaTickets.length} 条RMA返厂单`);

// 统计
console.log('\n=== 数据统计 ===');
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
