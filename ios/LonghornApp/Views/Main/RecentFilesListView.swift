import SwiftUI

struct RecentFilesListView: View {
    @StateObject private var recentManager = RecentFilesManager.shared
    
    var body: some View {
        List {
            if recentManager.recentFiles.isEmpty {
                ContentUnavailableView(
                    String(localized: "recent.no_files"),
                    systemImage: "clock",
                    description: Text("recent.hint")
                )
            } else {
                ForEach(recentManager.recentFiles) { file in
                    NavigationLink(destination: FilePreviewWrapper(file: file)) {
                        HStack {
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color(UIColor.secondarySystemBackground))
                                    .frame(width: 40, height: 40)
                                
                                Image(systemName: file.systemIconName)
                                    .foregroundColor(Color(file.iconColorName))
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(file.name)
                                    .font(.headline)
                                    .lineLimit(1)
                                
                                HStack {
                                    Text(file.formattedSize)
                                    Text("·")
                                    Text(file.formattedDate)
                                }
                                .font(.caption)
                                .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                .onDelete { indexSet in
                    // Optional: Allow deleting from history
                    // specific logic needs RecentFilesManager support for deletion if desired
                    // For now, no-op or implement remove
                }
            }
        }
        .navigationTitle(Text("recent.title"))
        .listStyle(InsetGroupedListStyle())
    }
}

// Wrapper for previewing a file from the list
struct FilePreviewWrapper: View {
    let file: FileItem
    @State private var previewFile: FileItem?
    
    var body: some View {
        // Since FileBrowserView handles preview internally usually, we might need a standalone previewer
        // or just reuse logic. For simplicity, let's just show a text or basic file info
        // BUT ideally we want the full preview experience.
        // Let's reuse the FileStatsView or similar, OR trigger the QuickLook.
        // Actually, the best way in this app structure is to use the existing FilePreviewSheet logic but it requires context.
        // Let's create a temporary simple detail view or try to integrate QuickLook.
        
        // For now, let's just show details
        FileStatsView(file: file)
            .navigationTitle(file.name)
    }
}
