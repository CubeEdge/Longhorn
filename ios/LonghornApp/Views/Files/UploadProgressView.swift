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

struct FilePickerView: UIViewControllerRepresentable {
    let destinationPath: String
    var onDismiss: () -> Void = {}
    
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        picker.allowsMultipleSelection = true
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(destinationPath: destinationPath, onDismiss: onDismiss)
    }
    
    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let destinationPath: String
        let onDismiss: () -> Void
        
        init(destinationPath: String, onDismiss: @escaping () -> Void) {
            self.destinationPath = destinationPath
            self.onDismiss = onDismiss
        }
        
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            for url in urls {
                Task {
                    do {
                        try await UploadService.shared.uploadFile(
                            fileURL: url,
                            destinationPath: destinationPath
                        )
                    } catch {
                        print("Upload failed: \(error)")
                    }
                }
            }
            onDismiss()
        }
        
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            onDismiss()
        }
    }
}

// MARK: - 照片选择器

struct PhotoPickerView: View {
    let destinationPath: String
    var onDismiss: () -> Void = {}
    
    @State private var itemsProcessed = 0
    @State private var totalItems = 0
    @State private var selectedItems: [PhotosPickerItem] = []
    @State private var isUploading = false
    
    // 字节级进度跟踪
    @State private var totalBytes: Int64 = 0
    @State private var uploadedBytes: Int64 = 0
    @State private var uploadSpeed: Double = 0  // bytes per second
    @State private var uploadStartTime: Date?
    
    var body: some View {
        NavigationStack {
            VStack {
                PhotosPicker(
                    selection: $selectedItems,
                    maxSelectionCount: 20,
                    matching: .any(of: [.images, .videos])
                ) {
                    VStack(spacing: 16) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.system(size: 64))
                            .foregroundColor(.blue)
                        
                        Text("browser.upload_photo")
                            .font(.headline)
                        
                        Text("action.select_up_to_20")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .onChange(of: selectedItems) { _, items in
                    if !items.isEmpty {
                        totalItems = items.count
                        itemsProcessed = 0
                        uploadSelectedItems(items)
                    }
                }
            }
            .navigationTitle("browser.upload_photo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.cancel") { onDismiss() }
                }
            }
            .overlay {
                if isUploading {
                    ZStack {
                        Color.black.opacity(0.4)
                            .ignoresSafeArea()
                        
                        VStack(spacing: 20) {
                            // 圆形进度条 - 基于字节数
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
                                Text("browser.upload.exporting")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                
                                // 进度详情：已上传 / 总大小
                                Text("\(formatBytes(uploadedBytes)) / \(formatBytes(totalBytes))")
                                    .font(.system(size: 13))
                                    .foregroundColor(.white.opacity(0.9))
                                
                                // 速度和剩余时间
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
                                
                                // 文件数进度 (次要)
                                Text("\(itemsProcessed) / \(totalItems)")
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
            }
        }
    }
    
    private func uploadSelectedItems(_ items: [PhotosPickerItem]) {
        isUploading = true
        uploadStartTime = Date()
        totalBytes = 0
        uploadedBytes = 0
        uploadSpeed = 0
        
        Task { @MainActor in
            typealias UploadJob = (url: URL, size: Int64, ext: String)
            
            let stream = AsyncStream(UploadJob.self) { continuation in
                Task {
                    for item in items {
                        if !isUploading { break }
                        
                        do {
                            // 使用 FileTransferable 获取文件 URL (避免加载 Data 到内存)
                            if let taskFile = try await item.loadTransferable(type: TaskFile.self) {
                                let attributes = try FileManager.default.attributesOfItem(atPath: taskFile.url.path)
                                let size = attributes[.size] as? Int64 ?? 0
                                let ext = taskFile.url.pathExtension
                                
                                await MainActor.run {
                                    totalBytes += size
                                }
                                
                                continuation.yield((url: taskFile.url, size: size, ext: ext))
                            }
                        } catch {
                            print("Load failed: \(error)")
                            await MainActor.run {
                                itemsProcessed += 1
                            }
                        }
                    }
                    continuation.finish()
                }
            }
            
            // 消费者 logic stays similar but simplified
            var completedFilesBytes: Int64 = 0
            
            // 启动进度监听
            let progressTask = Task { @MainActor in
                let uploadService = UploadService.shared
                while isUploading {
                    // Update Progress Logic
                    if let currentTask = uploadService.activeTasks.last,
                       (currentTask.status == .uploading || currentTask.status == .merging) {
                         // Only update if currentTask is actually 'alive' and we are processing it
                         // Note: We might want to verify task.fileName or id match, but .last is usually correct given sequential upload
                        
                        let currentJobBytes = currentTask.uploadedBytes
                        uploadedBytes = completedFilesBytes + currentJobBytes
                        
                        if let startTime = uploadStartTime {
                            let elapsed = Date().timeIntervalSince(startTime)
                            if elapsed > 0 && uploadedBytes > 0 {
                                uploadSpeed = Double(uploadedBytes) / elapsed
                            }
                        }
                    } else {
                        // In between tasks
                        if uploadedBytes < completedFilesBytes {
                            uploadedBytes = completedFilesBytes
                        }
                    }
                    try? await Task.sleep(nanoseconds: 100_000_000)
                }
            }
            
            for await job in stream {
                if !isUploading { break }
                
                do {
                    try await UploadService.shared.uploadFile(
                        fileURL: job.url,
                        destinationPath: destinationPath
                    )
                    
                    completedFilesBytes += job.size
                    
                    await MainActor.run {
                        itemsProcessed += 1
                        uploadedBytes = completedFilesBytes // Ensure we sync at end of file
                    }
                    
                    try? FileManager.default.removeItem(at: job.url)
                    
                } catch {
                    print("Upload failed: \(error)")
                    await MainActor.run {
                        itemsProcessed += 1
                    }
                }
            }
            
            progressTask.cancel()
            
            await MainActor.run {
                isUploading = false
                onDismiss()
            }
        }
    }
    
    private func getFileExtension(for item: PhotosPickerItem) -> String {
        if let contentType = item.supportedContentTypes.first {
            if contentType.conforms(to: .movie) {
                return "mp4"
            } else if contentType.conforms(to: .heic) {
                return "heic"
            } else if contentType.conforms(to: .png) {
                return "png"
            }
        }
        return "jpg"
    }
    
    // MARK: - 辅助方法
    
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

// MARK: - 辅助结构

struct TaskFile: Transferable {
    let url: URL
    
    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .item) { taskFile in
            SentTransferredFile(taskFile.url)
        } importing: { received in
            // Must copy to temporary location as received file might be deleted
            let fileName = received.file.lastPathComponent
            let dst = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString)-\(fileName)")
            // Remove if exists
            try? FileManager.default.removeItem(at: dst)
            try FileManager.default.copyItem(at: received.file, to: dst)
            return TaskFile(url: dst)
        }
    }
}

#Preview {
    UploadProgressView()
}
