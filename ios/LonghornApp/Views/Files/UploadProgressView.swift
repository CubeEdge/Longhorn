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
        
        Task {
            // 第一阶段：收集所有文件数据和大小
            var filesToUpload: [(data: Data, ext: String, size: Int64)] = []
            
            for item in items {
                do {
                    if let data = try await item.loadTransferable(type: Data.self) {
                        let ext = getFileExtension(for: item)
                        let size = Int64(data.count)
                        filesToUpload.append((data: data, ext: ext, size: size))
                    }
                } catch {
                    print("Load failed: \(error)")
                }
            }
            
            // 计算总大小
            let calculatedTotalBytes = filesToUpload.reduce(0) { $0 + $1.size }
            await MainActor.run {
                totalBytes = calculatedTotalBytes
            }
            
            // 第二阶段：逐个上传文件并监听实时进度
            var completedFilesBytes: Int64 = 0  // 已完成文件的总字节数
            
            for (index, fileInfo) in filesToUpload.enumerated() {
                do {
                    // 创建临时文件
                    let fileName = "\(UUID().uuidString).\(fileInfo.ext)"
                    let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                    try fileInfo.data.write(to: tempURL)
                    
                    // 启动异步监听进度的任务
                    let progressTask = Task { @MainActor in
                        // 监听 UploadService 中最新任务的进度
                        let uploadService = UploadService.shared
                        while isUploading {
                            // 查找当前文件对应的上传任务
                            if let currentTask = uploadService.activeTasks.last,
                               currentTask.status == .uploading || currentTask.status == .merging {
                                // 计算总进度：已完成文件字节 + 当前文件已上传字节
                                let currentProgress = completedFilesBytes + currentTask.uploadedBytes
                                uploadedBytes = currentProgress
                                
                                // 计算速度
                                if let startTime = uploadStartTime {
                                    let elapsed = Date().timeIntervalSince(startTime)
                                    if elapsed > 0 && currentProgress > 0 {
                                        uploadSpeed = Double(currentProgress) / elapsed
                                    }
                                }
                            }
                            try? await Task.sleep(nanoseconds: 100_000_000) // 每0.1秒更新一次
                        }
                    }
                    
                    // 执行上传
                    try await UploadService.shared.uploadFile(
                        fileURL: tempURL,
                        destinationPath: destinationPath
                    )
                    
                    // 取消进度监听
                    progressTask.cancel()
                    
                    // 更新已完成文件总字节数
                    completedFilesBytes += fileInfo.size
                    
                    await MainActor.run {
                        uploadedBytes = completedFilesBytes
                        itemsProcessed = index + 1
                        
                        // 更新速度
                        if let startTime = uploadStartTime {
                            let elapsed = Date().timeIntervalSince(startTime)
                            if elapsed > 0 {
                                uploadSpeed = Double(completedFilesBytes) / elapsed
                            }
                        }
                    }
                    
                    // 删除临时文件
                    try? FileManager.default.removeItem(at: tempURL)
                } catch {
                    print("Upload failed: \(error)")
                    await MainActor.run {
                        itemsProcessed += 1
                    }
                }
            }
            
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

#Preview {
    UploadProgressView()
}
