//
//  AppNotifications.swift
//  LonghornApp
//
//  统一的应用内事件通知定义
//

import Foundation

extension Notification.Name {
    // MARK: - 文件操作事件
    
    /// 文件被收藏/取消收藏
    static let starredDidChange = Notification.Name("starredDidChange")
    
    /// 文件被删除
    static let filesDidDelete = Notification.Name("filesDidDelete")
    
    /// 文件被上传
    static let filesDidUpload = Notification.Name("filesDidUpload")
    
    /// 文件夹被创建
    static let folderDidCreate = Notification.Name("folderDidCreate")
    
    /// 文件被重命名
    static let fileDidRename = Notification.Name("fileDidRename")
    
    /// 文件被移动
    static let fileDidMove = Notification.Name("fileDidMove")
    
    // MARK: - 分享事件
    
    /// 分享链接被创建/删除/修改
    static let sharesDidChange = Notification.Name("sharesDidChange")
    
    // MARK: - 用户事件
    
    /// 用户登出
    static let userDidLogout = Notification.Name("userDidLogout")
    
    /// 用户统计数据变化
    static let userStatsDidChange = Notification.Name("userStatsDidChange")
}

// MARK: - 通知事件发布辅助

struct AppEvents {
    
    /// 发布收藏变更事件
    static func notifyStarredChanged(path: String? = nil) {
        NotificationCenter.default.post(
            name: .starredDidChange,
            object: nil,
            userInfo: path != nil ? ["path": path!] : nil
        )
    }
    
    /// 发布文件删除事件
    static func notifyFilesDeleted(paths: [String]) {
        NotificationCenter.default.post(
            name: .filesDidDelete,
            object: nil,
            userInfo: ["paths": paths]
        )
    }
    
    /// 发布文件上传事件
    static func notifyFilesUploaded(parentPath: String) {
        NotificationCenter.default.post(
            name: .filesDidUpload,
            object: nil,
            userInfo: ["parentPath": parentPath]
        )
    }
    
    /// 发布分享变更事件
    static func notifySharesChanged() {
        NotificationCenter.default.post(name: .sharesDidChange, object: nil)
    }
    
    /// 发布登出事件
    static func notifyUserLogout() {
        NotificationCenter.default.post(name: .userDidLogout, object: nil)
    }
}
