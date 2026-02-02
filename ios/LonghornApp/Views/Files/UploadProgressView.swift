//
//  UploadProgressView.swift
//  LonghornApp
//
//  上传进度视图 - 显示上传任务列表和进度
//

import SwiftUI
import PhotosUI
import UniformTypeIdentifiers

struct UploadProgressView: View {
    @ObservedObject var uploadService = UploadService.shared
    var onDismiss: () -> Void = {}
    
    private var totalStats: (uploaded: Int64, total: Int64, speed: Double) {
        var uploaded: Int64 = 0
        var total: Int64 = 0
        var speeds: [Double] = []
        
        for task in uploadService.activeTasks {
            total += task.fileSize
            
            if task.status == .uploading || task.status == .merging {
                uploaded += task.uploadedBytes
                if let speedStr = task.speed.split(separator: " ").first,
                   let speedVal = Double(speedStr) {
                    if task.speed.contains("MB/s") {
                        speeds.append(speedVal * 1024 * 1024)
                    } else if task.speed.contains("KB/s") {
                        speeds.append(speedVal * 1024)
                    } else {
                        speeds.append(speedVal)
                    }
                }
            } else if task.status == .completed {
                uploaded += task.fileSize
            }
        }
        
        let avgSpeed = speeds.isEmpty ? 0 : speeds.reduce(0, +) / Double(speeds.count)
        return (uploaded, total, avgSpeed)
    }
    
    private var hasActiveUploads: Bool {
        uploadService.activeTasks.contains { task in
            task.status == .uploading || task.status == .merging || task.status == .pending
        }
    }
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 任务列表
                if uploadService.activeTasks.isEmpty {
                    ContentUnavailableView(
                        String(localized: "upload.no_tasks"),
                        systemImage: "arrow.up.circle",
                        description: Text("upload.no_tasks_description")
                    )
                } else {
                    List {
                        ForEach(uploadService.activeTasks) { task in
                            UploadTaskRow(task: task)
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle(String(localized: "upload.tasks_title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button {
                        onDismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 20))
                            .foregroundStyle(.secondary)
                    }
                }
                
                ToolbarItem(placement: .primaryAction) {
                    if hasActiveUploads {
                        // 显示总体进度
                        overallProgressView
                    } else if !uploadService.activeTasks.isEmpty {
                        // 上传完成后显示清理按钮
                        Button(String(localized: "upload.clear_completed")) {
                            uploadService.removeCompletedTasks()
                        }
                    }
                }
            }
        }
    }
    
    private var overallProgressView: some View {
        let stats = totalStats
        let progress = stats.total > 0 ? Double(stats.uploaded) / Double(stats.total) : 0
        
        return VStack(alignment: .trailing, spacing: 2) {
            Text("\(Int(progress * 100))%")
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(Color(red: 1.0, green: 0.82, blue: 0.0))
            
            HStack(spacing: 4) {
                if stats.speed > 0 {
                    Text(formatSpeed(stats.speed))
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                
                Text("\(formatSize(stats.uploaded))/\(formatSize(stats.total))")
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
            }
        }
    }
    
    private func formatSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
    
    private func formatSpeed(_ bytesPerSecond: Double) -> String {
        if bytesPerSecond >= 1024 * 1024 {
            return String(format: "%.1f MB/s", bytesPerSecond / (1024 * 1024))
        } else if bytesPerSecond >= 1024 {
            return String(format: "%.0f KB/s", bytesPerSecond / 1024)
        } else {
            return String(format: "%.0f B/s", bytesPerSecond)
        }
    }
}

struct UploadTaskRow: View {
    @ObservedObject var task: UploadTask
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 文件名和状态
            HStack {
                Image(systemName: iconName)
                    .foregroundColor(iconColor)
                
                Text(task.fileName)
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                
                Spacer()
                
                HStack(spacing: 4) {
                    Text(task.status.rawValue)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(statusColor)
                    
                    // 上传中时显示百分比
                    if task.status == .uploading || task.status == .merging {
                        Text("\(Int(task.progress * 100))%")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            // 进度条
            if task.status == .uploading || task.status == .merging {
                ProgressView(value: task.progress)
                    .progressViewStyle(.linear)
                    .tint(accentColor)
                
                HStack {
                    // Cancel按钮在左侧
                    Button(role: .destructive) {
                        task.cancel()
                    } label: {
                        Text(String(localized: "action.cancel"))
                            .font(.system(size: 13))
                    }
                    
                    Spacer()
                    
                    // 速率和容量在右侧
                    if !task.speed.isEmpty {
                        Text(task.speed)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                    
                    Text(formatSize(task.uploadedBytes) + " / " + formatSize(task.fileSize))
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                }
            }
            
            // 等待中的取消按钮
            if task.status == .pending {
                Button(role: .destructive) {
                    task.cancel()
                } label: {
                    Text(String(localized: "action.cancel"))
                        .font(.system(size: 13))
                }
            }
            
            // 失败信息和重试按钮
            if task.status == .failed {
                HStack(alignment: .top) {
                    if let error = task.errorMessage {
                        Text(error)
                            .font(.system(size: 12))
                            .foregroundColor(.red)
                    }
                    
                    Spacer()
                    
                    // 重新上传按钮在最右侧
                    Button {
                        Task {
                            await UploadService.shared.retryTask(task)
                        }
                    } label: {
                        Label("重新上传", systemImage: "arrow.up.circle")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(accentColor)
                    }
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    private var iconName: String {
        switch task.status {
        case .pending: return "clock"
        case .uploading: return "arrow.up.circle"
        case .merging: return "gearshape"
        case .completed: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .cancelled: return "xmark.circle"
        }
    }
    
    private var iconColor: Color {
        switch task.status {
        case .pending: return .secondary
        case .uploading: return accentColor
        case .merging: return .orange
        case .completed: return .green
        case .failed: return .red
        case .cancelled: return .secondary
        }
    }
    
    private var statusColor: Color {
        switch task.status {
        case .completed: return .green
        case .failed: return .red
        default: return .secondary
        }
    }
    
    private func formatSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - 文件选择器

struct FilePickerView: View {
    let destinationPath: String
    var onDismiss: () -> Void = {}
    
    @State private var isUploading = false
    @State private var totalFiles = 0
    @State private var currentFileIndex = 0
    @State private var currentFileName = ""
    @State private var pendingUrls: [URL] = []
    
    // 字节级进度跟踪
    @State private var totalBytes: Int64 = 0
    @State private var uploadedBytes: Int64 = 0
    @State private var uploadSpeed: Double = 0
    @State private var uploadStartTime: Date?
    
    var body: some View {
        ZStack {
            if isUploading {
                uploadProgressView
            } else {
                DocumentPickerWrapper(
                    onPick: { urls in
                        pendingUrls = urls
                        startUpload()
                    },
                    onCancel: {
                        onDismiss()
                    }
                )
            }
        }
    }
    
    private var uploadProgressView: some View {
        ZStack {
            Color.black.opacity(0.4)
                .ignoresSafeArea()
            
            VStack(spacing: 20) {
                // 圆形进度条
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.2), lineWidth: 4)
                        .frame(width: 70, height: 70)
                    
                    Circle()
                        .trim(from: 0, to: CGFloat(uploadedBytes) / CGFloat(max(totalBytes, 1)))
                        .stroke(Color(red: 1.0, green: 0.82, blue: 0.0), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .frame(width: 70, height: 70)
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 0.3), value: uploadedBytes)
                    
                    Text("\(Int(Double(uploadedBytes) / Double(max(totalBytes, 1)) * 100))%")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                }
                
                VStack(spacing: 6) {
                    Text("upload.uploading")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Text(currentFileName)
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.9))
                        .lineLimit(1)
                    
                    Text("\(formatBytes(uploadedBytes)) / \(formatBytes(totalBytes))")
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.9))
                    
                    HStack(spacing: 12) {
                        if uploadSpeed > 0 {
                            Text(formatSpeed(uploadSpeed))
                                .font(.system(size: 12))
                                .foregroundColor(.white.opacity(0.7))
                        }
                        
                        if let remaining = estimatedRemainingTime {
                            Text(remaining)
                                .font(.system(size: 12))
                                .foregroundColor(.white.opacity(0.7))
                        }
                    }
                    
                    Text("\(currentFileIndex) / \(totalFiles)")
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            .padding(30)
            .background(Material.ultraThinMaterial)
            .background(Color.gray.opacity(0.1))
            .cornerRadius(20)
            .shadow(radius: 10)
        }
    }
    
    private func startUpload() {
        guard !pendingUrls.isEmpty else {
            onDismiss()
            return
        }
        
        Task {
            do {
                try await UploadService.shared.uploadFiles(
                    fileURLs: pendingUrls,
                    destinationPath: destinationPath
                )
            } catch {
                print("Batch upload failed: \(error)")
            }
            onDismiss()
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
    
    private func formatSpeed(_ bytesPerSecond: Double) -> String {
        if bytesPerSecond >= 1024 * 1024 {
            return String(format: "%.1f MB/s", bytesPerSecond / 1024 / 1024)
        } else if bytesPerSecond >= 1024 {
            return String(format: "%.0f KB/s", bytesPerSecond / 1024)
        } else {
            return String(format: "%.0f B/s", bytesPerSecond)
        }
    }
    
    private var estimatedRemainingTime: String? {
        guard uploadSpeed > 0, totalBytes > uploadedBytes else { return nil }
        let remainingBytes = Double(totalBytes - uploadedBytes)
        let remainingSeconds = remainingBytes / uploadSpeed
        
        if remainingSeconds < 60 {
            return String(format: String(localized: "upload.remaining_seconds"), Int(remainingSeconds))
        } else if remainingSeconds < 3600 {
            return String(format: String(localized: "upload.remaining_minutes"), Int(remainingSeconds / 60))
        } else {
            return String(format: String(localized: "upload.remaining_hours"), Int(remainingSeconds / 3600))
        }
    }
}

// MARK: - 文档选择器包装

struct DocumentPickerWrapper: UIViewControllerRepresentable {
    let onPick: ([URL]) -> Void
    let onCancel: () -> Void
    
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        picker.allowsMultipleSelection = true
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick, onCancel: onCancel)
    }
    
    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: ([URL]) -> Void
        let onCancel: () -> Void
        
        init(onPick: @escaping ([URL]) -> Void, onCancel: @escaping () -> Void) {
            self.onPick = onPick
            self.onCancel = onCancel
        }
        
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            onPick(urls)
        }
        
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            onCancel()
        }
    }
}

// MARK: - 照片选择器

struct PhotoPickerView: View {
    let destinationPath: String
    var onDismiss: () -> Void = {}
    
    @State private var isUploading = false
    @State private var totalFiles = 0
    @State private var currentFileIndex = 0
    @State private var currentFileName = ""
    @State private var pendingResults: [PHPickerResult] = []
    
    // 字节级进度跟踪
    @State private var totalBytes: Int64 = 0
    @State private var uploadedBytes: Int64 = 0
    @State private var uploadSpeed: Double = 0
    @State private var uploadStartTime: Date?
    
    var body: some View {
        ZStack {
            if isUploading {
                uploadProgressView
            } else {
                PHPickerWrapper(
                    onPick: { results in
                        pendingResults = results
                        startUpload()
                    },
                    onCancel: {
                        onDismiss()
                    }
                )
            }
        }
    }
    
    private var uploadProgressView: some View {
        ZStack {
            Color.black.opacity(0.4)
                .ignoresSafeArea()
            
            VStack(spacing: 20) {
                // 圆形进度条
                ZStack {
                    Circle()
                        .stroke(Color.white.opacity(0.2), lineWidth: 4)
                        .frame(width: 70, height: 70)
                    
                    Circle()
                        .trim(from: 0, to: CGFloat(uploadedBytes) / CGFloat(max(totalBytes, 1)))
                        .stroke(Color(red: 1.0, green: 0.82, blue: 0.0), style: StrokeStyle(lineWidth: 4, lineCap: .round))
                        .frame(width: 70, height: 70)
                        .rotationEffect(.degrees(-90))
                        .animation(.linear(duration: 0.3), value: uploadedBytes)
                    
                    Text("\(Int(Double(uploadedBytes) / Double(max(totalBytes, 1)) * 100))%")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                }
                
                VStack(spacing: 6) {
                    Text("upload.uploading")
                        .font(.headline)
                        .foregroundColor(.white)
                    
                    Text(currentFileName)
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.9))
                        .lineLimit(1)
                    
                    Text("\(formatBytes(uploadedBytes)) / \(formatBytes(totalBytes))")
                        .font(.system(size: 13))
                        .foregroundColor(.white.opacity(0.9))
                    
                    HStack(spacing: 12) {
                        if uploadSpeed > 0 {
                            Text(formatSpeed(uploadSpeed))
                                .font(.system(size: 12))
                                .foregroundColor(.white.opacity(0.7))
                        }
                        
                        if let remaining = estimatedRemainingTime {
                            Text(remaining)
                                .font(.system(size: 12))
                                .foregroundColor(.white.opacity(0.7))
                        }
                    }
                    
                    Text("\(currentFileIndex) / \(totalFiles)")
                        .font(.system(size: 11))
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            .padding(30)
            .background(Material.ultraThinMaterial)
            .background(Color.gray.opacity(0.1))
            .cornerRadius(20)
            .shadow(radius: 10)
        }
    }
    
    private func startUpload() {
        guard !pendingResults.isEmpty else {
            onDismiss()
            return
        }
        
        Task {
            // 先导出所有照片
            var exportedURLs: [URL] = []
            for result in pendingResults {
                if let fileURL = await exportFile(from: result) {
                    exportedURLs.append(fileURL)
                }
            }
            
            // 批量上传
            do {
                try await UploadService.shared.uploadFiles(
                    fileURLs: exportedURLs,
                    destinationPath: destinationPath
                )
            } catch {
                print("Batch photo upload failed: \(error)")
            }
            
            // 清理临时文件
            for url in exportedURLs {
                try? FileManager.default.removeItem(at: url)
            }
            
            onDismiss()
        }
    }
    
    private func exportFile(from result: PHPickerResult) async -> URL? {
        let itemProvider = result.itemProvider
        
        // 获取原始文件名
        let suggestedName = itemProvider.suggestedName ?? "photo"
        
        // 尝试导出视频
        if itemProvider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
            return await withCheckedContinuation { continuation in
                itemProvider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, error in
                    guard let url = url else {
                        continuation.resume(returning: nil)
                        return
                    }
                    
                    // 保留原始文件名
                    let ext = url.pathExtension.isEmpty ? "mp4" : url.pathExtension
                    let fileName = suggestedName.hasSuffix(".\(ext)") ? suggestedName : "\(suggestedName).\(ext)"
                    let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                    
                    // 如果文件已存在,先删除
                    try? FileManager.default.removeItem(at: tempURL)
                    
                    do {
                        try FileManager.default.copyItem(at: url, to: tempURL)
                        continuation.resume(returning: tempURL)
                    } catch {
                        continuation.resume(returning: nil)
                    }
                }
            }
        }
        
        // 尝试导出图片
        let imageTypes = [UTType.heic.identifier, UTType.jpeg.identifier, UTType.png.identifier, UTType.image.identifier]
        
        for typeId in imageTypes {
            if itemProvider.hasItemConformingToTypeIdentifier(typeId) {
                if let url = await loadFileRepresentation(from: itemProvider, typeIdentifier: typeId, suggestedName: suggestedName) {
                    return url
                }
            }
        }
        
        return nil
    }
    
    private func loadFileRepresentation(from itemProvider: NSItemProvider, typeIdentifier: String, suggestedName: String) async -> URL? {
        return await withCheckedContinuation { continuation in
            itemProvider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { url, error in
                guard let url = url else {
                    continuation.resume(returning: nil)
                    return
                }
                
                // 保留原始文件名
                var ext = url.pathExtension
                if ext.isEmpty {
                    ext = "jpg"
                }
                let fileName = suggestedName.hasSuffix(".\(ext)") ? suggestedName : "\(suggestedName).\(ext)"
                let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                
                // 如果文件已存在,先删除
                try? FileManager.default.removeItem(at: tempURL)
                
                do {
                    try FileManager.default.copyItem(at: url, to: tempURL)
                    continuation.resume(returning: tempURL)
                } catch {
                    continuation.resume(returning: nil)
                }
            }
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
    
    private func formatSpeed(_ bytesPerSecond: Double) -> String {
        if bytesPerSecond >= 1024 * 1024 {
            return String(format: "%.1f MB/s", bytesPerSecond / 1024 / 1024)
        } else if bytesPerSecond >= 1024 {
            return String(format: "%.0f KB/s", bytesPerSecond / 1024)
        } else {
            return String(format: "%.0f B/s", bytesPerSecond)
        }
    }
    
    private var estimatedRemainingTime: String? {
        guard uploadSpeed > 0, totalBytes > uploadedBytes else { return nil }
        let remainingBytes = Double(totalBytes - uploadedBytes)
        let remainingSeconds = remainingBytes / uploadSpeed
        
        if remainingSeconds < 60 {
            return String(format: String(localized: "upload.remaining_seconds"), Int(remainingSeconds))
        } else if remainingSeconds < 3600 {
            return String(format: String(localized: "upload.remaining_minutes"), Int(remainingSeconds / 60))
        } else {
            return String(format: String(localized: "upload.remaining_hours"), Int(remainingSeconds / 3600))
        }
    }
}

// MARK: - PHPicker 包装

struct PHPickerWrapper: UIViewControllerRepresentable {
    let onPick: ([PHPickerResult]) -> Void
    let onCancel: () -> Void
    
    func makeUIViewController(context: Context) -> PHPickerViewController {
        var config = PHPickerConfiguration()
        config.selectionLimit = 20
        config.filter = .any(of: [.images, .videos])
        
        let picker = PHPickerViewController(configuration: config)
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: PHPickerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(onPick: onPick, onCancel: onCancel)
    }
    
    class Coordinator: NSObject, PHPickerViewControllerDelegate {
        let onPick: ([PHPickerResult]) -> Void
        let onCancel: () -> Void
        
        init(onPick: @escaping ([PHPickerResult]) -> Void, onCancel: @escaping () -> Void) {
            self.onPick = onPick
            self.onCancel = onCancel
        }
        
        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            picker.dismiss(animated: true)
            if results.isEmpty {
                onCancel()
            } else {
                onPick(results)
            }
        }
    }
}

#Preview {
    UploadProgressView()
}
