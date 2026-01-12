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
    
    @State private var isLoading = false
    @State private var videoPlayer: AVPlayer?
    @State private var showOSD = true  // OSD可见状态
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
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
        if let url = previewURL {
            let ext = file.name.split(separator: ".").last?.lowercased() ?? ""
            
            if ["jpg", "jpeg", "png", "gif", "heic", "webp"].contains(ext) {
                // 图片预览
                if let data = try? Data(contentsOf: url),
                   let uiImage = UIImage(data: data) {
                    Image(uiImage: uiImage)
                        .resizable()
                        .scaledToFit()
                } else {
                    Image(systemName: "photo")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)
                }
                
            } else if ["mp4", "mov", "m4v", "avi"].contains(ext) {
                // 视频预览
                VideoPlayer(player: AVPlayer(url: url))
                    .onAppear {
                        videoPlayer = AVPlayer(url: url)
                    }
                    .onDisappear {
                        videoPlayer?.pause()
                    }
                
            } else if ["pdf"].contains(ext) {
                // PDF 预览
                PDFKitView(url: url)
                
            } else if ["txt", "md", "json", "xml", "log", "swift", "js", "ts", "py"].contains(ext) {
                // 文本预览
                TextFileView(url: url)
                
            } else {
                // 其他文件类型
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
        } else {
            ProgressView("加载中...")
                .tint(.white)
        }
    }
    
    // MARK: - 底部信息栏
    
    private var bottomInfoBar: some View {
        VStack(spacing: 12) {
            // 操作按钮
            HStack(spacing: 40) {
                Button {
                    onDownload()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "arrow.down.circle.fill")
                            .font(.system(size: 32))
                        Text("下载")
                            .font(.caption)
                    }
                }
                .foregroundColor(accentColor)
                
                Button {
                    onShare()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "square.and.arrow.up.circle.fill")
                            .font(.system(size: 32))
                        Text("分享")
                            .font(.caption)
                    }
                }
                .foregroundColor(.white)
            }
            .padding(.vertical, 12)
            
            // 文件信息
            HStack(spacing: 20) {
                // 大小
                if let size = file.size {
                    Label(formatFileSize(size), systemImage: "doc")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }
                
                // 上传者
                if let uploader = file.uploaderName {
                    Label(uploader, systemImage: "person")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.8))
                }
                
                // 访问次数
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
    
    private func formatFileSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - PDF 预览视图

import PDFKit

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
