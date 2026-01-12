//
//  FileCacheManager.swift
//  LonghornApp
//
//  文件缓存管理器 - 实现 stale-while-revalidate 模式
//

import Foundation

/// 缓存的目录列表
struct CachedDirectoryListing {
    let files: [FileItem]
    let timestamp: Date
    let path: String
    
    /// 缓存是否过期(5分钟)
    var isStale: Bool {
        Date().timeIntervalSince(timestamp) > 300 // 5 minutes
    }
    
    /// 缓存是否完全过期(30分钟后强制刷新)
    var isExpired: Bool {
        Date().timeIntervalSince(timestamp) > 1800 // 30 minutes
    }
}

/// 文件缓存管理器
/// 实现类似 SWR 的 stale-while-revalidate 模式
actor FileCacheManager {
    static let shared = FileCacheManager()
    
    /// 目录列表缓存
    private var directoryCache: [String: CachedDirectoryListing] = [:]
    
    /// 正在加载的目录(防止重复请求)
    private var loadingPaths: Set<String> = []
    
    /// 预取队列
    private var prefetchQueue: [String] = []
    
    private init() {}
    
    // MARK: - 公共接口
    
    /// 获取缓存的目录列表(如果有)
    func getCached(path: String) -> [FileItem]? {
        guard let cached = directoryCache[path] else { return nil }
        // 完全过期则不返回
        if cached.isExpired { return nil }
        return cached.files
    }
    
    /// 缓存是否需要刷新
    func needsRefresh(path: String) -> Bool {
        guard let cached = directoryCache[path] else { return true }
        return cached.isStale
    }
    
    /// 保存目录列表到缓存
    func cache(files: [FileItem], for path: String) {
        directoryCache[path] = CachedDirectoryListing(
            files: files,
            timestamp: Date(),
            path: path
        )
    }
    
    /// 使缓存失效
    func invalidate(path: String) {
        directoryCache.removeValue(forKey: path)
    }
    
    /// 使所有缓存失效
    func invalidateAll() {
        directoryCache.removeAll()
    }
    
    /// 清理过期缓存
    func cleanupExpired() {
        directoryCache = directoryCache.filter { !$0.value.isExpired }
    }
    
    // MARK: - 加载状态管理
    
    /// 标记路径正在加载
    func markLoading(_ path: String) -> Bool {
        if loadingPaths.contains(path) {
            return false // 已经在加载
        }
        loadingPaths.insert(path)
        return true
    }
    
    /// 取消加载标记
    func markFinished(_ path: String) {
        loadingPaths.remove(path)
    }
    
    // MARK: - 预取
    
    /// 预取子目录
    func prefetch(paths: [String]) async {
        for path in paths {
            // 跳过已缓存且未过期的
            if let cached = directoryCache[path], !cached.isStale {
                continue
            }
            
            // 避免重复请求
            guard markLoading(path) else { continue }
            
            do {
                let files = try await FileService.shared.getFiles(path: path)
                cache(files: files, for: path)
            } catch {
                // 预取失败静默处理
                print("[Cache] Prefetch failed for \(path): \(error)")
            }
            
            markFinished(path)
        }
    }
    
    /// 预取直接子目录
    func prefetchSubdirectories(of path: String, files: [FileItem]) async {
        let subdirs = files
            .filter { $0.isDirectory }
            .prefix(5) // 最多预取5个子目录
            .map { $0.path }
        
        await prefetch(paths: Array(subdirs))
    }
}

// MARK: - FileService 缓存扩展

extension FileService {
    /// 获取文件列表(带缓存)
    func getFilesWithCache(path: String, forceRefresh: Bool = false) async throws -> (files: [FileItem], fromCache: Bool) {
        let cache = FileCacheManager.shared
        
        // 1. 尝试获取缓存
        if !forceRefresh, let cached = await cache.getCached(path: path) {
            // 返回缓存数据，同时检查是否需要后台刷新
            let needsRefresh = await cache.needsRefresh(path: path)
            
            if needsRefresh {
                // 后台刷新(不阻塞)
                Task.detached {
                    guard await cache.markLoading(path) else { return }
                    defer { Task { await cache.markFinished(path) } }
                    
                    if let freshFiles = try? await FileService.shared.getFiles(path: path) {
                        await cache.cache(files: freshFiles, for: path)
                    }
                }
            }
            
            return (cached, true)
        }
        
        // 2. 没有缓存或强制刷新，请求新数据
        guard await cache.markLoading(path) else {
            // 正在加载，等待一下再试从缓存读取
            try await Task.sleep(nanoseconds: 100_000_000) // 100ms
            if let cached = await cache.getCached(path: path) {
                return (cached, true)
            }
            throw APIError.serverError(0, "Loading in progress")
        }
        
        defer { Task { await cache.markFinished(path) } }
        
        let files = try await getFiles(path: path)
        await cache.cache(files: files, for: path)
        
        // 3. 预取子目录
        Task.detached {
            await cache.prefetchSubdirectories(of: path, files: files)
        }
        
        return (files, false)
    }
}
