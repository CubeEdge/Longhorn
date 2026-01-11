//
//  StarredView.swift
//  LonghornApp
//
//  收藏视图 - 列表/网格视图、选择、批量操作、详细信息
//

import SwiftUI

struct StarredView: View {
    @State private var starredItems: [StarredItem] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    // 视图模式
    @State private var viewMode: ViewMode = .list
    
    // 选择模式
    @State private var isSelectionMode = false
    @State private var selectedIds: Set<Int> = []
    @State private var showDeleteConfirmation = false
    
    // 预览
    @State private var previewItem: StarredItem?
    @State private var previewURL: URL?
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    enum ViewMode: String, CaseIterable {
        case list = "列表"
        case grid = "网格"
        
        var icon: String {
            switch self {
            case .list: return "list.bullet"
            case .grid: return "square.grid.2x2"
            }
        }
    }
    
    var body: some View {
        ZStack {
            if isLoading {
                ProgressView("加载中...")
            } else if let error = errorMessage {
                ContentUnavailableView(
                    "加载失败",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            } else if starredItems.isEmpty {
                ContentUnavailableView(
                    "暂无收藏",
                    systemImage: "star",
                    description: Text("收藏的文件和文件夹将显示在这里")
                )
            } else {
                VStack(spacing: 0) {
                    // 批量操作栏
                    if isSelectionMode && !selectedIds.isEmpty {
                        bulkActionBar
                    }
                    
                    // 内容
                    switch viewMode {
                    case .list:
                        listView
                    case .grid:
                        gridView
                    }
                }
            }
        }
        .navigationTitle("收藏")
        .toolbar {
            toolbarContent
        }
        .refreshable {
            await loadStarredItems()
        }
        .task {
            await loadStarredItems()
        }
        .confirmationDialog(
            "确定要取消收藏所选的 \(selectedIds.count) 个项目吗？",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("取消收藏", role: .destructive) {
                unstarSelectedItems()
            }
            Button("取消", role: .cancel) {}
        }
        .quickLookPreview($previewURL)
    }
    
    // MARK: - 列表视图
    
    private var listView: some View {
        List(selection: isSelectionMode ? $selectedIds : nil) {
            ForEach(starredItems) { item in
                StarredItemRow(
                    item: item,
                    isSelectionMode: isSelectionMode,
                    isSelected: selectedIds.contains(item.id),
                    onPreview: { previewItem(item) }
                )
                .tag(item.id)
                .contextMenu {
                    itemContextMenu(item)
                }
                .swipeActions(edge: .trailing) {
                    Button(role: .destructive) {
                        unstarItem(item)
                    } label: {
                        Label("取消收藏", systemImage: "star.slash")
                    }
                    .tint(.orange)
                }
            }
        }
        .listStyle(.plain)
        .environment(\.editMode, .constant(isSelectionMode ? .active : .inactive))
    }
    
    // MARK: - 网格视图
    
    private var gridView: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.adaptive(minimum: 140, maximum: 180), spacing: 16)
            ], spacing: 16) {
                ForEach(starredItems) { item in
                    StarredGridItem(
                        item: item,
                        isSelectionMode: isSelectionMode,
                        isSelected: selectedIds.contains(item.id),
                        onTap: {
                            if isSelectionMode {
                                toggleSelection(item.id)
                            } else {
                                handleItemTap(item)
                            }
                        }
                    )
                    .contextMenu {
                        itemContextMenu(item)
                    }
                }
            }
            .padding()
        }
    }
    
    // MARK: - 批量操作栏
    
    private var bulkActionBar: some View {
        HStack {
            Button {
                if selectedIds.count == starredItems.count {
                    selectedIds.removeAll()
                } else {
                    selectedIds = Set(starredItems.map { $0.id })
                }
            } label: {
                Text(selectedIds.count == starredItems.count ? "取消全选" : "全选")
                    .font(.system(size: 14, weight: .medium))
            }
            
            Spacer()
            
            Text("已选 \(selectedIds.count) 项")
                .font(.system(size: 14))
                .foregroundColor(.secondary)
            
            Spacer()
            
            Button(role: .destructive) {
                showDeleteConfirmation = true
            } label: {
                Image(systemName: "star.slash.fill")
                    .font(.system(size: 18))
            }
            .disabled(selectedIds.isEmpty)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(Color(UIColor.secondarySystemBackground))
    }
    
    // MARK: - 工具栏
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button(isSelectionMode ? "完成" : "选择") {
                isSelectionMode.toggle()
                if !isSelectionMode {
                    selectedIds.removeAll()
                }
            }
            .foregroundColor(isSelectionMode ? accentColor : .primary)
        }
        
        ToolbarItem(placement: .primaryAction) {
            Menu {
                ForEach(ViewMode.allCases, id: \.self) { mode in
                    Button {
                        viewMode = mode
                    } label: {
                        Label(mode.rawValue, systemImage: mode.icon)
                        if viewMode == mode {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            } label: {
                Image(systemName: viewMode.icon)
            }
        }
    }
    
    // MARK: - 上下文菜单
    
    @ViewBuilder
    private func itemContextMenu(_ item: StarredItem) -> some View {
        if item.isDirectory != true {
            Button {
                previewItem(item)
            } label: {
                Label("预览", systemImage: "eye")
            }
        }
        
        Button {
            navigateToFolder(item)
        } label: {
            Label("打开所在文件夹", systemImage: "folder")
        }
        
        Divider()
        
        Button(role: .destructive) {
            unstarItem(item)
        } label: {
            Label("取消收藏", systemImage: "star.slash")
        }
    }
    
    // MARK: - 方法
    
    private func loadStarredItems() async {
        isLoading = true
        errorMessage = nil
        
        do {
            starredItems = try await FileService.shared.getStarredFiles()
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func toggleSelection(_ id: Int) {
        if selectedIds.contains(id) {
            selectedIds.remove(id)
        } else {
            selectedIds.insert(id)
        }
    }
    
    private func handleItemTap(_ item: StarredItem) {
        if item.isDirectory == true {
            navigateToFolder(item)
        } else {
            previewItem(item)
        }
    }
    
    private func previewItem(_ item: StarredItem) {
        Task {
            do {
                let url = try await APIClient.shared.downloadFile(path: item.fullPath)
                await MainActor.run {
                    previewURL = url
                }
            } catch {
                print("Preview failed: \(error)")
            }
        }
    }
    
    private func navigateToFolder(_ item: StarredItem) {
        // TODO: 导航到对应目录
    }
    
    private func unstarItem(_ item: StarredItem) {
        Task {
            do {
                try await FileService.shared.unstarFile(id: item.id)
                await loadStarredItems()
            } catch {
                print("Unstar failed: \(error)")
            }
        }
    }
    
    private func unstarSelectedItems() {
        Task {
            for id in selectedIds {
                do {
                    try await FileService.shared.unstarFile(id: id)
                } catch {
                    print("Unstar \(id) failed: \(error)")
                }
            }
            selectedIds.removeAll()
            isSelectionMode = false
            await loadStarredItems()
        }
    }
}

// MARK: - 收藏项行视图

struct StarredItemRow: View {
    let item: StarredItem
    var isSelectionMode: Bool = false
    var isSelected: Bool = false
    var onPreview: () -> Void = {}
    
    var body: some View {
        if isSelectionMode {
            rowContent
        } else {
            NavigationLink {
                if item.isDirectory == true {
                    FileBrowserView(path: item.fullPath)
                } else {
                    FileDetailView(item: item)
                }
            } label: {
                rowContent
            }
        }
    }
    
    private var rowContent: some View {
        HStack(spacing: 14) {
            // 图标
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(iconColor.opacity(0.15))
                    .frame(width: 44, height: 44)
                
                Image(systemName: iconName)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(iconColor)
            }
            
            // 信息
            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayName)
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                
                HStack(spacing: 8) {
                    // 路径
                    Text(item.fullPath)
                        .font(.system(size: 12))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
                
                HStack(spacing: 12) {
                    // 大小
                    if let size = item.size, item.isDirectory != true {
                        let formatter = ByteCountFormatter()
                        Text(formatter.string(fromByteCount: size))
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                    
                    // 收藏时间
                    if let starredAt = item.starredAt {
                        if let date = parseDate(starredAt) {
                            Text(date, style: .date)
                                .font(.system(size: 11))
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            
            Spacer()
            
            if !isSelectionMode {
                Image(systemName: "star.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.orange)
            }
        }
        .padding(.vertical, 6)
    }
    
    private var iconName: String {
        if item.isDirectory == true {
            return "folder.fill"
        }
        
        // 根据扩展名判断
        let ext = (item.displayName as NSString).pathExtension.lowercased()
        switch ext {
        case "jpg", "jpeg", "png", "gif", "webp", "heic":
            return "photo.fill"
        case "mp4", "mov", "m4v", "avi":
            return "film.fill"
        case "mp3", "m4a", "wav", "aac":
            return "music.note"
        case "pdf":
            return "doc.fill"
        case "doc", "docx":
            return "doc.text.fill"
        case "xls", "xlsx":
            return "tablecells.fill"
        case "zip", "rar", "7z":
            return "doc.zipper"
        default:
            return "doc.fill"
        }
    }
    
    private var iconColor: Color {
        if item.isDirectory == true {
            return .blue
        }
        
        let ext = (item.displayName as NSString).pathExtension.lowercased()
        switch ext {
        case "jpg", "jpeg", "png", "gif", "webp", "heic":
            return .green
        case "mp4", "mov", "m4v", "avi":
            return .purple
        case "mp3", "m4a", "wav", "aac":
            return .orange
        case "pdf":
            return .red
        default:
            return .gray
        }
    }
    
    private func parseDate(_ string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: string) ?? ISO8601DateFormatter().date(from: string)
    }
}

// MARK: - 收藏项网格视图

struct StarredGridItem: View {
    let item: StarredItem
    var isSelectionMode: Bool = false
    var isSelected: Bool = false
    var onTap: () -> Void = {}
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        VStack(spacing: 12) {
            // 图标区域
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(iconColor.opacity(0.12))
                    .frame(height: 100)
                
                Image(systemName: iconName)
                    .font(.system(size: 40, weight: .medium))
                    .foregroundColor(iconColor)
            }
            .overlay(alignment: .topLeading) {
                if isSelectionMode {
                    Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 22))
                        .foregroundColor(isSelected ? accentColor : .secondary)
                        .padding(8)
                }
            }
            .overlay(alignment: .topTrailing) {
                if !isSelectionMode {
                    Image(systemName: "star.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.orange)
                        .padding(8)
                }
            }
            
            // 信息
            VStack(spacing: 4) {
                Text(item.displayName)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                
                if let size = item.size, item.isDirectory != true {
                    let formatter = ByteCountFormatter()
                    Text(formatter.string(fromByteCount: size))
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                } else if item.isDirectory == true {
                    Text("文件夹")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(12)
        .background(isSelected ? accentColor.opacity(0.1) : Color(UIColor.secondarySystemBackground))
        .cornerRadius(16)
        .onTapGesture { onTap() }
    }
    
    private var iconName: String {
        if item.isDirectory == true {
            return "folder.fill"
        }
        
        let ext = (item.displayName as NSString).pathExtension.lowercased()
        switch ext {
        case "jpg", "jpeg", "png", "gif", "webp", "heic":
            return "photo.fill"
        case "mp4", "mov", "m4v", "avi":
            return "film.fill"
        case "mp3", "m4a", "wav", "aac":
            return "music.note"
        case "pdf":
            return "doc.fill"
        default:
            return "doc.fill"
        }
    }
    
    private var iconColor: Color {
        if item.isDirectory == true { return .blue }
        
        let ext = (item.displayName as NSString).pathExtension.lowercased()
        switch ext {
        case "jpg", "jpeg", "png", "gif", "webp", "heic": return .green
        case "mp4", "mov", "m4v", "avi": return .purple
        case "mp3", "m4a", "wav", "aac": return .orange
        case "pdf": return .red
        default: return .gray
        }
    }
}

// MARK: - 文件详情视图

struct FileDetailView: View {
    let item: StarredItem
    @State private var previewURL: URL?
    @State private var isLoading = true
    
    var body: some View {
        Group {
            if isLoading {
                ProgressView("加载中...")
            } else if let url = previewURL {
                QuickLookPreview(url: url)
            } else {
                VStack(spacing: 24) {
                    Image(systemName: item.isDirectory == true ? "folder.fill" : "doc.fill")
                        .font(.system(size: 64))
                        .foregroundColor(.gray)
                    
                    Text(item.displayName)
                        .font(.system(size: 20, weight: .semibold))
                    
                    if let size = item.size {
                        let formatter = ByteCountFormatter()
                        Text("文件大小: \(formatter.string(fromByteCount: size))")
                            .foregroundColor(.secondary)
                    }
                    
                    Text("路径: \(item.fullPath)")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    Button {
                        Task {
                            await downloadAndPreview()
                        }
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
        }
        .navigationTitle(item.displayName)
        .task {
            await downloadAndPreview()
        }
    }
    
    private func downloadAndPreview() async {
        isLoading = true
        do {
            let url = try await APIClient.shared.downloadFile(path: item.fullPath)
            await MainActor.run {
                previewURL = url
                isLoading = false
            }
        } catch {
            print("Download failed: \(error)")
            await MainActor.run {
                isLoading = false
            }
        }
    }
}

// MARK: - 便捷初始化器

extension FileItem {
    init(name: String, path: String, isDirectory: Bool) {
        self.name = name
        self.path = path
        self.isDirectory = isDirectory
        self.size = nil
        self.modifiedAt = nil
        self.uploaderId = nil
        self.uploaderName = nil
        self.isStarred = nil
    }
}

#Preview {
    NavigationStack {
        StarredView()
    }
}
