# Backlog 更新记录

## 最近更新 (2026-02-15 02:57:03)
- 根据当前代码状态同步更新 backlog
- 检查待办事项完成状态
- 更新优先级排序

# Backlog 更新记录

## 最近更新 (2026-02-14 23:09:02)
- 根据当前代码状态同步更新 backlog
- 检查待办事项完成状态
- 更新优先级排序

# Backlog 更新记录

## 最近更新 (2026-02-14 23:08:56)
- 根据当前代码状态同步更新 backlog
- 检查待办事项完成状态
- 更新优先级排序

# Backlog 更新记录

## 最近更新 (2026-02-13 10:09:05)
- 根据当前代码状态同步更新 backlog
- 检查待办事项完成状态
- 更新优先级排序

# 产品待办事项 & 路线图

**概述**: 本文档跟踪 Kinefinity Longhorn 项目的高级功能、已知 Bug 和产品路线图。这是"计划"与"构建"的单一事实来源。

## 🚀 当前冲刺 (Service Module Phase 1)

> **目标**: 完成服务模块的核心闭环 (Service Record -> Issue -> Resolution) 及基础架构。

### [Feature] Service Module: 列表与详情 (List & Detail)
- **优先级**: 🔴 紧急 (P0)
- **描述**: 
  - **Service Record List**: 支持分页、筛选（状态、优先级）、搜索（客户名/SN）。
  - **Service Record Detail**: 实现类似聊天流的交互界面，显示完整的时间轴（创建、回复、状态变更）。
  - **Issue List**: 独立的工单列表（区分本地/返修），支持看板视图或列表视图。
- **状态**: ✅ 已完成 (v1.2)

### [Feature] Service Module: 客户上下文 (Customer Context)
- **优先级**: 🟠 高 (P1)
- **描述**: 
  - **Context Sidebar**: 实现 PRD 1.6.4 描述的上下文面板。
  - **双维度查询**: 支持按 "客户" (显示所有设备) 和 "SN" (显示设备历史) 切换。
  - **关联数据**: 在处理工单时自动显示该客户的历史服务记录。
- **状态**: 📋 待定 (Todo)

### [Feature] Service Module: 状态流转与权限 (Workflow & Roles)
- **优先级**: 🟠 高 (P1)
- **描述**: 
  - **状态机**: 实现 Service Record (处理中 -> 待反馈 -> 解决/关闭) 的状态流转控制。
  - **角色权限**: 区分 Dealer (仅见自己客户), Market (全局), Production (维修视角)。
- **状态**: 📋 待定 (Todo)

---

## 📋 待办事项 (Backlog)

### [Feature] Knowledge Base (Phase 2)
- **优先级**: 中
- **描述**: 
  - 从 Service Record 沉淀知识点。
  - 实现知识库的搜索与关联推荐。

### [Feature] 全局多语言完善 (Cleanup)
- **优先级**: 低
- **描述**: 
  - 个人中心 Dashboard 仍有英文（"Upload", "Storage", "Starred"）
  - 部分 Toast 消息可能仍是硬编码
- **状态**: ✅ 已完成 (v1.1)

---

## 🐛 问题追踪

### [UI] 部门浏览器空状态
- **状态**: Open (需持续监控)

---

## ✅ 已完成 (历史记录)

### [Arch] Files 模块重构与系统备份增强 (2026-02-10)
- **状态**: ✅ 已完成
- **内容**:
  - **模块重构**: 将 `server/index.js` 中的文件操作逻辑迁移至 `server/files/routes.js`，实现代码解耦。
  - **备份系统**: 实现支持数据库配置的自动备份服务 `BackupService`。
  - **热备份**: 采用 SQLite Online Backup 机制，支持在系统运行期间进行安全备份。
  - **策略管理**: 支持前端通过 API 调整备份频率和保留天数。
  - **手动触发**: 提供 `POST /api/admin/backup/now` 接口。

### [Feature] Service Module: Robust Creation & Smart List (2026-02-03)
- **状态**: ✅ 已完成
- **内容**:
  - **Smart List**: 实现了相对时间分组和视觉抽稀。
  - **Scope Control**: 实现了全局约束栏 (Scope Bar) 和产品/时间过滤。
  - **Robust Creation**: 
    - 统一创建弹窗 (Unified Modal)。
    - 草稿持久化 (Draft Persistence)。
    - 媒体上传与预览 (Media Uploads)。
  - **Attachments**: 详情页支持附件显示与下载。

### [Feature] Service Module Foundation (2026-02-02)
- **状态**: ✅ 已完成
- **内容**:
  - **App Rail**: 实现了侧边导航栏，分离 Service/Files 业务域。
  - **Seeding**: 完成 Service 模块的数据库种子填充 (10条测试数据)。
  - **Creation Fixes**: 修复工单创建 API (`/api/v1/issues`) 和服务记录表单 (`problem_category`)。
  - **Git**: 修复了 `UserInterfaceState.xcuserstate` 的追踪问题。

### [Hotfix] V13.4.2 生产环境修复 (2026-01-26)
- **状态**: ✅ 已完成
- **内容**:
  - **Server**: 修复 Zombie 进程并实现 Auto-Seeding (自动填充词库)。
  - **Client**: iOS 增加 API 错误防护，修复语言切换缓存 Bug。
  - **Ops**: 解决 404/500 及网络代理 (Fake IP) 问题。

- [x] **每日一词内容扩容**: 已达成单库 100+ (德/英/日/中, 总计 423)。
- [x] **每日一词 2.0**: Server API (`/api/vocabulary/random`) + Web/iOS 客户端迁移完成。
- [x] **每日一词 UX 优化**: iOS Cache-First 加载，启动即显示。
- [x] **Dashboard Permission Bug**: Server 跳过系统文件夹，修复 Admin 仪表盘 500 错误。
- [x] **文件预览按钮逻辑**: FileBrowser 预览隐藏"所在文件夹"，其他场景显示（已实现）。
- [x] **Admin Uploader Bug**: 后端路径别名匹配修复，解决 Web 端 Unknown 上传者问题。
- [x] **iOS 相册式交互**: 下拉关闭、左右滑动切换、滑动边界回弹 Toast。
- [x] **iOS 编译错误修复**: `RecentFilesListView.swift` 闭包签名修复。
- [x] **Web Uploader 修复**: 实现后端路径智能匹配。
- [x] **Dashboard 修复**: 修复 API 字段映射。
- [x] **iOS 交互增强**: 文件夹预览数量显示 + 滑动边界回弹提示。
- [x] **iOS App 重构**: 重构为 `FilePreviewSheet` (Pager) + `FilePreviewItemView` 结构。
- [x] **权限修复**: 修复了 Orange 用户在 "运营部" (OP) 的 403 错误。
- [x] **本地化**: 增加了 德语/日语 的基础支持。
- [x] **全局多语言完善**: Dashboard (Admin/Personal) 完成中文化，支持 key 缺失时的自动 fallback。
- [x] **Toast 系统升级**: 实现分级 (Weak/Strong) 提示系统，关键操作增加触感反馈。
- [x] **Phase 8: Infinite Engine (Infrastructure)**:
  - **Monitor**: 实现了 Hunger Index (`/api/admin/vocab-health`)。
  - **Trigger**: 实现了 Forge Trigger (`/api/admin/forge/trigger`)。
  - **Schema**: 数据库自动迁移，支持 `topic` 字段。
  - **Context UI**: iOS 端支持显示单词 Topic 标签 (e.g. "PHYSICS")。
  - **Display Fix**: 修复了 "(3)" 等后缀显示问题。
- [x] **Phase 9: AI Integration (Prep & Quality)**:
  - **Data Quality**: 优化例句生成逻辑，使用多变模板。
  - **Zero Latency**: 修复 App 初次启动无数据问题 (Default to Local API in Dev)。
  - **Ops**: 建立了 `COLLABORATION.md` 协作规范。

---

## 📝 产品笔记 & 决策

- **UI 风格**: Kinefinity 黄色 + 毛玻璃拟态 (Glassmorphism)。
- **平台**: iOS (SwiftUI) + Web (React) + Node.js (Express)。
- **部署**: Mac mini (M1) + PM2 + Cloudflare Tunnel。
