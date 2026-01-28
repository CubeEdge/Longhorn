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
    
    @Published var progress: Double = 0
    @Published var uploadedBytes: Int64 = 0
    @Published var speed: String = ""
    @Published var status: UploadStatus = .pending
    @Published var errorMessage: String?
    
    var isCancelled = false
    var abortController: Task<Void, Never>?
    
    init(fileName: String, fileSize: Int64, destinationPath: String) {
        self.fileName = fileName
        self.fileSize = fileSize
        self.destinationPath = destinationPath
    }
    
    func cancel() {
        isCancelled = true
        abortController?.cancel()
        status = .cancelled
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
    
    private let chunkSize: Int = 512 * 1024 // 512KB (Smaller chunks = smoother progress)
    
    private init() {}
    
    /// 上传文件
    func uploadFile(fileURL: URL, destinationPath: String) async throws {
        let fileName = fileURL.lastPathComponent
        let fileSize = try getFileSize(url: fileURL)
        
        let task = UploadTask(
            fileName: fileName,
            fileSize: fileSize,
            destinationPath: destinationPath
        )
        
        await MainActor.run {
            activeTasks.append(task)
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
        let fields: [String: String] = [
            "uploadId": uploadId,
            "fileName": fileName,
            "chunkIndex": String(chunkIndex),
            "totalChunks": String(totalChunks),
            "path": path
        ]
        
        do {
            try await APIClient.shared.uploadChunk(data: data, fields: fields)
        } catch {
            print("[Upload] Chunk \(chunkIndex) failed: \(error.localizedDescription)")
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
// MARK: - 辅助结构

struct TaskFile: Transferable {
    let url: URL
    
    static var transferRepresentation: some TransferRepresentation {
        // 1. Try HEIC first to preserve quality and size (Key for iPhone Photos)
        FileRepresentation(importedContentType: .heic) { received in
            return try copyToTmp(received)
        }
        // 2. Fallback to generic image (iOS may convert to JPEG)
        FileRepresentation(importedContentType: .image) { received in
            return try copyToTmp(received)
        }
        FileRepresentation(importedContentType: .movie) { received in
            return try copyToTmp(received)
        }
        // 3. Last resort
        FileRepresentation(importedContentType: .item) { received in
            return try copyToTmp(received)
        }
    }
    
    private static func copyToTmp(_ received: ReceivedTransferredFile) throws -> TaskFile {
        let originalName = received.file.lastPathComponent
        
        // Create a unique directory for this file to avoid name collisions
        // while preserving the original filename.
        // Structure: tmp/<UUID>/IMG_1234.HEIC
        let uniqueSubDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: uniqueSubDir, withIntermediateDirectories: true)
        
        let dst = uniqueSubDir.appendingPathComponent(originalName)
        
        // Remove if exists (unlikely given UUID dir, but safe)
        try? FileManager.default.removeItem(at: dst)
        
        // Copy
        try FileManager.default.copyItem(at: received.file, to: dst)
        return TaskFile(url: dst)
    }
}
