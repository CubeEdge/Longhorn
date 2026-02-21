//
//  Issue.swift
//  LonghornApp
//
//  工单/问题数据模型
//

import Foundation
import SwiftUI

// MARK: - 枚举类型

/// 工单状态
enum IssueStatus: String, Codable, CaseIterable {
    case pending = "Pending"
    case assigned = "Assigned"
    case inProgress = "InProgress"
    case awaitingVerification = "AwaitingVerification"
    case closed = "Closed"
    case rejected = "Rejected"
    
    var localizedName: String {
        switch self {
        case .pending: return String(localized: "issue.status.pending")
        case .assigned: return String(localized: "issue.status.assigned")
        case .inProgress: return String(localized: "issue.status.inProgress")
        case .awaitingVerification: return String(localized: "issue.status.awaitingVerification")
        case .closed: return String(localized: "issue.status.closed")
        case .rejected: return String(localized: "issue.status.rejected")
        }
    }
    
    var color: Color {
        switch self {
        case .pending: return .gray
        case .assigned: return .blue
        case .inProgress: return .orange
        case .awaitingVerification: return .purple
        case .closed: return .green
        case .rejected: return .red
        }
    }
    
    var iconName: String {
        switch self {
        case .pending: return "clock"
        case .assigned: return "person.badge.clock"
        case .inProgress: return "wrench.and.screwdriver"
        case .awaitingVerification: return "checkmark.circle.badge.questionmark"
        case .closed: return "checkmark.seal"
        case .rejected: return "xmark.circle"
        }
    }
}

/// 工单严重程度
enum IssueSeverity: String, Codable, CaseIterable {
    case low = "Low"
    case medium = "Medium"
    case high = "High"
    case critical = "Critical"
    
    var localizedName: String {
        switch self {
        case .low: return String(localized: "issue.severity.low")
        case .medium: return String(localized: "issue.severity.medium")
        case .high: return String(localized: "issue.severity.high")
        case .critical: return String(localized: "issue.severity.critical")
        }
    }
    
    var color: Color {
        switch self {
        case .low: return .green
        case .medium: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }
    
    var priority: Int {
        switch self {
        case .critical: return 4
        case .high: return 3
        case .medium: return 2
        case .low: return 1
        }
    }
}

/// 工单类别
enum IssueCategory: String, Codable, CaseIterable {
    case hardware = "Hardware"
    case software = "Software"
    case consultation = "Consultation"
    case returnRequest = "Return"
    case complaint = "Complaint"
    
    var localizedName: String {
        switch self {
        case .hardware: return String(localized: "issue.category.hardware")
        case .software: return String(localized: "issue.category.software")
        case .consultation: return String(localized: "issue.category.consultation")
        case .returnRequest: return String(localized: "issue.category.return")
        case .complaint: return String(localized: "issue.category.complaint")
        }
    }
    
    var iconName: String {
        switch self {
        case .hardware: return "cpu"
        case .software: return "app.badge"
        case .consultation: return "questionmark.bubble"
        case .returnRequest: return "arrow.uturn.backward.square"
        case .complaint: return "exclamationmark.triangle"
        }
    }
}

/// 工单来源
enum IssueSource: String, Codable, CaseIterable {
    case onlineFeedback = "OnlineFeedback"
    case offlineReturn = "OfflineReturn"
    case dealerFeedback = "DealerFeedback"
    case internalTest = "InternalTest"
    
    var localizedName: String {
        switch self {
        case .onlineFeedback: return String(localized: "issue.source.onlineFeedback")
        case .offlineReturn: return String(localized: "issue.source.offlineReturn")
        case .dealerFeedback: return String(localized: "issue.source.dealerFeedback")
        case .internalTest: return String(localized: "issue.source.internalTest")
        }
    }
}

// MARK: - 主模型

/// 工单模型
struct Issue: Codable, Identifiable {
    let id: Int
    let issueNumber: String
    let title: String
    let description: String?
    let status: IssueStatus
    let severity: IssueSeverity
    let category: IssueCategory
    let source: IssueSource
    let productId: Int?
    let accountId: Int?
    let serialNumber: String?
    let batchNumber: String?
    let assignedTo: Int?
    let createdBy: Int
    let departmentId: Int?
    let createdAt: String
    let updatedAt: String?
    
    // 关联字段（JOIN 返回）
    let productName: String?
    let customerName: String?
    let assignedToName: String?
    let createdByName: String?
    let departmentName: String?
    
    enum CodingKeys: String, CodingKey {
        case id, title, description, status, severity, category, source
        case issueNumber = "issue_number"
        case productId = "product_id"
        case accountId = "account_id"
        case serialNumber = "serial_number"
        case batchNumber = "batch_number"
        case assignedTo = "assigned_to"
        case createdBy = "created_by"
        case departmentId = "department_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case productName = "product_name"
        case customerName = "customer_name"
        case assignedToName = "assigned_to_name"
        case createdByName = "created_by_name"
        case departmentName = "department_name"
    }
    
    /// 格式化创建时间
    var formattedCreatedAt: String {
        formatDate(createdAt)
    }
    
    /// 格式化更新时间
    var formattedUpdatedAt: String? {
        guard let updatedAt = updatedAt else { return nil }
        return formatDate(updatedAt)
    }
    
    private func formatDate(_ dateString: String) -> String {
        // 尝试多种格式解析
        let formatters: [DateFormatter] = {
            let iso = DateFormatter()
            iso.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
            iso.locale = Locale(identifier: "en_US_POSIX")
            
            let simple = DateFormatter()
            simple.dateFormat = "yyyy-MM-dd HH:mm:ss"
            simple.locale = Locale(identifier: "en_US_POSIX")
            
            return [iso, simple]
        }()
        
        var date: Date?
        for formatter in formatters {
            if let parsed = formatter.date(from: dateString) {
                date = parsed
                break
            }
        }
        
        guard let date = date else { return dateString }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
}

// MARK: - 评论模型

/// 工单评论
struct IssueComment: Codable, Identifiable {
    let id: Int
    let issueId: Int
    let userId: Int
    let content: String
    let createdAt: String
    
    // 关联字段
    let username: String?
    
    enum CodingKeys: String, CodingKey {
        case id, content, username
        case issueId = "issue_id"
        case userId = "user_id"
        case createdAt = "created_at"
    }
    
    /// 格式化创建时间
    var formattedCreatedAt: String {
        let formatters: [DateFormatter] = {
            let iso = DateFormatter()
            iso.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
            iso.locale = Locale(identifier: "en_US_POSIX")
            
            let simple = DateFormatter()
            simple.dateFormat = "yyyy-MM-dd HH:mm:ss"
            simple.locale = Locale(identifier: "en_US_POSIX")
            
            return [iso, simple]
        }()
        
        var date: Date?
        for formatter in formatters {
            if let parsed = formatter.date(from: createdAt) {
                date = parsed
                break
            }
        }
        
        guard let date = date else { return createdAt }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
}

// MARK: - 附件模型

/// 工单附件
struct IssueAttachment: Codable, Identifiable {
    let id: Int
    let issueId: Int
    let userId: Int
    let fileName: String
    let filePath: String
    let fileSize: Int64?
    let fileType: String?
    let createdAt: String
    
    // 关联字段
    let username: String?
    
    enum CodingKeys: String, CodingKey {
        case id, username
        case issueId = "issue_id"
        case userId = "user_id"
        case fileName = "file_name"
        case filePath = "file_path"
        case fileSize = "file_size"
        case fileType = "file_type"
        case createdAt = "created_at"
    }
    
    /// 是否为图片
    var isImage: Bool {
        guard let fileType = fileType else { return false }
        return fileType.hasPrefix("image/")
    }
    
    /// 格式化文件大小
    var formattedFileSize: String {
        guard let size = fileSize else { return "" }
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: size)
    }
}

// MARK: - API 响应模型

/// 工单列表响应
struct IssueListResponse: Codable {
    let issues: [Issue]
    let total: Int
    let page: Int
    let limit: Int
}

/// 工单详情响应（包含评论和附件）
struct IssueDetailResponse: Codable {
    let issue: Issue
    let comments: [IssueComment]
    let attachments: [IssueAttachment]
}

/// 创建工单请求
struct CreateIssueRequest: Codable {
    let title: String
    let description: String?
    let severity: String
    let category: String
    let source: String
    let productId: Int?
    let accountId: Int?
    let serialNumber: String?
    let batchNumber: String?
    
    enum CodingKeys: String, CodingKey {
        case title, description, severity, category, source
        case productId = "product_id"
        case accountId = "account_id"
        case serialNumber = "serial_number"
        case batchNumber = "batch_number"
    }
}

/// 更新工单状态请求
struct UpdateIssueStatusRequest: Codable {
    let status: String
}

/// 分配工单请求
struct AssignIssueRequest: Codable {
    let assignedTo: Int
    
    enum CodingKeys: String, CodingKey {
        case assignedTo = "assigned_to"
    }
}

/// 添加评论请求
struct AddCommentRequest: Codable {
    let content: String
}

/// 工单统计概览
struct IssueStatistics: Codable {
    let totalIssues: Int
    let pendingCount: Int
    let inProgressCount: Int
    let closedCount: Int
    let criticalCount: Int
    let highCount: Int
    
    enum CodingKeys: String, CodingKey {
        case totalIssues = "total_issues"
        case pendingCount = "pending_count"
        case inProgressCount = "in_progress_count"
        case closedCount = "closed_count"
        case criticalCount = "critical_count"
        case highCount = "high_count"
    }
}
