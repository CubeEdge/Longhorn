//
//  PreviewCacheManager.swift
//  LonghornApp
//
//  预览文件缓存管理器 - 基于大小限制的LRU缓存，无时间过期
//

import Foundation

actor PreviewCacheManager {
    static let shared = PreviewCacheManager()
    
    private struct CachedPreview {
        let localURL: URL
        let originalPath: String
        let cachedAt: Date       // 用于LRU排序
        var lastAccessedAt: Date // 用于LRU排序（访问时更新）
        let fileSize: Int64
    }
    
    private var cache: [String: CachedPreview] = [:]
    private let cacheDir: URL
    private let maxCacheSize: Int64 = 500 * 1024 * 1024 // 500MB总大小限制
    
    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        cacheDir = caches.appendingPathComponent("PreviewCache", isDirectory: true)
        
        // 创建缓存目录
        try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        
        // 启动时重建缓存索引
        Task {
            await rebuildCacheIndex()
        }
    }
    
    /// 获取缓存的预览URL（如果存在）
    func getCachedURL(for path: String) -> URL? {
        guard var cached = cache[path] else { return nil }
        
        // 检查文件是否存在
        guard FileManager.default.fileExists(atPath: cached.localURL.path) else {
            cache.removeValue(forKey: path)
            return nil
        }
        
        // 更新最后访问时间（用于LRU）
        cached.lastAccessedAt = Date()
        cache[path] = cached
        
        return cached.localURL
    }
    
    /// 缓存预览文件
    func cache(url: URL, for path: String) {
        let fileName = (path as NSString).lastPathComponent
        let destURL = cacheDir.appendingPathComponent("\(UUID().uuidString)_\(fileName)")
        
        do {
            // 复制文件到缓存目录
            try FileManager.default.copyItem(at: url, to: destURL)
            
            let attrs = try FileManager.default.attributesOfItem(atPath: destURL.path)
            let fileSize = attrs[.size] as? Int64 ?? 0
            
            let now = Date()
            cache[path] = CachedPreview(
                localURL: destURL,
                originalPath: path,
                cachedAt: now,
                lastAccessedAt: now,
                fileSize: fileSize
            )
            
            // 检查总缓存大小，超限则清理
            enforceMaxSize()
        } catch {
            print("[PreviewCache] Failed to cache: \(error)")
        }
    }
    
    /// 强制缓存大小限制（LRU驱逐）
    private func enforceMaxSize() {
        var totalSize: Int64 = 0
        for (_, cached) in cache {
            totalSize += cached.fileSize
        }
        
        if totalSize > maxCacheSize {
            // 按最后访问时间排序（LRU），删除最久未使用的
            let sorted = cache.sorted { $0.value.lastAccessedAt < $1.value.lastAccessedAt }
            
            for (key, cached) in sorted {
                try? FileManager.default.removeItem(at: cached.localURL)
                cache.removeValue(forKey: key)
                totalSize -= cached.fileSize
                
                // 降到80%以下
                if totalSize <= maxCacheSize * 8 / 10 {
                    break
                }
            }
        }
    }
    
    /// 使特定路径的缓存失效（文件被删除/移动/重命名时调用）
    func invalidate(path: String) {
        if let cached = cache[path] {
            try? FileManager.default.removeItem(at: cached.localURL)
            cache.removeValue(forKey: path)
        }
    }
    
    /// 使多个路径的缓存失效
    func invalidate(paths: [String]) {
        for path in paths {
            invalidate(path: path)
        }
    }
    
    /// 使某个目录下所有文件的缓存失效（文件夹被删除/移动时调用）
    func invalidateDirectory(path: String) {
        let prefix = path.hasSuffix("/") ? path : path + "/"
        var keysToRemove: [String] = []
        
        for (key, cached) in cache {
            if key.hasPrefix(prefix) || key == path {
                try? FileManager.default.removeItem(at: cached.localURL)
                keysToRemove.append(key)
            }
        }
        
        for key in keysToRemove {
            cache.removeValue(forKey: key)
        }
    }
    
    /// 清空所有缓存
    func clearAll() {
        for (_, cached) in cache {
            try? FileManager.default.removeItem(at: cached.localURL)
        }
        cache.removeAll()
    }
    
    /// 重建缓存索引（启动时调用，恢复磁盘上的缓存文件）
    private func rebuildCacheIndex() {
        guard let contents = try? FileManager.default.contentsOfDirectory(
            at: cacheDir,
            includingPropertiesForKeys: [.fileSizeKey, .creationDateKey]
        ) else { return }
        
        // 清理所有旧缓存（启动时无法恢复路径映射）
        for file in contents {
            try? FileManager.default.removeItem(at: file)
        }
    }
    
    /// 获取当前缓存大小
    func getCacheSize() -> Int64 {
        var totalSize: Int64 = 0
        for (_, cached) in cache {
            totalSize += cached.fileSize
        }
        return totalSize
    }
    
    /// 获取缓存文件数量
    func getCacheCount() -> Int {
        return cache.count
    }
}
