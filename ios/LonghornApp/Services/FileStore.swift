//
//  FileStore.swift
//  LonghornApp
//
//  Created for efficient file browsing caching
//

import SwiftUI
import Combine

@MainActor
class FileStore: ObservableObject {
    static let shared = FileStore()
    
    // 缓存结构：路径 -> 文件列表
    @Published var cache: [String: [FileItem]] = [:]
    
    // 记录每个路径的首次加载状态
    @Published var loadingStates: [String: Bool] = [:]
    
    // 记录每个路径的最后更新时间
    private var lastUpdated: [String: Date] = [:]
    private let cacheValidityDuration: TimeInterval = 300 // 5分钟
    
    // 当前正在加载的路径（避免重复请求）
    private var activeRequests: Set<String> = []
    
    private init() {}
    
    // MARK: - API
    
    /// 获取指定路径的文件
    func getFiles(for path: String) -> [FileItem] {
        return cache[path] ?? []
    }
    
    /// 检查指定路径是否正在加载（首次）
    func isFirstLoad(for path: String) -> Bool {
        // 如果没有数据且从未加载过，并在 loadingStates 中未标记为 false
        if cache[path] == nil && (loadingStates[path] == nil || loadingStates[path] == true) {
            return true
        }
        return false
    }
    
    /// 智能加载数据
    func loadFilesIfNeeded(path: String) async {
        // 1. 如果有缓存且未过期，直接返回
        if let last = lastUpdated[path], 
           Date().timeIntervalSince(last) < cacheValidityDuration,
           !cache[path, default: []].isEmpty {
            return
        }
        
        // 2. 防止重复请求
        guard !activeRequests.contains(path) else { return }
        
        // 3. 开始加载
        await refreshFiles(path: path, silent: false)
    }
    
    /// 强制刷新（下拉刷新）
    func refreshFiles(path: String, silent: Bool = false) async {
        activeRequests.insert(path)
        
        // 如果不是静默刷新且无缓存，标记为正在加载
        if !silent && cache[path] == nil {
            loadingStates[path] = true
        }
        
        do {
            let (files, _) = try await FileService.shared.getFilesWithCache(path: path, forceRefresh: true)
            
            self.cache[path] = files
            self.lastUpdated[path] = Date()
            self.loadingStates[path] = false
            self.activeRequests.remove(path)
            
        } catch {
            print("FileStore: load failed for \(path): \(error)")
            self.activeRequests.remove(path)
            self.loadingStates[path] = false
            // 注意：这里不清除旧缓存，保证离线可用性
        }
    }
    
    // MARK: - 操作同步
    
    /// 清除所有缓存（例如退出登录时）
    func clearAll() {
        cache.removeAll()
        lastUpdated.removeAll()
        loadingStates.removeAll()
    }
    
    /// 乐观更新：删除文件
    func deleteFile(_ file: FileItem, in path: String) {
        if var files = cache[path] {
            files.removeAll { $0.path == file.path }
            cache[path] = files
        }
    }
    
    /// 乐观更新：重命名文件
    func renameFile(_ oldPath: String, to newName: String, parentPath: String) {
        if var files = cache[parentPath], let index = files.firstIndex(where: { $0.path == oldPath }) {
            var file = files[index]
            file.name = newName
            // 注意：path 也需要更新，这里简化处理，实际可能需要重新构建 path
            files[index] = file
            cache[parentPath] = files
        }
    }
}
