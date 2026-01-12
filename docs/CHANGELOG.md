# Changelog

## [11.5.0] - 2026-01-06
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
