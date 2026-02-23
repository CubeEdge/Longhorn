# Backlog 更新记录

## 最近更新 (2026-02-23 10:45)
- **Admin 设置体验升级**: 将所有管理端原生 `alert` 替换为响应式 `toast` 通知（Kine Yellow 风格），提升了交互的流畅度与现代感。
- **每日一词可见性修复**: 取消了公共设置接口 `/public-settings` 的鉴权要求，彻底解决了前端顶栏因鉴权阻断导致无法根据后台配置动态显示“每日一词”徽章的问题。
- **Wiki 导入样式统一**: 细化了知识生成器中“Bokeh 优化”按钮的选中态，从蓝紫色渐变回归至 Kine Yellow 主题色边框与光效，确保全站视觉语言高度对齐。

## 最近更新 (2026-02-23 03:15)
- **搜索 Tab 视觉分离**: 利用 `flex: 1` 占位符将搜索历史 Tab 强制推至 Tab 栏的最右侧，物理隔绝产品分类 Tab，有效减少视觉干扰与误操作。
- **Admin 设置状态持久化**: 实现了 Admin 面板的二级路由记忆功能。现在离开设置页面再从侧边栏切回时，会自动恢复至离开时的子 Tab（如：再次点击直接回到“人工智能”设置而非重置到通用）。
- **全量设置存入 DB**: 彻底迁移了「显示每日一词徽章」等原本仅存储于浏览器 `localStorage` 的界面开关至服务器 `system_settings` 数据库。完成了对应的 SQL 自动迁移脚本，确保配置在跨设备、跨浏览器、服务器重启后依然保持一致。

## 会话详情: 2026-02-23 03:15 (耗时: 15m)

**User Prompt**:
搜索tab移动到最右侧；系统设置需要记忆离开时的tab；所有设置项需要被记住（持久化到服务器）。

**Agent Response**:
1. **系统配置集成**: 给 `system_settings` 添加了 `ai_search_history_limit`，并在后端暴露 `/api/v1/system/public-settings` 给客户端动态查阅。Admin 面板增加 Web 端的阈值输入框。
2. **逻辑异常修复**: 补充了 API try/catch 层的容错返回，避免查询失败时覆盖历史快照的结果缓存。
3. **高频防抖渲染**: 将删除后若自身为已激活查询的回切任务委托给 `setTimeout` 或外部 useEffect 以避免 React 18 更新断层。
4. **前端UI减法设计**: 用 RegEx 去掉了所有产品的强制前缀。

**Result**: 
Wiki 完成了最后一块关键体验拼图，界面极为克制同时状态记忆深度覆盖了所有 AI 流程。

---

## 2026-02-23 01:50 (耗时: 120m)## 最近更新 (2026-02-22 14:40)
- **知识库UI对齐完善**: 删除了 `parseChapterNumber` 带来的 `1.1.1` 冗余前缀章节号渲染 Bug，重构了 Manual TOC Modal 中的折叠渲染过滤逻辑，移除了分类底色的绿色高亮，实现了苹果风格的安全暗流感设计。重新打补丁并发布了 v12.**版本**: 0.13.2
**状态**: 待确认
**最后更新**: 2026-02-23 (Deployed v12.1.8)
- **知识库导入与本地服务修复**: 解决了因硬编码 `/Volumes/fileserver` 导致的 Node 崩溃，并清理了 Wiki 层级子目录的渲染 UI。
- **URL 导入权限修复**: 取消了仅对 `Internal` 用户的强制授权，允许 `Employee` 执行，根治 `admin` 抓取 URL 生成图文时的 403 错误。

## 最近更新 (2026-02-21 21:35)
- **搜索质量提升**: 实现多关键词 AND 拆分搜索，搜索"音频的相关设置"从 0 篇召回提升至 4 篇
- **RMA 特征色修复**: AI 搜索结果中 RMA 工单小卡片现已正确显示琥珀色

## 最近更新 (2026-02-21 21:05)
- **全局 Schema 对齐**: 完成全栈 `customer_id` -> `account_id` 迁移，统一数据库视图、后端路由、iOS 模型及前端详情页。
- **UI 健壮性修复**: 彻底解决详情页重复字段干扰及 `CustomerContextSidebar` 的属性冲突问题。
- **文档全量对齐**: 同步更新了 PRD, API, DataModel 等 4 份核心文档的 Schema 描述。

## 最近更新 (2026-02-21 17:35:00)
- **搜索范围重大突破**: 彻底解除“仅搜已关闭工单”限制，处理中工单（如 HDMI 偏色等）实时检索 (bokeh.js v12.0.1)
- **UI 回归修复**: 成功恢复 Wiki 模块顶栏“每日一词”勋章，修复搜索返回状态残留 Bug
- **交互规范化**: 统一工单/文章点击采用 `window.open` 实现可靠的多标签页并行浏览
- Client 重大版本发版 v12.0.1 部署完成

## 最近更新 (2026-02-21 16:50:00)
- 完成 Wiki UI 与交互优化（外链卡片化、新标签页强力导航及视觉样式对齐）
- 前后端协同发版 v1.5.21 (Client v11.8.12) 部署完成

## 最近更新 (2026-02-21 16:35:00)
- 完成 Wiki 搜索体验强化 6 项改进（短查询安全回落、异步加载态、AI参考历史工单及UI精简）
- 前后端协同发版 v1.5.20 (Client v11.8.11) 部署完成

## 最近更新 (2026-02-21 12:24:00)
- 修复 500 接口报错，增加 API Key `.env` 回退机制
- 修复前端非搜索状态下分类列表与最近浏览不渲染的问题
- 同步发版 v1.5.18 (Client v11.8.9) 以验证更新

## 最近更新 (2026-02-21 11:46:00)
- 修复知识库搜索面板 UI 折叠 Bug
- 优化 `extractKeywords` 提取逻辑，解决长句及专有词汇检索失效问题
- 修复缺失 `ArticleCard` 等组件带来的 TS 编译报错问题
- 补齐多语言环境下的翻译键值导致的问题

## 最近更新 (2026-02-21 10:40:00)
- 执行 `git pull` 同步远程代码（包含 Wiki 组件更新）
- 解决 `SSL_ERROR_SYSCALL` 网络异常
- 同步文档 (PromptLog & DevLog)

## 最近更新 (2026-02-21 10:25:00)
- 完成知识库全方位文档同步 (PRD, API, DataModel, Scenarios)
- 标记 Knowledge Base (Phase 2) 为已完成
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
- **状态**: ✅ 已完成 (2026-02-21)

### [Feature] Service Module: 状态流转与权限 (Workflow & Roles)
- **优先级**: 🟠 高 (P1)
- **描述**: 
  - **状态机**: 实现 Service Record (处理中 -> 待反馈 -> 解决/关闭) 的状态流转控制。
  - **角色权限**: 区分 Dealer (仅见自己客户), Market (全局), Production (维修视角)。
- **状态**: 📋 待定 (Todo)

---

## 📋 待办事项 (Backlog)

### [Feature] Knowledge Base (Phase 2)
- **优先级**: ✅ 已完成 (2026-02-21)
- **描述**: 
  - 从 Service Record 沉淀知识点。
  - 实现知识库的搜索与关联推荐。
  - 文档闭环同步（PRD, API, DataModel, User Scenarios）。
  - **UI 深度抛光 (2026-02-22)**: 入口收敛至 Wiki 弹窗模式，完成 Kine Yellow 品牌色统一。

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

### [Doc] Knowledge Base Document Sync (2026-02-21)
- **状态**: ✅ 已完成
- **内容**:
  - **Service_PRD.md (v0.12.0)**: 细化 A/B/C/D 族群、DOCX/PDF 导入逻辑、混合搜索。
  - **Service_DataModel.md (v0.8.0)**: 补充 `chapter_number`, `source_type`, `format_status` 等字段。
  - **Service_API.md (v0.9.1)**: 注册 PDF/DOCX 导入接口及审计详情。
  - **Service_UserScenarios.md**: 补充自动化导入操作流程。

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
