import SwiftUI

struct RecentFilesListView: View {
    @StateObject private var recentManager = RecentFilesManager.shared
    @State private var isRefreshing = false
    @State private var previewFile: FileItem?
    
    private let imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]
    private let videoExtensions = ["mp4", "mov", "m4v", "avi", "mkv", "hevc"]
    
    var body: some View {
        List {
            if recentManager.filteredFiles.isEmpty {
                ContentUnavailableView(
                    String(localized: "recent.no_files"),
                    systemImage: "clock",
                    description: Text("recent.hint")
                )
            } else {
                ForEach(recentManager.filteredFiles) { file in
                    Button {
                        previewFile = file
                    } label: {
                        fileRow(file)
                    }
                    .buttonStyle(.plain) // Standard list behavior
                }
            }
        }
        .navigationTitle(Text("recent.title"))
        .listStyle(InsetGroupedListStyle())
        .refreshable {
            // 标准下拉刷新 - 只有松开手指后才会触发
            await refreshData()
        }
        .fullScreenCover(item: $previewFile) { file in
            FilePreviewSheet(
                initialFile: file,
                allFiles: recentManager.filteredFiles,
                onClose: { previewFile = nil },
                onDownload: { downloadTarget in
                    // Logic handled inside sheet or delegated
                },
                onShare: { shareTarget in
                    // Logic handled inside sheet
                },
                onStar: { starTarget in
                     Task {
                         try? await FileService.shared.toggleStar(path: starTarget.path)
                     }
                },
                onGoToLocation: { locationTarget in
                    previewFile = nil
                    // Extract parent path
                    let parentPath = (locationTarget.path as NSString).deletingLastPathComponent
                    NavigationManager.shared.navigateTo(path: parentPath)
                }
            )
        }
    }
    
    @ViewBuilder
    private func fileRow(_ file: FileItem) -> some View {
        HStack(spacing: 14) {
            // 缩略图或图标
            if isImageOrVideo(file) {
                ThumbnailView(path: file.path, size: 44)
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(UIColor.secondarySystemBackground))
                        .frame(width: 44, height: 44)
                    
                    Image(systemName: file.systemIconName)
                        .font(.system(size: 20))
                        .foregroundColor(Color(file.iconColorName))
                }
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(file.name)
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                
                HStack(spacing: 8) {
                    Text(file.formattedSize)
                    Text("·")
                    Text(file.formattedDate)
                }
                .font(.system(size: 12))
                .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
    
    private func isImageOrVideo(_ file: FileItem) -> Bool {
        let ext = (file.name as NSString).pathExtension.lowercased()
        return imageExtensions.contains(ext) || videoExtensions.contains(ext)
    }
    
    private func refreshData() async {
        // RecentFilesManager 会自动同步本地历史
        // 这里可以触发额外的数据更新
        try? await Task.sleep(nanoseconds: 300_000_000) // 0.3秒最小等待
    }
}
