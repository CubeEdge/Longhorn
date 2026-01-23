//
//  FileService.swift
//  LonghornApp
//
//  文件操作服务
//

import Foundation

/// 文件服务
class FileService {
    static let shared = FileService()
    
    private init() {}
    
    // MARK: - 文件列表
    
    /// 获取文件列表
    func getFiles(path: String) async throws -> [FileItem] {
        let queryItems = [URLQueryItem(name: "path", value: path)]
        let response: FilesResponse = try await APIClient.shared.get("/api/files", queryItems: queryItems)
        
        // 🐛 调试：打印服务器返回的 starred 状态
        for file in response.items {
            if file.isStarred == true {
                print("⭐ [DEBUG] Starred file found: \(file.name), isStarred=\(String(describing: file.isStarred))")
            }
        }
        if response.items.first(where: { $0.isStarred == true }) == nil {
            print("⚠️ [DEBUG] No starred files in response for path: \(path), count: \(response.items.count)")
        }
        
        // 🐛 调试：打印服务器返回的文件信息，特别是 uploader
        for file in response.items {
            print("📄 [DEBUG] File: \(file.name), uploader: \(file.uploaderName ?? "nil"), starred: \(String(describing: file.isStarred))")
        }
        
        return response.items
    }
    
    /// 获取可访问的部门列表
    func getAccessibleDepartments() async throws -> [Department] {
        return try await APIClient.shared.get("/api/user/accessible-departments")
    }
    
    /// 获取我的特殊权限目录
    func fetchMyPermissions() async throws -> [AuthorizedLocation] {
        return try await APIClient.shared.get("/api/user/permissions")
    }
    
    /// 获取部门概览数据
    func fetchDepartmentStats() async throws -> DepartmentOverviewStats {
        return try await APIClient.shared.get("/api/department/my-stats")
    }
    
    // MARK: - 搜索
    
    /// 搜索文件
    func searchFiles(query: String, scope: String = "all", type: String? = nil) async throws -> [FileItem] {
        var queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "scope", value: scope)
        ]
        if let type = type {
            queryItems.append(URLQueryItem(name: "type", value: type))
        }
        let response: SearchResponse = try await APIClient.shared.get("/api/search", queryItems: queryItems)
        return response.results
    }
    
    // MARK: - 文件夹操作
    
    /// 创建文件夹
    func createFolder(path: String, name: String) async throws {
        let request = CreateFolderRequest(path: path, name: name)
        try await APIClient.shared.post("/api/folders", body: request)
    }
    
    // MARK: - 文件操作
    
    /// 删除文件（移动到回收站）
    func deleteFile(path: String) async throws {
        let queryItems = [URLQueryItem(name: "path", value: path)]
        try await APIClient.shared.delete("/api/files", queryItems: queryItems)
    }
    
    /// 批量删除文件
    func deleteFiles(paths: [String]) async throws {
        let request = BulkDeleteRequest(paths: paths)
        try await APIClient.shared.post("/api/files/bulk-delete", body: request)
    }
    
    /// 移动文件
    func moveFiles(paths: [String], destination: String) async throws {
        let request = BulkMoveRequest(paths: paths, destination: destination)
        try await APIClient.shared.post("/api/files/bulk-move", body: request)
    }
    
    /// 重命名文件
    func renameFile(at path: String, to newName: String) async throws {
        let request = RenameRequest(path: path, newName: newName)
        try await APIClient.shared.post("/api/files/rename", body: request)
    }
    
    /// 复制文件
    func copyFile(sourcePath: String, targetDir: String) async throws -> CopyResult {
        let request = CopyRequest(sourcePath: sourcePath, targetDir: targetDir)
        return try await APIClient.shared.post("/api/files/copy", body: request)
    }
    
    // MARK: - 收藏操作
    
    /// 获取收藏列表
    func getStarredFiles() async throws -> [StarredItem] {
        return try await APIClient.shared.get("/api/starred")
    }
    
    /// 检查文件是否已收藏
    func isFileStarred(path: String) async throws -> Bool {
        let queryItems = [URLQueryItem(name: "path", value: path)]
        let response: StarredCheckResponse = try await APIClient.shared.get("/api/starred/check", queryItems: queryItems)
        return response.starred
    }
    
    /// 收藏文件
    func starFile(path: String) async throws {
        let request = StarRequest(path: path)
        try await APIClient.shared.post("/api/starred", body: request)
    }
    
    /// 取消收藏
    func unstarFile(id: Int) async throws {
        try await APIClient.shared.delete("/api/starred/\(id)")
    }
    
    /// 根据路径取消收藏
    func unstarByPath(path: String) async throws {
        let starred = try await getStarredFiles()
        if let item = starred.first(where: { $0.fullPath == path }) {
            try await unstarFile(id: item.id)
        }
    }
    
    /// 切换文件收藏状态
    func toggleStar(path: String) async throws {
        let isStarred = try await isFileStarred(path: path)
        if isStarred {
            try await unstarByPath(path: path)
        } else {
            try await starFile(path: path)
        }
    }
    
    // MARK: - 回收站操作
    
    /// 获取回收站内容
    func getRecycleBin() async throws -> [RecycleBinItem] {
        return try await APIClient.shared.get("/api/recycle-bin")
    }
    
    /// 恢复文件
    func restoreFile(id: Int) async throws {
        let _: EmptyBody = try await APIClient.shared.post("/api/recycle-bin/restore/\(id)", body: EmptyBody())
    }
    
    /// 永久删除
    func permanentlyDelete(id: Int) async throws {
        try await APIClient.shared.delete("/api/recycle-bin/\(id)")
    }
    
    /// 清空回收站
    func clearRecycleBin() async throws {
        try await APIClient.shared.delete("/api/recycle-bin-clear")
    }
    
    // MARK: - 文件夹树
    
    /// 获取文件夹树
    func getFolderTree(rootPath: String = "") async throws -> [FolderTreeItem] {
        let queryItems = [URLQueryItem(name: "root", value: rootPath)]
        // Server returns [FolderTreeItem], not { folders: ... }
        return try await APIClient.shared.get("/api/folders/tree", queryItems: queryItems)
    }
    
    // MARK: - 分享操作
    
    /// 创建分享链接
    func createShareLink(path: String, password: String?, expiresInDays: Int?, language: String = "zh") async throws -> ShareResult {
        let fileName = (path as NSString).lastPathComponent
        let request = CreateShareRequest(
            path: path,
            fileName: fileName,
            password: password,
            expiresIn: expiresInDays,
            language: language
        )
        return try await APIClient.shared.post("/api/shares", body: request)
    }
    
    /// 获取分享列表
    func getShareList() async throws -> [ShareItem] {
        return try await APIClient.shared.get("/api/shares")
    }
    
    /// 删除分享
    func deleteShare(id: Int) async throws {
        try await APIClient.shared.delete("/api/shares/\(id)")
    }
    
    /// 更新分享设置
    func updateShare(id: Int, password: String? = nil, removePassword: Bool = false, expiresInDays: Int? = nil) async throws {
        let request = UpdateShareRequest(password: password, removePassword: removePassword, expiresInDays: expiresInDays)
        try await APIClient.shared.put("/api/shares/\(id)", body: request)
    }
    
    /// 批量分享（创建分享合集）
    func createShareCollection(paths: [String], name: String, password: String?, expiresInDays: Int?, language: String = "zh") async throws -> ShareResult {
        let request = CreateCollectionRequest(
            paths: paths,
            name: name,
            password: password,
            expiresIn: expiresInDays,
            language: language
        )
        return try await APIClient.shared.post("/api/share-collection", body: request)
    }
    /// 获取文件访问统计
    func getFileStats(path: String) async throws -> [AccessLog] {
        let queryItems = [URLQueryItem(name: "path", value: path)]
        return try await APIClient.shared.get("/api/files/stats", queryItems: queryItems)
    }
    /// 获取我的分享记录
    func getMyShares() async throws -> [ShareLink] {
        return try await APIClient.shared.get("/api/share/my")
    }
    
    /// 记录文件访问（用于访问日志）
    func recordFileAccess(path: String) async {
        // Fire and forget - don't block UI for logging
        do {
            let request = FileAccessRequest(path: path)
            try await APIClient.shared.post("/api/files/access", body: request)
        } catch {
            print("Failed to record file access: \(error)")
        }
    }
}

private struct FileAccessRequest: Codable {
    let path: String
}

private struct EmptyResponse: Codable {}

// MARK: - 请求/响应结构

private struct FilesResponse: Codable {
    let items: [FileItem]
    let userCanWrite: Bool?
}

// ... existing structs ...

struct AccessLog: Codable, Identifiable {
    let count: Int
    let lastAccess: String
    let username: String?
    let email: String?
    
    var id: String { username ?? UUID().uuidString }
    
    enum CodingKeys: String, CodingKey {
        case count
        case lastAccess = "last_access"
        case username, email
    }
    
    var formattedLastAccess: String {
        return lastAccess // TODO: Format date properly
    }
}

private struct SearchResponse: Codable {
    let results: [FileItem]
}

private struct CreateFolderRequest: Codable {
    let path: String
    let name: String
}

private struct BulkDeleteRequest: Codable {
    let paths: [String]
}

private struct BulkMoveRequest: Codable {
    let paths: [String]
    let destination: String
    
    enum CodingKeys: String, CodingKey {
        case paths
        case destination = "targetDir"
    }
}

private struct RenameRequest: Codable {
    let path: String
    let newName: String
}

private struct CopyRequest: Codable {
    let sourcePath: String
    let targetDir: String
}

struct CopyResult: Codable {
    let success: Bool
    let newPath: String
}

private struct UpdateShareRequest: Codable {
    let password: String?
    let removePassword: Bool
    let expiresInDays: Int?
}

private struct StarRequest: Codable {
    let path: String  // 服务器期望 path 而非 file_path
}

private struct StarredCheckResponse: Codable {
    let starred: Bool
}

private struct EmptyBody: Codable {}

struct AuthorizedLocation: Codable, Identifiable {
    let id: Int
    let folderPath: String
    let accessType: String
    
    enum CodingKeys: String, CodingKey {
        case id
        case folderPath = "folder_path"
        case accessType = "access_type"
    }
    
    var displayName: String {
        let name = (folderPath as NSString).lastPathComponent
        return LocalizationHelper.localizedDepartmentName(name)
    }
}

struct DepartmentOverviewStats: Codable {
    let fileCount: Int
    let storageUsed: Int64
    let memberCount: Int
    let departmentName: String?
}

struct FolderTreeItem: Codable, Identifiable, Hashable {
    let uuid = UUID() // Renamed to avoid conflict with Identifiable's 'id'
    let name: String
    let path: String
    var children: [FolderTreeItem]?
    
    enum CodingKeys: String, CodingKey {
        case name, path, children
    }
    
    var id: String { path }
}



// MARK: - 分享相关模型

private struct CreateCollectionRequest: Codable {
    let paths: [String]
    let name: String
    let password: String?
    let expiresIn: Int?
    let language: String
}



struct ShareResult: Codable {
    let shareUrl: String
    let id: Int?
}

struct ShareItem: Codable, Identifiable {
    let id: Int
    let path: String
    let shareCode: String
    let password: String?
    let expiresAt: String?
    let createdAt: String
    let accessCount: Int
    
    enum CodingKeys: String, CodingKey {
        case id, path, password
        case shareCode = "share_code"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
        case accessCount = "access_count"
    }
    
    var displayName: String {
        (path as NSString).lastPathComponent
    }
    
    var shareURL: String {
        "\(APIClient.shared.baseURL)/s/\(shareCode)"
    }

}
