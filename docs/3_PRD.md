# Longhorn 企业文件管理系统 - 产品需求文档 (PRD)

**版本：** 13.4.1
**最后更新：** 2026-01-22

**状态：** 生产环境运行中 (V13)

---

## 1. 产品概述

### 1.1 产品定位
Longhorn 是一款面向企业内部的**轻量级文件管理与协作系统**，专为 Kinefinity 团队设计。提供安全、高效的文件存储、多级权限管理、跨部门分享及个人空间。

### 1.2 核心价值
- **部门隔离与协作**：按组织架构（MS/OP/RD/GE）划分存储，支持精细化授权。
- **灵活权限体系**：Admin / Lead / Member 角色 + Read / Contribute / Full 权限。
- **现代化体验**：iOS 风格毛玻璃 UI，支持桌面及移动端（响应式适配）。
- **零成本部署**：Node.js + SQLite，Mac mini 单机部署，Cloudflare Tunnel 穿透。

---

## 2. 核心功能模块

### 2.1 用户与权限
- **角色**：
  - **Admin**：全权管理（用户/部门/全局文件），可查看`/root`及所有个人空间。
  - **Lead**：管理本部门文件，通过授权访问其他部门。
  - **Member**：仅本部门及授权目录，拥有个人空间。
- **认证**：JWT Token (24h)，密码 bcrypt 加密。
- **授权**：支持跨部门目录授权（只读/读写）。

### 2.2 文件管理
- **架构**：物理磁盘映射（DiskA/DiskB）。
- **基本操作**：上传（支持大文件分片）、下载、重命名、移动（支持跨部门）、删除（软删除）。
- **高级功能**：
  - **收藏 (Starred)**：快速访问常用文件。
  - **分享 (Share)**：生成外部访问链接（支持密码/有效期/语言设置）。
  - **回收站 (Recycle Bin)**：30天自动保留期。
- **特殊处理**：
  - **上传者记录**：文件元数据记录上传者 ID。
  - **隐藏文件过滤**：自动隐藏系统文件（如 `.chunks`, `.DS_Store`）。

### 2.3 空间规划
- **部门空间**：`/dept/{CODE}` (MS, OP, RD, GE)。
- **个人空间**：`/personal` (物理路径 `Members/{username}`)。
- **公共资源**：可配置公共只读目录。

### 2.4 用户界面 (UI/UX)
- **风格**：深色模式 (Dark Mode)，透明磨砂 (Glassmorphism)，Kinefinity 黄色品牌色。
- **移动端适配**：
  - 响应式布局（Sidebar 折叠/覆盖）。
  - iPhone 药丸屏 Safe-area 适配。
  - 触摸优化。
- **多语言**：支持 中/英/德/日 切换。

### 2.5 每日一词 (Daily Word)
- **功能定位**: 碎片化语言学习组件，提升用户活跃度。
- **技术架构**: **Server-Client 动态架构**。
  - **API**: `/api/vocabulary` (支持分页、随机洗牌、ID排重)。
  - **客户端**: 启动时异步拉取 Top 50 随机词，浏览过程中静默预加载 (Infinite Scroll)。
- **数据源**: 服务端托管的高性能 JSON 词库 (`server/data/vocab/*.json`)，涵盖 De/Ja/En/Zh 四国语言。
- **交互**:
  - **Detail Sheet**: 毛玻璃详情页，集成 iOS 原生 TTS 发音。
- **刷新机制 (Refresh Logic)**:
  - **启动策略**: 每次冷启动检查本地词库是否满足 100 个，并尝试静默更新。
  - **手动刷新**: 在 UI (Settings 或 Daily Word Sheet) 上提供强制刷新入口，触发 API 立即拉取新词。
  - **进度反馈**: 加载过程中显示**圆环进度条或进度条** (Progress Bar/Ring)，提供直观反馈，而非纯文字。
  - **状态展示**: 在 Daily Word 详情页显示当前词库数量 (e.g., "Library: 153 words")。
- **数据指标 (Data Metrics)**:
  - **当前规模**: ~423 词 (De:105, En:108, Ja:102, Zh:108)。
  - **目标规模**: 100 词/语种 (共 400 词)。
  - **覆盖语种**: 德语 (De), 英语 (En), 日语 (Ja), 中文 (Zh)。

---

## 3. 最近更新 (V13.4.1)

### 3.1 紧急修复与稳定性
- **数据库兼容性修复**：
  - 修复 `authenticate` 中间件直接查询 `users.department_name` 导致的崩溃问题。改为标准的 `LEFT JOIN` 查询，兼容旧版本数据库 Schema。
- **iOS 权限修复**：
  - 解决部门名称含中文（如 "运营部"）导致的 403 权限错误，增加 Unicode NFC 标准化处理。
- **环境配置标准化**：
  - 明确 `DISK_A` 存储路径配置，确立 `server/data/DiskA` -> `/Volumes/fileserver` 的软链接部署规范。

### 3.2 之前的更新 (V13.4.0)

### 3.1 架构与稳定性增强
- **组件内聚化 (Component Inlining)**：
  - 针对 iOS App 中跨视图共享的 `FileDetailSheet` 组件，采用内聚化策略（合并至 `FileBrowserView`），绕过 Xcode 工程索引导致的 Target 链接错误，显著提升编译稳定性。
- **UI 逻辑统一**：
  - 收藏、搜索、浏览及分享列表全面对接 `FilePreviewSheet` 与 `FileDetailSheet`，实现“一处修改，全局生效”。

### 3.2 资源国际化
- **String Catalogs (xcstrings)**：
  - 迁移旧有的多语言映射至 iOS 新型 `Localizable.xcstrings` 格式，支持可视化管理和更精确的 Context 匹配。
  - 覆盖范围涵盖：操作提示、权限说明、部门名称及所有 UI 标签。

## 4. 之前的更新 (V13.1.0)


### 3.1 真实数据与统计
- **部门概览 (Real-time Stats)**：
  - 服务端动态计算部门文件数、存储占用及成员总数。
  - iOS 端 "More" Tab 根据角色差异化展示（Admin见系统概览，Lead/Member见部门概览）。
- **授权目录集成 (Authorized Folders)**：
  - 首页 "Browse" Tab 新增 "Authorized Folders" 分区。
  - 自动聚合由管理员授予用户的额外目录权限（跨部门访问），并支持一键跳转。

### 3.2 体验与UI优化
- **iOS 风格重构**：
  - 全面采用 iOS Files App 风格布局。
  - 优化 "Add Authorization" 按钮（醒目 Kine Yellow）。
  - Empty State 视觉优化。
- **编译与架构**：
  - 解决 `FolderPickerView` 命名冲突。
  - 修复 Server 端 API 接口数据完整性问题（UserID 关联查询）。

### 3.3 之前的更新 (V11.3.0)

### 3.1 移动端体验优化
- **Safe Area 适配**：修复 iPhone 动态岛/刘海屏遮挡顶部菜单问题。
- **滚动优化**：解决横屏模式下菜单和内容区无法滚动的问题。
- **布局调整**：右上角用户菜单在移动端隐藏详细信息，仅显示头像。

### 3.2 界面与交互改进
- **Sidebar 优化**：
  - 移除底部的版本号和旧版语言切换，界面更清爽。
  - 用户菜单增加 "Dashboard" 入口。
  - 用户菜单恢复两行显示（用户名+角色）。
- **弹窗层级修复**：解决“授权管理”弹窗被“用户详情”遮挡的问题 (z-index 提升)。
- **Dashboard**：新增系统概览仪表盘，展示存储/用户/文件统计。

### 3.3 系统稳定性与修复
- **隐藏文件过滤**：彻底屏蔽 `.chunks` 等系统文件夹在选择器和列表中的显示。
- **数据库一致性**：修复部门重复记录 (旧中文名 vs 新英文代码)。
- **数据完整性**：修复历史文件 "Unknown" 上传者问题（归属 Admin）。
- **部署规范**：标准化 `deploy.sh` 及迁移脚本。

---

## 4. 技术架构

- **前端**：React 18 + TypeScript + Vite + Zustand + CSS Variables。
- **后端**：Node.js + Express + SQLite (better-sqlite3)。
- **部署**：
  - PM2 进程守护。
  - **自动更新**：`deploy-watch.sh` 监控 Git 变更自动重载。
  - **迁移**：`migrate_dept_paths.js` 处理数据库与文件系统同步。

---

## 5. 文档索引

所有产品相关文档归档于 `product_docs/` 目录：

- `docs/1_Backlog.md`: **产品待办与状态** (能够看到所有功能、需求及完成情况)。
- `docs/2_PromptLog.md`: **AI 交互日志** (追踪历史对话与决策)。
- `docs/3_PRD.md`: **产品需求文档** (当前文档，功能规格说明)。
- `docs/4_DevLog.md`: **开发技术日志** (技术决策与架构记录)。
- `docs/iOS_Dev_Guide.md`: iOS App 开发与技术架构指南。

