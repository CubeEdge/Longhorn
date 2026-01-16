//
//  StarredView.swift
//  LonghornApp
//
//  收藏视图 - 列表/网格视图、选择、批量操作、详细信息
//

import SwiftUI

struct StarredView: View {
    @State private var starredItems: [StarredItem] = []
    @State private var isFirstLoad = true
    @State private var errorMessage: String?
    
    // 视图模式
    @State private var viewMode: ViewMode = .list
    
    // 选择模式
    @State private var isSelectionMode = false
    @State private var selectedIds: Set<Int> = []
    @State private var showDeleteConfirmation = false
    
    // 单条删除确认
    @State private var itemToUnstar: StarredItem?
    @State private var showSingleUnstarConfirmation = false
    
    // 预览
    @State private var previewItem: StarredItem?
    @State private var previewURL: URL?
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    enum ViewMode: String, CaseIterable {
        case list = "list"
        case grid = "grid"
        
        var title: LocalizedStringKey {
            switch self {
            case .list: return "browser.view_mode.list"
            case .grid: return "browser.view_mode.grid"
            }
        }
        
        var icon: String {
            switch self {
            case .list: return "list.bullet"
            case .grid: return "square.grid.2x2"
            }
        }
    }
    
    var body: some View {
        ZStack {
            // 错误状态
            if let error = errorMessage, starredItems.isEmpty {
                ContentUnavailableView(
                    String(localized: "alert.error"),
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            }
            // 首次加载骨架屏
            else if isFirstLoad && starredItems.isEmpty {
                VStack {
                    ProgressView()
                    Text("browser.loading")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 8)
                }
            }
            // 空状态
            else if starredItems.isEmpty {
                ContentUnavailableView(
                    String(localized: "starred.no_files"),
                    systemImage: "star",
                    description: Text("starred.hint")
                )
            }
            // 正常内容
            else {
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
        .navigationTitle(Text("starred.title"))
        .toolbar {
            toolbarContent
        }
        .refreshable {
            await refreshData()
        }
        .task {
            await loadData()
        }
        // 订阅收藏变更通知
        .onReceive(NotificationCenter.default.publisher(for: .starredDidChange)) { _ in
            Task { await refreshData() }
        }
        .confirmationDialog(
            "starred.confirm_unstar_count",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible,
            presenting: selectedIds.count
        ) { count in
            Button("action.unstar", role: .destructive) {
                unstarSelectedItems()
            }
            Button("action.cancel", role: .cancel) {}
        } message: { count in
            Text("starred.confirm_unstar_count \(count)")
        }
        // 单条取消收藏确认
        .confirmationDialog(
            "starred.confirm_unstar_single",
            isPresented: $showSingleUnstarConfirmation,
            titleVisibility: .visible,
            presenting: itemToUnstar
        ) { item in
            Button("action.unstar", role: .destructive) {
                confirmUnstarItem(item)
            }
            Button("action.cancel", role: .cancel) {
                itemToUnstar = nil
            }
        } message: { item in
            Text("starred.confirm_unstar_message \(item.displayName)")
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
                        itemToUnstar = item
                        showSingleUnstarConfirmation = true
                    } label: {
                        Label("action.unstar", systemImage: "star.slash")
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
                Text(selectedIds.count == starredItems.count ? "common.cancel_selection" : "action.select_all")
                    .font(.system(size: 14, weight: .medium))
            }
            
            Spacer()
            
            Text("common.selected_count \(selectedIds.count)")
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
            Button(isSelectionMode ? "action.done" : "action.select") {
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
                        Label(mode.title, systemImage: mode.icon)
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
                Label("action.preview", systemImage: "eye")
            }
        }
        
        Button {
            navigateToFolder(item)
        } label: {
            Label("starred.open_folder", systemImage: "folder")
        }
        
        Divider()
        
        Button(role: .destructive) {
            unstarItem(item)
        } label: {
            Label("action.unstar", systemImage: "star.slash")
        }
    }
    
    // MARK: - 方法
    
    /// 首次加载 - 进入页面时调用
    private func loadData() async {
        errorMessage = nil
        
        do {
            let items = try await FileService.shared.getStarredFiles()
            await MainActor.run {
                self.starredItems = items
                self.isFirstLoad = false
            }
        } catch is CancellationError {
            // 任务被取消时不显示错误
            print("StarredView: loadData cancelled")
        } catch {
            print("StarredView: loadData failed: \(error)")
            await MainActor.run {
                if self.starredItems.isEmpty {
                    self.errorMessage = error.localizedDescription
                }
                self.isFirstLoad = false
            }
        }
    }
    
    /// 下拉刷新 / 事件触发刷新 - 静默更新
    private func refreshData() async {
        do {
            let items = try await FileService.shared.getStarredFiles()
            await MainActor.run {
                self.starredItems = items
                self.errorMessage = nil
            }
        } catch is CancellationError {
            // 静默忽略
        } catch {
            print("StarredView: refreshData failed: \(error)")
        }
    }
    
    private func unstarItem(_ item: StarredItem) {
        itemToUnstar = item
        showSingleUnstarConfirmation = true
    }
    
    private func navigateToFolder(_ item: StarredItem) {
        // 导航逻辑这里需要 context，通常是由 NavigationLink 处理，或者这里做其他操作
        // 如果是简单的打印或者暂时空置
        print("Navigate to folder: \(item.fullPath)")
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
    
    /// 确认取消收藏单个项目（带 Toast 反馈）
    private func confirmUnstarItem(_ item: StarredItem) {
        Task {
            do {
                try await FileService.shared.unstarFile(id: item.id)
                // 乐观更新本地数据
                await MainActor.run {
                    starredItems.removeAll { $0.id == item.id }
                    itemToUnstar = nil
                }
                // 通知其他视图刷新
                NotificationCenter.default.post(name: .starredDidChange, object: nil)
                // 成功提示
                ToastManager.shared.show(String(localized: "starred.unstar_success"), type: .success)
            } catch {
                print("Unstar failed: \(error)")
                // 失败提示
                ToastManager.shared.show(String(localized: "starred.unstar_failed"), type: .error)
                // 失败时刷新以恢复状态
                await refreshData()
            }
        }
    }
    
    /// 批量取消收藏（带 Toast 反馈）
    private func unstarSelectedItems() {
        Task {
            var successCount = 0
            var failCount = 0
            
            for id in selectedIds {
                do {
                    try await FileService.shared.unstarFile(id: id)
                    successCount += 1
                } catch {
                    print("Unstar \(id) failed: \(error)")
                    failCount += 1
                }
            }
            // 乐观更新
            await MainActor.run {
                starredItems.removeAll { selectedIds.contains($0.id) }
                selectedIds.removeAll()
                isSelectionMode = false
            }
            // 通知其他视图
            NotificationCenter.default.post(name: .starredDidChange, object: nil)
            // 结果提示
            if failCount == 0 {
                ToastManager.shared.show(String(localized: "starred.unstar_batch_success \(successCount)"), type: .success)
            } else {
                ToastManager.shared.show(String(localized: "starred.unstar_batch_partial \(successCount) \(failCount)"), type: .warning)
            }
        }
    }
}

// MARK: - 通知名称扩展
extension Notification.Name {
    static let starredDidChange = Notification.Name("starredDidChange")
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
                    Text("starred.folder")
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
                ProgressView("status.loading")
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
                        Text("\(String(localized: "label.size")): \(formatter.string(fromByteCount: size))")
                            .foregroundColor(.secondary)
                    }
                    
                    Text("\(String(localized: "label.path")): \(item.fullPath)")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    
                    Button {
                        Task {
                            await downloadAndPreview()
                        }
                    } label: {
                        Label("file.download_preview", systemImage: "arrow.down.circle.fill")
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
        self.accessCount = nil
    }
}

#Preview {
    NavigationStack {
        StarredView()
    }
}
