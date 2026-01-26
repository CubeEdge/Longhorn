# 开发会话日志 (Development Session Log)

**概述**: 本文档记录每次开发会话的内容、投入的“Prompt轮数/精力”以及具体的技术产出。

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
        - **Manual Trigger**: Tap book icon or pull-to-refresh to force fetch (+20 words).
        - **UI Upgrade**: Added Library Count, Toolbar Progress Ring, and Bottom Overlay Toast.
    - **Settings Refactor**:
        - Reorganized sections: General, Content, Connection, Maintenance, About.
        - **Dialog Standardization**: Replaced `.alert` with `.confirmationDialog` for "Reset Preferences".
        - **Toast Specs**: Defined `standard` (Glass) vs `prominent` (Solid Color + Haptic) styles.
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
