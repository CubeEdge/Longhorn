
import Foundation
import Combine

class AdminService: ObservableObject {
    static let shared = AdminService()
    
    @Published var users: [User] = []
    @Published var departments: [Department] = []
    @Published var isLoading = false
    @Published var error: String?
    
    private init() {}
    
    // MARK: - Fetch Data
    
    @MainActor
    func fetchUsers() async {
        isLoading = true
        error = nil
        
        do {
            let fetchedUsers: [User] = try await APIClient.shared.get("/api/admin/users")
            self.users = fetchedUsers.sorted { $0.id < $1.id }
        } catch {
            self.error = "Failed to fetch users: \(error.localizedDescription)"
        }
        
        isLoading = false
    }
    
    @MainActor
    func fetchDepartments() async {
        do {
            let fetchedDepts: [Department] = try await APIClient.shared.get("/api/admin/departments")
            self.departments = fetchedDepts
        } catch {
            print("Failed to fetch departments: \(error)")
        }
    }
    
    @MainActor
    func fetchSystemStats() async throws -> SystemStats {
        return try await APIClient.shared.get("/api/admin/stats")
    }
    
    // MARK: - User Operations
    
    @MainActor
    func fetchPermissions(for userId: Int) async throws -> [Permission] {
        return try await APIClient.shared.get("/api/admin/users/\(userId)/permissions")
    }
    
    @MainActor
    func deletePermission(id: Int) async throws {
        try await APIClient.shared.delete("/api/admin/permissions/\(id)")
    }
    
    @MainActor
    func updateUser(id: Int, username: String, role: UserRole, departmentId: Int?, password: String?) async throws {
        let body = UpdateUserRequest(
            username: username,
            role: role.rawValue,
            department_id: departmentId,
            password: (password?.isEmpty == false) ? password : nil
        )
        
        try await APIClient.shared.put("/api/admin/users/\(id)", body: body)
        // Refresh list
        await fetchUsers()
    }
    
    @MainActor
    func grantPermission(userId: Int, folderPath: String, accessType: AccessType, expiresAt: String?) async throws {
        // Create request body using Codable struct
        
        // POST /api/admin/users/:id/permissions
        try await APIClient.shared.post("/api/admin/users/\(userId)/permissions", body: GrantPermissionRequest(
            folder_path: folderPath,
            access_type: accessType.rawValue,
            expires_at: expiresAt
        ))
        
        // Refresh list if needed (caller usually refreshes permissions)
    }
    @MainActor
    func fetchFiles(path: String) async throws -> [FileItem] {
        let encodedPath = path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let response: FileListResponse = try await APIClient.shared.get("/api/files?path=\(encodedPath)")
        return response.items.filter { $0.isDirectory && !$0.name.hasPrefix(".") }
    }
}

struct FileListResponse: Codable {
    let items: [FileItem]
}

struct SystemStats: Codable {
    let todayStats: PeriodStats
    let weekStats: PeriodStats
    let monthStats: PeriodStats
    let storage: StorageStats
    let topUploaders: [UploaderStats]
    let totalFiles: Int
}

struct PeriodStats: Codable {
    let count: Int
    let size: Int64
}

struct StorageStats: Codable {
    let used: Int64
    let total: Int64
    let percentage: Int
}

struct UploaderStats: Codable {
    let username: String
    let fileCount: Int
    let totalSize: Int64
}

private struct UpdateUserRequest: Encodable {
    let username: String
    let role: String
    let department_id: Int?
    let password: String?
}

private struct GrantPermissionRequest: Encodable {
    let folder_path: String
    let access_type: String
    let expires_at: String?
}
