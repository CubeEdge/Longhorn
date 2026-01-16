# Changelog

## [13.2.0] - 2026-01-16
### Added
- **Share Language**: iOS App 分享和批量分享弹窗新增“语言设置” (中文/English)，生成的分享链接将使用指定语言。
- **Delete Confirmation**: 单个文件删除操作增加二次确认弹窗，防止误删。

### Fixed
- **Share Links**: 修复创建分享链接时的 400 错误 (参数名匹配问题)。
- **Thumbnails**: 修复子文件夹下缩略图无法显示的问题 (路径编码修复)。
- **UI**: 移除文件列表底部多余的 "下拉刷新" 提示文字。

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

## [13.1.0] - 2026-01-14 (Evening Update)
### Added
- **Department Dashboard**: 部门概览现在展示真实数据（文件数、成员数、存储占用），而非Mock数据。
- **Authorized Folders**: 首页（Browse）"位置" 区域新增 "Authorized Folders" 分组，展示用户被特别授权访问的目录。
- **Server API**:
    - `GET /api/department/my-stats`: 获取部门统计。
    - `GET /api/user/permissions`: 获取由 Grant Permission 赋予的特殊目录访问权。

### Fixed
- **UI Tweaks**:
    - `UserDetailView`: 优化授权按钮样式（Kine Yellow），权限列表项现可点击跳转至对应文件夹。
    - `FolderPickerView`: 解决与内部组件的命名冲突。
- **Data Loading**: 修复部门统计因 Token 缺失部门字段而加载失败的问题。

## [13.0.0] - 2026-01-14

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
