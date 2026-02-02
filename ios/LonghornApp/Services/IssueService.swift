//
//  IssueService.swift
//  LonghornApp
//
//  工单服务 - API调用封装
//

import Foundation
import SwiftUI
import PhotosUI

/// 工单服务
class IssueService: ObservableObject {
    static let shared = IssueService()
    
    private let apiClient = APIClient.shared
    
    // MARK: - 工单列表
    
    /// 获取工单列表
    func fetchIssues(
        page: Int = 1,
        limit: Int = 20,
        status: IssueStatus? = nil,
        category: IssueCategory? = nil,
        search: String? = nil
    ) async throws -> IssueListResponse {
        var queryItems = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)")
        ]
        
        if let status = status {
            queryItems.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        if let category = category {
            queryItems.append(URLQueryItem(name: "category", value: category.rawValue))
        }
        if let search = search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        
        return try await apiClient.get("/api/issues", queryItems: queryItems)
    }
    
    /// 获取我的工单
    func fetchMyIssues(page: Int = 1, limit: Int = 20) async throws -> IssueListResponse {
        let queryItems = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "my", value: "true")
        ]
        return try await apiClient.get("/api/issues", queryItems: queryItems)
    }
    
    // MARK: - 工单详情
    
    /// 获取工单详情
    func fetchIssueDetail(id: Int) async throws -> IssueDetailResponse {
        return try await apiClient.get("/api/issues/\(id)")
    }
    
    // MARK: - 创建工单
    
    /// 创建工单
    func createIssue(
        title: String,
        description: String?,
        severity: IssueSeverity,
        category: IssueCategory,
        source: IssueSource,
        productId: Int?,
        customerId: Int?,
        serialNumber: String?,
        batchNumber: String?
    ) async throws -> Issue {
        let request = CreateIssueRequest(
            title: title,
            description: description,
            severity: severity.rawValue,
            category: category.rawValue,
            source: source.rawValue,
            productId: productId,
            customerId: customerId,
            serialNumber: serialNumber,
            batchNumber: batchNumber
        )
        return try await apiClient.post("/api/issues", body: request)
    }
    
    // MARK: - 更新工单
    
    /// 更新工单状态
    func updateIssueStatus(id: Int, status: IssueStatus) async throws {
        let request = UpdateIssueStatusRequest(status: status.rawValue)
        try await apiClient.put("/api/issues/\(id)/status", body: request)
    }
    
    /// 分配工单
    func assignIssue(id: Int, userId: Int) async throws {
        let request = AssignIssueRequest(assignedTo: userId)
        try await apiClient.put("/api/issues/\(id)/assign", body: request)
    }
    
    // MARK: - 评论
    
    /// 添加评论
    func addComment(issueId: Int, content: String) async throws -> IssueComment {
        let request = AddCommentRequest(content: content)
        return try await apiClient.post("/api/issues/\(issueId)/comments", body: request)
    }
    
    // MARK: - 附件
    
    /// 上传附件（图片）
    func uploadAttachment(issueId: Int, imageData: Data, fileName: String) async throws {
        let endpoint = "/api/issues/\(issueId)/attachments"
        guard let url = URL(string: apiClient.baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        // 认证
        if let token = await AuthManager.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Multipart form data
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        let session = URLSession.shared
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }
        
        if httpResponse.statusCode == 401 {
            await MainActor.run { AuthManager.shared.logout() }
            throw APIError.unauthorized
        }
        
        if httpResponse.statusCode >= 400 {
            throw APIError.serverError(httpResponse.statusCode, "上传失败")
        }
    }
    
    /// 下载附件
    func downloadAttachment(_ attachment: IssueAttachment) async throws -> URL {
        return try await apiClient.downloadFile(path: attachment.filePath)
    }
    
    // MARK: - 产品
    
    /// 获取产品列表
    func fetchProducts(search: String? = nil) async throws -> [Product] {
        var queryItems: [URLQueryItem] = []
        if let search = search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        let response: ProductListResponse = try await apiClient.get("/api/products", queryItems: queryItems.isEmpty ? nil : queryItems)
        return response.products
    }
    
    // MARK: - 客户
    
    /// 获取客户列表
    func fetchCustomers(search: String? = nil) async throws -> [Customer] {
        var queryItems: [URLQueryItem] = []
        if let search = search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        let response: CustomerListResponse = try await apiClient.get("/api/customers", queryItems: queryItems.isEmpty ? nil : queryItems)
        return response.customers
    }
    
    // MARK: - 统计
    
    /// 获取工单统计概览
    func fetchStatistics() async throws -> IssueStatistics {
        return try await apiClient.get("/api/issues/statistics")
    }
}

// MARK: - 工单Store（状态管理）

@MainActor
class IssueStore: ObservableObject {
    @Published var issues: [Issue] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var currentPage = 1
    @Published var totalCount = 0
    @Published var hasMore = true
    
    // 筛选条件
    @Published var statusFilter: IssueStatus?
    @Published var categoryFilter: IssueCategory?
    @Published var searchQuery = ""
    
    private let service = IssueService.shared
    private let pageSize = 20
    
    /// 加载工单列表
    func loadIssues(refresh: Bool = false) async {
        if refresh {
            currentPage = 1
            hasMore = true
        }
        
        guard hasMore, !isLoading else { return }
        
        isLoading = true
        error = nil
        
        do {
            let response = try await service.fetchIssues(
                page: currentPage,
                limit: pageSize,
                status: statusFilter,
                category: categoryFilter,
                search: searchQuery.isEmpty ? nil : searchQuery
            )
            
            if refresh {
                issues = response.issues
            } else {
                issues.append(contentsOf: response.issues)
            }
            
            totalCount = response.total
            hasMore = issues.count < response.total
            currentPage += 1
            
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    /// 刷新
    func refresh() async {
        await loadIssues(refresh: true)
    }
    
    /// 加载更多
    func loadMore() async {
        await loadIssues(refresh: false)
    }
    
    /// 应用筛选
    func applyFilter(status: IssueStatus?, category: IssueCategory?) async {
        statusFilter = status
        categoryFilter = category
        await refresh()
    }
    
    /// 搜索
    func search(_ query: String) async {
        searchQuery = query
        await refresh()
    }
}
