//
//  UploadService.swift
//  LonghornApp
//
//  分片上传服务 - 支持大文件上传、进度回调、取消操作
//

import Foundation
import SwiftUI

/// 上传任务
class UploadTask: ObservableObject, Identifiable {
    let id = UUID()
    let fileName: String
    let fileSize: Int64
    let destinationPath: String
    var sourceURL: URL? // 保存源文件URL用于重试
    
    @Published var progress: Double = 0
    @Published var uploadedBytes: Int64 = 0
    @Published var speed: String = ""
    @Published var status: UploadStatus = .pending
    @Published var errorMessage: String?
    
    var isCancelled = false
    var abortController: Task<Void, Never>?
    
    init(fileName: String, fileSize: Int64, destinationPath: String, sourceURL: URL? = nil) {
        self.fileName = fileName
        self.fileSize = fileSize
        self.destinationPath = destinationPath
        self.sourceURL = sourceURL
    }
    
    func cancel() {
        isCancelled = true
        abortController?.cancel()
        status = .cancelled
    }
    
    func retry() {
        progress = 0
        uploadedBytes = 0
        speed = ""
        status = .pending
        errorMessage = nil
        isCancelled = false
    }
}

enum UploadStatus: String {
    case pending = "等待中"
    case uploading = "上传中"
    case merging = "合并中"
    case completed = "已完成"
    case failed = "失败"
    case cancelled = "已取消"
}

/// 上传服务
class UploadService: ObservableObject {
    static let shared = UploadService()
    
    @Published var activeTasks: [UploadTask] = []
    
    private let chunkSize: Int = 512 * 1024 // 512KB - 更丝滑的进度更新
    
    private init() {}
    
    /// 批量上传文件 - 先创建所有任务,再逐个上传
    func uploadFiles(fileURLs: [URL], destinationPath: String) async throws {
        // 1. 批量创建任务
        var tasks: [UploadTask] = []
        for fileURL in fileURLs {
            let fileName = fileURL.lastPathComponent
            let fileSize = (try? getFileSize(url: fileURL)) ?? 0
            
            let task = UploadTask(
                fileName: fileName,
                fileSize: fileSize,
                destinationPath: destinationPath,
                sourceURL: fileURL
            )
            tasks.append(task)
        }
        
        // 2. 一次性添加到列表顶部
        await MainActor.run {
            activeTasks.insert(contentsOf: tasks, at: 0)
        }
        
        // 3. 逐个上传
        for (index, fileURL) in fileURLs.enumerated() {
            let task = tasks[index]
            
            do {
                try await performChunkedUpload(task: task, fileURL: fileURL)
                await MainActor.run {
                    task.status = .completed
                    task.progress = 1.0
                }
            } catch {
                await MainActor.run {
                    if !task.isCancelled {
                        task.status = .failed
                        task.errorMessage = error.localizedDescription
                    }
                }
                // 继续上传下一个文件,不中断
            }
        }
    }
    
    /// 重试失败的任务
    func retryTask(_ task: UploadTask) async {
        guard task.status == .failed, let fileURL = task.sourceURL else { return }
        
        await MainActor.run {
            task.retry()
        }
        
        do {
            try await performChunkedUpload(task: task, fileURL: fileURL)
            await MainActor.run {
                task.status = .completed
                task.progress = 1.0
            }
        } catch {
            await MainActor.run {
                if !task.isCancelled {
                    task.status = .failed
                    task.errorMessage = error.localizedDescription
                }
            }
        }
    }
    
    /// 上传文件 (单个)
    func uploadFile(fileURL: URL, destinationPath: String) async throws {
        let fileName = fileURL.lastPathComponent
        let fileSize = try getFileSize(url: fileURL)
        
        let task = UploadTask(
            fileName: fileName,
            fileSize: fileSize,
            destinationPath: destinationPath,
            sourceURL: fileURL
        )
        
        await MainActor.run {
            activeTasks.insert(task, at: 0)
        }
        
        do {
            try await performChunkedUpload(task: task, fileURL: fileURL)
            await MainActor.run {
                task.status = .completed
                task.progress = 1.0
            }
        } catch {
            await MainActor.run {
                if !task.isCancelled {
                    task.status = .failed
                    task.errorMessage = error.localizedDescription
                }
            }
            throw error
        }
    }
    
    /// 执行分片上传
    private func performChunkedUpload(task: UploadTask, fileURL: URL) async throws {
        let fileHandle = try FileHandle(forReadingFrom: fileURL)
        defer { try? fileHandle.close() }
        
        let totalChunks = Int(ceil(Double(task.fileSize) / Double(chunkSize)))
        let uploadId = "\(Date().timeIntervalSince1970)-\(UUID().uuidString.prefix(8))"
        
        await MainActor.run {
            task.status = .uploading
        }
        
        var uploadedBytes: Int64 = 0
        let startTime = Date()
        
        for chunkIndex in 0..<totalChunks {
            // 检查是否取消
            if task.isCancelled {
                return
            }
            
            // 读取分片数据
            let offset = Int64(chunkIndex) * Int64(chunkSize)
            try fileHandle.seek(toOffset: UInt64(offset))
            
            let remainingBytes = task.fileSize - offset
            let currentChunkSize = min(Int64(chunkSize), remainingBytes)
            
            guard let chunkData = try fileHandle.read(upToCount: Int(currentChunkSize)) else {
                throw UploadError.readFailed
            }
            
            // 上传分片
            try await uploadChunk(
                data: chunkData,
                uploadId: uploadId,
                fileName: task.fileName,
                chunkIndex: chunkIndex,
                totalChunks: totalChunks,
                path: task.destinationPath
            )
            
            // 更新进度
            uploadedBytes += currentChunkSize
            let progress = Double(uploadedBytes) / Double(task.fileSize)
            let elapsed = Date().timeIntervalSince(startTime)
            let bytesPerSecond = elapsed > 0 ? Double(uploadedBytes) / elapsed : 0
            let currentUploadedBytes = uploadedBytes  // Capture for MainActor
            let currentSpeed = formatSpeed(bytesPerSecond)
            
            await MainActor.run {
                task.uploadedBytes = currentUploadedBytes
                task.progress = progress
                task.speed = currentSpeed
            }
        }
        
        // 合并分片
        await MainActor.run {
            task.status = .merging
        }
        
        try await mergeChunks(
            uploadId: uploadId,
            fileName: task.fileName,
            totalChunks: totalChunks,
            path: task.destinationPath
        )
    }
    
    /// 上传单个分片
    private func uploadChunk(
        data: Data,
        uploadId: String,
        fileName: String,
        chunkIndex: Int,
        totalChunks: Int,
        path: String
    ) async throws {
        guard let token = await AuthManager.shared.token else {
            throw APIError.unauthorized
        }
        
        let boundary = UUID().uuidString
        var request = URLRequest(url: URL(string: "\(APIClient.shared.baseURL)/api/upload/chunk")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // 添加字段
        let fields: [String: String] = [
            "uploadId": uploadId,
            "fileName": fileName,
            "chunkIndex": String(chunkIndex),
            "totalChunks": String(totalChunks),
            "path": path
        ]
        
        for (key, value) in fields {
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"\(key)\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(value)\r\n".data(using: .utf8)!)
        }
        
        // 添加文件数据
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"chunk\"; filename=\"chunk\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: application/octet-stream\r\n\r\n".data(using: .utf8)!)
        body.append(data)
        body.append("\r\n".data(using: .utf8)!)
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw UploadError.uploadFailed
        }
    }
    
    /// 合并分片
    private func mergeChunks(
        uploadId: String,
        fileName: String,
        totalChunks: Int,
        path: String
    ) async throws {
        struct MergeRequest: Codable {
            let uploadId: String
            let fileName: String
            let totalChunks: Int
            let path: String
        }
        
        let request = MergeRequest(
            uploadId: uploadId,
            fileName: fileName,
            totalChunks: totalChunks,
            path: path
        )
        
        try await APIClient.shared.post("/api/upload/merge", body: request)
    }
    
    /// 获取文件大小
    private func getFileSize(url: URL) throws -> Int64 {
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        return attributes[.size] as? Int64 ?? 0
    }
    
    /// 格式化速度
    private func formatSpeed(_ bytesPerSecond: Double) -> String {
        if bytesPerSecond >= 1024 * 1024 {
            return String(format: "%.1f MB/s", bytesPerSecond / (1024 * 1024))
        } else if bytesPerSecond >= 1024 {
            return String(format: "%.0f KB/s", bytesPerSecond / 1024)
        } else {
            return String(format: "%.0f B/s", bytesPerSecond)
        }
    }
    
    /// 移除已完成的任务
    func removeCompletedTasks() {
        activeTasks.removeAll { $0.status == .completed || $0.status == .cancelled }
    }
}

enum UploadError: LocalizedError {
    case readFailed
    case uploadFailed
    case mergeFailed
    
    var errorDescription: String? {
        switch self {
        case .readFailed: return "读取文件失败"
        case .uploadFailed: return "上传失败"
        case .mergeFailed: return "合并分片失败"
        }
    }
}
