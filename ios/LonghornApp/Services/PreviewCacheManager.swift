//
//  PreviewCacheManager.swift
//  LonghornApp
//
//  预览文件缓存管理器 - 避免重复下载相同文件
//

import Foundation

actor PreviewCacheManager {
    static let shared = PreviewCacheManager()
    
    private struct CachedPreview {
        let localURL: URL
        let originalPath: String
        let cachedAt: Date
        let fileSize: Int64
    }
    
    private var cache: [String: CachedPreview] = [:]
    private let cacheDir: URL
    private let maxCacheSize: Int64 = 500 * 1024 * 1024 // 500MB
    private let maxAge: TimeInterval = 24 * 60 * 60 // 24小时
    
    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        cacheDir = caches.appendingPathComponent("PreviewCache", isDirectory: true)
        
        // 创建缓存目录
        try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        
        // 启动时清理过期缓存
        Task {
            await cleanupExpired()
        }
    }
    
    /// 获取缓存的预览URL（如果存在且未过期）
    func getCachedURL(for path: String) -> URL? {
        guard let cached = cache[path] else { return nil }
        
        // 检查是否过期
        if Date().timeIntervalSince(cached.cachedAt) > maxAge {
            // 过期，删除缓存
            try? FileManager.default.removeItem(at: cached.localURL)
            cache.removeValue(forKey: path)
            return nil
        }
        
        // 检查文件是否存在
        guard FileManager.default.fileExists(atPath: cached.localURL.path) else {
            cache.removeValue(forKey: path)
            return nil
        }
        
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
            
            cache[path] = CachedPreview(
                localURL: destURL,
                originalPath: path,
                cachedAt: Date(),
                fileSize: fileSize
            )
            
            // 检查总缓存大小
            Task {
                await enforceMaxSize()
            }
        } catch {
            print("[PreviewCache] Failed to cache: \(error)")
        }
    }
    
    /// 清理过期缓存
    func cleanupExpired() {
        let now = Date()
        var keysToRemove: [String] = []
        
        for (key, cached) in cache {
            if now.timeIntervalSince(cached.cachedAt) > maxAge {
                try? FileManager.default.removeItem(at: cached.localURL)
                keysToRemove.append(key)
            }
        }
        
        for key in keysToRemove {
            cache.removeValue(forKey: key)
        }
    }
    
    /// 强制缓存大小限制
    private func enforceMaxSize() {
        var totalSize: Int64 = 0
        for (_, cached) in cache {
            totalSize += cached.fileSize
        }
        
        if totalSize > maxCacheSize {
            // 按时间排序，删除最旧的
            let sorted = cache.sorted { $0.value.cachedAt < $1.value.cachedAt }
            
            for (key, cached) in sorted {
                try? FileManager.default.removeItem(at: cached.localURL)
                cache.removeValue(forKey: key)
                totalSize -= cached.fileSize
                
                if totalSize <= maxCacheSize * 7 / 10 { // 降到70%
                    break
                }
            }
        }
    }
    
    /// 使特定路径的缓存失效
    func invalidate(path: String) {
        if let cached = cache[path] {
            try? FileManager.default.removeItem(at: cached.localURL)
            cache.removeValue(forKey: path)
        }
    }
    
    /// 清空所有缓存
    func clearAll() {
        for (_, cached) in cache {
            try? FileManager.default.removeItem(at: cached.localURL)
        }
        cache.removeAll()
    }
}
