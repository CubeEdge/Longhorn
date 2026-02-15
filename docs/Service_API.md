# 产品服务系统 - API 设计文档

**版本**:  → 1
**状态**: 草稿
**最后更新**: 2026-02-15 00:02:23
**关联PRD**: Service_PRD.md (自动同步)
**关联场景**: Service_UserScenarios.md (自动同步)

> **智能API更新分析**：
> - 基于 70 个文件变更自动分析
> - 检测路由文件变更：9 个
> - 检测服务文件变更：12 个
> - 自动提取新增/修改的API接口

## 🔄 本次API智能更新

### 接口变更概览
- server/service/routes/accounts.js: 11 个接口
- server/service/routes/bokeh.js: 3 个接口
- server/service/routes/context.js: 3 个接口
- server/service/routes/dealer-repairs.js: 5 个接口
- server/service/routes/inquiry-tickets.js: 7 个接口
- server/service/routes/knowledge.js: 13 个接口
- server/service/routes/products-admin.js: 6 个接口
- server/service/routes/rma-tickets.js: 8 个接口
- server/service/routes/settings.js: 8 个接口

### 新增API接口
#### server/service/routes/accounts.js

#### server/service/routes/bokeh.js

#### server/service/routes/context.js
        router.get('/by-customer', authenticate, (req, res) => {

#### server/service/routes/dealer-repairs.js

#### server/service/routes/inquiry-tickets.js

#### server/service/routes/knowledge.js

#### server/service/routes/products-admin.js
        router.get('/', authenticate, requireAdmin, (req, res) => {
        router.get('/:id', authenticate, requireAdmin, (req, res) => {
        router.post('/', authenticate, requireAdmin, (req, res) => {
        router.put('/:id', authenticate, requireAdmin, (req, res) => {
        router.delete('/:id', authenticate, requireAdmin, (req, res) => {

#### server/service/routes/rma-tickets.js

#### server/service/routes/settings.js
        router.get('/backup/status', (req, res) => {
        router.post('/backup/now/:type', async (req, res) => {

### 修改的API接口
#### server/service/routes/accounts.js
    删除:             // 支持三种状态筛选: active, inactive, deleted
    新增:             // 支持状态筛选: active, inactive
    删除:                     conditions.push('a.is_active = 1 AND (a.is_deleted IS NULL OR a.is_deleted = 0)');
    新增:                     conditions.push('a.is_active = 1');
    删除:                     conditions.push('a.is_active = 0 AND (a.is_deleted IS NULL OR a.is_deleted = 0)');
    删除:                 } else if (status === 'deleted') {
    删除:                     conditions.push('a.is_deleted = 1');
    新增:                     conditions.push('a.is_active = 0');
    新增:                 // Note: 'deleted' status not supported - accounts table doesn't have is_deleted column
    删除:                 LEFT JOIN contacts c ON c.account_id = a.id AND (c.is_primary = 1 OR c.status = 'PRIMARY')

#### server/service/routes/bokeh.js
    删除:                     tsi.customer_id,
    新增:                     tsi.account_id,
    删除:             // Enrich results with customer names
    新增:             // Enrich results with account names
    删除:                 if (r.customer_id) {
    删除:                     const customer = db.prepare('SELECT customer_name FROM customers WHERE id = ?').get(r.customer_id);
    删除:                     customer_name = customer?.customer_name;
    新增:                 if (r.account_id) {
    新增:                     const account = db.prepare('SELECT name FROM accounts WHERE id = ?').get(r.account_id);
    新增:                     customer_name = account?.name;

#### server/service/routes/context.js
    新增:      * @note 兼容旧架构：优先查询 accounts 表，如未找到则返回 404
    删除:     router.get('/by-customer', (req, res) => {
    新增:     router.get('/by-customer', authenticate, (req, res) => {
    删除:             // 1. Fetch Customer Profile
    新增:             // 1. Fetch Customer Profile from accounts table (新架构)
    删除:                     SELECT * FROM customers WHERE id = ?
    新增:                     SELECT 
    新增:                         id,
    新增:                         name as customer_name,
    新增:                         email,

#### server/service/routes/dealer-repairs.js
    删除:             customer_name: repair.customer_name,
    新增:             // Account/Contact Info
    新增:             account_id: repair.account_id,
    新增:             contact_id: repair.contact_id,
    新增:             account: repair.account_id ? {
    新增:                 id: repair.account_id,
    新增:                 name: repair.account_name,
    新增:                 account_type: repair.account_type,
    新增:                 service_tier: repair.service_tier
    新增:             } : null,

#### server/service/routes/inquiry-tickets.js
    删除:                 customer_name: ticket.customer_name || '匿名客户',
    新增:                 // Account/Contact Info
    新增:                 account_id: ticket.account_id,
    新增:                 contact_id: ticket.contact_id,
    新增:                 account: ticket.account_id ? {
    新增:                     id: ticket.account_id,
    新增:                     name: ticket.account_name,
    新增:                     account_type: ticket.account_type,
    新增:                     service_tier: ticket.service_tier
    新增:                 } : null,

#### server/service/routes/knowledge.js
    删除:             const imagesDir = path.join(__dirname, '../../data/knowledge_images');
    新增:             const imagesDir = '/Volumes/fileserver/Service/Knowledge/Images';
    删除:                 const DISK_A = path.resolve(__dirname, '../../data/DiskA');
    新增:                 const DISK_A = '/Volumes/fileserver/Files';
    删除:             const imagesDir = path.join(__dirname, '../../data/knowledge_images');
    新增:             const imagesDir = '/Volumes/fileserver/Service/Knowledge/Images';
    删除:             const imagesDir = path.join(__dirname, '../../data/knowledge_images');
    新增:             const imagesDir = '/Volumes/fileserver/Service/Knowledge/Images';
    新增:                     formatted_content: formattedContent,  // Return full content for editor
    删除:                     image_count: imageMatches.length,

#### server/service/routes/products-admin.js
    新增: /**
    新增:  * Products Admin Routes
    新增:  * CRUD API for product management (Admin/Lead only)
    新增:  */
    新增: const express = require('express');
    新增: 
    新增: module.exports = function (db, authenticate) {
    新增:     const router = express.Router();
    新增: 
    新增:     // Check if user is Admin or Lead

#### server/service/routes/rma-tickets.js
    新增:             // Account/Contact Info
    新增:             account_id: ticket.account_id,
    新增:             contact_id: ticket.contact_id,
    新增:             account: ticket.account_id ? {
    新增:                 id: ticket.account_id,
    新增:                 name: ticket.account_name,
    新增:                 account_type: ticket.account_type,
    新增:                 service_tier: ticket.service_tier
    新增:             } : null,
    新增:             contact: ticket.contact_id ? {

#### server/service/routes/settings.js
    删除:                 // Normalize Backup Settings
    新增:                 // Normalize Primary Backup Settings
    新增: 
    新增:                 // Normalize Secondary Backup Settings
    新增:                 settings.secondary_backup_enabled = Boolean(settings.secondary_backup_enabled);
    新增:                 settings.secondary_backup_frequency = parseInt(settings.secondary_backup_frequency) || 4320;
    新增:                 settings.secondary_backup_retention_days = parseInt(settings.secondary_backup_retention_days) || 30;
    新增:                         secondary_backup_enabled = @secondary_backup_enabled,
    新增:                         secondary_backup_frequency = @secondary_backup_frequency,
    新增:                         secondary_backup_retention_days = @secondary_backup_retention_days,

### 数据模型变更


### 待完善内容
- [ ] 补充详细的请求/响应示例
- [ ] 更新错误码定义
- [ ] 完善权限控制说明
- [ ] 添加接口测试用例

---
