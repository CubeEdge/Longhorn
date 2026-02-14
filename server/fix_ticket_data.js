#!/usr/bin/env node
/**
 * 数据诊断和修复脚本
 * 用于修复工单系统的 account_id 数据同步问题
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'longhorn.db');
const db = new Database(dbPath);

console.log('========================================');
console.log('工单数据诊断和修复脚本');
console.log('========================================\n');

// 1. 检查 RMA 工单表结构和数据
console.log('1. RMA工单诊断');
console.log('----------------------------------------');
try {
    const rmaCount = db.prepare('SELECT COUNT(*) as count FROM rma_tickets').get();
    console.log(`   总数: ${rmaCount.count}`);
    
    const rmaList = db.prepare('SELECT id, ticket_number, account_id, customer_id FROM rma_tickets ORDER BY id DESC LIMIT 10').all();
    console.log('   最近10条RMA工单:');
    rmaList.forEach(r => {
        console.log(`     ID=${r.id}, ${r.ticket_number}, account_id=${r.account_id}, customer_id=${r.customer_id}`);
    });
    
    const rmaMissingAccount = db.prepare('SELECT COUNT(*) as count FROM rma_tickets WHERE account_id IS NULL').get();
    console.log(`   缺少account_id: ${rmaMissingAccount.count}条`);
} catch (err) {
    console.log(`   错误: ${err.message}`);
}

// 2. 检查经销商维修单
console.log('\n2. 经销商维修单诊断');
console.log('----------------------------------------');
try {
    const repairCount = db.prepare('SELECT COUNT(*) as count FROM dealer_repairs').get();
    console.log(`   总数: ${repairCount.count}`);
    
    const repairList = db.prepare('SELECT id, ticket_number, account_id, customer_id FROM dealer_repairs ORDER BY id DESC LIMIT 10').all();
    console.log('   最近10条维修单:');
    repairList.forEach(r => {
        console.log(`     ID=${r.id}, ${r.ticket_number}, account_id=${r.account_id}, customer_id=${r.customer_id}`);
    });
    
    const repairMissingAccount = db.prepare('SELECT COUNT(*) as count FROM dealer_repairs WHERE account_id IS NULL').get();
    console.log(`   缺少account_id: ${repairMissingAccount.count}条`);
} catch (err) {
    console.log(`   错误: ${err.message}`);
}

// 3. 检查咨询工单
console.log('\n3. 咨询工单诊断');
console.log('----------------------------------------');
try {
    const inquiryCount = db.prepare('SELECT COUNT(*) as count FROM inquiry_tickets').get();
    console.log(`   总数: ${inquiryCount.count}`);
    
    const inquiryMissingAccount = db.prepare('SELECT COUNT(*) as count FROM inquiry_tickets WHERE account_id IS NULL').get();
    console.log(`   缺少account_id: ${inquiryMissingAccount.count}条`);
} catch (err) {
    console.log(`   错误: ${err.message}`);
}

// 4. 检查 accounts 表
console.log('\n4. Accounts表诊断');
console.log('----------------------------------------');
try {
    const accountCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
    console.log(`   总数: ${accountCount.count}`);
    
    const dealerCount = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE account_type = 'DEALER'").get();
    console.log(`   经销商: ${dealerCount.count}`);
    
    const customerCount = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE account_type IN ('INDIVIDUAL', 'ORGANIZATION')").get();
    console.log(`   客户: ${customerCount.count}`);
} catch (err) {
    console.log(`   错误: ${err.message}`);
}

// 5. 检查 customers 表（旧表）
console.log('\n5. Customers表（旧表）诊断');
console.log('----------------------------------------');
try {
    const custCount = db.prepare('SELECT COUNT(*) as count FROM customers').get();
    console.log(`   总数: ${custCount.count}`);
} catch (err) {
    console.log(`   表不存在或错误: ${err.message}`);
}

// ========================================
// 数据修复
// ========================================
console.log('\n========================================');
console.log('开始数据修复');
console.log('========================================\n');

// 修复1: 同步 dealer_repairs 的 account_id
console.log('修复1: 同步 dealer_repairs 的 account_id');
try {
    // 从 customer_id 同步到 account_id（如果 customer_id 对应 accounts 表的记录）
    const updateFromCustomer = db.prepare(`
        UPDATE dealer_repairs 
        SET account_id = (
            SELECT a.id FROM accounts a 
            JOIN customers c ON (a.name = c.customer_name OR a.name = c.company_name)
            WHERE c.id = dealer_repairs.customer_id
            LIMIT 1
        )
        WHERE account_id IS NULL AND customer_id IS NOT NULL
    `);
    const result1 = updateFromCustomer.run();
    console.log(`   从customer_id同步: ${result1.changes}条更新`);
    
    // 如果还有缺失，从 dealer_id 推断客户
    // 经销商维修单通常关联到经销商下的客户
} catch (err) {
    console.log(`   错误: ${err.message}`);
}

// 修复2: 同步 rma_tickets 的 account_id
console.log('\n修复2: 同步 rma_tickets 的 account_id');
try {
    const updateRma = db.prepare(`
        UPDATE rma_tickets 
        SET account_id = (
            SELECT a.id FROM accounts a 
            JOIN customers c ON (a.name = c.customer_name OR a.name = c.company_name)
            WHERE c.id = rma_tickets.customer_id
            LIMIT 1
        )
        WHERE account_id IS NULL AND customer_id IS NOT NULL
    `);
    const result2 = updateRma.run();
    console.log(`   从customer_id同步: ${result2.changes}条更新`);
} catch (err) {
    console.log(`   错误: ${err.message}`);
}

// 修复3: 同步 inquiry_tickets 的 account_id
console.log('\n修复3: 同步 inquiry_tickets 的 account_id');
try {
    const updateInquiry = db.prepare(`
        UPDATE inquiry_tickets 
        SET account_id = (
            SELECT a.id FROM accounts a 
            JOIN customers c ON (a.name = c.customer_name OR a.name = c.company_name)
            WHERE c.id = inquiry_tickets.customer_id
            LIMIT 1
        )
        WHERE account_id IS NULL AND customer_id IS NOT NULL
    `);
    const result3 = updateInquiry.run();
    console.log(`   从customer_id同步: ${result3.changes}条更新`);
} catch (err) {
    console.log(`   错误: ${err.message}`);
}

// ========================================
// 修复后验证
// ========================================
console.log('\n========================================');
console.log('修复后验证');
console.log('========================================\n');

try {
    const rmaMissing = db.prepare('SELECT COUNT(*) as count FROM rma_tickets WHERE account_id IS NULL').get();
    const repairMissing = db.prepare('SELECT COUNT(*) as count FROM dealer_repairs WHERE account_id IS NULL').get();
    const inquiryMissing = db.prepare('SELECT COUNT(*) as count FROM inquiry_tickets WHERE account_id IS NULL').get();
    
    console.log(`RMA工单缺少account_id: ${rmaMissing.count}条`);
    console.log(`经销商维修单缺少account_id: ${repairMissing.count}条`);
    console.log(`咨询工单缺少account_id: ${inquiryMissing.count}条`);
} catch (err) {
    console.log(`验证错误: ${err.message}`);
}

console.log('\n========================================');
console.log('脚本执行完成');
console.log('========================================');

db.close();
