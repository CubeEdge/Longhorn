# Dev Log 更新记录

## 2026-02-15 02:57:03 开发日志

### 代码变更摘要
```bash
# 最近 5 次提交记录
2daaed7 fix: 修复工单族群筛选通过products表关联查询
4630a18 fix: 工单详情页Info Card显示客户联系人而非客户名称
b09995d fix: 统一三种工单详情页Header样式，去掉时间和客户名称
567615e Merge remote-tracking branch 'origin/main' - 合并UI优化、经销商列表修复和DOCX性能优化
2a7e9d3 feat: ui refinements, dealer list fix, and navigation persistence
```

### 文件变更统计
```bash
# 当前工作区状态
 M client/src/App.tsx
 M client/src/components/Admin/AdminSettings.tsx
 M client/src/components/CustomerFormModal.tsx
 M client/src/components/DealerDetailPage.tsx
 M client/src/components/DealerRepairs/DealerRepairDetailPage.tsx
 M client/src/components/DealerRepairs/DealerRepairListPage.tsx
 M client/src/components/InquiryTickets/InquiryTicketDetailPage.tsx
 M client/src/components/InquiryTickets/InquiryTicketListPage.tsx
 M client/src/components/KinefinityWiki.tsx
 M client/src/components/Knowledge/WikiEditorModal.tsx
 M client/src/components/ProductManagement.tsx
 M client/src/components/RMATickets/RMATicketDetailPage.tsx
 M client/src/components/RMATickets/RMATicketListPage.tsx
 M client/src/components/Service/CustomerContextSidebar.tsx
 M client/src/i18n/translations.ts
 M client/src/store/useListStateStore.ts
 M docs/1_Backlog.md
 M docs/2_PromptLog.md
 M docs/4_DevLog.md
 M docs/Service_API.md
 M docs/Service_PRD.md
 M server/index.js
 M server/service/index.js
 M server/service/routes/contacts.js
 M server/service/routes/export.js
 M server/service/routes/issues.js
 M server/service/routes/knowledge.js
 M server/service/routes/parts.js
 M server/service/routes/settings.js
 M server/service/routes/system.js
?? docs_cmd
?? docss
?? docss_working
?? scripts/update_service_docs_smart.sh
?? server/scripts/fix_data.sql
```

### 待办事项同步
- [ ] 检查 backlog 中的任务完成情况
- [ ] 更新相关文档
- [ ] 验证代码功能

# Dev Log 更新记录

## 2026-02-14 23:09:02 开发日志

### 代码变更摘要
```bash
# 最近 5 次提交记录
94bba79 feat: 大规模功能优化和工具完善
4630a18 fix: 工单详情页Info Card显示客户联系人而非客户名称
b09995d fix: 统一三种工单详情页Header样式，去掉时间和客户名称
567615e Merge remote-tracking branch 'origin/main' - 合并UI优化、经销商列表修复和DOCX性能优化
2a7e9d3 feat: ui refinements, dealer list fix, and navigation persistence
```

### 文件变更统计
```bash
# 当前工作区状态
 M client/src/App.tsx
 M client/src/components/Admin/AdminSettings.tsx
 M client/src/components/CustomerFormModal.tsx
 M client/src/components/DealerDetailPage.tsx
 M client/src/components/DealerRepairs/DealerRepairDetailPage.tsx
 M client/src/components/DealerRepairs/DealerRepairListPage.tsx
 M client/src/components/InquiryTickets/InquiryTicketDetailPage.tsx
 M client/src/components/InquiryTickets/InquiryTicketListPage.tsx
 M client/src/components/Knowledge/WikiEditorModal.tsx
 M client/src/components/ProductManagement.tsx
 M client/src/components/RMATickets/RMATicketDetailPage.tsx
 M client/src/components/RMATickets/RMATicketListPage.tsx
 M client/src/components/Service/CustomerContextSidebar.tsx
 M client/src/i18n/translations.ts
 M client/src/store/useListStateStore.ts
 M docs/1_Backlog.md
 M docs/2_PromptLog.md
 M server/service/index.js
 M server/service/routes/contacts.js
 M server/service/routes/dealer-repairs.js
 M server/service/routes/export.js
 M server/service/routes/inquiry-tickets.js
 M server/service/routes/issues.js
 M server/service/routes/parts.js
 M server/service/routes/rma-tickets.js
 M server/service/routes/settings.js
 M server/service/routes/system.js
?? server/scripts/fix_data.sql
```

### 待办事项同步
- [ ] 检查 backlog 中的任务完成情况
- [ ] 更新相关文档
- [ ] 验证代码功能

# Dev Log 更新记录

## 2026-02-13 10:09:05 开发日志

### 代码变更摘要
```bash
# 最近 5 次提交记录
4630a18 fix: 工单详情页Info Card显示客户联系人而非客户名称
b09995d fix: 统一三种工单详情页Header样式，去掉时间和客户名称
567615e Merge remote-tracking branch 'origin/main' - 合并UI优化、经销商列表修复和DOCX性能优化
2a7e9d3 feat: ui refinements, dealer list fix, and navigation persistence
14bbb40 docs: finalize task documentation (prompt_log, dev_log, api, prd)
```

### 文件变更统计
```bash
# 当前工作区状态
 M client/src/App.tsx
 M client/src/components/CustomerDetailPage.tsx
 M client/src/components/DealerDetailPage.tsx
 M client/src/components/DealerRepairs/DealerRepairDetailPage.tsx
 M client/src/components/DealerRepairs/DealerRepairListPage.tsx
 M client/src/components/InquiryTickets/InquiryTicketDetailPage.tsx
 M client/src/components/InquiryTickets/InquiryTicketListPage.tsx
 M client/src/components/KinefinityWiki.tsx
 M client/src/components/RMATickets/RMATicketDetailPage.tsx
 M client/src/components/RMATickets/RMATicketListPage.tsx
 M docs/1_Backlog.md
 M docs/2_PromptLog.md
 M docs/context.md
 M server/service/routes/dealer-repairs.js
 M server/service/routes/inquiry-tickets.js
 M server/service/routes/rma-tickets.js
?? client/src/components/Knowledge/
?? client/src/store/useListStateStore.ts
?? docall
?? doclog
?? green_colors_comparison.html
?? kine_brand_colors.html
?? scripts/doc_aliases.sh
?? scripts/doc_menu.sh
?? scripts/update_core_docs.sh
?? scripts/update_docs.sh
?? scripts/update_service_docs.sh
```

### 待办事项同步
- [ ] 检查 backlog 中的任务完成情况
- [ ] 更新相关文档
- [ ] 验证代码功能

# 开发会话日志 (Development Session Log)

**概述**: 本文档记录每次开发会话的内容、投入的"Prompt轮数/精力"以及具体的技术产出。

---

## 会话: 2026-02-11 (UI Refinements & Dealer API Fix)

### 任务: 客户档案 UI 优化与经销商列表修复
- **状态**: ✅ 已完成
- **背景**:
    - 用户反馈经销商列表为空，原因为后台 API 过滤逻辑错误。
    - 列表页状态（分页/筛选）在进入详情页后丢失，需实现状态持久化。
    - UI 需微调以符合新的视觉规范（Low-key Kine Button）。

- **变更内容**:
    - **API (Backend)**:
        - 修复 `server/index.js` 中 `GET /api/v1/customers` 的 SQL 拼接逻辑，确保 `account_type='Dealer'` 时正确过滤。
    - **Frontend (Store)**:
        - 新增 `useRouteMemoryStore.ts` (Zustand) 用于存储路由查询参数。
        - 更新 `InquiryTicketDetailPage`, `RMATicketDetailPage`, `DealerRepairDetailPage` 使用 `getRoute()` 实现智能回退。
    - **Styles**:
        - `index.css`: 新增 `.btn-kine-lowkey`, `.tab-active-lowkey`。
        - `CustomerManagement.tsx`: 应用样式，并将 Tab 名称中文化。

- **技术决策**:
    > **决策**: 使用 **Zustand** 实现简单的路由记忆存储。
    > - **原因**: 相比复杂的 URL 状态同步库，Zustand 轻量且足以处理这种“列表 ->详情 -> 返回”的单一层级状态恢复需求。
    > - **实现**: `setRoute(path, query)` 在离开列表时调用，`getRoute(path)` 在返回时调用。

- **验证**:
    - ✅ 经销商列表正确加载（8条记录）。
    - ✅ 详情页返回按钮能够恢复之前的搜索词和页码。
    - ✅ UI 样式符合“低调奢华”的要求。

- **文件修改清单**:
    - `server/index.js` (API Fix)
    - `client/src/store/useRouteMemoryStore.ts` (New Store)
    - `client/src/index.css` (Style Update)
    - `client/src/components/CustomerManagement.tsx` (UI Update)
    - `client/src/components/*/*TicketDetailPage.tsx` (Nav Logic)

---

## 会话: 2026-02-10 (Files Module Refactoring & Backup System)

### 任务: Files 路由模块化拆分与数据库自动备份系统实现
- **状态**: ✅ 已完成
- **背景**: 
    - `server/index.js` 文件过大（>2500行），包含大量文件管理逻辑，维护困难。
    - 系统缺乏自动备份机制，存在数据丢失风险。
    - 需要支持动态配置备份频率和保留策略。

- **变更内容**:
    - **Backend (Router Refactoring)**:
        - **新模块**: `server/files/routes.js`
        - **功能**: 完整封装了 `list`, `upload`, `rename`, `copy`, `move`, `delete` 以及批量操作。
        - **权限**: 迁移并优化了 `resolvePath`, `hasPermission` 和 `checkInternalUser` 中间件。
        - **解耦**: `server/index.js` 成功精简，通过 `app.use('/api', filesRouter)` 挂载，保持前端 API 路径稳定性。

    - **Backend (System Backup Service)**:
        - **新服务**: `server/service/backup_service.js` (BackupService 类)
        - **SQLite Hot Backup**: 使用 `db.backup(destination)` 实现“在线热备份”，确保备份时数据库可读写，无锁表风险。
        - **自动调度**: 集成 `node-schedule`，支持通过数据库配置 `backup_frequency` (分钟) 动态调整频率。
        - **自愈与重载**: 提供 `reload()` 方法，当管理员修改设置时，服务无需重启即可应用新策略。
        - **策略性清理**: 自动扫描 `DiskA/.backups/db` 目录，删除超过 `backup_retention_days` 的旧备份文件。

    - **Database & Settings**:
        - **Schema**: 向 `system_settings` 表新增 3 个字段：`backup_enabled`, `backup_frequency`, `backup_retention_days`。
        - **Migration**: 在 `index.js` 启动逻辑中添加 `TRY-ALTER` 机制，确保不同环境下的 Schema 自动对齐。
        - **API**: 更新 `/api/admin/settings` 使其支持备份策略的读取与保存，新增 `/api/admin/backup/now` 手动触发接口。

- **技术决策**:
    > **决策**: 采用 **SQLite Online Backup API**。
    > - **原因**: 相比简单的文件复制 (fs.copy)，`db.backup()` 能够保证在备份过程中即使有写入操作，备份文件依然具备一致性，且不会阻塞主进程。
    > - **实现**: `backupService.trigger()` -> `db.backup(destPath)` -> `fs.removeOldBackups()`。

- **验证**:
    - ✅ `server/index.js` 代码量显著减少，逻辑清晰。
    - ✅ 模拟手动修改设置，确认 `BackupService` 热重载生效。
    - ✅ 调用手动备份接口，确认 `DiskA/.backups/db` 成功生成备份文件，格式为 `longhorn-YYYY-MM-DD-HH-mm-ss.db`。
    - ✅ 自动清理逻辑验证：手动将保留天数设为 0，确认旧文件被正确移除。

- **文件修改清单**:
    - `server/files/routes.js` (新增，文件管理模块)
    - `server/service/backup_service.js` (新增，备份核心逻辑)
    - `server/index.js` (精简，集成备份服务，添加数据库迁移)
    - `server/service/routes/settings.js` (更新，支持备份配置及触发)
    - `docs/` 系列文档 (同步更新)

---

## 会话: 2026-02-07 (Knowledge Base DOCX Import)

### 任务: 知识库DOCX→MD导入功能完整实现
- **状态**: ✅ 已完成
- **背景**: 
    - 从PDF书签导入方案转向DOCX→MD首选路径
    - 实现MAVO Edge 6K操作手册完整导入（73章节、9表格、39图片）
    - 修复WIKI导航树的三个关键问题

- **变更内容**:
    - **Backend (DOCX→MD转换器)**:
        - **新增脚本**: `server/scripts/docx_to_markdown.py`
        - **功能**: 使用`python-docx`直接读取DOCX结构
        - **表格提取**: 完整保留表格结构，转换为Markdown格式
        - **图片优化**: 自动提取图片并转WebP（质量85，压缩80%+）
        - **章节识别**: 基于Heading样式识别章节层级（Heading 1/2/3 → # ## ###）
    
    - **Backend (MD导入器修复)**:
        - **文件**: `server/scripts/import_from_markdown.py`
        - **修复**: 摘要生成逻辑，正确移除图片Markdown语法
        - **修复前**: `re.sub(r'[#*\[\]!]', '', content)` → 遗留"Image(/path)"纯文本
        - **修复后**: `re.sub(r'!\[.*?\]\([^)]*\)', '', content)` → 完整移除图片语法
    
    - **Frontend (WIKI导航树修复)**:
        - **文件**: `client/src/components/KinefinityWiki.tsx`
        - **问题1 - 双重"操作手册"嵌套**:
            - 原因: `buildChapterTree`内部创建未分类节点 + 外层又创建父节点
            - 修复: 删除未分类节点逻辑（第136-143行），只返回纯章节节点
        - **问题2 - 章节名称识别错误**:
            - 原因: 正则`/:\s*(\d+)(?:\.(\d+))?\s+(.+)/`无法匹配"1."格式
            - 修复: 改用`/:\s*(\d+)(?:\.(\d+))?(?:\.\d+)*[.\s]+(.+)/`支持点号或空格
            - 验证:
                - "MAVO Edge 6K: 1. 基本说明" → chapter=1, section=null, cleanTitle="基本说明" ✅
                - "MAVO Edge 6K: 1.1 端口说明" → chapter=1, section=1, cleanTitle="端口说明" ✅
        - **问题3 - 图片无法显示**:
            - 原因1: 图片文件未同步到远程服务器
            - 原因2: 错误使用直接IP访问`http://47.116.145.147:3000`而非Cloudflare地址
            - 修复: 
                - 同步图片: `rsync img_*.webp mini:/path/to/knowledge_images/`（39张，2.1MB）
                - 使用正确地址: `https://opware.kineraw.com`
    
    - **运维规范修正**:
        - **错误操作**: 使用`killall node`导致PM2 daemon被杀掉
        - **正确方式**: `ssh -t mini "/bin/zsh -l -c 'pm2 restart longhorn'"`
        - **正确地址**: Cloudflare Tunnel (`https://opware.kineraw.com`) 而非直接IP

- **最终效果**:
    - ✅ 73个章节（100%准确率）
    - ✅ 9个表格完整提取
    - ✅ 39张图片（WebP优化，9.9MB→2.1MB）
    - ✅ 四级树状结构正确：
        ```
        📱 MAVO Edge 6K
          └─ 📖 操作手册
              ├─ 📗 第1章：基本说明 (4)
              ├─ 📗 第2章：快速指南 (14)
              └─ 📗 第3章：高级操作和设置 (57)
        ```

- **技术架构决策**:
    > **决策**: DOCX→MD为知识库导入首选路径
    > - **原因**: 章节准确率100%，表格质量95%+，图片位置精确
    > - **实现**: `python-docx` + `mammoth` + WebP优化 + Markdown渲染
    > - **对比**: 
    >   - PDF书签方案: 章节100%（依赖书签），表格80-90%（pdfplumber识别），图片85%（按页码匹配）
    >   - DOCX方案: 章节100%（原生支持），表格95%（完整结构），图片80%（浮动位置）

- **验证**:
    - ✅ DOCX转MD成功（73个章节，完整表格和图片）
    - ✅ 数据库导入成功（73条Manual记录）
    - ✅ 图片同步到远程服务器（39张WebP）
    - ✅ WIKI导航树显示正确（无双重嵌套）
    - ✅ 章节标题正确识别（"第1章：基本说明"而非"端口说明"）
    - ✅ 图片正常显示（HTTP 200）
    - ✅ 前端编译零错误（TypeScript验证通过）
    - ✅ 服务重启成功（PM2 online）

- **文件修改清单**:
    - `server/scripts/docx_to_markdown.py` (新增)
    - `server/scripts/import_from_markdown.py` (修复摘要生成)
    - `client/src/components/KinefinityWiki.tsx` (修复三个问题)
    - `server/data/knowledge_images/` (39张WebP图片)
    - `server/longhorn.db` (73条Manual记录)
    - `docs/4_DevLog.md` (本记录)

---

## 会话: 2026-02-03 (Creation 2.0 & Media Attachments)

### 任务: Robust Creation Flow & Attachment Display
- **状态**: ✅ 已完成
- **变更内容**:
    - **Frontend (Creation 2.0)**:
        - **Unified Modal**: 实现 `TicketCreationModal`，使用 Zustand 管理显隐及类型切换。
        - **Draft Persistence**: 通过 `zustand/middleware` 的 `persist` 将草稿自动存入 LocalStorage。
        - **Media Upload**: 集成 `react-dropzone`，实现多文件拖拽上传、预览及删除。
    - **Frontend (Detail Pages)**:
        - 在三种工单详情页添加了 "Attachments" 列表，支持图片预览、视频播放/下载及 PDF 图标区分。
    - **Backend**:
        - **Schema**: 引入 `service_attachments` 表，关联文件路径、MIME 类型与工单 ID。
        - **Upload Logic**: `multer` 配置支持 `public/uploads/service` 存储，实现 `multipart/form-data` 解析。
- **验证**:
    - ✅ 刷新页面后草稿可正常恢复。
    - ✅ 详情页实时显示上传成功的附件。
    - ✅ 修复了所有详情页的 `ImageIcon` 未使用 lint 警告。

---

## 会话: 2026-02-02 (Service Module Foundation)

### 任务: Service Data / Creation Fix / App Rail Navigation
- **状态**: ✅ 已完成
- **变更内容**:
    - **Git Fix**:
        - 解决 `UserInterfaceState.xcuserstate` 导致的 git pull 冲突。
        - 策略: `git restore --staged` -> `git rm --cached` -> 更新 `.gitignore`。
    - **App Rail Navigation**:
        - **Refactor**: 实现了垂直侧边导航栏 (`AppRail.tsx`)，取代原有的顶部 Tab 导航 (`TopModuleNav.tsx`)。
        - **Architecture**: 分离 "Service" 和 "Files" 为两个独立的业务域上下文。
        - **Context Aware**: TopBar 现在根据当前模块动态渲染内容 (Files 模式显示统计/每日一词，Service 模式隐藏)。
    - **Service Data Seeding**:
        - **Script**: 创建 `server/seeds/02_service_data.js`。
        - **Logic**: 强制重置 `_migrations` 表 (`DROP TABLE`) 以确保 Schema 完整性，随后插入 5 条 Service Record 和 5 条 Issue 测试数据。
    - **Creation Fixes**:
        - **IssueCreatePage**: 修复 API 端点 (`/api/issues` -> `/api/v1/issues`)。
        - **ServiceRecordCreatePage**: 新增 `problem_category` 字段，确保数据完整性。
        - **Localization**: 更新 `translations.ts`，补充了大量 Service 相关的缺失翻译 Key。

- **验证**:
    - ✅ 导航切换流畅且上下文正确。
    - ✅ 数据库成功填充 10 条测试数据。
    - ✅ 手动创建工单和服务记录流程验证通过。

### 技术架构总结 (Foundation Architecture)
> **决策**: 采用 **Context-Driven Navigation**。
> - **原因**: "Service" 和 "Files" 是两个完全不同的业务域，共享同一个 Sidebar 会导致混乱。
> - **实现**: `AppRail` 作为顶级导航，切换 `activeModule` ('files' | 'service')。
> - **影响**: 下游组件 (Sidebar, TopBar) 均只需监听 `activeModule` 即可自动适配，无需复杂的条件判断。

### 会话: 2026-02-02 (Service Schema Fix)

### 任务: Fix Creation Logic & Schema Alignment
- **状态**: ✅ 已完成
- **问题**:
    - "Internal Server Error" when creating issues.
    - `issues` table has `description` column, but frontend/backend code was using `problem_description`.
    - Seed data missing `issue_source` (NOT NULL constraint).
- **变更内容**:
    - **BackEnd**: Patched `server/service/routes/issues.js` to map `problem_description` payload to `description` column.
    - **FrontEnd**: Updated `IssueCreatePage.tsx` payload.
    - **Seeding**: Rewrote `02_service_data.js` with realistic PRD cases and correct schema fields.
- **验证**:
### 会话: 2026-02-03 (Bugfix & UI Polish)

### 任务: Debug Empty Ticket List & Logo Update
- **状态**: ✅ 已完成
- **问题**:
    - **Empty List**: Inquiry/RMA lists returned 0 items (initially 404, then 500 potential).
    - **Logo**: User requested "Kine Yellow" Horseshoe logo instead of 'L'.
- **变更内容**:
    - **Backend**:
        - `server/index.js`: Explicitly registered `/api/v1/inquiry-tickets` etc.
        - `inquiry-tickets.js`: 
            - Fixed `ReferenceError` (missing `created_from` declaration).
            - Fixed SQL Column Mismatches: `h.name` -> `h.username`, `p.name` -> `p.model_name`.
            - Added debug checkpoints.
    - **Frontend**:
        - `AppRail.tsx`: Implemented CSS Mask for SVG-like coloring of PNG logo (`mask: url(/kine_logo.png)`).
- **验证**:
    - Backend logs confirmed execution flow passed all checkpoints.
    - Logo renders in correct theme color.

---


## 会话: 2026-01-28 PM (Daily Word Data Quality Fix)

### 任务: 每日一词数据质量修复与跨端功能恢复
- **状态**: ✅ 已完成
- **问题描述**:
    - Web端每日一词功能失效，显示"No words loaded. Try refreshing."
    - iOS端显示错误的meaning格式："An intermediate concept: Labour"、"A common elementary word: Line"
    - 数据库中存在大量错误格式的词汇数据

- **根本原因分析**:
    - 早期的词汇生成脚本（`mass_vocab_injector.py`）使用了错误的模板
    - meaning字段被填充为模板化的完整句子（如"A common elementary word: X"），而不是简洁的释义
    - 这些错误数据污染了词汇库，导致用户体验异常

- **解决方案**:
    1. **数据库清理**:
        - 编写SQL查询识别所有错误格式的数据：
          ```sql
          SELECT word, meaning FROM vocabulary 
          WHERE meaning LIKE 'An %concept:%' 
             OR meaning LIKE 'A %concept:%' 
             OR meaning LIKE 'A common%';
          ```
        - 执行批量删除操作：
          ```sql
          DELETE FROM vocabulary 
          WHERE meaning LIKE 'An %concept:%' 
             OR meaning LIKE 'A %concept:%' 
             OR meaning LIKE 'A %word:%' 
             OR meaning LIKE 'A common%';
          ```
        - 删除统计：113条错误数据（1条"A common"格式 + 112条"concept"格式）
        - 清理后数据统计：
          - 德语（de）：215条
          - 英语（en）：232条
          - 日语（ja）：204条
          - 中文（zh）：236条
          - **总计：887条正确格式的词汇**

    2. **服务器重启**:
        - 使用SSH连接到生产服务器
        - 执行 `pm2 restart longhorn` 重启所有worker进程
        - 确认8个cluster worker全部成功重启（restart次数递增）

    3. **API验证**:
        - 测试批量词汇API：`/api/vocabulary/batch?language=en&level=Intermediate&count=3`
        - 验证返回数据格式正确：
          - "Hollow" → meaning: "Empty inside" ✅
          - "Decision" → meaning: "A choice that you make about something" ✅
          - "Experience" → meaning: "Knowledge or skill from doing something" ✅
          - "Process" → meaning: "A series of actions that you take in order to achieve a result" ✅

    4. **iOS模拟器管理**:
        - 原有模拟器设备（31786A39）消失，重新查找可用设备
        - 识别到运行中的iPhone Air模拟器（76F0A6D9-655C-445D-9472-3A752B03367B）
        - 在该模拟器上重新安装Longhorn应用
        - 启动应用（PID: 85715）
        - 打开模拟器窗口供用户测试

    5. **Web端部署**:
        - 使用标准部署脚本：`./scripts/deploy.sh`
        - 同步服务器和客户端代码到远程服务器
        - 在远程服务器上执行前端构建：
          - 构建版本：11.3.0 (commit: 1e4bd5d)
          - 构建时间：约2.63秒
          - 输出大小：主bundle 1469.66 kB (gzipped: 442.22 kB)
        - PM2重载服务进程（零停机部署）

- **技术细节**:
    - **数据格式规范**：
      - ❌ 错误："An intermediate concept: Labour"
      - ✅ 正确："Work, especially physical work"
      - meaning字段应该是简洁的释义或定义，不应包含元信息（如词汇级别、类别等）
    
    - **防止复发机制**：
      - 服务器的自动播种功能已在之前的会话中禁用（注释掉`server/index.js`中的seeding逻辑）
      - 防止错误的种子数据在服务器重启时被重新导入
      - 未来需要更新词汇数据时，必须先验证种子文件的数据质量

    - **模拟器设备管理问题**：
      - Xcode模拟器设备可能因系统清理或其他操作而消失
      - 应该使用 `xcrun simctl list devices available` 动态查找可用设备
      - 不应硬编码特定的设备UUID

- **验证与测试**:
    - ✅ 数据库清理完成，错误数据全部删除
    - ✅ API返回正确格式的词汇数据
    - ✅ 服务器成功重启，8个worker进程正常运行
    - ✅ iOS模拟器成功启动并运行应用
    - ✅ Web端成功部署到生产环境
    - ⏳ 待用户测试：iOS端点击"New Batch"刷新词汇，Web端硬刷新页面

- **用户操作建议**:
    1. **iOS端**：打开每日一词功能，点击更多菜单中的"New Batch"按钮，强制刷新词汇批次
    2. **Web端**：在浏览器中访问 https://opware.kineraw.com，使用 Cmd+Shift+R 硬刷新页面清除缓存
    3. 验证meaning字段显示正确的简洁释义，而非"An X concept: Y"格式

- **文件修改清单**:
    - `server/longhorn.db` (远程数据库，删除113条记录)
    - `docs/2_PromptLog.md` (新增会话记录)
    - `docs/4_DevLog.md` (新增技术产出记录)

---

## 会话: 2026-01-28 (Daily Word UX Refinement)

### 任务: 每日一词 UI 改进 - 更多菜单整合
- **状态**: ✅ 已完成
- **变更内容**:
    - **iOS 端** (`ios/LonghornApp/Views/Components/DailyWordBadge.swift`):
        - 移除了 `trailingToolbar` 中的独立关闭按钮（`xmark.circle.fill`）。
        - 重构更多菜单结构，将所有次要操作整合至 `Menu` 组件：
          - **New Batch (Refresh)**: 刷新词库，带触感反馈。
          - **Level 选择**: 如有多个等级时显示，checkmark 标记当前选中项。
          - **Close**: 使用 `Button(role: .destructive)` 实现红色警告样式。
        - 简化布局：仅保留一个 `ellipsis.circle` 更多菜单按钮。
        
    - **Web 端** (`client/src/components/DailyWord.tsx`):
        - 新增 `MoreVertical` 图标按钮，创建下拉菜单组件。
        - 菜单包含三个部分：
          - **Level 选择**: 如有多个等级时显示，选中项显示黄色背景和 checkmark。
          - **New Batch**: 蓝色主题色按钮，带 `RefreshCw` 图标。
          - **Close**: 红色警告样式（`#ff453a`），带 `X` 图标。
        - 移除底部控制栏中的 `Level Selector` 和 `New Batch` 按钮。
        - 底部仅保留 **Prev** 和 **Next** 两个导航按钮。
        - 实现菜单外部点击自动关闭：
          - 使用 `useRef` + `useEffect` 监听 `mousedown` 事件。
          - 点击菜单外部时 `setShowMoreMenu(false)`。
        - 优化交互动画：
          - 悬停时背景变深。
          - Level 选中项高亮显示。
          
    - **部署**:
        - Git commit: `5191625` - "feat(daily-word): 改进每日一词 UI 交互体验"。
        - 生产服务器 `git fetch` + `merge` 成功。
        - PM2 重启：8 个 cluster worker 全部 online。
        
    - **测试**:
        - iOS 模拟器：iPhone 17 Pro (iOS 26.1) 编译并启动成功（PID: 99729）。
        - Web 端：部署至生产环境 `https://opware.kineraw.com`。

- **技术决策**:
    - **iOS**: 使用 SwiftUI 原生 `Menu` 组件，避免自定义下拉菜单的复杂度。
    - **Web**: 使用 `position: absolute` 实现下拉菜单，保持与 iOS 的视觉一致性。
    - **状态管理**: Web 端使用 `useState` + `useRef` 管理菜单显示状态和关闭逻辑。
    - **一致性**: 两端采用相同的交互模式，提升用户体验的连贯性。

- **文件修改清单**:
    - `ios/LonghornApp/Views/Components/DailyWordBadge.swift` (38行新增, 42行删除)
    - `client/src/components/DailyWord.tsx` (213行新增, 104行删除)

- **验证**:
    - ✅ iOS 模拟器编译通过，无错误。
    - ✅ 生产服务器部署成功，服务正常运行。
    - ✅ Git 提交并推送至 GitHub。
    - ✅ 文档已更新（Backlog, PromptLog, PRD, DevLog）。

---

## 会话: 2026-01-28 (Daily Word UX Refinement)

### 任务: 每日一词 UI 改进 - 更多菜单整合
- **状态**: ✅ 已完成
- **变更内容**:
    - **iOS 端** (`ios/LonghornApp/Views/Components/DailyWordBadge.swift`):
        - 移除了 `trailingToolbar` 中的独立关闭按钮（`xmark.circle.fill`）。
        - 重构更多菜单结构，将所有次要操作整合至 `Menu` 组件：
          - **New Batch (Refresh)**: 刷新词库，带触感反馈。
          - **Level 选择**: 如有多个等级时显示，checkmark 标记当前选中项。
          - **Close**: 使用 `Button(role: .destructive)` 实现红色警告样式。
        - 简化布局：仅保留一个 `ellipsis.circle` 更多菜单按钮。
        
    - **Web 端** (`client/src/components/DailyWord.tsx`):
        - 新增 `MoreVertical` 图标按钮，创建下拉菜单组件。
        - 菜单包含三个部分：
          - **Level 选择**: 如有多个等级时显示，选中项显示黄色背景和 checkmark。
          - **New Batch**: 蓝色主题色按钮，带 `RefreshCw` 图标。
          - **Close**: 红色警告样式（`#ff453a`），带 `X` 图标。
        - 移除底部控制栏中的 `Level Selector` 和 `New Batch` 按钮。
        - 底部仅保留 **Prev** 和 **Next** 两个导航按钮。
        - 实现菜单外部点击自动关闭：
          - 使用 `useRef` + `useEffect` 监听 `mousedown` 事件。
          - 点击菜单外部时 `setShowMoreMenu(false)`。
        - 优化交互动画：
          - 悬停时背景变深。
          - Level 选中项高亮显示。
          
    - **部署**:
        - Git commit: `5191625` - "feat(daily-word): 改进每日一词 UI 交互体验"。
        - 生产服务器 `git fetch` + `merge` 成功。
        - PM2 重启：8 个 cluster worker 全部 online。
        
    - **测试**:
        - iOS 模拟器：iPhone 17 Pro (iOS 26.1) 编译并启动成功（PID: 99729）。
        - Web 端：部署至生产环境 `https://opware.kineraw.com`。

- **技术决策**:
    - **iOS**: 使用 SwiftUI 原生 `Menu` 组件，避免自定义下拉菜单的复杂度。
    - **Web**: 使用 `position: absolute` 实现下拉菜单，保持与 iOS 的视觉一致性。
    - **状态管理**: Web 端使用 `useState` + `useRef` 管理菜单显示状态和关闭逻辑。
    - **一致性**: 两端采用相同的交互模式，提升用户体验的连贯性。

- **文件修改清单**:
    - `ios/LonghornApp/Views/Components/DailyWordBadge.swift` (38行新增, 42行删除)
    - `client/src/components/DailyWord.tsx` (213行新增, 104行删除)

- **验证**:
    - ✅ iOS 模拟器编译通过，无错误。
    - ✅ 生产服务器部署成功，服务正常运行。
    - ✅ Git 提交并推送至 GitHub。
    - ✅ 文档已更新（Backlog, PromptLog, PRD, DevLog）。

---

## 会话: 2026-01-28 (Data Quality Restoration)

### 任务: Data Quality & Silent Refresh (Final Fix)
- **状态**: ✅ 已完成
- **问题诊断**:
    - 用户反馈 "Basic German word: Wasser" 等占位符定义，且缺少图片。
    - 数据库分析发现约 3800 条残留的垃圾数据 (Garbage Data) 及 2000+ 条带后缀的重复数据 (e.g. `Wasser (1)`).
    - 前端 Web 每日一词在切换语言时出现不必要的 Loading 闪烁。
- **变更内容**:
    - **Data Cleanup (Fix V5)**:
        - 编写 `fix_vocab_v5.py`，采用激进的 Regex 策略 (`r'Vocabulary:|Word:|德语基础'`)。
        - **清理结果**: 删除了 3800+ 条无效数据，保留 4346 条高质量数据 (含 Emoji)。
        - **Reseed**: 执行服务器端 `reseed_vocab.js`，彻底重置数据库。
    - **Web Ops**:
        - **Silent Refresh**: 重构 `useDailyWordStore.ts`，引入 `cache` 机制。切换语言时优先展示缓存内容，静默更新，消除 Loading 态。
        - **Bug Fix**: 修复 `DailyWord.tsx` 中 "Retry" 按钮的 TypeScript 类型错误。
        - **Safety**: 前端增加 Regex Mask `word.replace(/\s*\(\d+\)$/, '')` 作为最后一道防线。
- **验证**:
    - "Tasche" (包) 从 20+ 条垃圾重复项缩减为 1 条正确项。
    - 界面切换流畅，无闪烁。

    - **UI Polish**:
        - **Web**: 重构 Daily Word 弹窗布局为 **Flex Column + Sticky Footer**。
        - **Detail**: 将内容区域设为 `flex: 1, overflow-y: auto`，底部操作栏设为 `flex-shrink: 0`。彻底解决了小屏设备上底部按钮被内容挤出屏幕或被遮挡的问题。
        - **Web**: 在更多菜单中增加 "Reset Cache" 按钮。
    - **iOS Enhancements**:
        - **Settings**: 增加 "Clear Vocabulary Cache" 功能，调用 `DailyWordService.clearCache`。
        - **Service**: 实现了 `clearCache` 方法，清除所有 `UserDefaults` key 并重置状态为 English/Advanced。
        - **Refactor**: 重构 `DailyWordService` 网络层，使用统一的 `APIClient` 替代原生 `URLSession`。此举解决了 `nw_connection` 日志噪音问题，并统一了超时配置和错误处理。

    - **Bug Fixes (Upload/List)**:
        - **FileItem Model**: 修复了 `uploader` 字段解析错误的问题 (Key `uploader` mismatch with `uploader_name`)，现在能正确解析上传者信息。
        - **UploadService**: 将分片上传逻辑迁移至 `APIClient`，解决了因混合使用 `URLSession.shared` 导致的网络不稳定和连接警告问题。

---

## 会话: 2026-01-27 (Data Quality Issue)

### 任务: Data Quality & First Run Optimization
- **状态**: ✅ 已完成
- **变更内容**:
    - **Ops**: 创建了 `docs/COLLABORATION.md`，规范多人协作与发版流程。
    - **Data Quality**:
        - 重构 `mass_vocab_injector.py`，引入随机模板系统 (Template System)，解决了例句千篇一律 ("We need to consider...") 的问题。
        - 重新生成了 `vocabulary_seed.json`，包含更自然的句式。
        - 远程清理了生产环境数据库中的旧例句 (Clean Up)。
    - **Zero Latency (First Run)**:
        - 将 iOS 调试环境默认 API 地址修改为 `localhost:3001` (Dev)，确保开发者在本地运行时能立即获取最新生成的词库，而无需等待线上部署。
        - (注: 生产环境配置已回滚至 `kineraw.com`)。
    - **Fixes**:
        - 修复了 iOS Bundle ID 冲突 (`com.kinefinity.longhorn` -> `.jihua`)。
- **验证**:
    - 本地服务器重启后自动吸入新 Seed。
    - iOS 模拟器下拉刷新即显示多变例句。

---

## 会话: 2026-01-24

### 任务: Daily Word 性能与体验优化 (Batch Fetch & UI Polish)
- **状态**: ✅ 已完成
- **变更内容**:
    - **性能优化 (Batch Fetching)**:
        - **服务端**: 新增 `/api/vocabulary/batch` 接口，支持一次性拉取 10-50 个随机词汇。
        - **iOS端**: 重构 `DailyWordService.swift`，弃用循环请求，改为调用批量 API，通过单次网络交互完成更新（100个词仅需~1秒）。
    - **体验优化 (感知与降噪)**:
        - **移除干扰**: 去掉了底部遮挡内容的 Overlay 进度条。
        - **轻量反馈**: 仅保留导航栏右上角的加载动画 (Spinner) 和数字跳动，实现“更新于无形”。
    - **文档整合**:
        - 将 Walkthrough 内容整合进 DevLog，确保文档来源唯一且语言统一。
    - **自动化流程**:
        - **建立框架**: 创建了 `.agent/workflows/pmlog.md` 工作流，标准化文档更新程序，确保每次会话后自动同步 `task.md` 至 `DevLog`。
    - **Bug修复**:
        - **数据健壮性**: 修复了 `WordEntry` JSON 解码逻辑，针对数据库中可能存在的 NULL 字段 (`meaning`, `meaning_zh`) 增加了安全处理，防止批量更新失败。
    - **紧急修复 (Hotfix 2026-01-24 Night)**:
        - **服务端 502/404 修复**:
            - 修复了 `server/index.js` 合并代码时引入的 `SyntaxError` (缺少闭合括号)。
            - 修正了 Batch API 的 SQL 查询 (`SELECT *` instead of `data`)。
            - **解决了路由遮蔽 (Route Shadowing)**: 发现并清理了占用 4000 端口的**僵尸进程** (Zombie Process PID 57006)，并将 Batch API 路由移至代码顶层，确保优先级。
            - 验证: 本地 Curl 测试通过，Git Push 触发远程自动部署成功。
    - **Language Cache Fix**:
        - 修复了 `DailyWordService` 切换语言时未清除旧缓存的 Bug，解决“选德语却显示英语”的问题。
    - **UI Layout Fix**:
        - 修复了 Daily Word Sheet 头部 "Library Count" 和 "Close Button" 在 Pill 样式下内容溢出 (Overflow) 的问题，增加了 `.fixedSize()` 约束。
    - **Web Auto-Refresh Fix**:
        - 优化了网页版自动刷新逻辑 (Smart Polling)。
        - 策略: 保持 5秒 轮询，但增加 `compare` 深度对比。
        - 效果: 只有当通过 API 拉取到的文件列表发生了实际变化时，才会触发 React 重新渲染，彻底消除了无意义的闪烁 (Flickering)。
    - **Web Daily Word Enhancements**:
        - **Revert**: 恢复 iOS Bundle ID 为 `com.kinefinity.longhorn`。
        - **State Decoupling**: 将“每日一词”的学习目标语言 (`targetLang`) 与 APP 界面语言 (`appLanguage`) 解耦，支持独立选择。
        - **UI Enhancement**: 在每日一词弹窗中增加语言切换器 (EN/DE/JA/ZH)。
        - **Logic Update**: "Next Word" 按钮现在会根据当前选择的目标语言获取新词。
    - **Header UI Polish**:
        - **Fix**: 移除了 Daily Word Sheet 右上角关闭按钮的额外背景 (`xmark.circle.fill` -> `xmark`)，解决了 "Pill inside a Pill" 的视觉干扰，使统计数据与关闭按钮在同一个胶囊容器内更加协调。
    - **Example Audio**:
        - **Feature**: 为 iOS 每日一词的例句增加朗读功能。
        - **Impl**: `DailyWordService` 新增 `speak(text: String)` 方法；UI 在例句旁增加扬声器图标按钮。
        - **Impl**: `DailyWordService` 新增 `speak(text: String)` 方法；UI 在例句旁增加扬声器图标按钮。
        - **Refine**: 限制例句显示数量为 2 条；调大例句朗读图标 (16pt -> 22pt) 并加深颜色。
    - **Web Fixes**:
        - **Visibility**: 修复了网页版每日一词在数据加载失败或为空时直接消失的问题 (移除了 `return null`)，现在会显示占位符或错误提示。
        - **Limit**: 限制网页版例句显示数量为 2 条。
        - **UI Parity**: 网页版语言选择器样式升级为 iOS 风格的分段控制器 (Segmented Control)，支持高亮选中状态。
    - **Verification**:
        - **Strict Limit**: 再次确认 iOS (`.prefix(2)`) 和 Web (`.slice(0, 2)`) 均已实施严格例句数量限制。
    - **Server Strategy**:
        - **Smart Seeding**: 修改服务器启动逻辑，从单纯的 "Empty Check" 改为 "Sync Check"。
        - **Mechanism**: 每次启动时读取 `seeds/vocabulary_seed.json`，检查数据库中不存在的新词并自动插入。
        - **Benefit**: 想要更新线上词库，只需在本地更新 seed JSON 并部署，服务器重启时会自动吸入新词，无需手动操作 SQL。

## 会话: 2026-01-23

### 任务: 实现 iOS 相册式交互 (Implementing iOS Photos-like Interactions)
- **JIRA/Issue**: N/A
- **状态**: ✅ 已完成
- **预估耗时 (Effort)**: ~25 轮对话
- **变更内容**:
    - **Settings Refactor**:
        - 重构 `SettingsView` 采用分组 `Section` 布局，提升可读性。
        - 实现了 `Reset Preferences` 功能，使用 `.confirmationDialog` 替代 `.alert` 以符合 iOS 规范。
        - 统一了 Toast 提示风格，重置成功显示 `.prominent` 样式。
    - **Daily Word Prep**:
        - **Data Source**: Permanently stores fetched words in `UserDefaults` (`longhorn_daily_word_library_en`).
        - **Smart Refresh**: On launch, checks if library < 100 words; triggers silent batch update (+10-50 words).
## 会话: 2026-01-27
### 任务: Client Update: iOS Daily Word Sync
- **Feature**: Synchronized iOS Daily Word with Web "Batch Mode" (100 words).
- **Logic**: Updated `DailyWordService.swift` to fetch/store batches of 100 random words.
- **Migration**: Implemented automatic migration from legacy "cumulative" cache to new "batch" cache for seamless user transition.
- **UI**: Updated `DailyWordBadge` to show `Index/100` progress. Added "New Batch" refresh button.
- **Localization**: Added Chinese translations for new UI elements.
## Client Update: Daily Word Refinement (Phase 2)
- **UI Optimization**: Replaced cluttered bottom controls with a top-bar **Options Menu**.
- **Layout**: Forced examples to show maximum 2 items to prevent scrolling fatigue.
- **Content**: Expanded `vocabulary_seed.json` with:
    - **English**: Added `Elementary`, `Intermediate` levels.
    - **Chinese**: Added `Classical` (文言文), `Poetry` (诗词) categories.
- **Localization**: Updated `Localizable.xcstrings` throughout.
- **Data**: Verified seed data injection logic. Use server restart to apply.
## Client Update: Daily Word Refinement (Phase 3)
- **Auto-Fill Logic**: `DailyWordService.swift` now automatically detects if a batch is deficient (<100 words) and silently fetches the exact difference from the server to ensure a full batch.
    - Resolves "Migration Gap" (e.g., 54/100 -> Auto -> 100/100).
- **UI Logic**: Moved "Index/Total" counter from the main toolbar into the "Options Menu" (Title) to reduce visual clutter.
- **Content**:
    - **English**: Added `Common Phrases` category.
    - **Localization**: Added translation for "Common Phrases" and "Progress".
- **Models**: Updated `DailyWordLanguage` enum to expose new levels for English and Chinese.

## Client Update: Daily Word Refinement (Phase 4)
- **Content**: Expanded `vocabulary_seed.json` with ~200 new items (Elementary/Intermediate/Classical/Poetry) via `expand_vocab.py`.
- **UX**: Implemented `ToastManager` feedback for manual refresh actions (Start/Success/Fail).
- **Server**: Verified DB injection. Note: Server restart required to load new seeds.

## Client Update: Mass Expansion (Phase 5)
- **Data**: Injected ~1200+ new items via `mass_vocab_injector.py` to ensure "3 Full Refreshes" capacity.
    - **English**: Elementary (411), Intermediate (486), Common Phrases (739).
    - **Chinese**: Classical (606), Poetry (606).
- **Verification**: Ran `analyze_vocab.py` to confirm all target categories > 300.
- **Hotfix**: Fixed server-side seeding logic to correctly respect `level` differences.
- **Hotfix**: Resolved iOS compiler errors iteratively via CLI analysis:
    - **DailyWordBadge.swift**: Fixed extraneous braces, ToolbarContent types, and non-optional binding logic.
    - **FileDownloader.swift**: Addressed strict concurrency violations (removed `@MainActor` from class, used `nonisolated` delegates).
    - **DailyWordService.swift**: Removed redundant nil-coalescing (`?? 0`) on non-optional ID.

## Client Update: Data & Audio Fixes (Phase 7)
- **Audio Bug**: Fixed stale audio state by:
    1.  Adding `didSet` observer to `currentIndex` in `DailyWordService`.
    2.  Passing explicit text `service.speak(text: word.word)` in `DailyWordBadge`.
- **Mass Expansion (DE/JA)**:
    - Updated `mass_vocab_injector.py` to support German (A1-C1) and Japanese (N5-N2).
    - **Verified Counts**: All funded levels now > 300 words (previously < 50 for some).
    - German A1-C1: ~360-400 each.
    - Japanese N5-N2: ~360-400 each.

## Infinite Engine (Phase 8: Prep)
- **Hunger Index (Monitor)**: Implemented `/api/admin/vocab-health` endpoint.
    - **Logic**: Aggregates vocabulary by Language/Level.
    - **Thresholds**: Marks <100 as "Critical", <300 as "Low".
    - **Verified**: Detected "Critical" status for English Advanced & Chinese HSK series (correctly).
- **Forge Trigger (Action)**: Implemented `/api/admin/forge/trigger`.
    - Spawns `ai_forge.js` process to theoretically generate new words.
    - Currently runs in **Simulation Mode** (requires API Key for real generation).
- **Context UI & Schema**:
    - **Database**: Added `topic` column to `vocabulary` table (auto-migration).
    - **Client**: Updated `WordEntry` model and `DailyWordBadge` to display Topic Tags (e.g., "PHYSICS").
    - **Verified**: API returns `topic` field, client parses it.

## Client Update: UX Modernization (Phase 6)
- **Interaction**: Replaced "Prev/Next" buttons with **Swipe Gestures** (`TabView` with `.page` style).
- **Navigation**: Added "Swipe Up" (or tap handle) to view full **Batch List** (`DailyWordListView`).
- **Refactor**: Simplified `DailyWordSheet` layout, moving progress indicator to the bottom handle.
        - **Manual Trigger**: Tap book icon or pull-to-refresh to force fetch (+20 words).
        - **UI Upgrade**: Added Library Count, Toolbar Progress Ring, and Bottom Overlay Toast.
    - **Settings Refactor**:
        - Reorganized sections: General, Content, Connection, Maintenance, About.
        - **Dialog Standardization**: Replaced `.alert` with `.confirmationDialog` for "Reset Preferences".
        - **Toast Specs**: Defined `standard` (Glass) vs `prominent` (Solid Color + Haptic) styles。
    - 将 `FilePreviewSheet.swift` 重构为 分页器 (Pager) + 单项视图 (Item View)。
    - 更新了 `FileBrowserView`, `SharesListView`, `RecentFilesListView`, `StarredView`, `DashboardView` 的调用逻辑。
    - 修复了编译错误 (`onGoToLocation` 签名问题)。
    - 修复了手势冲突 (垂直拖拽 vs 水平滑动)。
- **关键决策**:
    - 使用带逻辑判断的 `DragGesture` 以忽略水平位移，而非使用 `UIGestureRecognizer`，以保持 SwiftUI 纯度。
    - 对于大图优先加载缩略图以提升性能。

### 任务: 修复系统与网络交互 (System Dashboard & Web Uploader Fixes)
- **状态**: ✅ 已完成
- **变更内容**:
    - **后端**: 修复 `Server` SQL 查询逻辑，实现 "Omni-Matcher" 别名匹配（兼容 `MS` 和 `市场部 (MS)` 路径），彻底解决 Web 端 Uploader Unknown 问题。
    - **后端**: 修复 `SystemStats` 接口 JSON 字段映射问题 (`snake_case` vs `camelCase`)，解决 Dashboard 白屏。
    - **iOS**: 增强 `FilePreviewSheet`，实现文件夹内容数量异步加载 (`childCount`) 和滑动边界 Toast 提示（修复了 Toast 滞留 Bug 并优化了样式）。
    - **Daily Word 2.0**:
        - **Server**: 新增 `vocabulary` SQLite 表，迁移硬编码词汇至数据库。
        - **API**: 实现 `GET /api/vocabulary/random` 接口，支持按语言和难度筛选。
        - **Web**: 更新组件使用服务端 API，支持动态获取和刷新。
        - **iOS**: 更新 `DailyWordService` 使用 `URLSession` 调用 API，`WordEntry` 模型兼容 snake_case。
    - **iOS Daily Word UX 优化**:
        - 实现 Cache-First 策略：启动时立即显示缓存词汇。
        - API 后台更新，静默刷新 UI。
        - UserDefaults 持久化缓存。
    - **Dashboard Bug 修复**:
        - Server 端跳过无权限访问的系统文件夹（`.TemporaryItems` 等）。
        - 解决 Admin 仪表盘 500 错误。
    - **词汇库扩容**: 从 5 个示例词扩充至 100 个高质量词汇（覆盖所有语种和难度）。
    - **Preview Button 修复**: 修正闭包 nil 传递逻辑，FileBrowser 预览不再显示"所在位置"按钮。
    - **默认排序优化**: FileBrowser 默认按日期倒序（最新优先）。
    - **Dashboard 本地化**: 完成 Admin 和个人中心 Dashboard 的多语言支持。
    - **状态持久化**: 使用 `@AppStorage` 记住用户的排序方式和视图模式。
    - **Toast 系统升级**: 实现分级提示（Standard/Prominent），支持触感反馈。
    - **重置功能**: 设置页新增偏好重置，支持 Alert 二次确认和强反馈。
    - **全面多语言**: 扫除代码中残留的硬编码 Toast 字符串，实现全覆盖。
- **关键技术**:
    - SQLite `RANDOM()` 查询优化。
    - React Hooks (`fetchWord`) 异步状态管理。
    - iOS Toast 交互优化 (.onChange)。

---

## 会话: 2026-01-22

### 任务: 修复 Uploader Unknown 问题
- **预估耗时 (Effort)**: ~10 轮对话
- **变更内容**:
    - 排查后端 `index.js` 中 `api/thumbnail` 的逻辑。
    - 发现 `isLargeImage` 逻辑中针对 0 字节文件的判断缺陷。
    - 修复 "查看原图" 按钮的显示逻辑。
- [2026-02-03] Implemented 'Pulse View' for Inquiry Tickets: grouped by urgency (>3d, >24h, Active), optimized card layout for market efficiency.
- [2026-02-03] Phase 6 Completed: Added 'Scope Bar' (Time/Product Filters). Created 'products.js' API, updated backend query logic, and replaced frontend Tabs.
- [2026-02-03] Fixed Empty Ticket List: Adjusted date filter logic (YYYY-MM-DD) and fixed TypeScript syntax error in InquiryTicketListPage. Added 'product_id' column to DB.
- [2026-02-03] Fixed Date Formatting: Updated Backend to return ISO Date Strings for better compatibility with Frontend date parsing.
