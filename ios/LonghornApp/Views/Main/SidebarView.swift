//
//  SidebarView.swift
//  LonghornApp
//
//  iPad 侧边栏
//

import SwiftUI

struct SidebarView: View {
    let departments: [Department]
    @Binding var selectedDepartment: Department?
    
    @EnvironmentObject var authManager: AuthManager
    @State private var selectedItem: SidebarItem? = .starred
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    private let deptIcons: [String: String] = [
        "MS": "camera.fill",
        "OP": "film.fill",
        "RD": "chevron.left.forwardslash.chevron.right",
        "RE": "cube.fill"
    ]
    
    enum SidebarItem: Hashable {
        case starred
        case shares
        case personal
        case department(Department)
        case recycleBin
        case settings
    }
    
    var body: some View {
        List(selection: $selectedItem) {
            // 快速访问
            Section("快速访问") {
                Label("收藏", systemImage: "star.fill")
                    .tag(SidebarItem.starred)
                
                Label("我的分享", systemImage: "square.and.arrow.up")
                    .tag(SidebarItem.shares)
            }
            
            // 个人空间
            Section("空间") {
                Label("个人空间", systemImage: "person.fill")
                    .tag(SidebarItem.personal)
            }
            
            // 部门
            Section("部门") {
                ForEach(departments) { dept in
                    Label {
                        Text(dept.name)
                    } icon: {
                        Image(systemName: deptIcons[dept.code] ?? "folder.fill")
                    }
                    .tag(SidebarItem.department(dept))
                }
            }
            
            // 工具
            Section {
                Label("回收站", systemImage: "trash")
                    .tag(SidebarItem.recycleBin)
                
                Label("设置", systemImage: "gearshape.fill")
                    .tag(SidebarItem.settings)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("Longhorn")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    if let user = authManager.currentUser {
                        Section {
                            Text(user.username)
                            Text(roleText(user.role))
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Divider()
                    
                    Button(role: .destructive) {
                        authManager.logout()
                    } label: {
                        Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } label: {
                    if let user = authManager.currentUser {
                        ZStack {
                            Circle()
                                .fill(accentColor)
                                .frame(width: 32, height: 32)
                            
                            Text(String(user.username.prefix(1)).uppercased())
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(.black)
                        }
                    }
                }
            }
        }
        .onChange(of: selectedItem) { _, newValue in
            handleSelection(newValue)
        }
    }
    
    private func handleSelection(_ item: SidebarItem?) {
        switch item {
        case .department(let dept):
            selectedDepartment = dept
        default:
            break
        }
    }
    
    private func roleText(_ role: UserRole) -> String {
        switch role {
        case .admin: return "管理员"
        case .lead: return "部门负责人"
        case .member: return "成员"
        }
    }
}

#Preview {
    NavigationSplitView {
        SidebarView(
            departments: [
                Department(id: 1, name: "市场部 (MS)"),
                Department(id: 2, name: "运营部 (OP)")
            ],
            selectedDepartment: .constant(nil)
        )
        .environmentObject(AuthManager.shared)
    } detail: {
        Text("Detail")
    }
}
