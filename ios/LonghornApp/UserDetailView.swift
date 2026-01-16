
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
    
    var isLead: Bool {
        authManager.currentUser?.role == .lead
    }
    
    var canManagePermissions: Bool {
        isAdmin || isLead
    }
    
    var body: some View {
        Form {
            // Section 1: Basic Info
            basicInfoSection

            
            // Section 2: Permissions
            permissionsSection
        }
        .navigationTitle(user.username)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                if isAdmin {
                    if isEditing {
                        Button("action.save") {
                            saveChanges()
                        }
                        .fontWeight(.bold)
                    } else {
                        Button("action.edit") {
                            startEditing()
                        }
                    }
                }
            }
            
            if isEditing {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("action.cancel") {
                        isEditing = false
                    }
                    .foregroundColor(.red)
                }
            }
        }
        .onAppear {
            loadPermissions()
            Task {
                await adminService.fetchDepartments()
            }
        }
        .sheet(isPresented: $showGrantSheet) {
            GrantPermissionSheet(user: user, isPresented: $showGrantSheet, onGrant: {
                loadPermissions()
            })
        }
        .alert(isPresented: $showingError) {
            Alert(title: Text("alert.error"), message: Text(errorMessage), dismissButton: .default(Text("action.confirm")))
        }
    }
    
    @State private var showGrantSheet = false

    private var basicInfoSection: some View {
        Section(header: Text("user.basic_info")) {
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
                        TextField("user.username", text: $editUsername)
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
                Picker("user.role", selection: $editRole) {
                    Text(UserRole.admin.localizedName).tag(UserRole.admin)
                    Text(UserRole.lead.localizedName).tag(UserRole.lead)
                    Text(UserRole.member.localizedName).tag(UserRole.member)
                }
                
                Picker("user.department", selection: $editDeptId) {
                    Text("user.dept_unassigned").tag(Optional<Int>.none)
                    ForEach(adminService.departments) { dept in
                        Text(dept.displayName).tag(Optional(dept.id ?? 0))
                    }
                }
                
                SecureField("user.reset_password_placeholder", text: $newPassword)
            } else {
                HStack {
                    Text("user.role")
                    Spacer()
                    Text(user.role.localizedName)
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("user.department")
                    Spacer()
                    Text(Department(id: nil, name: user.departmentName ?? "").localizedName())
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("user.created_at")
                    Spacer()
                    Text(user.createdAt?.prefix(10) ?? "Unknown")
                        .foregroundColor(.secondary)
                }
            }
        }
    }

    private var permissionsSection: some View {
        Section(header: Text("user.permissions")) {
            if permissions.isEmpty {
                HStack {
                    Image(systemName: "lock.circle")
                        .font(.title2)
                        .foregroundColor(.secondary)
                    Text("user.no_permissions")
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .padding(.vertical, 4)
            } else {
                ForEach(permissions) { perm in
                    PermissionRowView(
                        permission: perm,
                        canManage: canManagePermissions,
                        onDelete: { deletePermission(perm) }
                    )
                }
            }
            
            // Add Authorization Button
            if canManagePermissions {
                Button(action: { showGrantSheet = true }) {
                    HStack {
                        Image(systemName: "folder.badge.plus")
                        Text("user.add_permission")
                            .font(.body)
                        Spacer()
                    }
                    .foregroundColor(Color(red: 1.0, green: 0.82, blue: 0.0))
                }
            }
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

struct PermissionRowView: View {
    let permission: Permission
    let canManage: Bool
    let onDelete: () -> Void
    
    private var permissionLabel: String {
        switch permission.accessType {
        case .read: return String(localized: "permission.read")
        case .contribute: return String(localized: "permission.contribute")
        case .full: return String(localized: "permission.full")
        }
    }
    private var expiryLabel: String {
        if let expiresAt = permission.expiresAt {
            return String(expiresAt.prefix(10))
        }
        return String(localized: "permission.expiry.forever")
    }
    
    var body: some View {
        HStack {
            NavigationLink(destination: FileBrowserView(path: permission.folderPath)) {
                HStack {
                    Image(systemName: "folder.fill")
                        .foregroundColor(.blue)
                    
                    VStack(alignment: .leading) {
                        Text(permission.folderPath)
                            .font(.subheadline)
                        
                        Text("\(permissionLabel) · \(expiryLabel)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            if canManage {
                Button(action: onDelete) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                }
                .buttonStyle(BorderlessButtonStyle())
            }
        }
    }
}
