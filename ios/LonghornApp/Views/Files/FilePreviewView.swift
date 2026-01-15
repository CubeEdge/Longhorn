//
//  FilePreviewView.swift
//  LonghornApp
//
//  文件预览视图
//

import SwiftUI
import QuickLook

import AVKit

struct FilePreviewView: View {
    let file: FileItem
    
    @State private var localURL: URL?
    @State private var previewImage: UIImage?
    @State private var isLoading = false
    @State private var isDownloadingOriginal = false
    @State private var hasOriginal = false
    @State private var showShareSheet = false
    @Environment(\.dismiss) private var dismiss
    
    // Remote URL for streaming video
    private var remoteURL: URL? {
        let encodedPath = file.path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? file.path
        return URL(string: "\(APIClient.shared.baseURL)/preview/\(encodedPath)?raw=true")
    }
    
    // Preview URL (smaller, faster loading)
    private var previewURL: URL? {
        let encodedPath = file.path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? file.path
        return URL(string: "\(APIClient.shared.baseURL)/api/thumbnail?path=\(encodedPath)&size=preview")
    }
    
    private let videoExtensions = ["mp4", "mov", "m4v", "avi", "hevc"]
    private let imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]
    
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            
            // Content
            if isVideo {
                videoContent
            } else if isImage {
                imageContent
            } else {
                documentContent
            }
            
            // Loading Overlay
            if isLoading || isDownloadingOriginal {
                loadingOverlay
            }
        }
        .navigationTitle(file.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .bottomBar) {
                bottomToolbar
            }
        }
        .sheet(isPresented: $showShareSheet) {
            if let url = localURL {
                ShareSheet(activityItems: [url])
            }
        }
        .task {
            await loadContent()
        }
    }
    
    // MARK: - Content Views
    
    @ViewBuilder
    private var videoContent: some View {
        if let url = localURL {
            VideoPlayer(player: AVPlayer(url: url))
                .edgesIgnoringSafeArea(.all)
        } else if let url = remoteURL {
            VideoPlayer(player: AVPlayer(url: url))
                .edgesIgnoringSafeArea(.all)
        }
    }
    
    @ViewBuilder
    private var imageContent: some View {
        if let image = previewImage {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .edgesIgnoringSafeArea(.all)
        } else {
            ProgressView()
        }
    }
    
    @ViewBuilder
    private var documentContent: some View {
        if let url = localURL {
            QuickLookPreview(url: url)
        } else {
            downloadStateView
        }
    }
    
    private var loadingOverlay: some View {
        VStack(spacing: 12) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                .scaleEffect(1.5)
            Text(isDownloadingOriginal ? "正在下载原图..." : "加载中...")
                .foregroundColor(.white)
        }
        .padding(30)
        .background(.ultraThinMaterial.opacity(0.8))
        .cornerRadius(16)
    }
    
    private var downloadStateView: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.text")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            Text(file.name)
                .font(.headline)
                .foregroundColor(.white)
            
            Button {
                Task { await downloadOriginal() }
            } label: {
                Label("下载预览", systemImage: "arrow.down.circle.fill")
                    .font(.headline)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(12)
            }
        }
    }
    
    private var bottomToolbar: some View {
        HStack(spacing: 40) {
            // Star
            Button {
                Task {
                    try? await FileService.shared.toggleStar(path: file.path)
                    ToastManager.shared.show("已收藏", type: .success)
                }
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: file.isStarred == true ? "star.fill" : "star")
                        .font(.system(size: 22))
                    Text("收藏")
                        .font(.caption2)
                }
            }
            .foregroundColor(file.isStarred == true ? .orange : .primary)
            
            // Download Original
            Button {
                Task { await downloadOriginal() }
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: hasOriginal ? "checkmark.circle.fill" : "arrow.down.circle")
                        .font(.system(size: 22))
                    Text(hasOriginal ? "已下载" : "原图(\(file.formattedSize))")
                        .font(.caption2)
                }
            }
            .foregroundColor(hasOriginal ? .green : .blue)
            .disabled(isDownloadingOriginal || hasOriginal)
            
            // Share
            Button {
                Task {
                    // Must download original before sharing
                    if !hasOriginal {
                        await downloadOriginal()
                    }
                    if localURL != nil {
                        showShareSheet = true
                    }
                }
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 22))
                    Text("分享")
                        .font(.caption2)
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    // MARK: - Data Loading
    
    private var isVideo: Bool {
        videoExtensions.contains((file.name as NSString).pathExtension.lowercased())
    }
    
    private var isImage: Bool {
        imageExtensions.contains((file.name as NSString).pathExtension.lowercased())
    }
    
    private func loadContent() async {
        isLoading = true
        
        // 1. Check Disk Cache for original
        if let cachedURL = await PreviewCacheManager.shared.getCachedURL(for: file.path) {
            await MainActor.run {
                self.localURL = cachedURL
                self.hasOriginal = true
                self.isLoading = false
            }
            // Load cached image for display
            if isImage, let data = try? Data(contentsOf: cachedURL), let img = UIImage(data: data) {
                await MainActor.run { self.previewImage = img }
            }
            return
        }
        
        // 2. Smart Preview Logic
        // If size is unknown (nil or 0), default to treating as large image (use preview)
        let fileSize = file.size ?? 0
        let sizeIsKnown = file.size != nil && file.size! > 0
        let isSmallImage = isImage && sizeIsKnown && fileSize <= 1_048_576 // 1MB
        let isLargeImage = isImage && (!sizeIsKnown || fileSize > 1_048_576) // Unknown or > 1MB
        
        print("[Preview] File: \(file.name), Size: \(fileSize), sizeKnown: \(sizeIsKnown), isSmallImage: \(isSmallImage), isLargeImage: \(isLargeImage)")
        
        // 3. For LARGE images (>1MB): Use server preview API
        if isLargeImage, let url = previewURL {
            print("[Preview] Loading preview from: \(url)")
            do {
                var request = URLRequest(url: url)
                if let token = AuthManager.shared.token {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                let (data, response) = try await URLSession.shared.data(for: request)
                if let httpResponse = response as? HTTPURLResponse {
                    print("[Preview] Preview response: \(httpResponse.statusCode), bytes: \(data.count)")
                }
                if let image = UIImage(data: data) {
                    await MainActor.run {
                        self.previewImage = image
                        self.isLoading = false
                    }
                    print("[Preview] Preview loaded successfully")
                    return // SUCCESS - Don't download original
                } else {
                    print("[Preview] Failed to decode image from preview data")
                }
            } catch {
                print("[Preview] Failed to load preview: \(error)")
            }
            
            // Large image preview failed - show placeholder, DON'T auto-download original
            await MainActor.run {
                self.previewImage = nil // Will show ProgressView placeholder
                self.isLoading = false
            }
            ToastManager.shared.show("预览加载失败，请点击下载原图", type: .warning)
            return
        }
        
        // 4. For SMALL images or NON-images: Download original directly
        if isSmallImage || (!isImage && !isVideo) {
            print("[Preview] Downloading original for small/non-image file")
            await downloadOriginal()
        }
        
        // 5. For videos: Just stop loading (streaming handled by videoContent)
        await MainActor.run { self.isLoading = false }
    }
    
    private func downloadOriginal() async {
        guard !hasOriginal else { return }
        
        await MainActor.run { isDownloadingOriginal = true }
        
        do {
            let url = try await APIClient.shared.downloadFile(path: file.path)
            await PreviewCacheManager.shared.cache(url: url, for: file.path)
            
            // Update preview image with full resolution
            if isImage, let data = try? Data(contentsOf: url), let img = UIImage(data: data) {
                await MainActor.run { self.previewImage = img }
            }
            
            await MainActor.run {
                self.localURL = url
                self.hasOriginal = true
                self.isDownloadingOriginal = false
            }
            ToastManager.shared.show("原图已下载", type: .success)
        } catch {
            print("[Preview] Download original failed: \(error)")
            await MainActor.run { self.isDownloadingOriginal = false }
            ToastManager.shared.show("下载失败", type: .error)
        }
    }
}

// MARK: - Share Sheet
struct ShareSheet: UIViewControllerRepresentable {
    let activityItems: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - QuickLook 预览包装

struct QuickLookPreview: UIViewControllerRepresentable {
    let url: URL
    
    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }
    
    class Coordinator: NSObject, QLPreviewControllerDataSource {
        let parent: QuickLookPreview
        
        init(parent: QuickLookPreview) {
            self.parent = parent
        }
        
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
            return 1
        }
        
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            return parent.url as QLPreviewItem
        }
    }
}
