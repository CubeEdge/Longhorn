# 产品待办事项 & 路线图

**概述**: 本文档跟踪 Kinefinity Longhorn 项目的高级功能、已知 Bug 和产品路线图。这是"计划"与"构建"的单一事实来源。

## 🚀 当前冲刺

### [Feature] Daily Word 刷新机制
- **优先级**: 高
- **描述**: 
  - **启动策略**: 每次冷启动检查本地词库是否满足 100 个，并尝试静默更新。
  - **手动刷新**: 在 UI 上提供强制刷新入口（如下拉刷新或设置按钮），触发 API 立即拉取新词。
  - **进度反馈**: 显示 "Updating vocabulary..." 等非阻塞 Toast。
- **状态**: ✅ 已完成 (v1.1)

---

## 📋 待办事项

### [Feature] 全局多语言完善
- **优先级**: 低
- **描述**: 
  - 个人中心 Dashboard 仍有英文（"Upload", "Storage", "Starred"）
  - 部分 Toast 消息可能仍是硬编码
  - 统一处理所有 UI 文本的本地化
- **状态**: ✅ 已完成 (v1.1)

---

## 🐛 问题追踪

### [UI] 部门浏览器空状态
- **状态**: Open (需持续监控)

---

## ✅ 已完成 (历史记录)

- [x] **每日一词内容扩容**: 已达成单库 100+ (德/英/日/中, 总计 423)。
- [x] **每日一词 2.0**: Server API (`/api/vocabulary/random`) + Web/iOS 客户端迁移完成。
- [x] **每日一词 UX 优化**: iOS Cache-First 加载，启动即显示。
- [x] **Dashboard Permission Bug**: Server 跳过系统文件夹，修复 Admin 仪表盘 500 错误。
- [x] **文件预览按钮逻辑**: FileBrowser 预览隐藏"所在文件夹"，其他场景显示（已实现）。
- [x] **Admin Uploader Bug**: 后端路径别名匹配修复，解决 Web 端 Unknown 上传者问题。
- [x] **iOS 相册式交互**: 下拉关闭、左右滑动切换、滑动边界回弹 Toast。
- [x] **iOS 编译错误修复**: `RecentFilesListView.swift` 闭包签名修复。
- [x] **Web Uploader 修复**: 实现后端路径智能匹配。
- [x] **Dashboard 修复**: 修复 API 字段映射。
- [x] **iOS 交互增强**: 文件夹预览数量显示 + 滑动边界回弹提示。
- [x] **iOS App 重构**: 重构为 `FilePreviewSheet` (Pager) + `FilePreviewItemView` 结构。
- [x] **权限修复**: 修复了 Orange 用户在 "运营部" (OP) 的 403 错误。
- [x] **本地化**: 增加了 德语/日语 的基础支持。
- [x] **全局多语言完善**: Dashboard (Admin/Personal) 完成中文化，支持 key 缺失时的自动 fallback。
- [x] **Toast 系统升级**: 实现分级 (Weak/Strong) 提示系统，关键操作增加触感反馈。

---

## 📝 产品笔记 & 决策

- **UI 风格**: Kinefinity 黄色 + 毛玻璃拟态 (Glassmorphism)。
- **平台**: iOS (SwiftUI) + Web (React) + Node.js (Express)。
- **部署**: Mac mini (M1) + PM2 + Cloudflare Tunnel。
