# 产品待办事项 & 路线图 (Product Backlog & Roadmap)

**概述**: 本文档跟踪 Kinefinity Longhorn 项目的高级功能、已知 Bug 和产品路线图。这是"计划"与"构建"的单一事实来源。

## 🚀 当前冲刺 (Active Sprint - Current Focus)

*(暂无活跃任务)*

---

## 📋 待办事项 (Backlog - To Do)

### [Bug] iOS Admin Dashboard 数据显示为 "-"
- **优先级**: 高 (High)
- **描述**: Admin 用户在 iOS "概览" 中看到的系统统计数据为 "-"，疑似 JSON 解析失败。
- **状态**: 调查中 (Under Investigation)

### [Feature] 文件预览"所在文件夹"按钮显示逻辑
- **优先级**: 中 (Medium)
- **描述**: 
  - FileBrowser 预览时：隐藏"所在文件夹"按钮（已在当前文件夹）
  - 收藏/分享/最近文件 预览时：显示"所在文件夹"按钮（需要导航）
- **状态**: 待开发 (Backlog)

### [Feature] 全局 Toast 多语言支持
- **优先级**: 低 (Low)
- **描述**: 确保每一个弹出的 Toast 消息都已本地化（部分后端返回的消息可能仍是硬编码）。

---

## 🐛 问题追踪 (Bug Tracker - Known Issues)

### [UI] 部门浏览器空状态 (Department Browser Empty State)
- **状态**: Open (需持续监控)

---

## ✅ 已完成 (History)

- [x] **每日一词 2.0**: Server API (`/api/vocabulary/random`) + Web/iOS 客户端迁移完成。
- [x] **Admin Uploader Bug**: 后端路径别名匹配修复，解决 Web 端 Unknown 上传者问题。
- [x] **iOS 相册式交互**: 下拉关闭、左右滑动切换、滑动边界回弹 Toast。
- [x] **iOS 编译错误修复**: `RecentFilesListView.swift` 闭包签名修复。
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
