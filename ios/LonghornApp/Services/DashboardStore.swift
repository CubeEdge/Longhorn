//
//  DashboardStore.swift
//  LonghornApp
//
//  Created for efficient dashboard stats caching
//

import SwiftUI
import Combine

@MainActor
class DashboardStore: ObservableObject {
    static let shared = DashboardStore()
    
    // User stats cache
    @Published var userStats: UserStats?
    @Published var userStatsLoading = true
    private var userStatsLastUpdated: Date?
    
    // System stats cache (admin only)
    @Published var systemStats: SystemStats?
    @Published var systemStatsLoading = true
    private var systemStatsLastUpdated: Date?
    
    // Department stats cache
    @Published var deptStats: DepartmentOverviewStats?
    @Published var deptStatsLoading = true
    private var deptStatsLastUpdated: Date?
    
    private let cacheValidityDuration: TimeInterval = 300 // 5分钟
    
    private init() {}
    
    // MARK: - User Stats
    
    func loadUserStatsIfNeeded() async {
        // 如果有缓存且未过期，直接返回
        if let last = userStatsLastUpdated,
           Date().timeIntervalSince(last) < cacheValidityDuration,
           userStats != nil {
            return
        }
        
        await refreshUserStats()
    }
    
    func refreshUserStats() async {
        if userStats == nil {
            userStatsLoading = true
        }
        
        do {
            let stats: UserStats = try await APIClient.shared.get("/api/user/stats")
            self.userStats = stats
            self.userStatsLastUpdated = Date()
        } catch {
            print("DashboardStore: Failed to load user stats: \(error)")
        }
        
        userStatsLoading = false
    }
    
    // MARK: - System Stats (Admin)
    
    func loadSystemStatsIfNeeded() async {
        if let last = systemStatsLastUpdated,
           Date().timeIntervalSince(last) < cacheValidityDuration,
           systemStats != nil {
            return
        }
        
        await refreshSystemStats()
    }
    
    func refreshSystemStats() async {
        if systemStats == nil {
            systemStatsLoading = true
        }
        
        do {
            let stats = try await AdminService.shared.fetchSystemStats()
            self.systemStats = stats
            self.systemStatsLastUpdated = Date()
        } catch {
            print("DashboardStore: Failed to load system stats: \(error)")
        }
        
        systemStatsLoading = false
    }
    
    // MARK: - Department Stats
    
    func loadDeptStatsIfNeeded() async {
        if let last = deptStatsLastUpdated,
           Date().timeIntervalSince(last) < cacheValidityDuration,
           deptStats != nil {
            return
        }
        
        await refreshDeptStats()
    }
    
    func refreshDeptStats() async {
        if deptStats == nil {
            deptStatsLoading = true
        }
        
        do {
            let stats = try await FileService.shared.fetchDepartmentStats()
            self.deptStats = stats
            self.deptStatsLastUpdated = Date()
        } catch {
            print("DashboardStore: Failed to load dept stats: \(error)")
        }
        
        deptStatsLoading = false
    }
    
    // MARK: - Clear Cache
    
    func clearAll() {
        userStats = nil
        systemStats = nil
        deptStats = nil
        userStatsLastUpdated = nil
        systemStatsLastUpdated = nil
        deptStatsLastUpdated = nil
    }
}
