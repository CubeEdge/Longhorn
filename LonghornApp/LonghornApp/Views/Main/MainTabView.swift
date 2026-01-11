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
    
    @State private var selectedTab: Tab = .departments
    @State private var departments: [Department] = []
    @State private var selectedDepartment: Department?
    @State private var columnVisibility = NavigationSplitViewVisibility.all
    
    // 路径记忆
    @AppStorage("lastVisitedPath") private var lastVisitedPath: String = ""
    @AppStorage("lastDepartmentCode") private var lastDepartmentCode: String = ""
    
    enum Tab: Hashable {
        case departments  // 部门（第一位）
        case personal
        case starred
        case more
    }
    
    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                // iPad: 使用 NavigationSplitView
                iPadLayout
            } else {
                // iPhone: 使用 TabView
                iPhoneLayout
            }
        }
        .task {
            await loadDepartments()
        }
    }
    
    // MARK: - iPad 布局
    
    private var iPadLayout: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(
                departments: departments,
                selectedDepartment: $selectedDepartment
            )
            .navigationTitle("Longhorn")
        } detail: {
            if let dept = selectedDepartment {
                FileBrowserView(path: dept.code, searchScope: .department(dept.code))
            } else {
                ContentUnavailableView(
                    "选择一个目录",
                    systemImage: "folder",
                    description: Text("从左侧边栏选择要浏览的目录")
                )
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
    
    // MARK: - iPhone 布局
    
    private var iPhoneLayout: some View {
        TabView(selection: $selectedTab) {
            // 部门（文件浏览）- 第一个 Tab
            NavigationStack {
                DepartmentBrowserView(
                    departments: departments,
                    userDepartment: authManager.currentUser?.departmentName,
                    lastDepartmentCode: lastDepartmentCode,
                    onPathChange: { path in
                        lastVisitedPath = path
                        if let code = path.components(separatedBy: "/").first {
                            lastDepartmentCode = code
                        }
                    }
                )
            }
            .tabItem {
                Label("部门", systemImage: "building.2.fill")
            }
            .tag(Tab.departments)
            
            // 个人空间
            NavigationStack {
                FileBrowserView(path: "Members/\(authManager.currentUser?.username ?? "")", searchScope: .personal)
                    .navigationTitle("个人空间")
            }
            .tabItem {
                Label("个人", systemImage: "person.fill")
            }
            .tag(Tab.personal)
            
            // 收藏
            NavigationStack {
                StarredView()
            }
            .tabItem {
                Label("收藏", systemImage: "star.fill")
            }
            .tag(Tab.starred)
            
            // 更多
            NavigationStack {
                MoreMenuView()
            }
            .tabItem {
                Label("更多", systemImage: "ellipsis")
            }
            .tag(Tab.more)
        }
        .tint(Color(red: 1.0, green: 0.82, blue: 0.0)) // 品牌色
    }
    
    // MARK: - 方法
    
    private func loadDepartments() async {
        print("[MainTabView] Loading departments...")
        do {
            departments = try await FileService.shared.getAccessibleDepartments()
            print("[MainTabView] Loaded \(departments.count) departments: \(departments.map { $0.name })")
            
            // 自动选择上次访问的部门或用户所属部门
            if selectedDepartment == nil {
                // 优先使用上次访问的部门
                if !lastDepartmentCode.isEmpty,
                   let lastDept = departments.first(where: { $0.code == lastDepartmentCode }) {
                    selectedDepartment = lastDept
                }
                // 其次使用用户所属部门
                else if let userDeptName = authManager.currentUser?.departmentName,
                        let userDept = departments.first(where: { $0.name == userDeptName || $0.code == userDeptName }) {
                    selectedDepartment = userDept
                }
                // 最后使用第一个部门
                else if let first = departments.first {
                    selectedDepartment = first
                }
            }
        } catch {
            print("[MainTabView] Failed to load departments: \(error)")
            // 如果列表为空，显示错误
            if departments.isEmpty {
                // 忽略取消错误
                let nsError = error as NSError
                if nsError.domain != NSURLErrorDomain || nsError.code != NSURLErrorCancelled {
                    // 暂时不用 @State 显示，因为这会影响 UI 结构，直接打印更显眼的错误
                    print("❌ 部门加载失败: \(error.localizedDescription)")
                    
                    // 如果是认证错误，强制登出
                    if let apiError = error as? APIError, case .unauthorized = apiError {
                         AuthManager.shared.logout()
                    }
                }
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
                            Text(dept.displayName)
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
        .navigationTitle("部门")
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
                    SharesView()
                } label: {
                    Label("我的分享", systemImage: "square.and.arrow.up")
                }
                
                NavigationLink {
                    RecycleBinView()
                } label: {
                    Label("回收站", systemImage: "trash")
                }
                
                NavigationLink {
                    GlobalSearchView()
                } label: {
                    Label("全局搜索", systemImage: "magnifyingglass")
                }
            }
            
            // 设置
            Section {
                NavigationLink {
                    SettingsView()
                } label: {
                    Label("设置", systemImage: "gearshape.fill")
                }
            }
            
            // 登出
            Section {
                Button(role: .destructive) {
                    authManager.logout()
                } label: {
                    Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                }
            }
        }
        .navigationTitle("更多")
    }
    
    private func roleText(_ role: UserRole) -> String {
        switch role {
        case .admin: return "管理员"
        case .lead: return "部门负责人"
        case .member: return "成员"
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

struct SettingsView: View {
    @State private var serverURL = APIClient.shared.baseURL
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        Form {
            Section("服务器") {
                TextField("服务器地址", text: $serverURL)
                    .textContentType(.URL)
                    .autocapitalization(.none)
                    .onSubmit {
                        APIClient.shared.baseURL = serverURL
                    }
            }
            
            Section("关于") {
                HStack {
                    Text("版本")
                    Spacer()
                    Text("1.0.0")
                        .foregroundColor(.secondary)
                }
            }
        }
        .navigationTitle("设置")
    }
}

#Preview {
    MainTabView()
        .environmentObject(AuthManager.shared)
}
