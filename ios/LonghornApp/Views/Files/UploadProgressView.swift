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
                        "没有上传任务",
                        systemImage: "arrow.up.circle",
                        description: Text("上传的文件将显示在这里")
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
            .navigationTitle("上传任务")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { onDismiss() }
                }
                
                if !uploadService.activeTasks.isEmpty {
                    ToolbarItem(placement: .primaryAction) {
                        Button("清除已完成") {
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
                    Text("取消")
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
    
    @State private var selectedItems: [PhotosPickerItem] = []
    @State private var isUploading = false
    
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
                            .font(.system(size: 48))
                            .foregroundColor(.blue)
                        
                        Text("选择照片或视频")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .onChange(of: selectedItems) { _, items in
                    if !items.isEmpty {
                        uploadSelectedItems(items)
                    }
                }
            }
            .navigationTitle("上传照片")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { onDismiss() }
                }
            }
            .overlay {
                if isUploading {
                    ProgressView("处理中...")
                        .padding()
                        .background(.regularMaterial)
                        .cornerRadius(12)
                }
            }
        }
    }
    
    private func uploadSelectedItems(_ items: [PhotosPickerItem]) {
        isUploading = true
        
        Task {
            for item in items {
                do {
                    // 获取文件数据
                    if let data = try await item.loadTransferable(type: Data.self) {
                        // 创建临时文件
                        let fileName = "\(UUID().uuidString).\(getFileExtension(for: item))"
                        let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                        try data.write(to: tempURL)
                        
                        // 上传
                        try await UploadService.shared.uploadFile(
                            fileURL: tempURL,
                            destinationPath: destinationPath
                        )
                        
                        // 删除临时文件
                        try? FileManager.default.removeItem(at: tempURL)
                    }
                } catch {
                    print("Upload failed: \(error)")
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
}

#Preview {
    UploadProgressView()
}
