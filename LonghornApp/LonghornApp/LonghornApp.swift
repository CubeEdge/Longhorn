//
//  LonghornApp.swift
//  LonghornApp
//
//  Longhorn 企业文件管理系统 iOS 客户端
//  Created for Kinefinity
//

import SwiftUI

@main
struct LonghornApp: App {
    @StateObject private var authManager = AuthManager.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(authManager)
                .preferredColorScheme(.dark) // 深色模式优先
        }
    }
}
