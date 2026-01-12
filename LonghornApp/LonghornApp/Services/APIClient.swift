//
//  APIClient.swift
//  LonghornApp
//
//  网络请求客户端
//

import Foundation

/// API 错误
enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case networkError(Error)
    case serverError(Int, String?)
    case unauthorized
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "无效的 URL"
        case .noData:
            return "服务器未返回数据"
        case .decodingError(let error):
            return "数据解析错误: \(error.localizedDescription)"
        case .networkError(let error):
            return "网络错误: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "服务器错误 (\(code)): \(message ?? "未知错误")"
        case .unauthorized:
            return "认证失败，请重新登录"
        }
    }
}

/// API 客户端
class APIClient {
    static let shared = APIClient()
    
    // MARK: - 服务器配置
    
    /// 服务器基础 URL（可在设置中修改）
    var baseURL: String {
        get {
            UserDefaults.standard.string(forKey: "serverURL") ?? "https://opware.kineraw.com"
        }
        set {
            UserDefaults.standard.set(newValue, forKey: "serverURL")
        }
    }
    
    private let session: URLSession
    private let decoder: JSONDecoder
    
    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 120
        session = URLSession(configuration: config)
        
        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .useDefaultKeys
    }
    
    // MARK: - 请求方法
    
    /// 执行 GET 请求
    func get<T: Decodable>(_ endpoint: String, queryItems: [URLQueryItem]? = nil) async throws -> T {
        let request = try await buildRequest(endpoint: endpoint, method: "GET", queryItems: queryItems)
        return try await execute(request)
    }
    
    /// 执行 POST 请求
    func post<T: Decodable, B: Encodable>(_ endpoint: String, body: B) async throws -> T {
        var request = try await buildRequest(endpoint: endpoint, method: "POST")
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await execute(request)
    }
    
    /// 执行 POST 请求（无返回值）
    func post<B: Encodable>(_ endpoint: String, body: B) async throws {
        var request = try await buildRequest(endpoint: endpoint, method: "POST")
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let _: EmptyResponse = try await execute(request)
    }
    
    /// 执行 DELETE 请求
    func delete(_ endpoint: String) async throws {
        let request = try await buildRequest(endpoint: endpoint, method: "DELETE")
        let _: EmptyResponse = try await execute(request)
    }
    
    /// 执行 DELETE 请求（带 query 参数）
    func delete(_ endpoint: String, queryItems: [URLQueryItem]) async throws {
        let request = try await buildRequest(endpoint: endpoint, method: "DELETE", queryItems: queryItems)
        let _: EmptyResponse = try await execute(request)
    }
    
    // MARK: - 文件操作
    
    /// 下载文件
    func downloadFile(path: String, progress: ((Double) -> Void)? = nil) async throws -> URL {
        let endpoint = "/api/files"
        let queryItems = [
            URLQueryItem(name: "path", value: path),
            URLQueryItem(name: "download", value: "true")
        ]
        
        let request = try await buildRequest(endpoint: endpoint, method: "GET", queryItems: queryItems)
        
        let (tempURL, response) = try await session.download(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }
        
        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }
        
        if httpResponse.statusCode >= 400 {
            throw APIError.serverError(httpResponse.statusCode, nil)
        }
        
        // 移动到缓存目录
        let fileName = path.components(separatedBy: "/").last ?? "download"
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let destURL = cacheDir.appendingPathComponent(fileName)
        
        try? FileManager.default.removeItem(at: destURL)
        try FileManager.default.moveItem(at: tempURL, to: destURL)
        
        return destURL
    }
    
    /// 批量下载文件（返回 ZIP）
    func downloadBatchFiles(paths: [String]) async throws -> URL {
        let endpoint = "/api/download-batch"
        
        guard let urlComponents = URLComponents(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = await AuthManager.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let body = ["paths": paths]
        request.httpBody = try JSONEncoder().encode(body)
        
        let (tempURL, response) = try await session.download(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }
        
        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }
        
        if httpResponse.statusCode >= 400 {
            throw APIError.serverError(httpResponse.statusCode, nil)
        }
        
        // 移动到缓存目录
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let destURL = cacheDir.appendingPathComponent("batch_download.zip")
        
        try? FileManager.default.removeItem(at: destURL)
        try FileManager.default.moveItem(at: tempURL, to: destURL)
        
        return destURL
    }
    
    /// 上传文件
    func uploadFile(data: Data, fileName: String, toPath: String, progress: ((Double) -> Void)? = nil) async throws {
        let endpoint = "/api/upload"
        guard var urlComponents = URLComponents(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        urlComponents.queryItems = [URLQueryItem(name: "path", value: toPath)]
        
        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        // 添加认证头
        if let token = await AuthManager.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // 构建 multipart/form-data
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var bodyData = Data()
        
        // 添加文件
        bodyData.append("--\(boundary)\r\n".data(using: .utf8)!)
        bodyData.append("Content-Disposition: form-data; name=\"files\"; filename=\"\(fileName)\"\r\n".data(using: .utf8)!)
        bodyData.append("Content-Type: application/octet-stream\r\n\r\n".data(using: .utf8)!)
        bodyData.append(data)
        bodyData.append("\r\n".data(using: .utf8)!)
        bodyData.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = bodyData
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.noData
        }
        
        if httpResponse.statusCode == 401 {
            throw APIError.unauthorized
        }
        
        if httpResponse.statusCode >= 400 {
            throw APIError.serverError(httpResponse.statusCode, nil)
        }
    }
    
    // MARK: - 私有方法
    
    private func buildRequest(endpoint: String, method: String, queryItems: [URLQueryItem]? = nil) async throws -> URLRequest {
        guard var urlComponents = URLComponents(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        
        if let queryItems = queryItems {
            urlComponents.queryItems = queryItems
        }
        
        guard let url = urlComponents.url else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        
        // 添加认证头（如果已登录）
        if let token = await AuthManager.shared.token {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        return request
    }
    
    private func execute<T: Decodable>(_ request: URLRequest) async throws -> T {
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.noData
            }
            
            // 调试日志
            #if DEBUG
            if let json = String(data: data, encoding: .utf8) {
                print("[API] \(request.httpMethod ?? "GET") \(request.url?.path ?? "") -> \(httpResponse.statusCode)")
                print("[API] Response: \(json.prefix(500))")
            }
            #endif
            
            // 处理 401 未授权
            if httpResponse.statusCode == 401 {
                await MainActor.run {
                    AuthManager.shared.logout()
                }
                throw APIError.unauthorized
            }
            
            // 处理其他错误状态码
            if httpResponse.statusCode >= 400 {
                if let errorResponse = try? decoder.decode(ErrorResponse.self, from: data) {
                    throw APIError.serverError(httpResponse.statusCode, errorResponse.error ?? errorResponse.message)
                }
                throw APIError.serverError(httpResponse.statusCode, nil)
            }
            
            // 成功解码
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
            
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }
}

/// 空响应（用于不需要返回值的请求）
private struct EmptyResponse: Decodable {}

/// 错误响应
private struct ErrorResponse: Decodable {
    let error: String?
    let message: String?
}
