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
        let encodedPath = path.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? path
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
        return imageExtensions.contains(ext)
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

// MARK: - 批量分享对话框

struct BatchShareDialogView: View {
    let filePaths: [String]
    var onDismiss: () -> Void = {}
    
    @State private var name = ""
    @State private var password = ""
    @State private var usePassword = false
    @State private var expiresIn: ShareDialogView.ExpiryOption = .sevenDays
    @State private var isLoading = false
    @State private var shareResult: ShareResult?
    @State private var errorMessage: String?
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        NavigationStack {
            if let result = shareResult {
                shareSuccessView(result)
            } else {
                shareSettingsForm
            }
        }
    }
    
    private var shareSettingsForm: some View {
        Form {
            Section {
                HStack {
                    Image(systemName: "doc.on.doc.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.blue)
                    
                    Text("已选择 \(filePaths.count) 个文件")
                        .font(.system(size: 15, weight: .medium))
                }
            } header: {
                Text("分享内容")
            }
            
            Section {
                TextField("分享名称", text: $name)
            } header: {
                Text("合集名称")
            } footer: {
                Text("给这个分享合集起个名字")
            }
            
            Section {
                Toggle("设置访问密码", isOn: $usePassword)
                
                if usePassword {
                    SecureField("密码", text: $password)
                }
            } header: {
                Text("访问控制")
            }
            
            Section {
                Picker("有效期", selection: $expiresIn) {
                    ForEach(ShareDialogView.ExpiryOption.allCases, id: \.self) { option in
                        Text(option.rawValue).tag(option)
                    }
                }
                .pickerStyle(.menu)
            } header: {
                Text("链接有效期")
            }
            
            if let error = errorMessage {
                Section {
                    Text(error)
                        .foregroundColor(.red)
                }
            }
        }
        .navigationTitle("批量分享")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { onDismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    createBatchShare()
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("创建")
                    }
                }
                .disabled(isLoading || name.isEmpty)
                .foregroundColor(accentColor)
            }
        }
    }
    
    private func shareSuccessView(_ result: ShareResult) -> some View {
        VStack(spacing: 24) {
            Spacer()
            
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.green)
            
            Text("分享合集已创建")
                .font(.system(size: 20, weight: .semibold))
            
            Text(result.shareUrl)
                .font(.system(size: 14, design: .monospaced))
                .foregroundColor(.secondary)
                .padding()
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
            
            Button {
                UIPasteboard.general.string = result.shareUrl
            } label: {
                Label("复制链接", systemImage: "doc.on.doc")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.black)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(accentColor)
                    .cornerRadius(12)
            }
            
            Spacer()
            
            Button("完成") { onDismiss() }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
                .padding()
        }
        .navigationTitle("分享成功")
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func createBatchShare() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let result = try await FileService.shared.createShareCollection(
                    paths: filePaths,
                    name: name,
                    password: usePassword ? password : nil,
                    expiresInDays: expiresIn.days
                )
                
                await MainActor.run {
                    shareResult = result
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

#Preview {
    ThumbnailView(path: "MS/test.jpg", size: 100)
}
