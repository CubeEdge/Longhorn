//
//  PreviewCacheManager.swift
//  LonghornApp
//
//  预览文件缓存管理器 - 基于大小限制的LRU缓存，无时间过期
//

import Foundation

actor PreviewCacheManager {
    static let shared = PreviewCacheManager()
    
    private struct CachedPreview: Codable {
        let filename: String     // Store filename relative to cacheDir
        let originalPath: String
        let cachedAt: Date
        var lastAccessedAt: Date
        let fileSize: Int64
    }
    
    private var cache: [String: CachedPreview] = [:]
    private let cacheDir: URL
    private let indexURL: URL
    private let maxCacheSize: Int64 = 500 * 1024 * 1024 // 500MB
    
    private init() {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        cacheDir = caches.appendingPathComponent("PreviewCache", isDirectory: true)
        indexURL = cacheDir.appendingPathComponent("index.json")
        
        // Ensure cache directory exists
        try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        
        // Load index asynchronously
        Task {
            await loadCacheIndex()
            await cleanupOrphans() // Clean files not in index
        }
    }
    
    // MARK: - Persistence
    
    private func saveCacheIndex() {
        do {
            let data = try JSONEncoder().encode(cache)
            try data.write(to: indexURL, options: .atomic)
        } catch {
            print("[PreviewCache] Failed to save index: \(error)")
        }
    }
    
    private func loadCacheIndex() {
        do {
            guard FileManager.default.fileExists(atPath: indexURL.path) else { return }
            let data = try Data(contentsOf: indexURL)
            cache = try JSONDecoder().decode([String: CachedPreview].self, from: data)
            print("[PreviewCache] Restored index with \(cache.count) items")
        } catch {
            print("[PreviewCache] Failed to load index: \(error)")
            // If index is corrupt, clear everything to be safe
            clearAll()
        }
    }
    
    private func cleanupOrphans() {
        // Remove files in cacheDir that are not in the index (except index.json itself)
        guard let files = try? FileManager.default.contentsOfDirectory(at: cacheDir, includingPropertiesForKeys: nil) else { return }
        
        let validFilenames = Set(cache.values.map { $0.filename })
        
        for fileURL in files {
            let filename = fileURL.lastPathComponent
            if filename == "index.json" { continue }
            
            if !validFilenames.contains(filename) {
                try? FileManager.default.removeItem(at: fileURL)
                print("[PreviewCache] Removed orphan file: \(filename)")
            }
        }
    }
    
    // MARK: - Public API
    
    func getCachedURL(for path: String) -> URL? {
        guard var cached = cache[path] else { return nil }
        
        let fileURL = cacheDir.appendingPathComponent(cached.filename)
        
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            cache.removeValue(forKey: path)
            saveCacheIndex()
            return nil
        }
        
        // Update access time & save
        cached.lastAccessedAt = Date()
        cache[path] = cached
        saveCacheIndex()
        
        return fileURL
    }
    
    func cache(url: URL, for path: String) {
        let ext = (path as NSString).pathExtension
        let uniqueName = "\(UUID().uuidString).\(ext)" // Use random name to avoid collisions
        let destURL = cacheDir.appendingPathComponent(uniqueName)
        
        do {
            if FileManager.default.fileExists(atPath: destURL.path) {
                try FileManager.default.removeItem(at: destURL)
            }
            try FileManager.default.copyItem(at: url, to: destURL)
            
            let attrs = try FileManager.default.attributesOfItem(atPath: destURL.path)
            let fileSize = attrs[.size] as? Int64 ?? 0
            
            let now = Date()
            cache[path] = CachedPreview(
                filename: uniqueName,
                originalPath: path,
                cachedAt: now,
                lastAccessedAt: now,
                fileSize: fileSize
            )
            
            saveCacheIndex()
            enforceMaxSize()
        } catch {
            print("[PreviewCache] Failed to cache: \(error)")
        }
    }
    
    // MARK: - Maintenance
    
    private func enforceMaxSize() {
        var totalSize: Int64 = cache.values.reduce(0) { $0 + $1.fileSize }
        
        if totalSize > maxCacheSize {
            // Sort by LRU (Oldest Accessed First)
            let sorted = cache.sorted { $0.value.lastAccessedAt < $1.value.lastAccessedAt }
            
            for (key, cached) in sorted {
                let fileURL = cacheDir.appendingPathComponent(cached.filename)
                try? FileManager.default.removeItem(at: fileURL)
                cache.removeValue(forKey: key)
                totalSize -= cached.fileSize
                
                if totalSize <= maxCacheSize * 8 / 10 { // Flush down to 80%
                    break
                }
            }
            saveCacheIndex()
        }
    }
    
    func invalidate(path: String) {
        if let cached = cache[path] {
            let fileURL = cacheDir.appendingPathComponent(cached.filename)
            try? FileManager.default.removeItem(at: fileURL)
            cache.removeValue(forKey: path)
            saveCacheIndex()
        }
    }
    
    func invalidate(paths: [String]) {
        for path in paths {
            if let cached = cache[path] {
                let fileURL = cacheDir.appendingPathComponent(cached.filename)
                try? FileManager.default.removeItem(at: fileURL)
                cache.removeValue(forKey: path)
            }
        }
        saveCacheIndex()
    }
    
    func invalidateDirectory(path: String) {
        let prefix = path.hasSuffix("/") ? path : path + "/"
        let keysToRemove = cache.keys.filter { $0.hasPrefix(prefix) || $0 == path }
        
        for key in keysToRemove {
            if let cached = cache[key] {
                let fileURL = cacheDir.appendingPathComponent(cached.filename)
                try? FileManager.default.removeItem(at: fileURL)
                cache.removeValue(forKey: key)
            }
        }
        if !keysToRemove.isEmpty {
            saveCacheIndex()
        }
    }
    
    func clearAll() {
        try? FileManager.default.removeItem(at: cacheDir)
        try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
        cache.removeAll()
        // No need to save index, it's gone
    }
    
    func getCacheSize() -> Int64 {
        return cache.values.reduce(0) { $0 + $1.fileSize }
    }
    
    func getCacheCount() -> Int {
        return cache.count
    }
}
