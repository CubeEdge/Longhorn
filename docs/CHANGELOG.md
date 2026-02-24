# Changelog

## [12.1.37] - 2026-02-24
### Added (Article Manager)
- **Safe Delete Confirmation**: 实现了全新的批量/单篇文章删除确认弹窗，包含待删标题清单及 10 秒强制倒计时安全机制。
- **Select All Refinement**: 优化了文章管理页的全选逻辑，使其仅对当前搜索过滤后的可见文章生效，防止误选后台项目。
- **i18n**: 为删除安全机制补充了多语言支持。

## [Unreleased] - 2026-02-07
### Added (Knowledge Base)
- **DOCX Import Pipeline**: 新增知识库DOCX→MD完整导入流程，支持MAVO Edge 6K操作手册导入（73章节、9表格、39图片）。
  - **转换器**: `server/scripts/docx_to_markdown.py` - 使用`python-docx`直接读取DOCX结构，完整保留表格和层级。
  - **图片优化**: 自动提取并转WebP格式（质量85，压缩率80%+）。
  - **导入器**: `server/scripts/import_from_markdown.py` - 按标题分割章节，保留Markdown格式。

### Fixed (WIKI Navigation)
- **双重嵌套问题**: 修复WIKI导航树"操作手册"节点双重嵌套，确保四级结构正确（产品线→产品型号→分类→章节→文章）。
- **章节识别**: 优化`parseChapterNumber`正则，支持"1."和"1.1"两种格式，准确率100%。
- **图片显示**: 同步39张WebP图片到远程服务器`/data/knowledge_images/`，修复图片无法加载问题。
- **摘要生成**: 修正Markdown图片语法移除逻辑，避免摘要中出现"Image(/path)"纯文本。

### Changed (Infrastructure)
- **运维规范**: 明确远程执行必须使用`ssh -t mini "/bin/zsh -l -c '...'"` 格式，避免`killall node`杀掉PM2 daemon。
- **访问地址**: 统一使用Cloudflare Tunnel地址`https://opware.kineraw.com`，而非直接IP访问。

---

## [13.4.1] - 2026-01-22
### Emergency Fix
- **Database Schema Compatibility**: Fixed a critical server crash when authenticating users. The server previously expected a `department_name` column in the `users` table, which did not exist in the production database. The query was rewritten to use a `LEFT JOIN` with the `departments` table, ensuring stability without requiring risky schema migrations.
- **iOS 403 Permission Error**: Resolved an issue where localized department names (e.g., "运营部") caused access denial on iOS. Implemented strict Unicode NFC normalization to match server-side logic.
- **Storage Configuration**: Hardened the server deployment script to ensure `DISK_A` correctly points to the external storage volume (`/Volumes/fileserver`) via a managed symlink, preventing "Empty Folder" states.

## [13.3.0] - 2026-01-19
### Added
- **Starred Thumbnails**: 收藏列表和网格视图现在显示图片/视频缩略图，而非通用图标。
- **Starred Preview**: 收藏列表点击文件使用 `FilePreviewView` 统一预览体验，包含收藏、下载、分享按钮。
- **Batch Star Toggle**: 批量收藏支持 Toggle 逻辑（已收藏则取消，未收藏则收藏），使用乐观更新和并发执行。
- **StarredItem.toFileItem()**: 添加类型转换方法支持与 FilePreviewView 集成。

### Fixed
- **Translations**: 填充多个缺失的翻译键：
  - `action.star`, `starred.folder`, `status.loading`, `status.downloaded`
  - `toast.unstarred_success`, `toast.batch_star_toggle`
  - `starred.unstar_batch_success`, `starred.unstar_batch_partial`
- **Starred UI**: 移除收藏列表行右侧的取消收藏按钮（用户可通过左滑操作）。
- **Server ETag**: 修复 `/api/files` ETag 生成逻辑，包含用户收藏状态，确保收藏变更时客户端刷新。
- **Server Starred Query**: 增强收藏文件匹配逻辑，支持精确路径和后缀匹配。
- **Optimistic Updates**: 修复 `performStar`/`performUnstar` 同时更新本地数组和 FileStore 缓存，实现即时 UI 响应。

### Changed
- **FileService.starFile 409 Handling**: 服务端返回 409 (已收藏) 时客户端视为成功，避免不必要的回滚。

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
