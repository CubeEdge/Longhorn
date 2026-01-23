# 产品待办事项 & 路线图 (Product Backlog & Roadmap)

**概述**: 本文档跟踪 Kinefinity Longhorn 项目的高级功能、已知 Bug 和产品路线图。这是“计划”与“构建”的单一事实来源。

## 🚀 当前冲刺 (Active Sprint - Current Focus)

### [Feature] iOS 相册式交互 (iOS Photos-like Interactions)
- **状态**: ✅ 已完成 (Completed)
- **描述**: 在文件预览中增加下拉关闭、上拉查看详情、左右滑动切换文件的功能。
- **验证**: 也就是在 iOS 模拟器上验证通过。手势交互独立且流畅。

### [Bug] `RecentFilesListView.swift` 编译错误
- **状态**: ✅ 已修复 (Fixed)
- **描述**: 修复了 `onGoToLocation` 闭包签名不匹配的问题。

---

## 📋 待办事项 (Backlog - To Do)

### [Feature] 每日一词 2.0 (Daily Word Upgrade)
- **优先级**: 中 (Medium)
- **需求**: 
    1. **扩容**: 每个语种 (中/英/德/日) 词库扩充至 100+ 词汇。
    2. **交互**: 每次打开 App 或刷新时，强制从词库中随机抽取新词 (Smart Refresh)。
    3. **架构**: 从前端硬编码 (Client-Side) 迁移至后端 API `/api/vocabulary` (Server-Side)，以支持动态更新和轻量化前端。
- **状态**: ✅ 已完成 (Server/Web) | ⏳ iOS 待接入

### [Feature] 全局 Toast 多语言支持
- **优先级**: 低 (Low)
- **描述**: 确保每一个弹出的 Toast 消息都已本地化（部分后端返回的消息可能仍是硬编码）。

### [Bug] Admin 上传者显示为 "Unknown"
- **状态**: ✅ 已修复 (Fixed)
- **描述**: 网页端文件列表显示 "Unknown" 上传者。
- **修复**: 后端实现路径别名匹配 (Code <-> Name)，解决 App 与 Web 路径格式不一致问题。

---

## 🐛 问题追踪 (Bug Tracker - Known Issues)

### [UI] 部门浏览器空状态 (Department Browser Empty State)
- **状态**: Open (需持续监控)

---

## ✅ 已完成 (History)

- [x] **Web Uploader 修复**: 实现后端路径智能匹配。
- [x] **Dashboard 修复**: 修复 API 字段映射。
- [x] **iOS 交互增强**: 文件夹预览数量显示 + 滑动边界回弹提示。
- [x] **iOS App 重构**: 重构为 `FilePreviewSheet` (Pager) + `FilePreviewItemView` 结构。
- [x] **权限修复**: 修复了 Orange 用户在 "运营部" (OP) 的 403 错误。
- [x] **本地化**: 增加了 德语/日语 的基础支持。

---

## 📝 产品笔记 & 决策 (Product Notes & Decisions)

- **UI 风格**: Kinefinity 黄色 + 毛玻璃拟态 (Glassmorphism)。
- **平台**: iOS (SwiftUI) + Web (React) + Node.js (Express)。
- **部署**: Mac mini (M1) + PM2 + Cloudflare Tunnel。
