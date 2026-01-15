//
//  ShareService.swift
//  LonghornApp
//
//  分享服务
//

import Foundation

/// 分享服务
class ShareService {
    static let shared = ShareService()
    
    private init() {}
    
    // MARK: - 分享操作
    
    /// 获取我的分享列表
    func getMyShares() async throws -> [ShareLink] {
        return try await APIClient.shared.get("/api/shares")
    }
    
    /// 创建分享链接
    func createShare(
        filePath: String,
        fileName: String,
        password: String? = nil,
        expiresDays: Int? = nil,
        language: String = "zh"
    ) async throws -> ShareLink {
        let request = CreateShareRequest(
            path: filePath,
            fileName: fileName,
            password: password,
            expiresIn: expiresDays,
            language: language
        )
        return try await APIClient.shared.post("/api/shares", body: request)
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
    
    /// 获取分享链接 URL
    func getShareURL(token: String) -> String {
        return "\(APIClient.shared.baseURL)/s/\(token)"
    }
    
    // MARK: - 分享合集操作
    
    /// 获取我的分享合集列表
    func getMyCollections() async throws -> [ShareCollection] {
        return try await APIClient.shared.get("/api/my-share-collections")
    }
    
    /// 删除分享合集
    func deleteCollection(id: Int) async throws {
        try await APIClient.shared.delete("/api/share-collection/\(id)")
    }
    
    /// 获取分享合集链接 URL
    func getCollectionURL(token: String) -> String {
        return "\(APIClient.shared.baseURL)/c/\(token)"
    }
    
    /// 更新分享合集设置
    func updateCollection(id: Int, password: String? = nil, removePassword: Bool = false, expiresInDays: Int? = nil) async throws {
        let request = UpdateShareRequest(password: password, removePassword: removePassword, expiresInDays: expiresInDays)
        try await APIClient.shared.put("/api/share-collection/\(id)", body: request)
    }
}

private struct UpdateShareRequest: Codable {
    let password: String?
    let removePassword: Bool
    let expiresInDays: Int?
}
