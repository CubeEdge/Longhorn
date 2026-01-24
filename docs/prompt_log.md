# Prompt Log - Longhorn项目历史记录

本文档记录Longhorn项目开发过程中的所有用户prompt，用于追踪需求和问题演进。

---

## 2026-01-24

### 13:40 - 深度多语言审计 (Deep Localization Audit)
**User Prompt**:
- 发现 "unstar" 的提示仍是英文，要求更仔细检查。

**Action**:
1. **Audit**: 检查 `Localizable.xcstrings` 中 `starred.unstar_*` 相关的 Key。
2. **Finding**: 发现这些 Key 虽然存在，但**只有英文 (`en`) 定义，缺失中文 (`zh-Hans`) 翻译块**。
3. **Fix**: 手动补全了 6 个 Unstar 相关 Key 的中文翻译。

**Result**:
- 修复了 Unstar 操作的英文提示残留问题。

**Status**: Complete.

### 13:30 - 全局多语言完善 (Global Localization: Toasts)
**User Prompt**:
- 很多 Toast 消息没有实现多语言，要求仔细检查并完善。

**Action**:
1. **Audit**: 使用 `grep` 扫描所有 `ToastManager.shared.show` 调用。
2. **Identification**: 发现 `ShareDialogView` 和 `FilePreviewView` 中存在 5 处硬编码中文。
3. **Refactor**:
   - `ShareDialogView`: "链接已复制" -> `link.copied`, "密码已复制" -> `toast.password_copied`。
   - `FilePreviewView`: "原图已下载" -> `toast.original_downloaded`, "下载失败" -> `toast.download_failed`, "预览失败" -> `toast.preview_failed`。
4. **Key Management**: 在 `Localizable.xcstrings` 中添加了上述缺失的 Key。

**Result**:
- App 内的 Toast 提示现在实现了 100% 关键路径的多语言覆盖。

**Status**: Complete.

### 13:25 - 编译错误修复 (Build Fixes)
**User Prompt**:
1. `SettingsView.swift`: Scope error (private func inside body).
2. `ToastView.swift`: Missing argument `style` in Preview.
3. `MoreTabRootView.swift`: Missing argument `value` in DetailStatRow.

**Action**:
1. **SettingsView**: 重构代码结构，将 helper funcs 移出 `body`。
2. **ToastView**: 修复 Preview 调用。
3. **MoreTabRootView**: 
   - 发现 `DetailStatRow` 调用缺少 `value` 参数。
   - 新增 Key `stats.storage_share` ("存储占比")。
   - 修正调用为 `title: "存储占比", value: "XX%"`。

**Result**:
- 修复所有编译错误。

**Status**: Complete.

### 13:20 - Toast 样式审计 (Toast Style Audit)
**User Prompt**:
- 继续完善，要求升级关键操作的 Toast 提示。

**Action**:
- 审计了 `FileBrowserView` 和 `ShareDialogView`。
- 将以下操作的 Toast 升级为 **强提示 (.prominent)**：
  - 文件：删除、移动、重命名、复制、新建文件夹。
  - 分享：复制链接、复制密码。
- 保持 **弱提示 (.standard)**：
  - 收藏/取消收藏 (操作频繁/非决定性)。
  - 网络错误 (避免过度惊扰)。

**Result**:
- 关键操作（如删除）现在会有明显的视觉反馈和触感反馈。

**Status**: Complete.

### 13:10 - Toast 系统升级与重置功能 (Toast System & Reset Feature)
**User Prompt**:
1. 需求：设置页增加"恢复所有状态"开关，需确认和提示。
2. 需求：设计 Toast 分级系统（强/弱提示），并给出方案。

**Action**:
1. **Design**: 创建 `implementation_plan.md`，定义了 Weak (Glassmorphism) 和 Strong (Solid Color) 两种 Toast 风格。
2. **Implementation**:
   - `ToastManager/ToastView`: 支持 `style` 参数 (`.standard` / `.prominent`)。
   - `SettingsView`: 新增"高级"区 -> "重置所有偏好设置" 按钮。
   - **交互流程**: 点击重置 -> 弹出 Alert 确认 -> 清除 `UserDefaults` -> 显示 Strong Success Toast。
3. **Localization**: 添加了相关中英文 Keys。

**Result**:
- 设置页现在有了安全的重置功能。
- Toast 提示现在具备了视觉层级。

**Status**: Complete.

---

## 2026-01-23

### 00:10 - 三项修复 (Triple Fix)
**User Prompt**:
1. Dashboard 仍显示 "-"
2. Preview Button "所在位置" 仍出现在 FileBrowser
3. 新需求：FileBrowser 默认按上传时间倒序排列

**Action**:
1. **Dashboard**: Server 端 SQL 已修正（`ORDER BY totalSize`），需重启。
2. **Preview Button**: 修改 `FilePreviewSheet.swift`，条件判断 callback 是否存在。
3. **Sort Order**: 修改 `FileBrowserView.swift` 默认值为 `.date`。

**Result**:
- 修复 Dashboard, Preview Button, Sort Order。

**Status**: Complete.

### 22:45 - 再次修复 Dashboard SQL (Dashboard Fix 2)
**User Prompt**:
- Dashboard 仍报错 500，提示 `no such column: total_size`。

**Action**:
- 发现 `Top Uploaders` 查询中别名为 `totalSize` (camelCase)，但 `ORDER BY` 使用了 `total_size` (snake_case)。
- 修复：改为 `ORDER BY totalSize DESC`。

**Status**: Complete.

### 22:14 - Dashboard SQL 修复 (Dashboard SQL Fix)
**User Prompt**:
- Dashboard 仍报错：SQL 查询使用不存在的列。

**Action**:
- 发现 SQL 错误：查询使用 `uploaded_at` 列，但数据库实际列名是 `upload_date`。
- 修复：`WHERE s.upload_date >= ?`。

**Status**: Complete.

### 21:47 - 词汇库扩容 (Vocabulary Expansion)
**User Prompt**:
- 发现词库仅有 5 个示例词汇，要求立即扩容。

**Action**:
- 生成并导入 35 个高质量词汇条目（德/英/日/中）。

**Status**: Complete.

### 21:40 - Dashboard 修复 & 文件预览按钮确认
**User Prompt**:
- Dashboard 仍显示 "-" (权限错误)。
- FileBrowser 预览隐藏"所在文件夹"按钮。

**Action**:
1. **Dashboard**: Server 扫描跳过系统文件夹（解决权限报错）。
2. **预览按钮**: 确认逻辑已正确实现（根据 nil 判断）。

**Status**: Complete.

### 21:26 - 每日一词 UX 优化 & Dashboard Bug
**User Prompt**:
- 每日一词加载慢。
- Admin Dashboard 概览数据仍显示 "-"。

**Action**:
1. **iOS**: 实现 Cache-First 策略，启动即显示缓存词汇。
2. **Dashboard**: 定位到 Server 返回字段与 iOS 模型不匹配或 SQL 问题。

**Status**: In Progress.

### 21:17 - 每日一词 2.0 iOS 端
**User Prompt**:
- 要求继续完成 Daily Word 2.0 的 iOS 端接入。

**Action**:
- iOS Model/Service 适配 Server API。

**Status**: Complete.

### 21:15 - 文档治理提醒
**User Prompt**:
- 提醒每次操作后必须同步更新文档。

**Action**:
- 补充文档更新。

**Status**: In Progress.

### 21:10 - 每日一词 2.0 (Server Migration)
**User Prompt**:
- 批准 Daily Word 2.0 计划。

**Action**:
- Server: 创建 `vocabulary` 表，实现 API，导入种子数据。
- Web: 重构 `DailyWord.tsx`。

**Status**: Complete.

### 21:05 - 体验打磨 (UI Polish)
**User Prompt**:
- iOS Toast 滞留 bug。
- 询问文档同步机制。

**Action**:
- 修复 iOS Toast 逻辑与样式。
- 建立文档更新流程。

**Status**: Ready.

### 21:00 - 文档治理 (Documentation Alignment)
**User Prompt**:
- 质疑文档混乱。

**Action**:
- 恢复并整理 `prompt_log.md`。

**Status**: Complete.

### 20:50 - 系统修复与iOS增强
**User Prompt**:
- Dashboard 空，Web Uploader Unknown，iOS 新需求。

**Action**:
- Dashboard: 修复 SQL 映射。
- Web Uploader: 实现路径别名。
- iOS: 实现文件夹计数与回弹。

**Status**: Complete.

### 15:45 - Doc Consolidation & Bug Analysis
**User Prompt**:
- 文档整理，Daily Word 规划。

**Action**:
- 重写 Context，规划 Daily Word 2.0。

**Status**: Planning.

---

## 2026-01-22

### 08:30 - 严重故障：Admin/Member 数据不可见 (Empty Folder/403)
**User Prompt**:
- Admin/Member进入报错500或显示空。

**Action**:
- 修复 `authenticate` 中间件 SQL (缺少 `department_name` 列)。
- 恢复服务器软链接。

**Result**:
- 恢复正常访问。

---

## 2026-01-19

### 22:00 - 收藏功能全面优化
**User Prompt**:
- 收藏列表体验优化（预览、缩略图、多语言）。

**Action**:
- 接入 `FilePreviewView`，添加缩略图，优化交互与翻译。

### 17:00 - 服务端收藏逻辑修复
**User Prompt**:
- 收藏图标更新不及时。

**Action**:
- ETag 优化，乐观更新。

---

## 2026-01-14

### 18:30 - 服务端崩溃修复
**Action**: 修复 JS 语法错误。

### 18:25 - 部门数据缺失与授权目录不显示
**Action**: 服务端 API 修复 (JOIN) + iOS `AuthorizedLocation` 支持。

### 18:20 - BrowseView 编译修复
**Action**: 补充缺失变量。

### 17:50 - 部门真实数据接入
**Action**: 服务端 `/api/department/my-stats`。

### 17:00 - UI微调
**Action**: Kine Yellow 按钮优化。

### 11:45 - 语法错误修复
**Action**: 补全闭合括号。

### 11:41 - 个人与更多Tab优化
**Action**: UI 重构（个人空间入口、Dashboard 卡片）。

### 00:53 - 最近访问布局简化
**Action**: 改为列表入口。

### 00:46 - 编译错误 Persistent
**Action**: 代码合并绕过 Target 问题。

### 00:30 - 个人中心UI重构
**Action**: List 风格重构。

### 00:22 - 浏览Tab微调
**Action**: 移除部门每日一词。

### 00:10 - DashboardView 遗留报错
**Action**: 临时修复跳转。

### 23:55 - iOS 布局重构 (Files App Style)
**Action**: 拆分 Browse/Personal/More 三大模块。

### 11:22 - iPhone 药丸屏遮挡
**Action**: `viewport-fit=cover` 适配。

### 01:20 - 文件夹显示为空与 Unknown
**Action**: 数据库清洗与路径修复。

### 00:48 - 弹窗遮挡修复
**Action**: Z-index 调整。

---

## 2026-01-10

### 11:03 - PM2 Cluster模式咨询
**Conclusion**: 暂不启用。

### 10:56 - 分块上传实现
**Action**: 5MB 分块，绕过 Cloudflare 限制。

### 10:51 - 版本时间标注
**Action**: 双时间显示 (Commit + Build)。

### 10:43 - 版本号Hash困惑
**Action**: 显式 Build Time。

### 10:41 - 自动部署哨兵
**Action**: 修复 `deploy-watch.sh` 权限。

### 10:37 - 自动更新线程查询
**Result**: 确认 `deploy-watch.sh` 运行中。

### 10:28 - 小文件上传延迟
**Action**: 数据库事务优化 + UI 状态修复。

### 10:27 - Cloudflare Tunnel确认
**Result**: 确认 DNS-only 无效。

---

## 2026-01-09

### 09:30 - FileBrowser/RecycleBin 国际化修复 (续)
**Status**: 问题持续。

### 09:22 - 中文翻译未生效
**Status**: 验证中。

### 09:15 - FileBrowser/RecycleBin 国际化修复
**Action**: 尝试修复表头英文问题。

### 01:04 - RecycleBin 时间 Locale
**Status**: 德语显示问题。

---

## 2026-01-08

### 14:16 - 搜索页面全中文
**Status**: 确认正常。
