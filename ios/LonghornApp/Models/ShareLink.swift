//
//  ShareLink.swift
//  LonghornApp
//
//  分享链接数据模型
//

import Foundation

/// 分享链接模型
struct ShareLink: Codable, Identifiable {
    let id: Int
    let userId: Int
    let filePath: String
    let fileName: String?
    let token: String
    let password: String?
    let expiresAt: String?
    let createdAt: String
    let accessCount: Int
    let language: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case filePath = "file_path"
        case fileName = "file_name"
        case token, password
        case expiresAt = "expires_at"
        case createdAt = "created_at"
        case accessCount = "access_count"
        case language
    }
    
    /// 是否已过期
    var isExpired: Bool {
        guard let expiresAt = expiresAt else { return false }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: expiresAt) else { return false }
        return date < Date()
    }
    
    /// 是否有密码保护
    var hasPassword: Bool {
        password != nil && !password!.isEmpty
    }
    
    /// 格式化创建时间
    var formattedCreatedAt: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: createdAt) else { return createdAt }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
    
    /// 格式化过期时间
    var formattedExpiresAt: String? {
        guard let expiresAt = expiresAt else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: expiresAt) else { return expiresAt }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
}

/// 创建分享请求
struct CreateShareRequest: Codable {
    let path: String
    let fileName: String
    let password: String?
    let expiresIn: Int?
    let language: String
    
    enum CodingKeys: String, CodingKey {
        case path
        case fileName = "file_name"
        case password
        case expiresIn = "expiresIn"
        case language
    }
}

/// 分享合集模型
struct ShareCollection: Codable, Identifiable {
    let id: Int
    let token: String
    let name: String
    let expiresAt: String?
    let accessCount: Int
    let createdAt: String
    let itemCount: Int?
    let hasPassword: Bool?
    
    enum CodingKeys: String, CodingKey {
        case id
        case token
        case name
        case expiresAt = "expires_at"
        case accessCount = "access_count"
        case createdAt = "created_at"
        case itemCount = "item_count"
        case hasPassword = "has_password"
    }
    
    /// 是否已过期
    var isExpired: Bool {
        guard let expiresAt = expiresAt else { return false }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: expiresAt) else { return false }
        return date < Date()
    }
    
    /// 格式化过期时间
    var formattedExpiresAt: String? {
        guard let expiresAt = expiresAt else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: expiresAt) else { return expiresAt }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
}

