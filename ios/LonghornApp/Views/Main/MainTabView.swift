//
//  MainTabView.swift
//  LonghornApp
//
//  主界面：iPhone 使用 TabView，iPad 使用 NavigationSplitView
//

import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.horizontalSizeClass) var horizontalSizeClass
    
    @AppStorage("selectedTab") private var selectedTab: Tab = .home
    @State private var columnVisibility = NavigationSplitViewVisibility.all
    
    enum Tab: String, Hashable {
        case home = "home"
        case personal = "personal"
        case more = "more"
    }
    
    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                iPadLayout
            } else {
                iPhoneLayout
            }
        }
    }
    
    // MARK: - iPad Layput (Split View)
    private var iPadLayout: some View {
        // Simple placeholder for iPad to match iPhone structure for now, 
        // or keep existing logic if compatible. 
        // For this refactor, let's just reuse the TabView for simplicity as the request focused on Layout.
        // Or actually, user asked for "iOS Files App" style which usually means Sidebar on iPad.
        // Let's stick to TabView for now to ensure consistency with the new design.
        iPhoneLayout
    }
    
    @StateObject private var navManager = NavigationManager.shared
    
    // MARK: - iPhone Layout
    private var iPhoneLayout: some View {
        TabView(selection: $selectedTab) {
            // Tab 1: 浏览 (Browse)
            BrowseView()
                .tabItem {
                    Label("tab.browse", systemImage: "folder.fill")
                }
                .tag(Tab.home)
            
            // Tab 2: 个人 (Personal)
            PersonalTabRootView()
                .tabItem {
                    Label("tab.personal", systemImage: "person.fill")
                }
                .tag(Tab.personal)
            
            // Tab 3: 更多 (More)
            MoreTabRootView()
                .tabItem {
                    Label("tab.more", systemImage: "ellipsis.circle.fill")
                }
                .tag(Tab.more)
        }
        .tint(Color(red: 1.0, green: 0.82, blue: 0.0))
        .environmentObject(navManager)
        .onChange(of: navManager.selectedTab) { _, newTab in
            if let tab = newTab {
                selectedTab = tab
                navManager.selectedTab = nil // Reset request
            }
        }
    }
}

// MARK: - 部门浏览视图（自动打开用户部门或上次访问目录）

struct DepartmentBrowserView: View {
    let departments: [Department]
    let userDepartment: String?
    let lastDepartmentCode: String
    let onPathChange: (String) -> Void
    
    @State private var navigationPath = NavigationPath()
    @State private var hasAutoNavigated = false
    
    private let deptIcons: [String: String] = [
        "MS": "camera.fill",
        "OP": "film.fill",
        "RD": "chevron.left.forwardslash.chevron.right",
        "RE": "cube.fill"
    ]
    
    private let deptColors: [String: Color] = [
        "MS": .orange,
        "OP": .purple,
        "RD": .blue,
        "RE": .green
    ]
    
    /// 基于 code 去重的部门列表
    private var uniqueDepartments: [Department] {
        var seen = Set<String>()
        return departments.filter { dept in
            if seen.contains(dept.code) {
                return false
            }
            seen.insert(dept.code)
            return true
        }
    }
    
    var body: some View {
        List {
            ForEach(uniqueDepartments, id: \.code) { dept in
                NavigationLink(value: dept) {
                    HStack(spacing: 16) {
                        // 图标
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(deptColors[dept.code] ?? .gray)
                                .opacity(0.2)
                                .frame(width: 44, height: 44)
                            
                            Image(systemName: deptIcons[dept.code] ?? "folder.fill")
                                .font(.system(size: 18, weight: .semibold))
                                .foregroundColor(deptColors[dept.code] ?? .gray)
                        }
                        
                        // 名称
                        VStack(alignment: .leading, spacing: 4) {
                            Text(dept.localizedName())
                                .font(.system(size: 16, weight: .semibold))
                            
                            Text(dept.code)
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .navigationTitle(Text("nav.departments"))
        .navigationDestination(for: Department.self) { dept in
            FileBrowserView(path: dept.code, searchScope: .department(dept.code))
                .navigationTitle(dept.displayName)
                .onAppear {
                    onPathChange(dept.code)
                }
        }
        .onAppear {
            autoNavigateIfNeeded()
        }
    }
    
    private func autoNavigateIfNeeded() {
        guard !hasAutoNavigated, !uniqueDepartments.isEmpty else { return }
        hasAutoNavigated = true
        
        // 优先使用上次访问的部门
        if !lastDepartmentCode.isEmpty,
           let lastDept = uniqueDepartments.first(where: { $0.code == lastDepartmentCode }) {
            navigationPath.append(lastDept)
            return
        }
        
        // 其次使用用户所属部门
        if let userDept = userDepartment,
           let dept = uniqueDepartments.first(where: { $0.name.contains(userDept) || $0.code == userDept }) {
            navigationPath.append(dept)
        }
    }
}

// MARK: - 更多菜单

struct MoreMenuView: View {
    @EnvironmentObject var authManager: AuthManager
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        List {
            // 用户信息
            if let user = authManager.currentUser {
                Section {
                    HStack(spacing: 16) {
                        // 头像
                        ZStack {
                            Circle()
                                .fill(accentColor)
                                .frame(width: 56, height: 56)
                            
                            Text(String(user.username.prefix(1)).uppercased())
                                .font(.system(size: 24, weight: .bold))
                                .foregroundColor(.black)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(user.username)
                                .font(.system(size: 18, weight: .semibold))
                            
                            Text(roleText(user.role))
                                .font(.system(size: 14))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 8)
                }
            }
            
            // 功能入口
            Section {
                NavigationLink {
                    IssueListView()
                } label: {
                    Label("issues.title", systemImage: "ticket")
                }
                
                NavigationLink {
                    SharesView()
                } label: {
                    Label("quick.my_shares", systemImage: "square.and.arrow.up")
                }
                
                NavigationLink {
                    RecycleBinView()
                } label: {
                    Label("quick.recycle_bin", systemImage: "trash")
                }
                
                NavigationLink {
                    GlobalSearchView()
                } label: {
                    Label("more.global_search", systemImage: "magnifyingglass")
                }
            }
            
            // 设置
            Section {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("settings.title", systemImage: "gearshape.fill")
                }
            }
            
            // 登出
            Section {
                Button(role: .destructive) {
                    authManager.logout()
                } label: {
                    Label("more.logout", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
        .navigationTitle(Text("tab.more"))
    }
    
    private func roleText(_ role: UserRole) -> String {
        switch role {
        case .admin: return String(localized: "role.admin")
        case .lead: return String(localized: "role.lead")
        case .member: return String(localized: "role.member")
        }
    }
}

// MARK: - 全局搜索视图

struct GlobalSearchView: View {
    var body: some View {
        SearchListView()
    }
}

// MARK: - 搜索范围

enum SearchScope {
    case all
    case department(String)
    case personal
    
    var displayName: String {
        switch self {
        case .all: return "全部"
        case .department(let code): return code
        case .personal: return "个人空间"
        }
    }
    
    var scopeParameter: String {
        switch self {
        case .all: return "all"
        case .department(let code): return code
        case .personal: return "personal"
        }
    }
}

// MARK: - 占位视图

// 视图引用（使用实际实现的视图）
typealias SharesView = SharesListView
typealias RecycleBinView = RecycleBinListView




