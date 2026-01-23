//
//  SharePreviewSheet.swift
//  LonghornApp
//
//  分享专属预览面板 - 针对分享场景优化的文件预览
//

import SwiftUI
import QuickLook
import AVKit

struct SharePreviewSheet: View {
    let file: FileItem
    let share: ShareLink
    let previewURL: URL?
    let onClose: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    var onGoToLocation: (() -> Void)? = nil
    
    @State private var isLoading = false
    @State private var finalURL: URL?
    @StateObject private var downloader = FileDownloader()
    @State private var isDownloading = false
    @State private var errorMessage: String?
    
    @State private var videoPlayer: AVPlayer?
    @State private var showOSD = true
    @State private var isStarred: Bool
    @State private var showDeleteConfirmation = false
    @State private var showCopied = false
    
    @State private var webViewError: String?
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    init(file: FileItem, share: ShareLink, previewURL: URL?, onClose: @escaping () -> Void, onEdit: @escaping () -> Void, onDelete: @escaping () -> Void, onGoToLocation: (() -> Void)? = nil) {
        self.file = file
        self.share = share
        self.previewURL = previewURL
        self.onClose = onClose
        self.onEdit = onEdit
        self.onDelete = onDelete
        self.onGoToLocation = onGoToLocation
        self._isStarred = State(initialValue: file.isStarred == true)
    }
    
    var body: some View {
        ZStack {
            // 预览内容（全屏）
            previewContent
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.black)
                .onTapGesture {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showOSD.toggle()
                    }
                }
            
            // OSD 层
            if showOSD {
                VStack {
                    // 顶部栏
                    topBar
                    
                    Spacer()
                    
                    // 底部信息栏
                    bottomInfoBar
                }
            }
        }
        .edgesIgnoringSafeArea(.all)
        .statusBarHidden(!showOSD)
        .onAppear {
            loadPreview()
            // Record file access for logging
            Task {
                await FileService.shared.recordFileAccess(path: file.path)
            }
        }
        .confirmationDialog(
            String(localized: "alert.confirm_delete"),
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button(String(localized: "action.delete"), role: .destructive) {
                onDelete()
                onClose()
            }
            Button(String(localized: "action.cancel"), role: .cancel) {}
        } message: {
            Text("确定删除分享「\(file.name)」？删除后分享链接将失效。")
        }
    }
    
    // MARK: - 顶部栏
    
    private var topBar: some View {
        HStack {
            Button {
                onClose()
            } label: {
                Text("action.close")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(accentColor)
            }
            
            Spacer()
            
            Text(file.name)
                .font(.system(size: 16, weight: .semibold))
                .foregroundColor(.white)
                .lineLimit(1)
            
            Spacer()
            
            Menu {
                // 复制链接
                Button {
                    copyShareLink()
                } label: {
                    Label("action.copy_link", systemImage: "doc.on.doc")
                }
                
                // 编辑分享设置
                Button {
                    onEdit()
                } label: {
                    Label("share.action.edit", systemImage: "pencil")
                }
                
                // 所在位置
                if onGoToLocation != nil {
                    Button {
                        onGoToLocation?()
                        onClose()
                    } label: {
                        Label("action.location", systemImage: "folder")
                    }
                }
                
                Divider()
                
                // 删除分享
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    Label("action.delete", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .font(.system(size: 22))
                    .foregroundColor(.white)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 60)
        .padding(.bottom, 16)
        .background(
            LinearGradient(
                colors: [Color.black.opacity(0.8), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }
    
    // MARK: - 底部信息栏
    
    private var bottomInfoBar: some View {
        VStack(spacing: 12) {
            // 操作按钮行
            HStack(spacing: 32) {
                // 收藏
                Button {
                    isStarred.toggle()
                    Task {
                        try? await FileService.shared.toggleStar(path: file.path)
                        AppEvents.notifyStarredChanged(path: file.path)
                    }
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: isStarred ? "star.fill" : "star")
                            .font(.system(size: 28))
                        Text(isStarred ? "status.starred" : "action.favorite")
                            .font(.caption)
                    }
                }
                .foregroundColor(isStarred ? .orange : .white)
                
                // 下载
                Button {
                    downloadFile()
                } label: {
                    VStack(spacing: 4) {
                        if isDownloading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .frame(width: 28, height: 28)
                        } else {
                            Image(systemName: "arrow.down.circle")
                                .font(.system(size: 28))
                        }
                        Text("action.download")
                            .font(.caption)
                    }
                }
                .foregroundColor(.white)
                .disabled(isDownloading)
                
                // 复制链接
                Button {
                    copyShareLink()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: showCopied ? "checkmark.circle" : "doc.on.doc")
                            .font(.system(size: 28))
                        Text(showCopied ? "share.status.copied" : "action.copy_link")
                            .font(.caption)
                    }
                }
                .foregroundColor(showCopied ? .green : .white)
            }
            .padding(.vertical, 12)
            
            // 分享信息行
            HStack(spacing: 20) {
                // 访问次数
                Label("\(share.accessCount)", systemImage: "eye")
                    .font(.caption)
                    .foregroundColor(.white.opacity(0.8))
                
                // 过期时间
                if let expiry = share.formattedExpiresAt {
                    Label(expiry, systemImage: "clock")
                        .font(.caption)
                        .foregroundColor(share.isExpired ? .red : .white.opacity(0.8))
                } else {
                    Label(String(localized: "share.status.permanent"), systemImage: "infinity")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }
                
                // 密码保护
                if share.hasPassword {
                    Label(String(localized: "share.status.protected"), systemImage: "lock.fill")
                        .font(.caption)
                        .foregroundColor(.orange)
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
    
    // MARK: - 预览内容
    
    @ViewBuilder
    private var previewContent: some View {
        if isLoading {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .white))
        } else if let error = errorMessage {
            VStack(spacing: 16) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 48))
                    .foregroundColor(.yellow)
                Text(error)
                    .foregroundColor(.white)
            }
        } else if let url = finalURL {
            previewForURL(url)
        } else {
            unsupportedPreview
        }
    }
    
    @ViewBuilder
    private func previewForURL(_ url: URL) -> some View {
        let ext = (file.name as NSString).pathExtension.lowercased()
        
        if ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"].contains(ext) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                case .failure:
                    unsupportedPreview
                case .empty:
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                @unknown default:
                    unsupportedPreview
                }
            }
        } else if ["mp4", "mov", "m4v", "avi", "mkv"].contains(ext) {
            if let player = videoPlayer {
                VideoPlayer(player: player)
                    .onAppear { player.play() }
                    .onDisappear { player.pause() }
            } else {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
            }
        } else {
            unsupportedPreview
        }
    }
    
    private var unsupportedPreview: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.fill")
                .font(.system(size: 80))
                .foregroundColor(.white.opacity(0.6))
            
            Text("无法预览此文件类型")
                .foregroundColor(.white.opacity(0.8))
            
            Button {
                downloadFile()
            } label: {
                Label("action.download", systemImage: "arrow.down.circle")
                    .font(.headline)
            }
            .buttonStyle(.borderedProminent)
            .tint(accentColor)
        }
    }
    
    // MARK: - 方法
    
    private func loadPreview() {
        isLoading = true
        
        if let url = previewURL {
            finalURL = url
            isLoading = false
            return
        }
        
        // 构造预览URL
        let cleanPath = file.path.hasPrefix("/") ? String(file.path.dropFirst()) : file.path
        guard let encodedPath = cleanPath.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "\(APIClient.shared.baseURL)/api/preview?path=\(encodedPath)") else {
            errorMessage = "无法生成预览"
            isLoading = false
            return
        }
        
        let ext = (file.name as NSString).pathExtension.lowercased()
        if ["mp4", "mov", "m4v", "avi", "mkv"].contains(ext) {
            var request = URLRequest(url: url)
            if let token = AuthManager.shared.token {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            let asset = AVURLAsset(url: url, options: ["AVURLAssetHTTPHeaderFieldsKey": ["Authorization": "Bearer \(AuthManager.shared.token ?? "")"]])
            let playerItem = AVPlayerItem(asset: asset)
            videoPlayer = AVPlayer(playerItem: playerItem)
        }
        
        finalURL = url
        isLoading = false
    }
    
    private func copyShareLink() {
        let url = ShareService.shared.getShareURL(token: share.token)
        UIPasteboard.general.string = url
        
        withAnimation {
            showCopied = true
        }
        
        ToastManager.shared.show(String(localized: "link.copied"), type: .success)
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                showCopied = false
            }
        }
    }
    
    private func downloadFile() {
        isDownloading = true
        
        Task {
            do {
                let cleanPath = file.path.hasPrefix("/") ? String(file.path.dropFirst()) : file.path
                guard let encodedPath = cleanPath.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                      let url = URL(string: "\(APIClient.shared.baseURL)/api/download?path=\(encodedPath)") else {
                    throw NSError(domain: "Download", code: -1, userInfo: [NSLocalizedDescriptionKey: "无法生成下载链接"])
                }
                
                var request = URLRequest(url: url)
                if let token = AuthManager.shared.token {
                    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
                }
                
                let (data, response) = try await URLSession.shared.data(for: request)
                
                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode) else {
                    throw NSError(domain: "Download", code: -1, userInfo: [NSLocalizedDescriptionKey: "下载失败"])
                }
                
                // Save to Documents
                let documentsURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
                let fileURL = documentsURL.appendingPathComponent(file.name)
                try data.write(to: fileURL)
                
                await MainActor.run {
                    isDownloading = false
                    ToastManager.shared.show(String(localized: "download.success"), type: .success)
                }
            } catch {
                await MainActor.run {
                    isDownloading = false
                    ToastManager.shared.show(error.localizedDescription, type: .error)
                }
            }
        }
    }
}
