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
    
    var body: some View {
        NavigationStack {
            Group {
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
                    Button(String(localized: "action.close")) { onDismiss() }
                }
                
                if !uploadService.activeTasks.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button(String(localized: "upload.clear_completed")) {
                            uploadService.removeCompletedTasks()
                        }
                    }
                }
            }
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
                
                Text(task.status.rawValue)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(statusColor)
            }
            
            // 进度条
            if task.status == .uploading || task.status == .merging {
                ProgressView(value: task.progress)
                    .progressViewStyle(.linear)
                    .tint(accentColor)
                
                HStack {
                    Text("\(Int(task.progress * 100))%")
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
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
            
            // 失败信息
            if task.status == .failed, let error = task.errorMessage {
                Text(error)
                    .font(.system(size: 12))
                    .foregroundColor(.red)
            }
            
            // 取消按钮
            if task.status == .uploading || task.status == .pending {
                Button(role: .destructive) {
                    task.cancel()
                } label: {
                    Text(String(localized: "action.cancel"))
                        .font(.system(size: 13))
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
    
    @State private var showPicker = true
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
        NavigationStack {
            Group {
                if isUploading {
                    uploadProgressView
                } else {
                    Color.clear
                }
            }
            .navigationTitle("browser.upload_file")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.cancel") {
                        onDismiss()
                    }
                }
            }
        }
        .sheet(isPresented: $showPicker, onDismiss: {
            if pendingUrls.isEmpty && !isUploading {
                onDismiss()
            }
        }) {
            DocumentPickerWrapper(
                onPick: { urls in
                    pendingUrls = urls
                    showPicker = false
                    startUpload()
                },
                onCancel: {
                    showPicker = false
                    onDismiss()
                }
            )
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
        
        isUploading = true
        uploadStartTime = Date()
        totalFiles = pendingUrls.count
        currentFileIndex = 0
        totalBytes = 0
        uploadedBytes = 0
        uploadSpeed = 0
        
        // 计算总大小
        for url in pendingUrls {
            if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
               let size = attrs[.size] as? Int64 {
                totalBytes += size
            }
        }
        
        if totalBytes == 0 {
            totalBytes = 1 // 避免除零
        }
        
        Task { @MainActor in
            var completedBytes: Int64 = 0
            
            // 启动进度监听
            let progressTask = Task { @MainActor in
                let uploadService = UploadService.shared
                while isUploading {
                    if let currentTask = uploadService.activeTasks.last,
                       (currentTask.status == .uploading || currentTask.status == .merging) {
                        let currentJobBytes = currentTask.uploadedBytes
                        uploadedBytes = completedBytes + currentJobBytes
                        
                        if let startTime = uploadStartTime {
                            let elapsed = Date().timeIntervalSince(startTime)
                            if elapsed > 0 && uploadedBytes > 0 {
                                uploadSpeed = Double(uploadedBytes) / elapsed
                            }
                        }
                    }
                    try? await Task.sleep(nanoseconds: 100_000_000)
                }
            }
            
            for (index, url) in pendingUrls.enumerated() {
                currentFileIndex = index + 1
                currentFileName = url.lastPathComponent
                
                let fileSize: Int64
                if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
                   let size = attrs[.size] as? Int64 {
                    fileSize = size
                } else {
                    fileSize = 0
                }
                
                do {
                    try await UploadService.shared.uploadFile(
                        fileURL: url,
                        destinationPath: destinationPath
                    )
                    completedBytes += fileSize
                    uploadedBytes = completedBytes
                } catch {
                    print("Upload failed: \(error)")
                }
            }
            
            progressTask.cancel()
            isUploading = false
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
    
    @State private var showPicker = true
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
        NavigationStack {
            Group {
                if isUploading {
                    uploadProgressView
                } else {
                    Color.clear
                }
            }
            .navigationTitle("browser.upload_photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.cancel") {
                        onDismiss()
                    }
                }
            }
        }
        .sheet(isPresented: $showPicker, onDismiss: {
            if pendingResults.isEmpty && !isUploading {
                onDismiss()
            }
        }) {
            PHPickerWrapper(
                onPick: { results in
                    pendingResults = results
                    showPicker = false
                    startUpload()
                },
                onCancel: {
                    showPicker = false
                    onDismiss()
                }
            )
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
        
        isUploading = true
        uploadStartTime = Date()
        totalFiles = pendingResults.count
        currentFileIndex = 0
        totalBytes = 1 // 避免除零,后面会更新
        uploadedBytes = 0
        uploadSpeed = 0
        currentFileName = String(localized: "browser.upload.exporting")
        
        Task { @MainActor in
            var completedBytes: Int64 = 0
            var totalExportedSize: Int64 = 0
            
            // 启动进度监听
            let progressTask = Task { @MainActor in
                let uploadService = UploadService.shared
                while isUploading {
                    if let currentTask = uploadService.activeTasks.last,
                       (currentTask.status == .uploading || currentTask.status == .merging) {
                        let currentJobBytes = currentTask.uploadedBytes
                        uploadedBytes = completedBytes + currentJobBytes
                        
                        if let startTime = uploadStartTime {
                            let elapsed = Date().timeIntervalSince(startTime)
                            if elapsed > 0 && uploadedBytes > 0 {
                                uploadSpeed = Double(uploadedBytes) / elapsed
                            }
                        }
                    }
                    try? await Task.sleep(nanoseconds: 100_000_000)
                }
            }
            
            // 边导出边上传
            for (index, result) in pendingResults.enumerated() {
                currentFileIndex = index + 1
                currentFileName = String(localized: "browser.upload.exporting") + " \(index + 1)/\(pendingResults.count)..."
                
                // 导出文件
                guard let fileURL = await exportFile(from: result) else {
                    continue
                }
                
                // 获取文件大小
                var fileSize: Int64 = 0
                if let attrs = try? FileManager.default.attributesOfItem(atPath: fileURL.path),
                   let size = attrs[.size] as? Int64 {
                    fileSize = size
                    totalExportedSize += size
                    totalBytes = totalExportedSize
                }
                
                currentFileName = fileURL.lastPathComponent
                
                // 上传文件
                do {
                    try await UploadService.shared.uploadFile(
                        fileURL: fileURL,
                        destinationPath: destinationPath
                    )
                    completedBytes += fileSize
                    uploadedBytes = completedBytes
                } catch {
                    print("Upload failed: \(error)")
                }
                
                // 清理临时文件
                try? FileManager.default.removeItem(at: fileURL)
            }
            
            progressTask.cancel()
            isUploading = false
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
