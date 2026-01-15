//
//  ThumbnailView.swift
//  LonghornApp
//
//  缩略图视图 - 异步加载图片缩略图
//

import SwiftUI

struct ThumbnailView: View {
    let path: String
    var size: CGFloat = 40
    
    @State private var image: UIImage?
    @State private var isLoading = true
    @State private var loadFailed = false
    
    private var thumbnailURL: URL? {
        // Strip leading slash to ensure path is treated as relative by server's path.resolve
        let cleanPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let encodedPath = cleanPath.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? cleanPath
        return URL(string: "\(APIClient.shared.baseURL)/api/thumbnail?path=\(encodedPath)&size=\(Int(size * 2))")
    }
    
    var body: some View {
        Group {
            if let image = image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: size, height: size)
                    .clipped()
                    .cornerRadius(size > 50 ? 8 : 4)
            } else if loadFailed {
                // 加载失败显示图标
                ZStack {
                    RoundedRectangle(cornerRadius: size > 50 ? 8 : 4)
                        .fill(Color.green.opacity(0.15))
                        .frame(width: size, height: size)
                    
                    Image(systemName: "photo.fill")
                        .font(.system(size: size * 0.5))
                        .foregroundColor(.green)
                }
            } else {
                // 加载中
                ZStack {
                    RoundedRectangle(cornerRadius: size > 50 ? 8 : 4)
                        .fill(Color(UIColor.secondarySystemBackground))
                        .frame(width: size, height: size)
                    
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.6)
                    }
                }
            }
        }
        .task {
            await loadThumbnail()
        }
    }
    
    private func loadThumbnail() async {
        guard let url = thumbnailURL else {
            loadFailed = true
            isLoading = false
            return
        }
        
        let cacheKey = "\(path)_\(size)"
        
        // 1. Check Memory Cache
        if let cachedImage = ImageCacheService.shared.image(for: cacheKey) {
            self.image = cachedImage
            self.isLoading = false
            return
        }
        
        // 2. Network Request
        do {
            var request = URLRequest(url: url)
            if let token = AuthManager.shared.token {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode),
                  let loadedImage = UIImage(data: data) else {
                loadFailed = true
                isLoading = false
                return
            }
            
            // 3. Save to Memory Cache
            ImageCacheService.shared.insertImage(loadedImage, for: cacheKey)
            
            await MainActor.run {
                image = loadedImage
                isLoading = false
            }
        } catch {
            await MainActor.run {
                loadFailed = true
                isLoading = false
            }
        }
    }
}

// MARK: - 文件行视图（带缩略图）

struct FileRowWithThumbnailView: View {
    let file: FileItem
    var isSelectionMode: Bool = false
    var isSelected: Bool = false
    var onPreview: () -> Void = {}
    
    private let imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]
    private let videoExtensions = ["mp4", "mov", "m4v", "avi", "mkv", "hevc"]
    
    var body: some View {
        if isSelectionMode {
            rowContent
        } else {
            NavigationLink {
                destinationView
            } label: {
                rowContent
            }
        }
    }
    
    private var rowContent: some View {
        HStack(spacing: 14) {
            // 图标或缩略图
            if isImageFile {
                ThumbnailView(path: file.path, size: 44)
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(iconColor.opacity(0.15))
                        .frame(width: 44, height: 44)
                    
                    Image(systemName: file.systemIconName)
                        .font(.system(size: 20, weight: .medium))
                        .foregroundColor(iconColor)
                }
            }
            
            // 文件信息
            VStack(alignment: .leading, spacing: 4) {
                Text(file.name)
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                
                HStack(spacing: 8) {
                    if !file.isDirectory {
                        Text(file.formattedSize)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                    
                    if let date = file.modifiedAt {
                        Text(date, style: .date)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            Spacer()
            
            // 收藏标记
            if file.isStarred == true {
                Image(systemName: "star.fill")
                    .font(.system(size: 12))
                    .foregroundColor(.orange)
            }
        }
        .padding(.vertical, 4)
    }
    
    @ViewBuilder
    private var destinationView: some View {
        if file.isDirectory {
            FileBrowserView(path: file.path)
                .navigationTitle(file.name)
        } else {
            FilePreviewView(file: file)
        }
    }
    
    private var isImageFile: Bool {
        let ext = (file.name as NSString).pathExtension.lowercased()
        return imageExtensions.contains(ext) || videoExtensions.contains(ext)
    }
    
    private var iconColor: Color {
        let ext = (file.name as NSString).pathExtension.lowercased()
        if file.isDirectory { return .blue }
        if imageExtensions.contains(ext) { return .green }
        if ["mp4", "mov", "m4v", "avi"].contains(ext) { return .purple }
        if ["mp3", "m4a", "wav"].contains(ext) { return .orange }
        if ext == "pdf" { return .red }
        return .gray
    }
}


#Preview {
    ThumbnailView(path: "MS/test.jpg", size: 100)
}
