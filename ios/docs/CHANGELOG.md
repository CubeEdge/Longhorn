# Changelog

## [14.0.0] - 2026-01-16
### Added
- **Smart Refresh Architecture**: 实装基于 SWR (Stale-While-Revalidate) 模式的智能刷新方案。
    - **Data Stores**: 新增 `FileStore`, `DashboardStore`, `ShareStore` 内存缓存层。
    - **Global Event Bus**: 引入 `AppNotifications` 全局事件模型，实现跨视图同步（如：文件浏览器收藏后，星标页即时更新）。
- **Maintenance**: 
    - 新增 `AppNotifications.swift` 用于统一管理通知。
    - 登出时自动清理所有内存缓存。
    - `docs/OPS.md` 增加 Mac mini 开机自启动、自动登录及服务持久化配置指南。

## [13.2.0] - 2026-01-16
### Changed
- **Delete UX**: 优化分享删除确认框，从顶部固定移动至删除按钮附近弹出，符合 iOS 原生交互习惯。
- **Preview Optimization**: 图片预览加载逻辑重构，解决大文件或弱网下 0% 状态卡顿问题。
- **Cache Manager**: `PreviewCacheManager` 优化，引入防抖磁盘写入，消除主线程卡顿。
### Fixed
- **Property Names**: 修复 `ShareLink` 模型属性引用错误（`fileName`/`filePath`）。
- **Bug Fix**: 修复 `SharesListView` 中因括号不匹配导致的编译错误。

## [13.1.0] - 2026-01-14
### Fixed
- **JSON Syntax**: 修复 `Localizable.xcstrings` 格式错误导致的应用崩溃。
- **Compilation**: 修复 `DashboardView` 中 `User` 模型访问错误。
### Changed
- **Deep Localization**: 完成核心视图 (`FileBrowser`, `UserDetail`, `Personal`, `More`) 的深度本地化，覆盖菜单、弹窗和枚举值。
- **Localization Resources**: 新增 40+ 个本地化键值对，支持中/英/德/日。

## [13.0.0] - 2026-01-14
### Changed
- **iOS Navigation Refactor**: 重构为 iOS 原生 "Files App" 风格的三段式导航 (Browse, Personal, More)。
    - **Browse Tab**: 集成搜索、部门列表、资料库（收藏、分享、最近访问）、每日一词。
    - **Personal Tab**: 个人中心重设计为 iOS Settings 风格列表，包含数据概览卡片。
    - **More Tab**: 管理功能与仪表盘入口，根据角色 (Admin/Lead) 动态显示。
- **UI Improvements**:
    - **Detail Stats**: 新增 `DetailStatsView` 用于展示详细的个人或部门数据指标。
    - **Recent Files**: 优化 Recent Files 显示逻辑，在 browse tab 仅显示入口，点击进入详情页，避免首页遮挡。
- **Fixes**:
    - **Build System**: 修复多个 View 的 Target Membership 问题（通过代码嵌入绕过）。
    - **Layout**: 修复 iPhone 药丸屏遮挡与 Sidebar 点击问题。

## [12.0.0] - 2026-01-13 (Skipped Version for internal tests)

### Added
- **Multi-Language Support**: 全面支持中文、英语、德语、日语 (CN/EN/DE/JA)。
    - **UI Switcher**: 顶部栏用户头像下拉菜单集成语言切换功能。
    - **Share Page**: 分享页右上角新增独立语言切换器（非白色下拉框风格）。
    - **Smart Defaults**: 分享页默认加载创建者设定的语言偏好。
- **Share Options**: 创建分享/批量分享弹窗新增“默认语言”选项，支持指定分享内容的显示语言。
- **Backend Schema**: 数据库 `shares`, `share_links`, `share_collections` 新增 `language` 字段。
- **Batch Download Naming**: 批量下载压缩包采用 `{FirstFileName}_and_{others}.zip` 命名策略。
- **Grid Thumbnails**: 星标页网格视图现在支持视频和图片缩略图显示。

## [11.4.0] - 2026-01-06
### Fixed
- **Starred Metadata**: 修复星标文件列表中的“大小”和“访问次数”显示为 `NaN` 的问题，通过优化 `/api/starred` 返回完整元数据并移除前端 N+1 请求。
### Added
- **Smart Share**: 引入智能分享逻辑，单选文件自动触发单文件分享，多选触发批量打包分享。
- **Logout UI**: 重构退出登录入口，从侧边栏底部移除，整合至顶部栏用户头像下拉菜单中，提升界面整洁度。
### Changed
- **Batch Action Bar**: 统一批量操作栏（分享、移动、下载、删除）的图标与文案，与单文件右键菜单保持视觉一致性。

## [11.3.0] - 2026-01-05
### Added
- **Global Loading States**: 全面实现操作等待状态，包括：
    - **Share Generation**: 生成分享链接时禁用按钮并显示"生成中..."。
    - **Bulk Actions**: 批量删除、下载、移动操作增加加载中（Loading）反馈。
    - **Folder Creation**: 创建文件夹时显示旋转加载图标。
    - **Move Modal**: 移动确认按钮支持 Async 等待状态，防止弹窗过早关闭。
### Changed
- **Terminology**: 优化系统提示语，将技术性词汇（如"读取文件库"）替换为更友好的表达（"更新列表"）。
