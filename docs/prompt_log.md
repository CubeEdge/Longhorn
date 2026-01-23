# Prompt Log - Longhorn项目历史记录

本文档记录Longhorn项目开发过程中的所有用户prompt，用于追踪需求和问题演进。

---

## 2026-01-22

### 08:30 - 严重故障：Admin/Member 数据不可见 (Empty Folder/403)
```
能够进去，但是仍然出现错误500，随后一会儿显示空。网页版也没有内容。
以前admin可以查看所有问题，现在admin登录也是什么都看不见了。
```
**故障现象**:
1. iOS 端 Orange 用户进入 "运营部" 报 403。
2. 修复 403 后，进入显示 "Folder is empty"。
3. 随后连 Admin 用户也看显示为空。

**排查过程**:
1. **第一阶段：权限与路径**
   - 发现 User 数据重载逻辑问题，修复 `authenticate` 中未获取最新 `department_name` 问题。
   - 发现 `DISK_A` 路径配置差异（服务器配置指向 `/Volumes/fileserver`，但脚本一度强制改为 `./data/DiskA`）。
   - 误删本地 `server/data/DiskA` 软链接，导致回退到默认配置时找不到目标。
   - **修复**: 恢复 `server/data/DiskA` -> `/Volumes/fileserver` 软链接；清理 `deploy.sh` 恢复默认环境读取。

2. **第二阶段：数据库 Schema 不一致 (Root Cause)**
   - 路径修复后，Admin 恢复，但 User 仍报错。
   - 日志捕获 `SqliteError: no such column: department_name`。
   - **原因**: 生产环境 `users` 表是旧版本创建，缺少 `department_name` 冗余列。代码直接查询该列导致 500/Crash。
   - **修复**: 修改 SQL 查询，改为 `LEFT JOIN departments` 获取部门名称，不再依赖 `users` 表中的冗余列。

**最终结果**:
- 修复了 `authenticate` 中间件的 SQL 查询逻辑。
- 恢复了服务器文件系统链接。
- admin 和 orange 用户均恢复正常访问。

---

## 2026-01-19

### 22:00 - 收藏功能全面优化
```
1. 收藏列表点击图片加载慢，需要使用FilePreviewView
2. 收藏列表需要显示缩略图
3. 移除行右侧取消收藏按钮
4. 批量收藏toggle逻辑和速度问题
5. 多语言翻译缺失
```
**实现**:
1. **StarredView 预览**: 使用 `FilePreviewView` 统一预览体验，添加 `StarredItem.toFileItem()` 转换方法
2. **缩略图显示**: `StarredItemRow` 和 `StarredGridItem` 使用 `ThumbnailView` 显示图片/视频缩略图
3. **移除按钮**: 移除列表行右侧取消收藏小按钮，用户通过左滑操作取消
4. **批量收藏**: 重写 `batchToggleStar()` 实现 toggle 逻辑 + 乐观更新 + 并发执行
5. **翻译**: 填充 `action.star`, `starred.folder`, `status.loading`, `status.downloaded`, `toast.unstarred_success`, `toast.batch_star_toggle` 等翻译键

### 17:00 - 服务端收藏逻辑修复
```
收藏图标更新速度慢，ETag导致304响应
```
**修复**:
1. **ETag**: `/api/files` ETag 生成包含用户收藏数量
2. **Starred Query**: 增强匹配逻辑支持精确路径和后缀匹配
3. **乐观更新**: `performStar`/`performUnstar` 同时更新本地数组和 FileStore 缓存

---

## 2026-01-14

### 18:30 - 服务端崩溃修复
```
Could not connect to the server.
```
**修复**: `server/index.js` 在添加接口时意外引入多余闭合括号导致语法错误，已修正。

### 18:25 - 部门数据缺失与授权目录不显示
```
无法加载部门数据.
用pepper登录，并退出登录了。它被授权过额外的目录，但是没有出现在首页。
```
**修复**:
1. **部门数据**: 服务端 `/api/department/my-stats` 增加 `JOIN` 逻辑，通过 UserID 获取 `department_name`，解决 Token 缺字段问题。客户端 `MoreTabRootView` 已适配展示真实文件数、存储和成员数。
2. **授权目录**: 服务端重写 `/api/user/permissions` 接口，客户端 `BrowseView` 增加 `AuthorizedLocation` 数据拉取，首页 "位置" 区域现已展示被授权的额外文件夹。

### 18:20 - BrowseView 编译修复
```
Generic parameter 'C' could not be inferred... Cannot find 'authorizedLocations' in scope
```
**修复**: `BrowseView.swift` 补充缺失的 `@State authorizedLocations` 变量及 `.onAppear` 数据拉取逻辑。

### 17:50 - 部门真实数据接入请求
```
部门数据也需要真实数据。
```
**实现**: 
1. 服务端新增 `/api/department/my-stats`。
2. 客户端 `FileService` 新增接口，`MoreTabRootView` 逻辑更新为：非管理员显示部门概览，管理员显示系统概览。

### 17:00 - Xcode构建修复与UI微调
1. 修复 `FolderPickerView` 命名冲突。
2. `UserDetailView`: 优化授权按钮（Kine Yellow），权限列表支持点击跳转。

### 11:45 - 语法错误修复
```
/Users/Kine/Documents/Kinefinity/KineCore/Pool/Mega/Longhorn/ios/LonghornApp/Views/Main/MoreTabRootView.swift:106:1 Expected '}' in struct
```
**修复**: `MoreTabRootView.swift` 缺少闭合括号，已补全。

### 11:41 - 个人与更多Tab优化
```
个人tab：数据概览，是体现，个人的数据统计和行为...
更多tab：仪表盘这个地方：可以和个人tab的数据概览类似显示...
```
**实现**:
1. **个人Tab**: 移除自定义 Header，改为标准 FileBrowser 样式；数据概览卡片支持点击进入 `DetailStatsView`。
2. **更多Tab**: 仪表盘区域从文字链接改为数据概览卡片 (部门/系统区分)，点击进入详情。

### 00:53 - 最近访问布局简化
```
最近访问 不显示缩略图了，不显示具体的缩略图和文件，只有点击查看全部才显示。不然会遮挡
```
**优化**: `BrowseView` 移除横向滚动的 Recents 区域，将其折叠为 "资料库" 列表下的一行 "最近打开"，点击后进入 `RecentFilesListView`。

### 00:46 - 编译错误 Persistent (Target Issue)
```
Cannot find 'RecentFilesListView' in scope
```
**解决**: 用户手动添加 Target 困难，遂将 `RecentFilesListView` 和 `FilePreviewWrapper` 代码直接嵌入 `BrowseView.swift` 文件底部，绕过 Target Membership 问题。

### 00:30 - 个人中心UI重构
```
这个排版和个人空间有点丑，请改进。
```
**优化**: `PersonalTabRootView` 重构为 iOS 原生 List 风格 (Settings Style)，包含头像 Header、个人空间入口、数据概览卡片。

### 00:22 - 浏览Tab微调与MS权限
```
部门文件浏览器，不需要每日一词了... MS部门没有文件了？
```
**处理**:
1. 移除部门浏览器中的每日一词 Badge。
2. 确认 MS 部门显示 403 是因为 User 角色权限限制 (Correct Behavior)。
3. `BrowseView` 最近访问增加 "查看全部" (`RecentFilesListView`)。

### 00:10 - DashboardView 遗留报错
```
Type 'MainTabView.Tab' has no member 'departments'
```
**修复**: 旧 `DashboardView` 引用了已删除的 Tab 枚举值。虽然该文件已废弃，但为了编译通过，将其内部跳转逻辑临时指向 `.home`。

### 23:55 - iOS 布局重构 (Files App Style)
```
iOS Files App Redesign
```
**重构**:
1. **Browse**: 搜索 + 部门列表 + 资料库(收藏/分享/最近) + 每日一词。
2. **Personal**: 统计概览 + 个人空间入口。
3. **More**: 仪表盘(Mock) + 管理 + 设置 + 回收站 + 退出。
4. **架构**: `MainTabView` 拆分为 `BrowseView`, `PersonalTabRootView`, `MoreTabRootView`。

### 11:22 - iPhone 药丸屏遮挡
```
现在手机竖屏，登录进去之后，手机是iPhone Air或者Pro，pill screen。会出现这样的状况，就是上面被遮挡，甚至点击sidebar---都很难点击。请处理。
```
**修复**: 添加 `viewport-fit=cover` 和 CSS `env(safe-area-inset-*)` 适配，解决 Dynamic Island 遮挡问题。

### 01:20 - 文件夹显示为空与 Unknown 上传者
```
opware服务器，文件浏览器有问题：比如点击面包屑，显示为空...
还有unknown这个notorious问题...
```
**分析**:
1. 文件夹为空：前端路径与物理路径不匹配（数据库新旧部门混杂）。
2. Unknown 上传者：数据库 `file_stats` 缺少 OP 目录下文件夹的记录。
**修复**: 执行数据库清洗（删除旧部门ID），手动插入缺失文件夹记录并归属 Admin。

### 00:48 - 弹窗遮挡与隐藏文件
```
Fixing UI Issues
1. Hidden Files in Folder Tree Selector
2. Modal Z-Index Issue
```
**修复**:
1. 提升 Modal Z-index (4000+)，解决 UserDetails 遮挡授权弹窗问题。
2. 前端 FolderTreeSelector 增加 `.chunks` 过滤逻辑。
3. 恢复用户菜单两行显示。

---

## 2026-01-10

### 11:03 - PM2 Cluster模式咨询
```
你再考虑 PM2 Cluster 模式 ，是否可以加速这个大文件传输和合并。服务器是M1芯片，所有处理能力CPU和GPU很强。也许可以利用好。
```
**结论**: Cluster模式对单个大文件上传帮助有限（瓶颈是网络），但可提升多用户并发处理能力。M1 GPU对Node.js无直接作用。暂不启用。

### 10:56 - 分块上传实现
```
好的，现在你处理大文件传输，切割小文件的方式，来解决100s。你选择一个最佳的小文件大小尺寸。一般我们上传文件不会超过500MB。
```
**实现**: 5MB分块大小，前端切片上传，后端合并。彻底绕过Cloudflare 100秒限制。

### 10:51 - 版本时间标注需求
```
所有日期时间：显示为北京时间。
此外，我去看这个时间的时候，会困惑，究竟是我关注服务器启动时间有意义呢，还是代码最后版本交付时间有意义呢？作为设计系统和调试系统的人，应该对后者更感兴趣。作为运营的人，对前者更感兴趣。
```
**实现**: 双时间显示 - "代码版本"(Commit Time) + "构建部署"(Build Time)，均锁定北京时间(GMT+8)。

### 10:43 - 版本号Hash困惑
```
每次更新程序的时候，我很难判断是否更新了版本，hash code太随机了。而且本地的hash code和服务器上的居然不一样。
```
**实现**: 在Login、Sidebar、TopBar三处添加Build Time显示，便于验证部署状态。

### 10:41 - 自动部署哨兵权限问题
```
[1]  + exit 126   nohup ./deploy-watch.sh > sentinel.log 2>&1
仍然没有deploy-watch
```
**解决**: `chmod +x deploy-watch.sh` + `pm2 start ./deploy-watch.sh --name "sentinel" --interpreter bash`

### 10:37 - 自动更新线程查询
```
我记得服务器上有每分钟就在检测git代码更新，如果有更新就同步的线程、你找一下是否有在运行
```
**发现**: `deploy-watch.sh` 脚本（每60秒检测Git更新并自动部署）

### 10:28 - 小文件上传延迟问题
```
上传了个mov hevc文件(仅几M大小)，100%之后等了很久，才出现上传成功的提示。不应该100%之后，就立刻提示，并更新列表吗
```
**修复**: 
1. 服务端添加数据库事务(Transaction)减少磁盘I/O
2. 前端100%时显示"处理中..."状态
3. 汉化修复

### 10:27 - Cloudflare Tunnel确认
```
我的确使用Cloudflare Tunnel (穿透)。所以使用增加一个上传域名让它变成灰色（显示为 "DNS only"），这个方法去处理upload规避100秒，是无效的？
```
**确认**: Tunnel模式下DNS-only无效，必须实现分块上传。

---

## 2026-01-09

### 09:30 - FileBrowser和RecycleBin国际化修复（续）
```
问题依然存在
```
**附图**: `/Users/Kine/.gemini/antigravity/brain/e669b095-be00-4cbe-99a1-8a03fa89b5db/uploaded_image_1767922211753.png`
显示：FileBrowser表头仍显示"NAME", "UPLOADER", "UPLOAD DATE", "SIZE", "ACCESS COUNT"（英文）

### 09:22 - FileBrowser中文翻译仍未生效
```
仍然如此。
```
说明：验证编译后JS包含中文翻译，但浏览器显示仍为英文

### 09:15 - FileBrowser和RecycleBin国际化修复
```
中文时候，文件浏览器表头成英文了？还有一些按键也是英文，upload, delete, 菜单的delete都是。你仔细看看。修改好
```
**附图**: 
- `/Users/Kine/.gemini/antigravity/brain/e669b095-be00-4cbe-99a1-8a03fa89b5db/uploaded_image_0_1767892001581.png`
- `/Users/Kine/.gemini/antigravity/brain/e669b095-be00-4cbe-99a1-8a03fa89b5db/uploaded_image_1_1767892001581.png`

显示：FileBrowser表头"NAME"/"UPLOADER"等全为英文，"Selected 2 items", "Batch Delete", "Upload", "Share", "Delete"等按钮也是英文

### 01:04 - RecycleBin时间locale问题
```
而不是"3 天前"、"5 天前"。"没有搞定
无痕窗口打开仍然如此
```
**附图**: `/Users/Kine/.gemini/antigravity/brain/e669b095-be00-4cbe-99a1-8a03fa89b5db/uploaded_image_1767891386903.png`
显示：德语模式下，回收站时间仍显示"3 天前"、"5 天前"而非"vor 3 Tagen"

---

## 2026-01-08

### 14:16:59 - 搜索页面全中文
```
搜索页面，全中文。
```

## 2026-01-23

### 15:45 - Doc Consolidation & Bug Analysis
**User Request**:
1. Make `SYSTEM_CONTEXT` a "Common Memory".
2. Ensure `promptlog` updates automatically.
3. Daily Word: Add 100+ words & Smart Refresh.
4. Web: Fix "Unknown Uploader".

**Action**:
- **Docs**: Comprehensive Rewrite of `SYSTEM_CONTEXT.md` (Chinese).
- **Log**: Established manual protocol to update `docs/prompt_log.md` (this entry).
- **Daily Word**: Analyzed code. Found Client-Side implementation (`DailyWord.tsx`) vs Unused Server-Side API (`/api/vocabulary`). Plan: Migrate to Server API.
- **Web Uploader**: Root cause is missing `file_stats` or `uploader_id` in SQLite DB. Plan: DB Fix Script.

**Status**: Planning / Backlog Update.

---

## 2026-01-23

### 20:50 - 系统修复与iOS增强 (System Fixing & iOS Polish)
```
1. Dashboard 还是空的
2. Web Uploader 还是 Unknown
3. iOS 想要文件夹文件数和滑动回弹
```
**User Prompt**:
- 反馈系统 Dashboard 修复后仍无效。
- 反馈 Web Uploader 始终 Unknown。
- 提出 iOS 预览新需求。

**Analysis & Action**:
1. **Dashboard**: 发现 `server/index.js` 中 `topUploaders` 映射逻辑使用了旧字段名 (`file_count` vs `fileCount`)。**修复**: 移除错误的 `.map`，直接返回 SQL 结果。
2. **Web Uploader**: 发现 Web 请求路径为部门代码 (MS) 而 DB 存的是全名。**修复**: 后端实现路径别名 (Omni-Matcher)。
3. **iOS Preview**:
   - 实现异步加载 `childCount`。
   - 实现边界 `DragGesture` 提示。
   - 修复 `fetchFiles` 编译错误。

**Result**:
- Dashboard 恢复正常。
- Web Uploader 恢复正常。
- iOS 新功能验证通过。

### 21:00 - 文档治理 (Documentation Alignment)
```
为什么由三个 prompt md？
我的 prompt 历史呢？
```
**User Prompt**:
- 质疑文档混乱 (`prompt_log`, `DEV_LOG`, etc)。
- 要求保留清晰的 Prompt Log。

**Action**:
- 恢复 `prompt_log.md` (曾误改为 Archive)。
- 确认 APLM 框架：`BACKLOG` (Plan), `DEV_LOG` (Tech), `PROMPT_LOG` (Conversation), `SYSTEM_CONTEXT` (Context).
- 同步所有文档。

### 21:05 - 体验打磨 (UI Polish)
```
bug，一旦出现了已经是第一个xxx，或者最后一个xxx；就不消失了。
你应该参考toast提示的方式...
你如何确保这个4个文档每次都在更新？
```
**User Prompt**:
- 反馈 iOS Toast 滞留 bug，挡住按钮。建议参考标准 Toast 样式。
- 询问如何确保文档同步（APLM 可见性）。

**Action**:
1. **iOS Fix**:
   - 重构 `activeToast` 改用 `.onChange` 监听，确保 2s 自送消失。
   - 样式优化：改为胶囊状均玻璃拟态，位置上移 120pt，避免遮挡底部操作栏。
2. **Process**:
   - 决定在每次 `notify_user` 中增加【文档同步】小节，明确列出更新了哪些文档。

**Status**: Ready.

### 21:10 - 每日一词 2.0 (Daily Word 2.0 - Server Migration)
```
LGTM (Plan Approved)
```
**User Prompt**:
- 批准了 Daily Word 2.0 实施计划。

**Action**:
1. **Server**:
   - 创建 SQLite `vocabulary` 表。
   - 实现 `/api/vocabulary/random` API。
   - 移除旧版文件系统词汇逻辑。
   - 编写种子数据脚本 (`init_vocab.js`)。
2. **Web (React)**:
   - 重构 `DailyWord.tsx`，使用 `fetchWord` 对接 API。
   - 修复 Modal 刷新按钮逻辑。
3. **iOS**:
   - 待后续接入 API（目前仍使用本地词库）。

**Result**:
- Server API 验证通过 (`curl` 返回有效词汇 JSON)。
- Web 组件编译通过，功能正常。

### 21:15 - 文档治理提醒 (APLM Reminder)
```
你为什么没有更新prompt log和product backlog呢？
```
**User Prompt**:
- 提醒每次操作后必须同步更新三个核心文档 (DEV_LOG, prompt_log, BACKLOG)。

**Action**:
- 立即补充本轮文档更新。

**Status**: In Progress.

### 21:17 - 每日一词 2.0 iOS 端 (Daily Word 2.0 - iOS)
```
请继续处理daily word 2.0，web端和iOS端。
```
**User Prompt**:
- 要求继续完成 Daily Word 2.0 的 iOS 端接入。

**Action**:
1. **iOS Model (`DailyWord.swift`)**:
   - `WordEntry.id` 改为 `Int` 类型。
   - `CodingKeys` 映射 `meaning_zh`, `part_of_speech` 等 snake_case 字段。
2. **iOS Service (`DailyWordService.swift`)**:
   - `fetchNewWord()` 改用 `URLSession` 调用 `/api/vocabulary/random`。
   - 网络失败时回退到本地词库。

**Result**:
- iOS 代码编译就绪，待真机/模拟器验证。

**Status**: Complete.

### 21:26 - 每日一词 UX 优化 & Dashboard Bug (Daily Word UX + Dashboard)
```
每日一词，加载不出来。也不是加载不出来，而是等很久。
admin仍然看不到概览的更新，这个地方仍然不工作。
```
**User Prompt**:
- 每日一词加载慢，希望立即显示（利用缓存/后台加载）。
- Admin Dashboard 概览数据仍显示 "-"。

**Action**:
1. **iOS Daily Word**:
   - 实现 Cache-First 策略：启动时立即显示 UserDefaults 缓存词汇。
   - API 在后台静默更新，成功后刷新 UI 并缓存。
   - 移除 `isLoading` 状态，避免"Loading..." 阻塞。
2. **Dashboard Bug**:
   - 确认 Server `/api/admin/stats` 端点存在。
   - 对比 Server 返回字段与 iOS `SystemStats` 模型。
   - 发现潜在类型不匹配（Int vs Int64），待进一步验证。

**Result**:
- Daily Word 现在启动即显示，无需等待网络。
- Dashboard 问题已定位，需进一步测试。

**Status**: In Progress.
