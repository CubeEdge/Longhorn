# 产品服务闭环系统 - 需求文档 (PRD)

**版本**:  → 1
**状态**: 待确认
**最后更新**: 2026-02-15 00:02:23

> **智能更新分析**：
> - 基于 70 个文件的变更自动分析
> - 检测到 9 个路由变更
> - 检测到 13 个组件变更
> - 检测到 12 个服务变更

## 🔄 本次智能更新内容

### 变更概览
    📊 变更分析结果:
      - 路由文件变更: 9 个
      - 组件文件变更: 13 个
      - 服务文件变更: 12 个
      - 数据模型变更: 0
    0 个
      - API相关变更: 21 个

### 详细变更分析
🔍 提取变更详情...
### 路由变更分析
#### server/service/routes/accounts.js
    router.get('/', authenticate, (req, res) => {
    router.post('/', authenticate, (req, res) => {
    router.get('/:id', authenticate, (req, res) => {
    router.get('/:id/contacts', authenticate, (req, res) => {
    router.post('/:id/contacts', authenticate, (req, res) => {

#### server/service/routes/bokeh.js
    router.post('/search-tickets', authenticate, async (req, res) => {
    router.post('/index', authenticate, async (req, res) => {
    router.post('/batch-index', authenticate, async (req, res) => {

#### server/service/routes/context.js
    router.get('/by-customer', authenticate, (req, res) => {
    router.get('/by-account', authenticate, (req, res) => {
    router.get('/by-serial-number', authenticate, (req, res) => {

#### server/service/routes/dealer-repairs.js
    router.get('/stats', authenticate, (req, res) => {
    router.get('/', authenticate, (req, res) => {
    router.get('/:id', authenticate, (req, res) => {
    router.post('/', authenticate, serviceUpload.array('attachments'), (req, res) => {
    router.delete('/:id', authenticate, (req, res) => {

#### server/service/routes/inquiry-tickets.js
    router.get('/stats', authenticate, (req, res) => {
    router.get('/', authenticate, (req, res) => {
    router.get('/:id', authenticate, (req, res) => {
    router.post('/', authenticate, serviceUpload.array('attachments'), (req, res) => {
    router.post('/:id/upgrade', authenticate, (req, res) => {

#### server/service/routes/knowledge.js
    router.get('/', authenticate, (req, res) => {
    router.get('/:idOrSlug', authenticate, (req, res) => {
    router.post('/', authenticate, (req, res) => {
    router.post('/import/pdf', authenticate, upload.single('pdf'), async (req, res) => {
    router.post('/import/docx', authenticate, docxUpload.single('docx'), async (req, res) => {

#### server/service/routes/products-admin.js
    router.get('/', authenticate, requireAdmin, (req, res) => {
    router.get('/:id', authenticate, requireAdmin, (req, res) => {
    router.post('/', authenticate, requireAdmin, (req, res) => {
    router.put('/:id', authenticate, requireAdmin, (req, res) => {
    router.delete('/:id', authenticate, requireAdmin, (req, res) => {

#### server/service/routes/rma-tickets.js
    router.get('/stats', authenticate, (req, res) => {
    router.get('/', authenticate, (req, res) => {
    router.get('/:id', authenticate, (req, res) => {
    router.post('/', authenticate, serviceUpload.array('attachments'), (req, res) => {
    router.post('/batch', authenticate, (req, res) => {

#### server/service/routes/settings.js
    router.get('/settings', (req, res) => {
    router.post('/settings', (req, res) => {
    router.get('/backup/status', (req, res) => {
    router.post('/backup/now', async (req, res) => {
    router.post('/backup/now/:type', async (req, res) => {

### 组件变更分析
#### client/src/components/Admin/AdminSettings.tsx
                                                                message: '恢复功能开发中，请联系管理员手动恢复。'

#### client/src/components/CustomerManagement.tsx

#### client/src/components/DealerDetailPage.tsx

#### client/src/components/DealerRepairs/DealerRepairDetailPage.tsx

#### client/src/components/DealerRepairs/DealerRepairListPage.tsx

#### client/src/components/InquiryTickets/InquiryTicketDetailPage.tsx

#### client/src/components/InquiryTickets/InquiryTicketListPage.tsx

#### client/src/components/KinefinityWiki.tsx

#### client/src/components/Knowledge/WikiEditorModal.tsx

#### client/src/components/ProductManagement.tsx

#### client/src/components/RMATickets/RMATicketDetailPage.tsx

#### client/src/components/RMATickets/RMATicketListPage.tsx

#### client/src/components/UI/SortDropdown.tsx

### 服务变更分析
#### server/service/ai_service.js
+++ b/server/service/ai_service.js
+                tsi.account_id,
+                if (r.account_id) {
+                    const account = this.db.prepare('SELECT name FROM accounts WHERE id = ?').get(r.account_id);
+                    customer_name = account?.name;

#### server/service/backup_service.js
+++ b/server/service/backup_service.js
+        this.diskPath = diskPath;
+        this.primaryTimer = null;
+        this.secondaryTimer = null;
+        
+        this.primaryConfig = {
+            path: '/Volumes/fileserver/System/Backups/db',
+            label: '主备份'
+        };
+        

#### server/service/migrations/011_add_ticket_product_family.sql
+++ b/server/service/migrations/011_add_ticket_product_family.sql
+-- Migration 011: Add product_family column to ticket tables
+-- Purpose: Enable efficient filtering by product family (A/B/C/D)
+-- Date: 2026-02-12
+
+-- 1. Add product_family column to inquiry_tickets
+ALTER TABLE inquiry_tickets ADD COLUMN product_family TEXT;
+
+-- 2. Add product_family column to rma_tickets
+ALTER TABLE rma_tickets ADD COLUMN product_family TEXT;

#### server/service/routes/accounts.js
+++ b/server/service/routes/accounts.js
+                    conditions.push('a.is_active = 1');
+                    conditions.push('a.is_active = 0');
+                LEFT JOIN contacts c ON c.account_id = a.id AND c.status = 'PRIMARY'

#### server/service/routes/bokeh.js
+++ b/server/service/routes/bokeh.js
+                    tsi.account_id,
+                if (r.account_id) {
+                    const account = db.prepare('SELECT name FROM accounts WHERE id = ?').get(r.account_id);
+                    customer_name = account?.name;
+                    dealer_id, account_id, visibility, closed_at
+                    @dealer_id, @account_id, @visibility, @closed_at
+                account_id: ticketData.account_id || null,
+            dealer_id, account_id, visibility, closed_at
+            @dealer_id, @account_id, @visibility, @closed_at

#### server/service/routes/context.js
+++ b/server/service/routes/context.js
+     * @note 兼容旧架构：优先查询 accounts 表，如未找到则返回 404
+    router.get('/by-customer', authenticate, (req, res) => {
+                    SELECT 
+                        id,
+                        name as customer_name,
+                        email,
+                        phone,
+                        country,
+                        city,

#### server/service/routes/dealer-repairs.js
+++ b/server/service/routes/dealer-repairs.js
+            account_id: repair.account_id,
+            contact_id: repair.contact_id,
+            account: repair.account_id ? {
+                id: repair.account_id,
+                name: repair.account_name,
+                account_type: repair.account_type,
+                service_tier: repair.service_tier
+            } : null,
+            contact: repair.contact_id ? {

#### server/service/routes/inquiry-tickets.js
+++ b/server/service/routes/inquiry-tickets.js
+                account_id: ticket.account_id,
+                contact_id: ticket.contact_id,
+                account: ticket.account_id ? {
+                    id: ticket.account_id,
+                    name: ticket.account_name,
+                    account_type: ticket.account_type,
+                    service_tier: ticket.service_tier
+                } : null,
+                contact: ticket.contact_id ? {

#### server/service/routes/knowledge.js
+++ b/server/service/routes/knowledge.js
+            const imagesDir = '/Volumes/fileserver/Service/Knowledge/Images';
+                const DISK_A = '/Volumes/fileserver/Files';
+            const imagesDir = '/Volumes/fileserver/Service/Knowledge/Images';
+            const imagesDir = '/Volumes/fileserver/Service/Knowledge/Images';
+                    image_count: imageMatches.length

#### server/service/routes/products-admin.js
+++ b/server/service/routes/products-admin.js
+/**
+ * Products Admin Routes
+ * CRUD API for product management (Admin/Lead only)
+ */
+const express = require('express');
+
+module.exports = function (db, authenticate) {
+    const router = express.Router();
+

#### server/service/routes/rma-tickets.js
+++ b/server/service/routes/rma-tickets.js
+            account_id: ticket.account_id,
+            contact_id: ticket.contact_id,
+            account: ticket.account_id ? {
+                id: ticket.account_id,
+                name: ticket.account_name,
+                account_type: ticket.account_type,
+                service_tier: ticket.service_tier
+            } : null,
+            contact: ticket.contact_id ? {

#### server/service/routes/settings.js
+++ b/server/service/routes/settings.js
+
+                settings.secondary_backup_enabled = Boolean(settings.secondary_backup_enabled);
+                settings.secondary_backup_frequency = parseInt(settings.secondary_backup_frequency) || 4320;
+                settings.secondary_backup_retention_days = parseInt(settings.secondary_backup_retention_days) || 30;
+                        secondary_backup_enabled = @secondary_backup_enabled,
+                        secondary_backup_frequency = @secondary_backup_frequency,
+                        secondary_backup_retention_days = @secondary_backup_retention_days,
+                    backup_retention_days: parseInt(settings.backup_retention_days) || 7,
+                    secondary_backup_enabled: settings.secondary_backup_enabled ? 1 : 0,

### 功能需求更新
#### 新增功能特性
- [ ] 基于代码变更自动识别新增功能
- [ ] 更新用户场景描述
- [ ] 补充业务流程说明

#### 修改的功能逻辑
- [ ] 识别现有功能的变更点
- [ ] 更新相关业务规则
- [ ] 调整用户操作流程

### 非功能性需求
- [ ] 性能要求更新
- [ ] 安全性增强
- [ ] 兼容性说明

---
