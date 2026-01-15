//
//  FilePreviewSheet.swift
//  LonghornApp
//
//  自定义文件预览面板 - 包含下载/分享/文件信息 + OSD隐藏
//

import SwiftUI
import QuickLook
import AVKit

struct FilePreviewSheet: View {
    let file: FileItem
    let previewURL: URL?
    let onClose: () -> Void
    let onDownload: () -> Void
    let onShare: () -> Void
    var onStar: (() -> Void)? = nil  // 用于切换收藏状态
    
    @State private var isLoading = false
    @State private var finalURL: URL? // 最终使用的预览URL (本地或远程)
    @StateObject private var downloader = FileDownloader()
    @State private var isDownloading = false
    @State private var errorMessage: String?
    
    @State private var videoPlayer: AVPlayer?
    @State private var showOSD = true  // OSD可见状态
    @State private var isStarred: Bool  // 收藏状态
    
    @State private var webViewError: String? // Debug state
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    init(file: FileItem, previewURL: URL?, onClose: @escaping () -> Void, onDownload: @escaping () -> Void, onShare: @escaping () -> Void, onStar: (() -> Void)? = nil) {
        self.file = file
        self.previewURL = previewURL
        self.onClose = onClose
        self.onDownload = onDownload
        self.onShare = onShare
        self.onStar = onStar
        self._isStarred = State(initialValue: file.isStarred == true)
    }
    
    var body: some View {
        ZStack {
            // 预览内容（全屏）
            previewContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black)
                .ignoresSafeArea()
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showOSD.toggle()
                    }
                }
            
            // OSD 覆盖层
            if showOSD {
                VStack(spacing: 0) {
                    // 顶部导航栏
                    topBar
                        .transition(.move(edge: .top).combined(with: .opacity))
                    
                    Spacer()
                    
                    // "查看原图" 按钮 (微信风格)
                    // 显示条件: 是大图 且 (没有本地文件 OR 本地文件是缩略图/预览图) 且 未在下载中
                    let isCachedOriginal: Bool = {
                        guard let url = finalURL, let size = file.size else { return false }
                        if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
                           let cachedSize = attrs[.size] as? Int64 {
                            // 如果缓存文件大小接近原图大小 (误差 10KB)，认为是原图
                            return cachedSize >= (size - 10240)
                        }
                        return false
                    }()
                    
                    if isLargeImage && !isCachedOriginal && !isDownloading {
                        Button {
                            // 切换到下载原图模式
                            print("[Preview] User requested original image")
                            finalURL = nil
                            isDownloading = true
                            
                            // 构建原图URL (raw=true)
                            let rawURL = buildPreviewURL(for: file)
                            if let url = rawURL {
                                Task {
                                    await downloadAndCache(url: url)
                                }
                            }
                        } label: {
                            Text("查看原图")
                                .font(.system(size: 14, weight: .medium))
                                .foregroundColor(.white)
                                .padding(.horizontal, 16)
                                .padding(.vertical, 8)
                                .background(.ultraThinMaterial)
                                .cornerRadius(20)
                        }
                        .padding(.bottom, 20) // Spacing above bottom bar
                        .transition(.opacity)
                    }
                    
                    // 底部信息栏
                    bottomInfoBar
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
        }
    }
    
    // MARK: - 顶部栏
    
    private var topBar: some View {
        HStack {
            Button("关闭") {
                onClose()
            }
            .foregroundColor(.white)
            
            Spacer()
            
            Text(file.name)
                .font(.headline)
                .foregroundColor(.white)
                .lineLimit(1)
            
            Spacer()
            
            Menu {
                Button {
                    onDownload()
                } label: {
                    Label("下载", systemImage: "arrow.down.circle")
                }
                
                Button {
                    onShare()
                } label: {
                    Label("分享链接", systemImage: "square.and.arrow.up")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.title2)
                    .foregroundColor(.white)
            }
        }
        .padding()
        .background(
            LinearGradient(
                colors: [Color.black.opacity(0.7), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
    
    // MARK: - 预览内容
    
    @ViewBuilder
    private var previewContent: some View {
        let ext = file.name.split(separator: ".").last?.lowercased() ?? ""
        
        if ["jpg", "jpeg", "png", "gif", "heic", "heif", "webp"].contains(ext) {
            // 图片预览 - 智能选择 (缩略图 -> 预览图/原图 -> 进度条)
            let isLargeImage = (file.size ?? 0) > 1_048_576 || file.size == nil
            let remoteURL = isLargeImage ? buildLargePreviewURL(for: file) : buildPreviewURL(for: file)
            let thumbnailURL = buildThumbnailURL(for: file)
            
            ZStack {
                Color.black // 纯黑背景
                
                // 层级 1: 缩略图 (轻度模糊，瞬间加载)
                if finalURL == nil, let thumbURL = thumbnailURL {
                    AsyncImage(url: thumbURL) { phase in
                        if let image = phase.image {
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .blur(radius: 5)
                                .opacity(0.6)
                        } else {
                            Color.black
                        }
                    }
                }
                
                // 层级 2: 加载进度
                if isDownloading {
                    ZStack {
                        RoundedRectangle(cornerRadius: 16)
                            .fill(.ultraThinMaterial)
                            .frame(width: 80, height: 80)
                        
                        Circle()
                            .stroke(Color.white.opacity(0.2), lineWidth: 4)
                            .frame(width: 40, height: 40)
                        
                        Circle()
                            .trim(from: 0, to: downloader.progress)
                            .stroke(accentColor, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                            .frame(width: 40, height: 40)
                            .rotationEffect(.degrees(-90))
                            .animation(.linear(duration: 0.1), value: downloader.progress)
                        
                        Text("\(Int(downloader.progress * 100))%")
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundColor(.white)
                    }
                    .transition(.scale.combined(with: .opacity))
                    .zIndex(10)
                }
                
                // 层级 3: 最终原图
                if let bgURL = finalURL {
                    AsyncImage(url: bgURL) { phase in
                        switch phase {
                        case .success(let image):
                            ZoomableScrollView {
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fit)
                            }
                            .transition(.opacity.animation(.easeInOut(duration: 0.3)))
                        case .failure:
                            if let url = remoteURL {
                                WebView(url: url, errorMessage: $webViewError)
                            } else {
                                Image(systemName: "exclamationmark.triangle").foregroundColor(.red)
                            }
                        case .empty:
                            ProgressView().tint(.white)
                        @unknown default:
                            EmptyView()
                        }
                    }
                    .id(bgURL)
                }
                
                // 错误提示
                if errorMessage != nil {
                     VStack {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                            .foregroundColor(.yellow)
                        Text("加载失败")
                            .foregroundColor(.white)
                    }
                }
            }
            .task {
                if let cached = await PreviewCacheManager.shared.getCachedURL(for: file.path) {
                    print("[Preview] Hit cache: \(cached.path)")
                    finalURL = cached
                    isDownloading = false
                } else {
                    print("[Preview] Cache miss. Starting progressive download.")
                    finalURL = nil
                    isDownloading = true
                    
                    if let url = remoteURL {
                        await downloadAndCache(url: url)
                    }
                }
            }

        } else if ["mp4", "mov", "m4v", "avi", "hevc"].contains(ext) {
            let remoteURL = buildPreviewURL(for: file)
            
            ZStack {
                Color.black
                ProgressView().tint(.white)
                
                if let url = finalURL ?? remoteURL {
                    VideoPlayer(player: AVPlayer(url: url))
                        .onAppear {
                            videoPlayer = AVPlayer(url: url)
                            videoPlayer?.play()
                        }
                        .onDisappear {
                            videoPlayer?.pause()
                            videoPlayer = nil
                        }
                } else {
                    Text("Invalid URL").foregroundColor(.red)
                }
            }
            .task {
                if let cached = await PreviewCacheManager.shared.getCachedURL(for: file.path) {
                    finalURL = cached
                } else {
                    finalURL = remoteURL
                    if let url = remoteURL {
                        Task.detached(priority: .utility) {
                            do {
                                let (data, _) = try await URLSession.shared.data(from: url)
                                let tempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                                try data.write(to: tempURL)
                                await PreviewCacheManager.shared.cache(url: tempURL, for: file.path)
                                try? FileManager.default.removeItem(at: tempURL)
                            } catch {
                                print("[Video] Cache failed: \(error)")
                            }
                        }
                    }
                }
            }
            
        } else if ["pdf"].contains(ext) {
            if let url = previewURL {
                PDFKitView(url: url)
            } else {
                ProgressView().tint(.white)
            }
            
        } else if ["txt", "md", "json", "xml", "log", "swift", "js", "ts", "py"].contains(ext) {
            if let url = previewURL {
                TextFileView(url: url)
            } else {
                ProgressView().tint(.white)
            }
            
        } else {
            VStack(spacing: 16) {
                Image(systemName: file.systemIconName)
                    .font(.system(size: 80))
                    .foregroundColor(.white.opacity(0.6))
                
                Text("无法预览此文件类型")
                    .foregroundColor(.white.opacity(0.8))
                
                Button {
                    onDownload()
                } label: {
                    Label("下载文件", systemImage: "arrow.down.circle")
                        .font(.headline)
                }
                .buttonStyle(.borderedProminent)
                .tint(accentColor)
            }
        }
    }
    
    // MARK: - 底部信息栏
    
    private var bottomInfoBar: some View {
        VStack(spacing: 12) {
            HStack(spacing: 32) {
                Button {
                    isStarred.toggle()
                    onStar?()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: isStarred ? "star.fill" : "star")
                            .font(.system(size: 28))
                        Text(isStarred ? "已收藏" : "收藏")
                            .font(.caption)
                    }
                }
                .foregroundColor(isStarred ? .orange : .white)
                
                Button {
                    onDownload()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "arrow.down.circle")
                            .font(.system(size: 28))
                        Text("下载")
                            .font(.caption)
                    }
                }
                .foregroundColor(.white)
                
                Button {
                    onShare()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.system(size: 28))
                        Text("分享")
                            .font(.caption)
                    }
                }
                .foregroundColor(.white)
            }
            .padding(.vertical, 12)
            
            HStack(spacing: 20) {
                if let size = file.size {
                    Label(formatFileSize(size), systemImage: "doc")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }
                
                if let uploader = file.uploaderName {
                    Label(uploader, systemImage: "person")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }
                
                if let accessCount = file.accessCount {
                    Label("\(accessCount)次访问", systemImage: "eye")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }
            }
            .padding(.bottom, 16)
        }
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(
                colors: [Color.clear, Color.black.opacity(0.8)],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
    
    // MARK: - Helper Functions
    
    // Helper to access isLargeImage inside previewContent logic (Repeated logic but accessible here)
    private var isLargeImage: Bool {
        return (file.size ?? 0) > 1_048_576 || file.size == nil
    }
    
    private func formatFileSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }

    private func buildPreviewURL(for file: FileItem) -> URL? {
        var urlComponents = URLComponents(string: APIClient.shared.baseURL)
        let rawPath = file.path.hasPrefix("/") ? String(file.path.dropFirst()) : file.path
        urlComponents?.path = "/preview/" + rawPath
        urlComponents?.queryItems = [URLQueryItem(name: "raw", value: "true")]
        return urlComponents?.url
    }
    
    private func buildLargePreviewURL(for file: FileItem) -> URL? {
        var urlComponents = URLComponents(string: APIClient.shared.baseURL)
        urlComponents?.path = "/api/thumbnail"
        urlComponents?.queryItems = [
            URLQueryItem(name: "path", value: file.path),
            URLQueryItem(name: "size", value: "preview")
        ]
        return urlComponents?.url
    }
    
    private func buildThumbnailURL(for file: FileItem) -> URL? {
        var urlComponents = URLComponents(string: APIClient.shared.baseURL)
        urlComponents?.path = "/api/thumbnail"
        urlComponents?.queryItems = [
            URLQueryItem(name: "path", value: file.path),
            URLQueryItem(name: "size", value: "400")
        ]
        return urlComponents?.url
    }
    
    private func downloadAndCache(url: URL) async {
        do {
            print("[Preview] Starting high-performance download for \(file.path)")
            let tempURL = try await downloader.downloadFile(from: url)
            await PreviewCacheManager.shared.cache(url: tempURL, for: file.path)
            try? FileManager.default.removeItem(at: tempURL)
            print("[Preview] Download & Cache complete")
            
            if let cached = await PreviewCacheManager.shared.getCachedURL(for: file.path) {
                withAnimation {
                    finalURL = cached
                    isDownloading = false
                }
            }
        } catch {
            print("[Preview] Download failed: \(error)")
            let nsError = error as NSError
            if nsError.code != NSURLErrorCancelled {
                errorMessage = error.localizedDescription
            }
            isDownloading = false
        }
    }
}

// MARK: - PDF 预览视图

struct PDFKitView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> PDFView {
        let pdfView = PDFView()
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        return pdfView
    }
    
    func updateUIView(_ uiView: PDFView, context: Context) {
        if uiView.document == nil {
            uiView.document = PDFDocument(url: url)
        }
    }
}

// MARK: - 文本文件预览

struct TextFileView: View {
    let url: URL
    @State private var content: String = ""
    @State private var isLoading = true
    
    var body: some View {
        ScrollView {
            if isLoading {
                ProgressView()
            } else {
                Text(content)
                    .font(.system(.body, design: .monospaced))
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .foregroundColor(.white)
            }
        }
        .task {
            do {
                content = try String(contentsOf: url, encoding: .utf8)
            } catch {
                content = "无法读取文件内容"
            }
            isLoading = false
        }
    }
}

// MARK: - WebView Component

import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    @Binding var errorMessage: String?
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.navigationDelegate = context.coordinator
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if uiView.url != url {
            let request = URLRequest(url: url)
            uiView.load(request)
        }
    }
    
    class Coordinator: NSObject, WKNavigationDelegate {
        var parent: WebView
        
        init(_ parent: WebView) {
            self.parent = parent
        }
        
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.parent.errorMessage = error.localizedDescription
            }
        }
        
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            DispatchQueue.main.async {
                self.parent.errorMessage = error.localizedDescription
            }
        }
    }
}

// MARK: - File Downloader Service (Embedded)
@MainActor
class FileDownloader: NSObject, ObservableObject {
    @Published var progress: Double = 0.0
    private var continuation: CheckedContinuation<URL, Error>?
    private var downloadTask: URLSessionDownloadTask?
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()
    
    func downloadFile(from url: URL) async throws -> URL {
        self.progress = 0.0
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let task = session.downloadTask(with: url)
            self.downloadTask = task
            task.resume()
        }
    }
    
    func cancel() {
        downloadTask?.cancel()
        continuation?.resume(throwing: URLError(.cancelled))
        continuation = nil
    }
}

extension FileDownloader: URLSessionDownloadDelegate {
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let continuation = self.continuation else { return }
        do {
            let safeTempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try FileManager.default.moveItem(at: location, to: safeTempURL)
            continuation.resume(returning: safeTempURL)
            self.continuation = nil
        } catch {
            continuation.resume(throwing: error)
            self.continuation = nil
        }
    }
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        Task { @MainActor in
            if totalBytesExpectedToWrite > 0 {
                self.progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
            }
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error, let continuation = self.continuation {
            continuation.resume(throwing: error)
            self.continuation = nil
        }
    }
}

// MARK: - Zoomable ScrollView Helper
struct ZoomableScrollView<Content: View>: UIViewRepresentable {
    private var content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.delegate = context.coordinator
        scrollView.maximumZoomScale = 5.0
        scrollView.minimumZoomScale = 1.0
        scrollView.bouncesZoom = true
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.showsVerticalScrollIndicator = false
        scrollView.backgroundColor = .clear
        
        scrollView.isUserInteractionEnabled = true
        scrollView.isScrollEnabled = true
        
        let hostedView = context.coordinator.hostingController.view!
        hostedView.backgroundColor = .clear
        hostedView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.addSubview(hostedView)
        
        NSLayoutConstraint.activate([
            hostedView.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            hostedView.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            hostedView.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            hostedView.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            
            hostedView.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor),
            hostedView.heightAnchor.constraint(equalTo: scrollView.frameLayoutGuide.heightAnchor)
        ])
        
        let doubleTapGesture = UITapGestureRecognizer(target: context.coordinator, action: #selector(context.coordinator.handleDoubleTap(_:)))
        doubleTapGesture.numberOfTapsRequired = 2
        scrollView.addGestureRecognizer(doubleTapGesture)
        
        return scrollView
    }
    
    func updateUIView(_ uiView: UIScrollView, context: Context) {
        context.coordinator.hostingController.rootView = self.content
    }
    
    func makeCoordinator() -> Coordinator {
        return Coordinator(hostingController: UIHostingController(rootView: self.content))
    }
    
    class Coordinator: NSObject, UIScrollViewDelegate {
        var hostingController: UIHostingController<Content>
        
        init(hostingController: UIHostingController<Content>) {
            self.hostingController = hostingController
        }
        
        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            return hostingController.view
        }
        
        @objc func handleDoubleTap(_ gesture: UITapGestureRecognizer) {
            guard let scrollView = gesture.view as? UIScrollView else { return }
            
            if scrollView.zoomScale > 1 {
                scrollView.setZoomScale(1, animated: true)
            } else {
                let point = gesture.location(in: scrollView)
                let size = scrollView.bounds.size
                let w = size.width / 3
                let h = size.height / 3
                let x = point.x - (w / 2.0)
                let y = point.y - (h / 2.0)
                let rect = CGRect(x: x, y: y, width: w, height: h)
                scrollView.zoom(to: rect, animated: true)
            }
        }
    }
}
