
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
        var body: [String: Any] = [
            "username": username,
            "role": role.rawValue,
            "department_id": departmentId as Any
        ]
        
        if let password = password, !password.isEmpty {
            body["password"] = password
        }
        
        let _: User = try await APIClient.shared.put("/api/admin/users/\(id)", body: body)
        // Refresh list
        await fetchUsers()
    }
}
