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
            filePath: filePath,
            fileName: fileName,
            password: password,
            expiresDays: expiresDays,
            language: language
        )
        return try await APIClient.shared.post("/api/shares", body: request)
    }
    
    /// 删除分享
    func deleteShare(id: Int) async throws {
        try await APIClient.shared.delete("/api/shares/\(id)")
    }
    
    /// 获取分享链接 URL
    func getShareURL(token: String) -> String {
        return "\(APIClient.shared.baseURL)/s/\(token)"
    }
}
