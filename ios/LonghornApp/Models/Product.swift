//
//  Product.swift
//  LonghornApp
//
//  产品数据模型
//

import Foundation

/// 产品模型
struct Product: Codable, Identifiable, Hashable {
    let id: Int
    let name: String
    let model: String?
    let category: String?
    let description: String?
    let serialFormat: String?
    let createdAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id, name, model, category, description
        case serialFormat = "serial_format"
        case createdAt = "created_at"
    }
    
    /// 产品显示名称（名称 + 型号）
    var displayName: String {
        if let model = model, !model.isEmpty {
            return "\(name) (\(model))"
        }
        return name
    }
}

/// 产品列表响应
struct ProductListResponse: Codable {
    let products: [Product]
    let total: Int
    let page: Int
    let limit: Int
}
