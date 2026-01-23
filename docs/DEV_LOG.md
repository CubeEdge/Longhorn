# 开发会话日志 (Development Session Log)

**概述**: 本文档记录每次开发会话的内容、投入的“Prompt轮数/精力”以及具体的技术产出。

## 会话: 2026-01-23

### 任务: 实现 iOS 相册式交互 (Implementing iOS Photos-like Interactions)
- **JIRA/Issue**: N/A
- **状态**: ✅ 已完成
- **预估耗时 (Effort)**: ~25 轮对话
- **变更内容**:
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
