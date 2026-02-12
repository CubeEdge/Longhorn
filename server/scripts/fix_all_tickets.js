const Database = require('better-sqlite3');
const db = new Database('longhorn.db');

// 禁用外键检查
db.pragma('foreign_keys = OFF');

console.log('=== 修复所有Service工单ID和内容 ===\n');

// 获取账户信息
const accounts = db.prepare("SELECT id, name, account_type FROM accounts WHERE account_type IN ('DEALER', 'ORGANIZATION', 'INDIVIDUAL') ORDER BY id").all();
console.log('账户列表:');
accounts.forEach(a => {
  console.log(`  - ${a.name}: ID ${a.id}, Type ${a.account_type}`);
});

const proavUK = accounts.find(a => a.name === 'ProAV UK');
const gafpa = accounts.find(a => a.name === 'Gafpa Gear');
const oneSV = accounts.find(a => a.name === '1SV');
const dpGadget = accounts.find(a => a.name === 'DP Gadget');
const beijingFilm = accounts.find(a => a.name === '北京电影学院');
const shanghaiTV = accounts.find(a => a.name === '上海广播电视台');

// 获取产品ID
const products = db.prepare('SELECT id, model_name FROM products').all();
const edge8k = products.find(p => p.model_name === 'MAVO Edge 8K');
const edge6k = products.find(p => p.model_name === 'MAVO Edge 6K');
const mark2 = products.find(p => p.model_name === 'MAVO mark2 LF');

console.log('\n=== 第1步：修复咨询工单ID ===');
// 清空现有咨询工单
db.prepare('DELETE FROM inquiry_tickets').run();
console.log('清空现有咨询工单...');

// 创建符合 K2602-XXXX 格式的咨询工单
const inquiryData = [
  {
    account: proavUK,
    customer: 'BBC Studios',
    product: edge8k,
    sn: '8624-A012',
    summary: 'SDI输出信号不稳定问题咨询',
    description: '客户反映在拍摄4K 50fps时，SDI输出信号偶尔会出现雪花点和中断。已更换SDI线缆但问题依然存在。',
    solution: '经排查是SDI模块接口接触不良，建议送修检测。',
    status: 'Resolved',
    priority: 'Medium',
    date: '2026-02-01'
  },
  {
    account: gafpa,
    customer: 'German Film Academy',
    product: edge6k,
    sn: '8624-B045',
    summary: '固件升级后无法识别KineMAG Nano',
    description: '升级到最新固件后，原本正常工作的KineMAG Nano存储卡无法被识别，显示"未格式化"提示。',
    solution: '确认是固件兼容性问题，建议回滚到前一版本或等待下一版本修复。',
    status: 'Resolved',
    priority: 'High',
    date: '2026-02-03'
  },
  {
    account: oneSV,
    customer: 'Los Angeles Film School',
    product: mark2,
    sn: '8523-C089',
    summary: 'ProRes RAW录制规格咨询',
    description: '客户询问MAVO mark2 LF在录制ProRes RAW时的最高分辨率和帧率规格，以及外录选项。',
    solution: '提供了详细的ProRes RAW规格说明和Atomos Ninja V外录方案。',
    status: 'Resolved',
    priority: 'Low',
    date: '2026-02-05'
  },
  {
    account: dpGadget,
    customer: 'Singapore Media Corp',
    product: edge8k,
    sn: '8624-D023',
    summary: '触摸屏反应迟钝',
    description: '拍摄现场触摸屏反应变得迟钝，有时需要多次点击才能响应。',
    solution: '建议进行屏幕校准，如问题持续建议送修检测。',
    status: 'InProgress',
    priority: 'Medium',
    date: '2026-02-08'
  },
  {
    account: beijingFilm,
    customer: '北京电影学院',
    product: edge6k,
    sn: '8624-E056',
    summary: '保修期限查询',
    description: '教学设备需要确认保修期限，序列号8624-E056。',
    solution: '已核实保修信息，设备在保内至2026年12月。',
    status: 'Resolved',
    priority: 'Low',
    date: '2026-02-10'
  },
  {
    account: proavUK,
    customer: 'ITV Studios',
    product: edge8k,
    sn: '8624-F012',
    summary: 'ND滤镜切换异响',
    description: '在切换内置ND滤镜时出现明显的机械异响，担心是否有故障。',
    solution: '确认是正常的机械声音，但建议送修检查确保无磨损。',
    status: 'Resolved',
    priority: 'Low',
    date: '2026-02-11'
  },
  {
    account: gafpa,
    customer: 'Bavaria Film',
    product: edge6k,
    sn: '8624-G034',
    summary: '高温环境下自动关机',
    description: '在室外高温环境（35°C+）拍摄约30分钟后机器自动关机，冷却后可重新开机。',
    solution: '确认是过热保护机制，建议使用主动散热方案或调整拍摄时间。',
    status: 'Resolved',
    priority: 'Medium',
    date: '2026-02-12'
  }
];

const insertInquiry = db.prepare(`
  INSERT INTO inquiry_tickets (
    ticket_number, account_id, customer_name, product_id, serial_number,
    problem_summary, communication_log, resolution,
    status, service_type, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

inquiryData.forEach((item, index) => {
  const seq = (index + 1).toString().padStart(4, '0');
  const ticketNumber = `K2602-${seq}`;
  
  insertInquiry.run(
    ticketNumber,
    item.account.id,
    item.customer,
    item.product?.id || null,
    item.sn,
    item.summary,
    item.description,
    item.solution,
    item.status,
    'Consultation',  // service_type
    `${item.date}T10:00:00Z`,
    `${item.date}T10:00:00Z`
  );
  
  console.log(`  ✓ ${ticketNumber} - ${item.customer} - ${item.summary}`);
});

console.log(`\n完成! 共创建 ${inquiryData.length} 条咨询工单\n`);

console.log('=== 第2步：验证经销商维修单ID ===');
const repairs = db.prepare('SELECT ticket_number, problem_description FROM dealer_repairs ORDER BY id').all();
console.log(`当前经销商维修单: ${repairs.length} 条`);
repairs.forEach(r => {
  console.log(`  - ${r.ticket_number} | ${r.problem_description?.substring(0,40)}`);
});

console.log('\n=== 第3步：验证RMA返厂单ID ===');
const rmas = db.prepare('SELECT ticket_number, channel_code, problem_description FROM rma_tickets ORDER BY id').all();
console.log(`当前RMA返厂单: ${rmas.length} 条`);
rmas.forEach(r => {
  console.log(`  - ${r.ticket_number} (${r.channel_code}) | ${r.problem_description?.substring(0,40)}`);
});

console.log('\n=== ID格式验证 ===');
const inquiryCheck = db.prepare("SELECT ticket_number FROM inquiry_tickets WHERE ticket_number NOT LIKE 'K____-%'").all();
const rmaCheck = db.prepare("SELECT ticket_number FROM rma_tickets WHERE ticket_number NOT LIKE 'RMA-_-____-%'").all();
const repairCheck = db.prepare("SELECT ticket_number FROM dealer_repairs WHERE ticket_number NOT LIKE 'SVC-D-____-%'").all();

if (inquiryCheck.length === 0 && rmaCheck.length === 0 && repairCheck.length === 0) {
  console.log('✅ 所有工单ID格式正确！');
} else {
  console.log('❌ 发现格式错误的工单ID:');
  inquiryCheck.forEach(t => console.log(`  - 咨询工单: ${t.ticket_number}`));
  rmaCheck.forEach(t => console.log(`  - RMA返厂单: ${t.ticket_number}`));
  repairCheck.forEach(t => console.log(`  - 经销商维修单: ${t.ticket_number}`));
}

console.log('\n=== 数据统计 ===');
console.log(`咨询工单: ${db.prepare('SELECT COUNT(*) as cnt FROM inquiry_tickets').get().cnt}`);
console.log(`RMA返厂单: ${db.prepare('SELECT COUNT(*) as cnt FROM rma_tickets').get().cnt}`);
console.log(`经销商维修单: ${db.prepare('SELECT COUNT(*) as cnt FROM dealer_repairs').get().cnt}`);

console.log('\n=== 修复完成 ===');

db.close();
