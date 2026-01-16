
import SwiftUI

struct TeamManagementView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var adminService = AdminService.shared
    @State private var searchText = ""
    
    var isAdmin: Bool {
        authManager.currentUser?.role == .admin
    }
    
    var isLead: Bool {
        authManager.currentUser?.role == .lead
    }
    
    var filteredUsers: [User] {
        let users = adminService.users
        
        // 1. Filter by Role/Dept
        let roleFiltered: [User]
        if isAdmin {
            roleFiltered = users
        } else if isLead {
            // Leads only see their own department
            let myDeptName = authManager.currentUser?.departmentName
            roleFiltered = users.filter { $0.departmentName == myDeptName }
        } else {
            roleFiltered = []
        }
        
        // 2. Filter by Search
        if searchText.isEmpty {
            return roleFiltered
        } else {
            return roleFiltered.filter { $0.username.localizedCaseInsensitiveContains(searchText) }
        }
    }
    
    var body: some View {
        List {
            if adminService.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity)
            } else {
                ForEach(filteredUsers) { user in
                    NavigationLink(destination: UserDetailView(user: user)) {
                        HStack {
                            ZStack {
                                Circle()
                                    .fill(Color.blue)
                                    .frame(width: 40, height: 40)
                                Text(String(user.username.prefix(1)).uppercased())
                                    .foregroundColor(.white)
                                    .fontWeight(.bold)
                            }
                            
                            VStack(alignment: .leading) {
                                Text(user.username)
                                    .font(.headline)
                                HStack {
                                    Text(user.departmentName ?? "未分配")
                                    Text("·")
                                    Text(user.role.rawValue)
                                }
                                .font(.caption)
                                .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .searchable(text: $searchText, prompt: "搜索用户")
        .navigationTitle("团队列表")
        .task {
            // Always fetch users on appear
            await adminService.fetchUsers()
        }
        .refreshable {
            await adminService.fetchUsers()
        }
    }
}
