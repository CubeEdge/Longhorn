# Longhorn iOS App 开发指南

**版本**: 1.0
**日期**: 2026-01-13
**适用对象**: iOS 开发者 / 维护者

---

## 1. 架构概览

本项目采用 **SwiftUI + MVVM** 架构，强调数据驱动 UI (Data-Driven UI) 原则。

*   **Views (视图)**: 纯 SwiftUI 构建，负责 UI 渲染。
*   **ViewModels (视图模型)**: (如 `FileBrowserView` 内嵌逻辑) 管理状态。
*   **Services (服务)**: 单例模式，负责底层逻辑 (API, 缓存, 认证)。
    *   `APIClient`: 网络请求核心 (REST).
    *   `AuthManager`: JWT 令牌管理 (Keychain).
    *   `FileCacheManager`: 文件列表缓存 (Actor).
    *   `PreviewCacheManager`: 预览文件持久化缓存 (Codable Index).

---

## 2. 核心机制设计

### 2.1 预览与缓存机制 (Preview & Caching)

为了对齐 Web 端的流畅体验，我们针对 iOS 实现了以下特制机制：

| 特性 | Web 端实现 | iOS 端实现 | 设计思考 |
|:---|:---|:---|:---|
| **列表刷新** | 5秒轮询 (SWR Hook) | **前台5秒轮询 (.task 循环)** | 消除"手机端数据滞后"的刻板印象。 |
| **删除同步** | 轮询发现文件消失 -> 移除 DOM | **轮询差异对比 (Diff)** -> 自动清理缓存 | 避免用户点击已删除的"幽灵文件"。 |
| **预览持久化** | 浏览器缓存 (Disk Cache) | **PreviewCacheManager + index.json** | 重启 App 后预览缓存依然有效，节省流量，提升秒开率。 |
| **HEIC 支持** | 浏览器原生支持有限 | **Native AsyncImage** | 原生渲染，支持高性能缩放/回弹。 |

### 2.2 竞态条件防护 (Race Condition Protection)

在 `FileBrowserView` 中，我们严格遵循**数据优先**原则：
*   ❌ **禁止**: 使用 `Bool` 状态 (`$showPreview`) 控制全屏弹窗。
*   ✅ **必须**: 使用 `Date/Item` 状态 (`$previewFile`) 控制全屏弹窗。
    *   `fullScreenCover(item: $previewFile)` 确保了只有当数据存在时，UI 才会构建，彻底解决了“黑屏”问题。

---

## 3. 关键模块详解

### 3.1 预览缓存管理器 (`PreviewCacheManager`)
*   **位置**: `Services/PreviewCacheManager.swift`
*   **策略**: LRU (Least Recently Used)，上限 500MB。
*   **持久化**: 通过 `index.json` 记录文件名与原始路径映射。App 启动时异步加载索引，不再清空缓存。

### 3.2 列表轮询 (`loadFiles`)
*   **位置**: `FileBrowserView.swift`
*   **逻辑**: 
    1. 首次进入显示 Loading Spinner。
    2. 之后每 5 秒发起 `forceRefresh: true` 请求，但标记 `silent: true` (不显示 Spinner)。
    3. 获取新列表后，计算 `Old - New` 差集，调用 `PreviewCacheManager.invalidate` 清理已被他人删除的文件的缓存。

---

## 4. 调试指南

### 4.1 常见问题
*   **预览黑屏**:
    *   检查是否使用了 `item:` 绑定而非 `isPresented:`。
    *   检查服务端是否正确返回 `Content-Type: image/jpeg` (对于 HEIC 转换后的流)。
*   **缩略图失效**:
    *   服务器必须安装 `ffmpeg` (处理视频) 和 `sips` (处理 HEIC)。
    *   检查服务器日志 `server/index.js` 中的 `[Thumbnail]` 输出。

---

## 5. 打包与发布
*   **Bundle ID**: `com.kinefinity.LonghornApp`
*   **签名**: Automatic Signing (需配置 Team)
*   **最低版本**: iOS 16.0
