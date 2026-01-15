
import SwiftUI

struct UserDetailView: View {
    @State var user: User
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var adminService = AdminService.shared
    
    @State private var permissions: [Permission] = []
    @State private var isEditing = false
    @State private var editUsername = ""
    @State private var editRole: UserRole = .member
    @State private var editDeptId: Int?
    @State private var newPassword = ""
    
    // For feedback
    @State private var showingError = false
    @State private var errorMessage = ""
    
    var isAdmin: Bool {
        authManager.currentUser?.role == .admin
    }
    
    var body: some View {
        Form {
            // Section 1: Basic Info
            Section(header: Text("基本信息")) {
                HStack {
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.blue)
                            .frame(width: 60, height: 60)
                        Text(String(user.username.prefix(1)).uppercased())
                            .font(.title)
                            .foregroundColor(.white)
                            .fontWeight(.bold)
                    }
                    
                    VStack(alignment: .leading, spacing: 4) {
                        if isEditing {
                            TextField("用户名", text: $editUsername)
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                        } else {
                            Text(user.username)
                                .font(.title2)
                                .fontWeight(.bold)
                        }
                        
                        Text("ID: \(user.id)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .padding(.vertical, 8)
                
                if isEditing {
                    Picker("角色", selection: $editRole) {
                        Text("Admin").tag(UserRole.admin)
                        Text("Lead").tag(UserRole.lead)
                        Text("Member").tag(UserRole.member)
                    }
                    
                    Picker("部门", selection: $editDeptId) {
                        Text("未分配").tag(Optional<Int>.none)
                        ForEach(adminService.departments) { dept in
                            Text(dept.displayName).tag(Optional(dept.id ?? 0))
                        }
                    }
                    
                    SecureField("重置密码 (留空则不修改)", text: $newPassword)
                } else {
                    HStack {
                        Text("角色")
                        Spacer()
                        Text(user.role.rawValue)
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("部门")
                        Spacer()
                        Text(user.departmentName ?? "未分配")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("入职时间")
                        Spacer()
                        Text(user.createdAt?.prefix(10) ?? "未知")
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            // Section 2: Edit Actions (Admin Only)
            if isAdmin {
                Section {
                    if isEditing {
                        Button(action: saveChanges) {
                            HStack {
                                Spacer()
                                Text("保存修改")
                                    .fontWeight(.bold)
                                Spacer()
                            }
                        }
                        
                        Button(action: { isEditing = false }) {
                            HStack {
                                Spacer()
                                Text("取消")
                                    .foregroundColor(.red)
                                Spacer()
                            }
                        }
                    } else {
                        Button("编辑账户") {
                            startEditing()
                        }
                    }
                }
            }
            
            // Section 3: Permissions
            Section(header: Text("特殊权限")) {
                if permissions.isEmpty {
                    Text("无额外权限")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(permissions) { perm in
                        HStack {
                            Image(systemName: "folder")
                                .foregroundColor(.blue)
                            
                            VStack(alignment: .leading) {
                                Text(perm.folderPath)
                                    .font(.subheadline)
                                Text(perm.accessType.rawValue)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            if isAdmin {
                                Button(action: {
                                    deletePermission(perm)
                                }) {
                                    Image(systemName: "trash")
                                        .foregroundColor(.red)
                                }
                                .buttonStyle(BorderlessButtonStyle())
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(user.username)
        .onAppear {
            loadPermissions()
            Task {
                await adminService.fetchDepartments()
            }
        }
        .alert(isPresented: $showingError) {
            Alert(title: Text("错误"), message: Text(errorMessage), dismissButton: .default(Text("确定")))
        }
    }
    
    private func startEditing() {
        editUsername = user.username
        editRole = user.role
        editDeptId = user.departmentId
        newPassword = ""
        isEditing = true
    }
    
    private func saveChanges() {
        Task {
            do {
                try await adminService.updateUser(
                    id: user.id,
                    username: editUsername,
                    role: editRole,
                    departmentId: editDeptId,
                    password: newPassword
                )
                
                // Update local user object
                isEditing = false
                // Ideally trigger a refresh
            } catch {
                errorMessage = error.localizedDescription
                showingError = true
            }
        }
    }
    
    private func loadPermissions() {
        Task {
            do {
                permissions = try await adminService.fetchPermissions(for: user.id)
            } catch {
                print("Failed to load permissions: \(error)")
            }
        }
    }
    
    private func deletePermission(_ perm: Permission) {
        Task {
            do {
                try await adminService.deletePermission(id: perm.id)
                loadPermissions() // Reload
            } catch {
                errorMessage = "撤销失败: \(error.localizedDescription)"
                showingError = true
            }
        }
    }
}
