//
//  FilePreviewSheet.swift
//  LonghornApp
//
//  自定义文件预览面板 - 包含下载/分享/文件信息
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
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 预览内容
                previewContent
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                
                // 底部信息栏
                bottomInfoBar
            }
            .navigationTitle(file.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") {
                        onClose()
                    }
                }
                
                ToolbarItem(placement: .primaryAction) {
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
                    }
                }
            }
        }
    }
    
    // MARK: - 预览内容
    
    @ViewBuilder
    private var previewContent: some View {
        if let url = previewURL {
            let ext = file.name.split(separator: ".").last?.lowercased() ?? ""
            
            if ["jpg", "jpeg", "png", "gif", "heic", "webp"].contains(ext) {
                // 图片预览
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .empty:
                        ProgressView()
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                    case .failure:
                        Image(systemName: "photo")
                            .font(.system(size: 60))
                            .foregroundColor(.secondary)
                    @unknown default:
                        EmptyView()
                    }
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
                        .foregroundColor(.secondary)
                    
                    Text("无法预览此文件类型")
                        .foregroundColor(.secondary)
                    
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
        }
    }
    
    // MARK: - 底部信息栏
    
    private var bottomInfoBar: some View {
        VStack(spacing: 12) {
            Divider()
            
            // 操作按钮
            HStack(spacing: 20) {
                Button {
                    onDownload()
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "arrow.down.circle.fill")
                            .font(.system(size: 28))
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
                            .font(.system(size: 28))
                        Text("分享")
                            .font(.caption)
                    }
                }
                .foregroundColor(.blue)
            }
            .padding(.vertical, 8)
            
            // 文件信息
            HStack(spacing: 16) {
                // 大小
                if let size = file.size {
                    Label(formatFileSize(size), systemImage: "doc")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                // 上传者
                if let uploader = file.uploaderName {
                    Label(uploader, systemImage: "person")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                // 访问次数
                if let accessCount = file.accessCount {
                    Label("\(accessCount)", systemImage: "eye")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.bottom, 12)
        }
        .background(Color(UIColor.secondarySystemBackground))
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

