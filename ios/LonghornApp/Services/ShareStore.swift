//
//  ShareStore.swift
//  LonghornApp
//
//  Created for persisting shares data across tab switches
//

import SwiftUI
import Combine

@MainActor
class ShareStore: ObservableObject {
    static let shared = ShareStore()
    
    @Published var shares: [ShareLink] = []
    @Published var collections: [ShareCollection] = []
    @Published var isFirstLoad: Bool = true
    @Published var errorMessage: String?
    
    // 缓存有效期（例如 5 分钟）
    private var lastUpdated: Date?
    private let cacheValidityDuration: TimeInterval = 300
    
    private init() {}
    
    /// 加载数据：如果缓存有效则不请求，否则后台刷新
    func loadDataIfNeeded() async {
        // 如果数据为空，强制加载
        if shares.isEmpty && collections.isEmpty {
            await refreshData(showLoading: true)
            return
        }
        
        // 检查缓存有效期
        if let lastUpdated = lastUpdated, Date().timeIntervalSince(lastUpdated) < cacheValidityDuration {
            // 缓存有效，无需操作
            return
        }
        
        // 缓存过期，静默刷新
        await refreshData(showLoading: false)
    }
    
    /// 强制刷新数据
    func refreshData(showLoading: Bool = false) async {
        if showLoading {
            // 只有首次加载且无数据时才重置 isFirstLoad，避免 UI 跳动
            if shares.isEmpty && collections.isEmpty {
                isFirstLoad = true
            }
        }
        
        do {
            async let sharesTask = ShareService.shared.getMyShares()
            async let collectionsTask = ShareService.shared.getMyCollections()
            
            let (newShares, newCollections) = try await (sharesTask, collectionsTask)
            
            self.shares = newShares
            self.collections = newCollections
            self.errorMessage = nil
            self.lastUpdated = Date()
            
            if showLoading {
                self.isFirstLoad = false
            }
        } catch is CancellationError {
            // 忽略取消
        } catch {
            print("ShareStore: load failed: \(error)")
            if shares.isEmpty && collections.isEmpty {
                self.errorMessage = error.localizedDescription
            }
            if showLoading {
                self.isFirstLoad = false
            }
        }
    }
    
    // MARK: - 操作方法
    
    func deleteShare(_ id: Int) async throws {
        // 乐观更新
        let originalShares = shares
        shares.removeAll { $0.id == id }
        
        do {
            try await ShareService.shared.deleteShare(id: id)
        } catch {
            // 回滚
            shares = originalShares
            throw error
        }
    }
    
    func deleteCollection(_ id: Int) async throws {
        // 乐观更新
        let originalCollections = collections
        collections.removeAll { $0.id == id }
        
        do {
            try await ShareService.shared.deleteCollection(id: id)
        } catch {
            // 回滚
            collections = originalCollections
            throw error
        }
    }
}
