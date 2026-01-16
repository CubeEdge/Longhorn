//
//  User.swift
//  LonghornApp
//
//  用户数据模型
//

import Foundation

/// 用户角色
enum UserRole: String, Codable {
    case admin = "Admin"
    case lead = "Lead"
    case member = "Member"
    
    var localizedName: String {
        switch self {
        case .admin: return String(localized: "role.Admin")
        case .lead: return String(localized: "role.Lead")
        case .member: return String(localized: "role.Member")
        }
    }
}

/// 用户模型
struct User: Codable, Identifiable {
    let id: Int
    let username: String
    let role: UserRole
    let departmentId: Int?
    let departmentName: String?
    let createdAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, username, role
        case departmentId = "department_id"
        case departmentName = "department_name"
        case createdAt = "created_at"
    }
    
    /// 是否为管理员
    var isAdmin: Bool {
        role == .admin
    }
    
    /// 是否为部门负责人
    var isLead: Bool {
        role == .lead
    }
}

/// 登录响应
struct LoginResponse: Codable {
    let token: String
    let user: User
}

/// 部门模型
struct Department: Codable, Identifiable, Hashable {
    let id: Int?
    let name: String
    
    /// 使用 code 作为唯一标识符（避免重复）
    var uniqueId: String { code }
    
    /// 从部门名称中提取代码（如 "市场部 (MS)" -> "MS"）
    var code: String {
        // 尝试从括号中提取
        if let match = name.range(of: "\\([A-Z]+\\)", options: .regularExpression) {
            let extracted = String(name[match])
            return String(extracted.dropFirst().dropLast())
        }
        // 如果名称本身就是代码
        if name.range(of: "^[A-Z]{2,3}$", options: .regularExpression) != nil {
            return name
        }
        return name
    }
    
    /// 获取显示用的部门名称
    var displayName: String {
        return localizedName()
    }
}
