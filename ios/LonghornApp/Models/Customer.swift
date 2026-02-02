//
//  Customer.swift
//  LonghornApp
//
//  客户数据模型
//

import Foundation

/// 客户类型
enum CustomerType: String, Codable, CaseIterable {
    case enterprise = "Enterprise"
    case dealer = "Dealer"
    case individual = "Individual"
    case government = "Government"
    case education = "Education"
    
    var localizedName: String {
        switch self {
        case .enterprise: return String(localized: "customer.type.enterprise")
        case .dealer: return String(localized: "customer.type.dealer")
        case .individual: return String(localized: "customer.type.individual")
        case .government: return String(localized: "customer.type.government")
        case .education: return String(localized: "customer.type.education")
        }
    }
}

/// 客户模型
struct Customer: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let company: String?
    let email: String?
    let phone: String?
    let customerType: CustomerType?
    let country: String?
    let province: String?
    let city: String?
    let address: String?
    let notes: String?
    let createdAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, name, company, email, phone
        case customerType = "customer_type"
        case country, province, city, address, notes
        case createdAt = "created_at"
    }
    
    /// 客户显示名称（公司名 + 联系人）
    var displayName: String {
        if let company = company, !company.isEmpty {
            return "\(company) - \(name)"
        }
        return name
    }
    
    /// 完整地址
    var fullAddress: String? {
        let parts = [country, province, city, address].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }
    
    /// 联系信息摘要
    var contactSummary: String? {
        let parts = [phone, email].compactMap { $0 }.filter { !$0.isEmpty }
        return parts.isEmpty ? nil : parts.joined(separator: " | ")
    }
}

/// 客户列表响应
struct CustomerListResponse: Codable {
    let customers: [Customer]
    let total: Int
    let page: Int
    let limit: Int
}
