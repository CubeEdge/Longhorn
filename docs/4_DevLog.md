# 开发会话日志 (Development Session Log)

**概述**: 本文档记录每次开发会话的内容、投入的“Prompt轮数/精力”以及具体的技术产出。

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
