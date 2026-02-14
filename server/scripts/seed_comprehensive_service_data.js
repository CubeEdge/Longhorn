/**
 * Comprehensive Service Data Seeding Script
 * Populates accounts, contacts, and tickets for the service system
 * 
 * Data Structure:
 * - 8 Dealers (existing + new)
 * - 12 Organization customers (rental houses, production companies)
 * - 10 Individual customers (photographers)
 * - Multiple contacts per account
 * - 20 Inquiry tickets
 * - 10 RMA tickets
 * - 9 Dealer repair tickets
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, '..', 'longhorn.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

console.log('🚀 Starting comprehensive service data seeding...');
console.log('📁 Database:', dbPath);

// ==========================================
// Helper Functions
// ==========================================

function generateAccountNumber() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `ACC-${year}-${random}`;
}

function generateTicketNumber(prefix, date = new Date()) {
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `${prefix}${yy}${mm}-${random}`;
}

function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function randomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ==========================================
// Data Definitions
// ==========================================

// Product families and models
const PRODUCT_FAMILIES = {
    A: ['MAVO Edge 8K', 'MAVO Edge 6K', 'MAVO mark2 LF'],
    B: ['MAVO LF', 'MAVO S35', 'Terra 4K', 'Terra 6K'],
    C: ['Eagle SDI', 'Eagle HDMI', 'KineMON 7U2'],
    D: ['GripBAT PD75', 'KineMAG Nano 1TB']
};

const FIRMWARE_VERSIONS = ['KineOS 8.0', 'KineOS 7.2', 'KineOS 7.1', 'KineOS 6.5'];

// Issue categories and types
const ISSUE_CATEGORIES = ['稳定性', '素材', '监看', 'SSD', '音频', '兼容性', '时码', '硬件结构'];
const ISSUE_SUBCATEGORIES = {
    '稳定性': ['死机', '自动重启', '固件崩溃', '过热保护'],
    '素材': ['坏帧', '色彩异常', '分辨率问题', '编码错误'],
    '监看': ['无图像', '色彩偏差', '延迟', '触控失灵'],
    'SSD': ['无法识别', '读写错误', '掉速', '格式化失败'],
    '音频': ['无声音', '杂音', '电平异常', '延迟'],
    '兼容性': ['第三方镜头', '第三方监视器', '第三方电池', '第三方存储'],
    '时码': ['时码不准', '时码丢失', '同步失败'],
    '硬件结构': ['按键失灵', '接口松动', '外壳损伤', '散热异常']
};

const SERVICE_TYPES = ['consultation', 'troubleshooting', 'remote_assist', 'complaint'];
const CHANNELS = ['phone', 'email', 'wechat', 'enterprise_wechat'];
const INQUIRY_STATUSES = ['in_progress', 'waiting_customer', 'resolved', 'converted'];
const TICKET_STATUSES = ['pending', 'in_progress', 'repaired', 'waiting_payment', 'closed'];
const SEVERITIES = ['1', '2', '3'];

// Countries and regions
const COUNTRIES = [
    { name: '中国', code: 'CN', cities: ['北京', '上海', '深圳', '成都', '杭州'] },
    { name: '美国', code: 'US', cities: ['Los Angeles', 'New York', 'Chicago', 'San Francisco'] },
    { name: '英国', code: 'UK', cities: ['London', 'Manchester', 'Birmingham'] },
    { name: '德国', code: 'DE', cities: ['Berlin', 'Munich', 'Hamburg'] },
    { name: '法国', code: 'FR', cities: ['Paris', 'Lyon', 'Marseille'] },
    { name: '日本', code: 'JP', cities: ['Tokyo', 'Osaka', 'Kyoto'] },
    { name: '澳大利亚', code: 'AU', cities: ['Sydney', 'Melbourne', 'Brisbane'] },
    { name: '加拿大', code: 'CA', cities: ['Toronto', 'Vancouver', 'Montreal'] }
];

// ==========================================
// 1. Seed Dealers (8 dealers)
// ==========================================

const DEALERS = [
    {
        name: 'ProAV UK',
        dealer_code: 'ProAV',
        dealer_level: 'tier1',
        region: 'Europe',
        country: '英国',
        city: 'London',
        address: 'Unit 7, 8, 9 & 10, The IO Centre, Fingle Drive, Stonebridge, Milton Keynes, MK13 0AT',
        email: 'info@proav.co.uk',
        phone: '+44 1908 366 600',
        can_repair: 1,
        credit_limit: 50000,
        contacts: [
            { name: 'Mike Johnson', job_title: '维修主管', email: 'mike@proav.co.uk', phone: '+44 1908 366 601', is_primary: 1 },
            { name: 'Sarah Williams', job_title: '销售经理', email: 'sarah@proav.co.uk', phone: '+44 1908 366 602', is_primary: 0 },
            { name: 'David Brown', job_title: '技术支持', email: 'david@proav.co.uk', phone: '+44 1908 366 603', is_primary: 0 }
        ]
    },
    {
        name: 'Gafpa Gear',
        dealer_code: 'Gafpa',
        dealer_level: 'tier1',
        region: 'Europe',
        country: '德国',
        city: 'Berlin',
        address: 'Kastanienallee 79, 10435 Berlin',
        email: 'info@gafpagear.com',
        phone: '+49 30 12345678',
        can_repair: 1,
        credit_limit: 40000,
        contacts: [
            { name: 'Hans Mueller', job_title: '技术总监', email: 'hans@gafpagear.com', phone: '+49 30 12345679', is_primary: 1 },
            { name: 'Anna Schmidt', job_title: '客户经理', email: 'anna@gafpagear.com', phone: '+49 30 12345680', is_primary: 0 }
        ]
    },
    {
        name: '1SourceVideo',
        dealer_code: '1SV',
        dealer_level: 'tier1',
        region: 'North America',
        country: '美国',
        city: 'Los Angeles',
        address: '1234 Sunset Blvd, Los Angeles, CA 90028',
        email: 'support@1sourcevideo.com',
        phone: '+1 323 555 0123',
        can_repair: 1,
        credit_limit: 60000,
        contacts: [
            { name: 'John Smith', job_title: '维修主管', email: 'john@1sourcevideo.com', phone: '+1 323 555 0124', is_primary: 1 },
            { name: 'Emily Davis', job_title: '销售总监', email: 'emily@1sourcevideo.com', phone: '+1 323 555 0125', is_primary: 0 },
            { name: 'Michael Chen', job_title: '技术支持', email: 'michael@1sourcevideo.com', phone: '+1 323 555 0126', is_primary: 0 }
        ]
    },
    {
        name: 'CVP UK',
        dealer_code: 'CVP',
        dealer_level: 'tier1',
        region: 'Europe',
        country: '英国',
        city: 'Manchester',
        address: 'CVP House, 2-4 Baird Road, Waterhouse Lane, Kingston upon Thames, KT1 1EX',
        email: 'info@cvp.com',
        phone: '+44 20 8282 1111',
        can_repair: 1,
        credit_limit: 80000,
        contacts: [
            { name: 'Tom Wilson', job_title: '技术经理', email: 'tom@cvp.com', phone: '+44 20 8282 1112', is_primary: 1 },
            { name: 'Lisa Anderson', job_title: '客户服务', email: 'lisa@cvp.com', phone: '+44 20 8282 1113', is_primary: 0 }
        ]
    },
    {
        name: 'DP Gadget',
        dealer_code: 'DPGadget',
        dealer_level: 'tier2',
        region: 'Asia Pacific',
        country: '新加坡',
        city: 'Singapore',
        address: '10 Anson Road, #26-04 International Plaza, Singapore 079903',
        email: 'info@dpgadget.com',
        phone: '+65 6222 8888',
        can_repair: 1,
        credit_limit: 20000,
        contacts: [
            { name: 'Tan Wei Ming', job_title: '技术主管', email: 'tan@dpgadget.com', phone: '+65 6222 8889', is_primary: 1 },
            { name: 'Lim Siew Hua', job_title: '销售经理', email: 'lim@dpgadget.com', phone: '+65 6222 8890', is_primary: 0 }
        ]
    },
    {
        name: 'Cinetx',
        dealer_code: 'Cinetx',
        dealer_level: 'tier2',
        region: 'North America',
        country: '加拿大',
        city: 'Toronto',
        address: '500 King Street West, Toronto, ON M5V 1L9',
        email: 'info@cinetx.ca',
        phone: '+1 416 555 0199',
        can_repair: 1,
        credit_limit: 25000,
        contacts: [
            { name: 'Robert Taylor', job_title: '技术总监', email: 'robert@cinetx.ca', phone: '+1 416 555 0200', is_primary: 1 }
        ]
    },
    {
        name: 'RMK Australia',
        dealer_code: 'RMK',
        dealer_level: 'tier3',
        region: 'Asia Pacific',
        country: '澳大利亚',
        city: 'Sydney',
        address: '45 Pitt Street, Sydney, NSW 2000',
        email: 'info@rmk.com.au',
        phone: '+61 2 9252 9999',
        can_repair: 0,
        credit_limit: 10000,
        contacts: [
            { name: 'James Wilson', job_title: '销售经理', email: 'james@rmk.com.au', phone: '+61 2 9252 9998', is_primary: 1 }
        ]
    },
    {
        name: 'EU Office',
        dealer_code: 'EUOffice',
        dealer_level: 'tier1',
        region: 'Europe',
        country: '法国',
        city: 'Paris',
        address: '25 Rue de la Paix, 75002 Paris',
        email: 'info@euoffice.fr',
        phone: '+33 1 42 60 55 55',
        can_repair: 1,
        credit_limit: 45000,
        contacts: [
            { name: 'Pierre Dubois', job_title: '技术主管', email: 'pierre@euoffice.fr', phone: '+33 1 42 60 55 56', is_primary: 1 },
            { name: 'Marie Laurent', job_title: '客户经理', email: 'marie@euoffice.fr', phone: '+33 1 42 60 55 57', is_primary: 0 }
        ]
    }
];

// ==========================================
// 2. Seed Organization Customers (12)
// ==========================================

const ORGANIZATIONS = [
    {
        name: 'Netflix Studios',
        service_tier: 'VVIP',
        industry_tags: ['PRODUCTION', 'STREAMING'],
        country: '美国',
        city: 'Los Angeles',
        address: '5808 W. Sunset Blvd, Los Angeles, CA 90028',
        email: 'tech@netflix.com',
        phone: '+1 310 734 8888',
        contacts: [
            { name: 'Christopher Nolan', job_title: '技术总监', email: 'cnolan@netflix.com', phone: '+1 310 734 8889', is_primary: 1 },
            { name: 'Emma Thomas', job_title: '制片经理', email: 'ethomas@netflix.com', phone: '+1 310 734 8890', is_primary: 0 },
            { name: 'Hans Zimmer', job_title: '音频工程师', email: 'hzimmer@netflix.com', phone: '+1 310 734 8891', is_primary: 0 }
        ]
    },
    {
        name: 'ARRI Rental',
        service_tier: 'VIP',
        industry_tags: ['RENTAL_HOUSE'],
        country: '德国',
        city: 'Munich',
        address: 'Arnulfstraße 16, 80335 München',
        email: 'rental@arri.de',
        phone: '+49 89 3809 0',
        contacts: [
            { name: 'Markus Zeiler', job_title: '维修主管', email: 'mzeiler@arri.de', phone: '+49 89 3809 100', is_primary: 1 },
            { name: 'Klaus Riemer', job_title: '设备经理', email: 'kriemer@arri.de', phone: '+49 89 3809 101', is_primary: 0 }
        ]
    },
    {
        name: 'Panavision London',
        service_tier: 'VIP',
        industry_tags: ['RENTAL_HOUSE'],
        country: '英国',
        city: 'London',
        address: '202 Wardour Street, London W1F 8ZH',
        email: 'london@panavision.com',
        phone: '+44 20 7434 9511',
        contacts: [
            { name: 'Richard Thompson', job_title: '技术总监', email: 'rthompson@panavision.com', phone: '+44 20 7434 9512', is_primary: 1 },
            { name: 'Helen Parker', job_title: '客户服务', email: 'hparker@panavision.com', phone: '+44 20 7434 9513', is_primary: 0 }
        ]
    },
    {
        name: '北京光线传媒',
        service_tier: 'VIP',
        industry_tags: ['PRODUCTION', 'BROADCAST'],
        country: '中国',
        city: '北京',
        address: '北京市东城区和平里东街11号',
        email: 'tech@enlightmedia.com',
        phone: '+86 10 8418 8888',
        contacts: [
            { name: '张艺谋', job_title: '技术总监', email: 'zhang@enlightmedia.com', phone: '+86 10 8418 8889', is_primary: 1 },
            { name: '陈凯歌', job_title: '制片主任', email: 'chen@enlightmedia.com', phone: '+86 10 8418 8890', is_primary: 0 }
        ]
    },
    {
        name: '上海东方传媒',
        service_tier: 'VIP',
        industry_tags: ['BROADCAST'],
        country: '中国',
        city: '上海',
        address: '上海市静安区威海路298号',
        email: 'tech@smg.cn',
        phone: '+86 21 6256 8888',
        contacts: [
            { name: '王小明', job_title: '设备主管', email: 'wangxm@smg.cn', phone: '+86 21 6256 8889', is_primary: 1 },
            { name: '李小红', job_title: '技术工程师', email: 'lixh@smg.cn', phone: '+86 21 6256 8890', is_primary: 0 }
        ]
    },
    {
        name: 'Wanda Pictures',
        service_tier: 'STANDARD',
        industry_tags: ['PRODUCTION'],
        country: '中国',
        city: '北京',
        address: '北京市朝阳区建国路88号SOHO现代城',
        email: 'tech@wandapictures.com',
        phone: '+86 10 8585 8888',
        contacts: [
            { name: '王健林', job_title: '技术顾问', email: 'wangjl@wandapictures.com', phone: '+86 10 8585 8889', is_primary: 1 }
        ]
    },
    {
        name: 'Sony Pictures',
        service_tier: 'VVIP',
        industry_tags: ['PRODUCTION', 'STREAMING'],
        country: '美国',
        city: 'Culver City',
        address: '10202 West Washington Boulevard, Culver City, CA 90232',
        email: 'tech@sonypictures.com',
        phone: '+1 310 244 4000',
        contacts: [
            { name: 'Tony Vinciquerra', job_title: '技术总监', email: 'tony@sonypictures.com', phone: '+1 310 244 4001', is_primary: 1 },
            { name: 'Tom Rothman', job_title: '制片主管', email: 'tom@sonypictures.com', phone: '+1 310 244 4002', is_primary: 0 }
        ]
    },
    {
        name: 'BBC Studios',
        service_tier: 'VIP',
        industry_tags: ['BROADCAST', 'PRODUCTION'],
        country: '英国',
        city: 'London',
        address: 'Television Centre, 101 Wood Lane, London W12 7FA',
        email: 'tech@bbcstudios.co.uk',
        phone: '+44 20 8433 2000',
        contacts: [
            { name: 'David Attenborough', job_title: '技术顾问', email: 'david@bbcstudios.co.uk', phone: '+44 20 8433 2001', is_primary: 1 },
            { name: 'Mary Berry', job_title: '设备经理', email: 'mary@bbcstudios.co.uk', phone: '+44 20 8433 2002', is_primary: 0 }
        ]
    },
    {
        name: 'NHK Japan',
        service_tier: 'VIP',
        industry_tags: ['BROADCAST'],
        country: '日本',
        city: 'Tokyo',
        address: '2-2-1 Jinnan, Shibuya-ku, Tokyo 150-8001',
        email: 'tech@nhk.or.jp',
        phone: '+81 3 3465 1111',
        contacts: [
            { name: '田中一郎', job_title: '技术部长', email: 'tanaka@nhk.or.jp', phone: '+81 3 3465 1112', is_primary: 1 }
        ]
    },
    {
        name: 'Village Roadshow',
        service_tier: 'STANDARD',
        industry_tags: ['PRODUCTION'],
        country: '澳大利亚',
        city: 'Melbourne',
        address: 'Level 2, 500 Chapel Street, South Yarra VIC 3141',
        email: 'tech@villageroadshow.com.au',
        phone: '+61 3 9421 8888',
        contacts: [
            { name: 'Bruce Berman', job_title: '技术总监', email: 'bruce@villageroadshow.com.au', phone: '+61 3 9421 8889', is_primary: 1 }
        ]
    },
    {
        name: 'Telefilm Canada',
        service_tier: 'STANDARD',
        industry_tags: ['PRODUCTION'],
        country: '加拿大',
        city: 'Montreal',
        address: '360 Saint-Jacques Street, Montreal, QC H2Y 1P5',
        email: 'tech@telefilm.ca',
        phone: '+1 514 283 6363',
        contacts: [
            { name: 'Jean-Pierre Blais', job_title: '技术主管', email: 'jeanpierre@telefilm.ca', phone: '+1 514 283 6364', is_primary: 1 }
        ]
    },
    {
        name: 'CCTV',
        service_tier: 'VVIP',
        industry_tags: ['BROADCAST'],
        country: '中国',
        city: '北京',
        address: '北京市海淀区复兴路11号',
        email: 'tech@cctv.com',
        phone: '+86 10 6850 8888',
        contacts: [
            { name: '李明', job_title: '技术总监', email: 'liming@cctv.com', phone: '+86 10 6850 8889', is_primary: 1 },
            { name: '王芳', job_title: '设备主管', email: 'wangfang@cctv.com', phone: '+86 10 6850 8890', is_primary: 0 }
        ]
    }
];

// ==========================================
// 3. Seed Individual Customers (10)
// ==========================================

const INDIVIDUALS = [
    {
        name: '张伟',
        service_tier: 'STANDARD',
        country: '中国',
        city: '北京',
        address: '北京市朝阳区三里屯SOHO A座1205',
        email: 'zhangwei@example.com',
        phone: '+86 138 1234 5678',
        contacts: [{ name: '张伟', job_title: '独立摄影师', email: 'zhangwei@example.com', phone: '+86 138 1234 5678', is_primary: 1 }]
    },
    {
        name: 'Michael Jordan',
        service_tier: 'VIP',
        country: '美国',
        city: 'Chicago',
        address: '123 Michigan Avenue, Chicago, IL 60601',
        email: 'mjordan@example.com',
        phone: '+1 312 555 0199',
        contacts: [{ name: 'Michael Jordan', job_title: '纪录片摄影师', email: 'mjordan@example.com', phone: '+1 312 555 0199', is_primary: 1 }]
    },
    {
        name: '山田太郎',
        service_tier: 'STANDARD',
        country: '日本',
        city: 'Tokyo',
        address: '1-2-3 Shibuya, Tokyo 150-0002',
        email: 'yamada@example.jp',
        phone: '+81 90 1234 5678',
        contacts: [{ name: '山田太郎', job_title: '自由摄影师', email: 'yamada@example.jp', phone: '+81 90 1234 5678', is_primary: 1 }]
    },
    {
        name: 'Jean Pierre',
        service_tier: 'STANDARD',
        country: '法国',
        city: 'Paris',
        address: '45 Rue de Rivoli, 75001 Paris',
        email: 'jpierre@example.fr',
        phone: '+33 6 12 34 56 78',
        contacts: [{ name: 'Jean Pierre', job_title: '时尚摄影师', email: 'jpierre@example.fr', phone: '+33 6 12 34 56 78', is_primary: 1 }]
    },
    {
        name: '李明',
        service_tier: 'VIP',
        country: '中国',
        city: '上海',
        address: '上海市浦东新区陆家嘴环路1000号',
        email: 'liming@example.com',
        phone: '+86 139 8765 4321',
        contacts: [{ name: '李明', job_title: '广告摄影师', email: 'liming@example.com', phone: '+86 139 8765 4321', is_primary: 1 }]
    },
    {
        name: 'Emma Watson',
        service_tier: 'STANDARD',
        country: '英国',
        city: 'London',
        address: '22 Baker Street, London NW1 6XE',
        email: 'ewatson@example.co.uk',
        phone: '+44 7700 900123',
        contacts: [{ name: 'Emma Watson', job_title: '独立电影人', email: 'ewatson@example.co.uk', phone: '+44 7700 900123', is_primary: 1 }]
    },
    {
        name: 'Hans Mueller',
        service_tier: 'STANDARD',
        country: '德国',
        city: 'Hamburg',
        address: 'Mönckebergstraße 7, 20095 Hamburg',
        email: 'hmueller@example.de',
        phone: '+49 151 1234 5678',
        contacts: [{ name: 'Hans Mueller', job_title: '风光摄影师', email: 'hmueller@example.de', phone: '+49 151 1234 5678', is_primary: 1 }]
    },
    {
        name: '王小红',
        service_tier: 'STANDARD',
        country: '中国',
        city: '深圳',
        address: '深圳市南山区科技园南区',
        email: 'wangxh@example.com',
        phone: '+86 135 2468 1357',
        contacts: [{ name: '王小红', job_title: '婚礼摄影师', email: 'wangxh@example.com', phone: '+86 135 2468 1357', is_primary: 1 }]
    },
    {
        name: 'Chris Hemsworth',
        service_tier: 'VIP',
        country: '澳大利亚',
        city: 'Sydney',
        address: '100 George Street, Sydney NSW 2000',
        email: 'chemsworth@example.au',
        phone: '+61 412 345 678',
        contacts: [{ name: 'Chris Hemsworth', job_title: '野生动物摄影师', email: 'chemsworth@example.au', phone: '+61 412 345 678', is_primary: 1 }]
    },
    {
        name: 'Ryan Reynolds',
        service_tier: 'STANDARD',
        country: '加拿大',
        city: 'Vancouver',
        address: '1234 Burrard Street, Vancouver, BC V6Z 1Z1',
        email: 'rreynolds@example.ca',
        phone: '+1 604 555 0199',
        contacts: [{ name: 'Ryan Reynolds', job_title: '商业摄影师', email: 'rreynolds@example.ca', phone: '+1 604 555 0199', is_primary: 1 }]
    }
];

// ==========================================
// Main Seeding Logic
// ==========================================

try {
    // Start transaction
    db.exec('BEGIN TRANSACTION');

    // Get existing dealers
    const existingDealers = db.prepare("SELECT id, name FROM accounts WHERE account_type = 'DEALER'").all();
    console.log(`\n📊 Found ${existingDealers.length} existing dealers`);
    
    const dealerMap = {};
    existingDealers.forEach(d => {
        dealerMap[d.name] = d.id;
    });

    // Insert new dealers
    console.log('\n🏪 Inserting dealers...');
    const insertDealer = db.prepare(`
        INSERT INTO accounts (
            account_number, name, account_type, email, phone, country, city, address,
            dealer_level, dealer_code, region, can_repair, credit_limit, is_active
        ) VALUES (?, ?, 'DEALER', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    
    const insertOrg = db.prepare(`
        INSERT INTO accounts (
            account_number, name, account_type, email, phone, country, city, address,
            service_tier, is_active
        ) VALUES (?, ?, 'ORGANIZATION', ?, ?, ?, ?, ?, ?, 1)
    `);
    
    const insertIndividual = db.prepare(`
        INSERT INTO accounts (
            account_number, name, account_type, email, phone, country, city, address,
            service_tier, is_active
        ) VALUES (?, ?, 'INDIVIDUAL', ?, ?, ?, ?, ?, ?, 1)
    `);

    const insertContact = db.prepare(`
        INSERT INTO contacts (
            account_id, name, email, phone, job_title, is_primary, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `);

    for (const dealer of DEALERS) {
        if (dealerMap[dealer.name]) {
            console.log(`  ⏭️  Dealer already exists: ${dealer.name}`);
            continue;
        }

        const accountNumber = generateAccountNumber();
        const result = insertDealer.run(
            accountNumber,
            dealer.name,
            dealer.email,
            dealer.phone,
            dealer.country,
            dealer.city,
            dealer.address,
            dealer.dealer_level,
            dealer.dealer_code,
            dealer.region,
            dealer.can_repair,
            dealer.credit_limit
        );

        const accountId = result.lastInsertRowid;
        dealerMap[dealer.name] = accountId;
        console.log(`  ✅ Created dealer: ${dealer.name} (ID: ${accountId})`);

        // Insert contacts
        for (const contact of dealer.contacts) {
            insertContact.run(
                accountId,
                contact.name,
                contact.email,
                contact.phone,
                contact.job_title,
                contact.is_primary
            );
        }
        console.log(`     📇 Added ${dealer.contacts.length} contacts`);
    }

    // Check existing organizations and individuals
    const existingOrgs = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE account_type = 'ORGANIZATION'").get().count;
    const existingIndividuals = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE account_type = 'INDIVIDUAL'").get().count;
    
    console.log(`\n📊 Found ${existingOrgs} existing organizations, ${existingIndividuals} existing individuals`);

    // Insert organization customers (only if less than 12 exist)
    console.log('\n🏢 Inserting organization customers...');
    const orgMap = {};
    let orgsCreated = 0;
    
    if (existingOrgs >= 12) {
        console.log('  ⏭️  Already have 12+ organizations, skipping...');
        // Get existing org IDs for contact reference
        const existingOrgRows = db.prepare("SELECT id, name FROM accounts WHERE account_type = 'ORGANIZATION'").all();
        existingOrgRows.forEach(o => orgMap[o.name] = o.id);
    } else {
        for (const org of ORGANIZATIONS) {
            // Check if org with same name already exists
            const existingOrg = db.prepare("SELECT id FROM accounts WHERE name = ? AND account_type = 'ORGANIZATION'").get(org.name);
            if (existingOrg) {
                console.log(`  ⏭️  Organization already exists: ${org.name}`);
                orgMap[org.name] = existingOrg.id;
                continue;
            }

            const accountNumber = generateAccountNumber();
            const result = insertOrg.run(
                accountNumber,
                org.name,
                org.email,
                org.phone,
                org.country,
                org.city,
                org.address,
                org.service_tier
            );

            const accountId = result.lastInsertRowid;
            orgMap[org.name] = accountId;
            orgsCreated++;
            console.log(`  ✅ Created org: ${org.name} (ID: ${accountId})`);

            // Insert contacts
            for (const contact of org.contacts) {
                insertContact.run(
                    accountId,
                    contact.name,
                    contact.email,
                    contact.phone,
                    contact.job_title,
                    contact.is_primary
                );
            }
            console.log(`     📇 Added ${org.contacts.length} contacts`);
        }
    }

    // Insert individual customers (only if less than 10 exist)
    console.log('\n👤 Inserting individual customers...');
    const individualMap = {};
    let individualsCreated = 0;
    
    if (existingIndividuals >= 10) {
        console.log('  ⏭️  Already have 10+ individuals, skipping...');
    } else {
        for (const ind of INDIVIDUALS) {
            // Check if individual with same name already exists
            const existingInd = db.prepare("SELECT id FROM accounts WHERE name = ? AND account_type = 'INDIVIDUAL'").get(ind.name);
            if (existingInd) {
                console.log(`  ⏭️  Individual already exists: ${ind.name}`);
                individualMap[ind.name] = existingInd.id;
                continue;
            }

            const accountNumber = generateAccountNumber();
            const result = insertIndividual.run(
                accountNumber,
                ind.name,
                ind.email,
                ind.phone,
                ind.country,
                ind.city,
                ind.address,
                ind.service_tier
            );

            const accountId = result.lastInsertRowid;
            individualMap[ind.name] = accountId;
            individualsCreated++;
            console.log(`  ✅ Created individual: ${ind.name} (ID: ${accountId})`);

            // Insert contacts
            for (const contact of ind.contacts) {
                insertContact.run(
                    accountId,
                    contact.name,
                    contact.email,
                    contact.phone,
                    contact.job_title,
                    contact.is_primary
                );
            }
        }
    }
    
    console.log(`\n📊 Created ${orgsCreated} new organizations, ${individualsCreated} new individuals`);

    // Commit accounts transaction
    db.exec('COMMIT');
    console.log('\n✅ Accounts and contacts seeded successfully!');

    // ==========================================
    // Seed Tickets
    // ==========================================
    
    console.log('\n🎫 Starting ticket seeding...');
    db.exec('BEGIN TRANSACTION');

    // Get all account IDs for reference
    // Note: inquiry_tickets references dealers and customers tables (legacy)
    const allDealers = db.prepare("SELECT id, name FROM dealers").all();
    const allCustomers = db.prepare("SELECT id, customer_name as name FROM customers").all();
    const allProducts = db.prepare('SELECT id, model_name, product_family FROM products').all();

    console.log(`  📊 Found ${allDealers.length} dealers, ${allCustomers.length} customers, ${allProducts.length} products`);

    // Insert Inquiry Tickets (20)
    console.log('\n📝 Creating 20 inquiry tickets...');
    const insertInquiry = db.prepare(`
        INSERT INTO inquiry_tickets (
            ticket_number, customer_name, customer_id, dealer_id,
            product_id, serial_number, service_type, channel, problem_summary,
            status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < 20; i++) {
        const dealer = randomElement(allDealers);
        const customer = randomElement(allCustomers);
        const product = randomElement(allProducts);
        const category = randomElement(ISSUE_CATEGORIES);
        const subcategory = randomElement(ISSUE_SUBCATEGORIES[category]);
        
        const ticketNumber = generateTicketNumber('K');
        const createdAt = randomDate(new Date('2025-01-01'), new Date());
        
        insertInquiry.run(
            ticketNumber,
            customer.name,
            customer.id,
            dealer.id,
            product.id,
            `SN${Math.floor(Math.random() * 90000) + 10000}`,
            randomElement(SERVICE_TYPES),
            randomElement(CHANNELS),
            `${category} - ${subcategory}`,
            randomElement(INQUIRY_STATUSES),
            createdAt.toISOString()
        );
        
        if ((i + 1) % 5 === 0) {
            console.log(`    ✅ Created ${i + 1}/20 inquiry tickets`);
        }
    }

    // Insert RMA/Service Issues (19 total - 10 RMA + 9 Dealer Repair)
    console.log('\n🔧 Creating 19 service issues (RMA + Dealer Repair)...');
    
    // First create a default system user if none exists
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    let defaultUserId = 1;
    if (userCount === 0) {
        const createUser = db.prepare(`
            INSERT INTO users (username, password, role, department_name, created_at)
            VALUES ('system', 'system', 'admin', 'System', datetime('now'))
        `);
        const result = createUser.run();
        defaultUserId = result.lastInsertRowid;
        console.log(`    👤 Created default system user (ID: ${defaultUserId})`);
    } else {
        defaultUserId = db.prepare('SELECT id FROM users LIMIT 1').get().id;
    }
    
    const insertIssue = db.prepare(`
        INSERT INTO issues (
            issue_number, product_id, customer_id, issue_category, issue_source,
            title, description, severity, status, reporter_name,
            serial_number, firmware_version, ticket_type, created_by, created_at
        ) VALUES (?, ?, ?, 'Hardware', 'OfflineReturn', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Create 10 RMA issues
    for (let i = 0; i < 10; i++) {
        const customer = randomElement(allCustomers);
        const product = randomElement(allProducts);
        const category = randomElement(ISSUE_CATEGORIES);
        const subcategory = randomElement(ISSUE_SUBCATEGORIES[category]);
        
        const issueNumber = generateTicketNumber('RMA-D-');
        const createdAt = randomDate(new Date('2025-01-01'), new Date());
        
        insertIssue.run(
            issueNumber,
            product.id,
            customer.id,
            `${category} - ${subcategory}`,
            `客户反馈${category}问题：${subcategory}，影响正常使用。`,
            randomElement(['Low', 'Medium', 'High', 'Critical']),
            randomElement(['Pending', 'Assigned', 'InProgress', 'AwaitingVerification', 'Closed']),
            customer.name,
            `SN${Math.floor(Math.random() * 90000) + 10000}`,
            randomElement(FIRMWARE_VERSIONS),
            'RMA',
            defaultUserId,
            createdAt.toISOString()
        );
        
        if ((i + 1) % 5 === 0) {
            console.log(`    ✅ Created ${i + 1}/10 RMA issues`);
        }
    }

    // Create 9 Dealer Service issues
    for (let i = 0; i < 9; i++) {
        const customer = randomElement(allCustomers);
        const product = randomElement(allProducts);
        const category = randomElement(ISSUE_CATEGORIES);
        const subcategory = randomElement(ISSUE_SUBCATEGORIES[category]);
        
        const issueNumber = generateTicketNumber('SVC-D-');
        const createdAt = randomDate(new Date('2025-01-01'), new Date());
        
        insertIssue.run(
            issueNumber,
            product.id,
            customer.id,
            `${category} - ${subcategory}`,
            `经销商本地维修：${category} - ${subcategory}`,
            randomElement(['Low', 'Medium', 'High', 'Critical']),
            randomElement(['Pending', 'Assigned', 'InProgress', 'AwaitingVerification', 'Closed']),
            customer.name,
            `SN${Math.floor(Math.random() * 90000) + 10000}`,
            randomElement(FIRMWARE_VERSIONS),
            'SVC',
            defaultUserId,
            createdAt.toISOString()
        );
        
        if ((i + 1) % 3 === 0) {
            console.log(`    ✅ Created ${i + 1}/9 dealer service issues`);
        }
    }

    // Commit tickets transaction
    db.exec('COMMIT');
    console.log('\n✅ All tickets seeded successfully!');

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SEEDING COMPLETE!');
    console.log('='.repeat(60));
    
    const stats = db.prepare(`
        SELECT 
            (SELECT COUNT(*) FROM accounts WHERE account_type = 'DEALER') as dealers,
            (SELECT COUNT(*) FROM accounts WHERE account_type = 'ORGANIZATION') as organizations,
            (SELECT COUNT(*) FROM accounts WHERE account_type = 'INDIVIDUAL') as individuals,
            (SELECT COUNT(*) FROM contacts) as contacts,
            (SELECT COUNT(*) FROM inquiry_tickets) as inquiry_tickets,
            (SELECT COUNT(*) FROM issues WHERE ticket_type = 'RMA') as rma_tickets,
            (SELECT COUNT(*) FROM issues WHERE ticket_type = 'SVC') as dealer_repair_tickets
    `).get();
    
    console.log(`\n📊 Final Statistics:`);
    console.log(`   🏪 Dealers: ${stats.dealers}`);
    console.log(`   🏢 Organizations: ${stats.organizations}`);
    console.log(`   👤 Individuals: ${stats.individuals}`);
    console.log(`   📇 Contacts: ${stats.contacts}`);
    console.log(`   📝 Inquiry Tickets: ${stats.inquiry_tickets}`);
    console.log(`   🔧 RMA Tickets: ${stats.rma_tickets}`);
    console.log(`   🔨 Dealer Repair Tickets: ${stats.dealer_repair_tickets}`);
    console.log(`\n✨ Total: ${stats.dealers + stats.organizations + stats.individuals} accounts, ${stats.contacts} contacts, ${stats.inquiry_tickets + stats.rma_tickets + stats.dealer_repair_tickets} tickets`);

} catch (error) {
    console.error('\n❌ Error seeding data:', error);
    db.exec('ROLLBACK');
    process.exit(1);
} finally {
    db.close();
    console.log('\n👋 Database connection closed.');
}
