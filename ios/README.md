# 📱 Longhorn iOS App

Longhorn 的移动端实现，基于 SwiftUI 开发。

## 开发环境
- **Xcode**: 15.0+
- **iOS**: 16.0+
- **语言**: Swift 5.9

## 项目结构
- `LonghornApp/Models`: 数据模型 (FileItem, User 等)
- `LonghornApp/Views`: UI 界面 (FileBrowser, PreviewSheet 等)
- `LonghornApp/Services`: 网络请求与逻辑 (APIClient, FileCacheManager 等)

## 主要实现
- **SwiftUI + Actor**: 现代化的并发处理。
- **自定义预览**: 使用 `FilePreviewSheet` 完美对齐网页端体验。
- **智能缓存**: `FileCacheManager` 实现后台刷新与预取的 SWR 模式。

## 配置与运行
1. 使用 Xcode 打开 `LonghornApp.xcodeproj`。
2. 确保模拟器或真机能访问服务器地址 (默认配置在 `APIClient.swift` 中)。
3. Command + R 运行。

---
*注：目前已完成 P0 (核心体验) 和 P1 (功能完整) 的对齐工作。*
