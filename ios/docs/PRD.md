# Longhorn iOS Client - 产品需求文档 (PRD)

**版本：** 13.1.0  
**最后更新：** 2026-01-14  
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
  - **分享 (Share)**：生成外部访问链接（支持密码/有效期）。
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
  - **Toolbar Badge**: 常驻入口，显示今日单词。
  - **Detail Sheet**: 毛玻璃详情页，集成 iOS 原生 TTS 发音。

---

## 3. 最近更新 (V13.1.0)

### 3.1 深度本地化 (Deep Localization)
- **全面覆盖**: 完成 `Browse`, `Personal`, `More` 核心 Tab 的 UI 文本替换。
- **细节优化**: 修复 View 枚举 (Sort/ViewMode)、操作菜单 (Menu)、弹窗 (Sheet) 中的硬编码字符串。
- **资源补全**: `Localizable.xcstrings` 新增 40+ 键值，支持四国语言 (CN/EN/DE/JA)。

### 3.2 iOS 原生导航重构 (V13.0)
- **三段式导航**: 重构为 `Browse`, `Personal`, `More` 结构，贴合 iOS Files App 体验。
- **组件拆分**:
  - `BrowseView`: 集成搜索与文件浏览。
  - `PersonalTabRootView`: 个人中心设置化列表。
  - `DetailStatsView`: 独立的数据指标详情页。

### 3.3 稳定性修复
- **JSON 修复**: 修正 XCStrings 文件格式错误。
- **编译修复**: 解决 User 模型属性访问导致的构建失败。

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

- `product_docs/PRD.md`: 本文档。
- `product_docs/prompt_log.md`: AI 交互与需求变更流水账。
- `product_docs/prompt_version.md`: 版本迭代记录表。
- `product_docs/deployment.md`:服务器部署与维护指南（**新**）。
- `docs/iOS_Dev_Guide.md`: iOS App 开发与技术架构指南（**新**）。

