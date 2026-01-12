//
//  FileBrowserView.swift
//  LonghornApp
//
//  文件浏览器视图 - 完整功能版
//

import SwiftUI
import PhotosUI
import QuickLook




struct FileBrowserView: View {
    let path: String
    var searchScope: SearchScope = .all
    
    @State private var files: [FileItem] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var viewMode: ViewMode = .list
    @State private var sortOrder: SortOrder = .name
    
    // 选择模式
    @State private var isSelectionMode = false
    @State private var selectedPaths: Set<String> = []
    
    // 操作状态
    @State private var showCreateFolder = false
    @State private var newFolderName = ""
    @State private var showUploadSheet = false
    @State private var showMoveSheet = false
    @State private var showShareSheet = false
    @State private var shareFile: FileItem?
    @State private var showDeleteConfirmation = false
    
    // 重命名
    @State private var showRenameAlert = false
    @State private var renameFile: FileItem?
    @State private var newFileName = ""
    
    // 上传
    @State private var showFilePicker = false
    @State private var showPhotoPicker = false
    @State private var showUploadProgress = false
    @State private var activeUploadCount: Int = 0
    
    // 预览
    @State private var previewFile: FileItem?
    @State private var previewURL: URL?
    @State private var isPreviewLoading = false
    @State private var showPreviewError = false
    @State private var previewErrorMessage = ""
    
    // 批量下载
    @State private var isBatchDownloading = false
    @State private var batchDownloadURL: URL?
    
    // 搜索
    @State private var searchText = ""
    @State private var isSearching = false
    @State private var searchResults: [FileItem] = []
    
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
    
    enum SortOrder: String, CaseIterable {
        case name = "名称"
        case date = "日期"
        case size = "大小"
        
        var icon: String {
            switch self {
            case .name: return "textformat"
            case .date: return "calendar"
            case .size: return "externaldrive"
            }
        }
    }
    
    var body: some View {
        ZStack {
            if isLoading {
                ProgressView("加载中...")
                    .progressViewStyle(.circular)
            } else if let error = errorMessage {
                ContentUnavailableView(
                    "加载失败",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
                .overlay(alignment: .bottom) {
                    Button("重试") {
                        Task { await loadFiles() }
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.bottom, 40)
                }
            } else if displayedFiles.isEmpty {
                if isSearching && !searchText.isEmpty {
                    ContentUnavailableView(
                        "无搜索结果",
                        systemImage: "magnifyingglass",
                        description: Text("没有找到匹配「\(searchText)」的结果")
                    )
                } else {
                    ContentUnavailableView(
                        "文件夹为空",
                        systemImage: "folder",
                        description: Text("此文件夹中没有文件")
                    )
                }
            } else {
                fileListContent
            }
        }
        .navigationTitle(pathTitle)
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $searchText, prompt: searchPrompt)
        .onSubmit(of: .search) {
            performSearch()
        }
        .onChange(of: searchText) { _, newValue in
            if newValue.isEmpty {
                isSearching = false
                searchResults = []
            }
        }
        .toolbar {
            toolbarContent
        }
        .refreshable {
            await loadFiles(forceRefresh: true)
        }
        .task {
            await loadFiles()
        }
        .sheet(isPresented: $showCreateFolder) {
            createFolderSheet
        }
        .sheet(isPresented: $showMoveSheet) {
            moveSheet
        }
        .confirmationDialog(
            "确定要删除所选的 \(selectedPaths.count) 个项目吗？",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("删除", role: .destructive) {
                deleteSelectedFiles()
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("删除的文件将移动到回收站")
        }
        .sheet(item: $shareFile) { file in
            ShareDialogView(
                filePath: file.path,
                fileName: file.name,
                onDismiss: { shareFile = nil }
            )
        }
        .sheet(isPresented: $showFilePicker) {
            FilePickerView(
                destinationPath: path,
                onDismiss: {
                    showFilePicker = false
                    Task { await loadFiles() }
                }
            )
        }
        .sheet(isPresented: $showPhotoPicker) {
            PhotoPickerView(
                destinationPath: path,
                onDismiss: {
                    showPhotoPicker = false
                    Task { await loadFiles() }
                }
            )
        }
        .sheet(isPresented: $showUploadProgress) {
            UploadProgressView(onDismiss: { showUploadProgress = false })
        }
        .quickLookPreview($previewURL)
        .overlay {
            if isPreviewLoading {
                ZStack {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                    
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.5)
                            .tint(.white)
                        Text("正在下载预览...")
                            .foregroundStyle(.white)
                            .font(.headline)
                    }
                    .padding(30)
                    .background(Material.ultraThinMaterial)
                    .cornerRadius(16)
                }
            }
        }
        .alert("预览失败", isPresented: $showPreviewError) {
            Button("确定", role: .cancel) { }
        } message: {
            Text(previewErrorMessage)
        }
        .alert("重命名", isPresented: $showRenameAlert) {
            TextField("新名称", text: $newFileName)
            Button("取消", role: .cancel) {
                renameFile = nil
                newFileName = ""
            }
            Button("确定") {
                performRename()
            }
        } message: {
            if let file = renameFile {
                Text("重命名 \"\(file.name)\"")
            }
        }
    }
    
    // MARK: - 搜索相关
    
    private var searchPrompt: String {
        switch searchScope {
        case .all:
            return "搜索所有文件"
        case .department(let code):
            return "在 \(code) 中搜索"
        case .personal:
            return "搜索个人空间"
        }
    }
    
    private var displayedFiles: [FileItem] {
        if isSearching && !searchResults.isEmpty {
            return searchResults
        }
        return sortedFiles
    }
    
    private func performSearch() {
        guard !searchText.isEmpty else { return }
        isSearching = true
        
        Task {
            do {
                searchResults = try await FileService.shared.searchFiles(
                    query: searchText,
                    scope: searchScope.scopeParameter
                )
            } catch {
                print("Search failed: \(error)")
                searchResults = []
            }
        }
    }
    
    // MARK: - 子视图
    
    @ViewBuilder
    private var fileListContent: some View {
        VStack(spacing: 0) {
            // 批量操作栏
            if isSelectionMode && !selectedPaths.isEmpty {
                bulkActionBar
            }
            
            switch viewMode {
            case .list:
                List(selection: isSelectionMode ? $selectedPaths : nil) {
                    ForEach(displayedFiles) { file in
                        FileRowView(
                            file: file,
                            isSelectionMode: isSelectionMode,
                            isSelected: selectedPaths.contains(file.path),
                            onAction: { action in
                                handleFileAction(action, for: file)
                            }
                        )
                        .tag(file.path)
                        .contextMenu {
                            fileContextMenu(file)
                        }
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                deleteFile(file)
                            } label: {
                                Label("删除", systemImage: "trash")
                            }
                            
                            Button {
                                toggleStar(file)
                            } label: {
                                Label(
                                    file.isStarred == true ? "取消收藏" : "收藏",
                                    systemImage: file.isStarred == true ? "star.slash" : "star"
                                )
                            }
                            .tint(.orange)
                        }
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await loadFiles(forceRefresh: true)
                }
                .environment(\.editMode, .constant(isSelectionMode ? .active : .inactive))
                
            case .grid:
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 100, maximum: 140), spacing: 16)
                    ], spacing: 16) {
                        ForEach(displayedFiles) { file in
                            FileGridItemView(
                                file: file,
                                isSelectionMode: isSelectionMode,
                                isSelected: selectedPaths.contains(file.path),
                                onTap: {
                                    if isSelectionMode {
                                        toggleSelection(file.path)
                                    }
                                },
                                onAction: { action in
                                    handleFileAction(action, for: file)
                                }
                            )
                            .contextMenu {
                                fileContextMenu(file)
                            }
                        }
                    }
                    .padding()
                    .padding()
                }
                .refreshable {
                    await loadFiles(forceRefresh: true)
                }
            }
        }
    }
    
    // MARK: - 批量操作栏
    
    private var bulkActionBar: some View {
        HStack {
            // 全选/取消全选
            Button {
                if selectedPaths.count == displayedFiles.count {
                    selectedPaths.removeAll()
                } else {
                    selectedPaths = Set(displayedFiles.map { $0.path })
                }
            } label: {
                Text(selectedPaths.count == displayedFiles.count ? "取消全选" : "全选")
                    .font(.system(size: 14, weight: .medium))
            }
            
            Spacer()
            
            Text("已选 \(selectedPaths.count) 项")
                .font(.system(size: 14))
                .foregroundColor(.secondary)
            
            Spacer()
            
            // 批量操作按钮
            HStack(spacing: 16) {
                Button {
                    showMoveSheet = true
                } label: {
                    Image(systemName: "folder")
                }
                .disabled(selectedPaths.isEmpty)
                
                Button {
                    batchDownload()
                } label: {
                    if isBatchDownloading {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "arrow.down.circle")
                    }
                }
                .disabled(selectedPaths.isEmpty || isBatchDownloading)
                
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    Image(systemName: "trash")
                }
                .disabled(selectedPaths.isEmpty)
            }
            .font(.system(size: 18))
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(Color(UIColor.secondarySystemBackground))
    }
    
    // MARK: - 工具栏
    
    private var toolbarContent: some ToolbarContent {
        Group {
            // 选择模式切换
            ToolbarItem(placement: .primaryAction) {
                Button(isSelectionMode ? "完成" : "选择") {
                    isSelectionMode.toggle()
                    if !isSelectionMode {
                        selectedPaths.removeAll()
                    }
                }
                .foregroundColor(isSelectionMode ? accentColor : .primary)
            }
            
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    // 视图切换
                    Section("视图") {
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
                    }
                    
                    // 排序
                    Section("排序") {
                        ForEach(SortOrder.allCases, id: \.self) { order in
                            Button {
                                sortOrder = order
                            } label: {
                                Label(order.rawValue, systemImage: order.icon)
                                if sortOrder == order {
                                    Image(systemName: "checkmark")
                                }
                            }
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
            
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button {
                        let formatter = DateFormatter()
                        formatter.dateFormat = "yyyyMMdd"
                        newFolderName = formatter.string(from: Date())
                        showCreateFolder = true
                    } label: {
                        Label("新建文件夹", systemImage: "folder.badge.plus")
                    }
                    
                    Divider()
                    
                    Button {
                        showFilePicker = true
                    } label: {
                        Label("上传文件", systemImage: "doc.badge.plus")
                    }
                    
                    Button {
                        showPhotoPicker = true
                    } label: {
                        Label("上传照片/视频", systemImage: "photo.badge.plus")
                    }
                    
                    if activeUploadCount > 0 {
                        Divider()
                        
                        Button {
                            showUploadProgress = true
                        } label: {
                            Label("上传进度 (\(activeUploadCount))", systemImage: "arrow.up.circle")
                        }
                    }
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
    }
    
    // MARK: - 上下文菜单
    
    @ViewBuilder
    private func fileContextMenu(_ file: FileItem) -> some View {
        // 预览
        if !file.isDirectory {
            Button {
                previewFile(file)
            } label: {
                Label("预览", systemImage: "eye")
            }
        }
        
        // 收藏
        Button {
            toggleStar(file)
        } label: {
            Label(
                file.isStarred == true ? "取消收藏" : "收藏",
                systemImage: file.isStarred == true ? "star.slash.fill" : "star.fill"
            )
        }
        
        Divider()
        
        // 分享
        if !file.isDirectory {
            Button {
                shareFile = file
            } label: {
                Label("分享", systemImage: "square.and.arrow.up")
            }
            
            Button {
                downloadFile(file)
            } label: {
                Label("下载", systemImage: "arrow.down.circle")
            }
        }
        
        // 移动
        Button {
            selectedPaths = [file.path]
            showMoveSheet = true
        } label: {
            Label("移动到", systemImage: "folder")
        }
        
        Divider()
        
        // 重命名
        Button {
            renameFile = file
            newFileName = file.name
            showRenameAlert = true
        } label: {
            Label("重命名", systemImage: "pencil")
        }
        
        // 删除
        Button(role: .destructive) {
            deleteFile(file)
        } label: {
            Label("删除", systemImage: "trash")
        }
    }
    
    // MARK: - Sheet 视图
    
    private var createFolderSheet: some View {
        NavigationStack {
            Form {
                TextField("文件夹名称", text: $newFolderName)
            }
            .navigationTitle("新建文件夹")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        showCreateFolder = false
                        newFolderName = ""
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("创建") {
                        createFolder()
                    }
                    .disabled(newFolderName.isEmpty)
                    .foregroundColor(accentColor)
                }
            }
        }
        .presentationDetents([.height(200)])
    }
    
    private var moveSheet: some View {
        NavigationStack {
            FolderPickerView(
                selectedPath: .constant(""),
                onSelect: { targetPath in
                    moveSelectedFiles(to: targetPath)
                    showMoveSheet = false
                }
            )
            .navigationTitle("移动到")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        showMoveSheet = false
                    }
                }
            }
        }
    }
    
    // MARK: - 计算属性
    
    private var pathTitle: String {
        if path.lowercased().hasPrefix("members/") {
            return "个人空间"
        }
        return path.components(separatedBy: "/").last ?? "文件"
    }
    
    private var sortedFiles: [FileItem] {
        var sorted = files
        
        // 文件夹优先
        sorted.sort { $0.isDirectory && !$1.isDirectory }
        
        // 按选择的排序方式排序
        switch sortOrder {
        case .name:
            sorted.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        case .date:
            sorted.sort { ($0.modifiedAt ?? .distantPast) > ($1.modifiedAt ?? .distantPast) }
        case .size:
            sorted.sort { ($0.size ?? 0) > ($1.size ?? 0) }
        }
        
        return sorted
    }
    
    // MARK: - 方法
    
    private func loadFiles(forceRefresh: Bool = false) async {
        // 首次加载或强制刷新时显示loading
        if files.isEmpty || forceRefresh {
            isLoading = true
        }
        errorMessage = nil
        
        do {
            let (loadedFiles, fromCache) = try await FileService.shared.getFilesWithCache(
                path: path,
                forceRefresh: forceRefresh
            )
            files = loadedFiles
            
            // 如果是从缓存加载，可以显示一个小指示(可选)
            if fromCache {
                print("[Cache] Loaded \(loadedFiles.count) files from cache")
            }
        } catch let error as APIError {
            // 如果有缓存数据，即使出错也保留
            if files.isEmpty {
                errorMessage = error.errorDescription
            }
        } catch {
            if files.isEmpty {
                errorMessage = error.localizedDescription
            }
        }
        
        isLoading = false
    }
    
    private func toggleSelection(_ path: String) {
        if selectedPaths.contains(path) {
            selectedPaths.remove(path)
        } else {
            selectedPaths.insert(path)
        }
    }
    
    private func previewFile(_ file: FileItem) {
        isPreviewLoading = true
        Task {
            do {
                let url = try await APIClient.shared.downloadFile(path: file.path)
                await MainActor.run {
                    previewURL = url
                    isPreviewLoading = false
                }
            } catch {
                await MainActor.run {
                    isPreviewLoading = false
                    previewErrorMessage = error.localizedDescription
                    showPreviewError = true
                }
                print("Preview failed: \(error)")
            }
        }
    }
    
    private func handleFileAction(_ action: FileAction, for file: FileItem) {
        switch action {
        case .preview:
            previewFile(file)
        case .toggleStar:
            toggleStar(file)
        case .share:
            shareFile = file
        case .move:
            selectedPaths = [file.path]
            showMoveSheet = true
        case .delete:
            deleteFile(file)
        case .download:
            downloadFile(file)
        }
    }

    
    private func toggleStar(_ file: FileItem) {
        Task {
            do {
                try await FileService.shared.toggleStar(path: file.path)
                await loadFiles()
            } catch {
                print("Toggle star failed: \(error)")
            }
        }
    }
    
    private func performRename() {
        guard let file = renameFile,
              !newFileName.isEmpty,
              newFileName != file.name else {
            renameFile = nil
            newFileName = ""
            return
        }
        
        Task {
            do {
                try await FileService.shared.renameFile(
                    at: file.path,
                    to: newFileName
                )
                // 使缓存失效并刷新
                await FileCacheManager.shared.invalidate(path: path)
                await loadFiles(forceRefresh: true)
            } catch {
                print("Rename failed: \(error)")
            }
            renameFile = nil
            newFileName = ""
        }
    }
    
    private func deleteFile(_ file: FileItem) {
        Task {
            do {
                try await FileService.shared.deleteFile(path: file.path)
                await loadFiles()
            } catch {
                print("Delete failed: \(error)")
            }
        }
    }
    
    private func deleteSelectedFiles() {
        Task {
            do {
                try await FileService.shared.deleteFiles(paths: Array(selectedPaths))
                selectedPaths.removeAll()
                isSelectionMode = false
                await loadFiles()
            } catch {
                print("Bulk delete failed: \(error)")
            }
        }
    }
    
    private func moveSelectedFiles(to destination: String) {
        Task {
            do {
                try await FileService.shared.moveFiles(paths: Array(selectedPaths), destination: destination)
                selectedPaths.removeAll()
                isSelectionMode = false
                await loadFiles()
            } catch {
                print("Bulk move failed: \(error)")
            }
        }
    }
    
    private func downloadFile(_ file: FileItem) {
        Task {
            do {
                let url = try await APIClient.shared.downloadFile(path: file.path)
                print("Downloaded to: \(url)")
                // 使用系统分享
                await MainActor.run {
                    previewURL = url
                }
            } catch {
                print("Download failed: \(error)")
            }
        }
    }
    
    private func createFolder() {
        Task {
            do {
                try await FileService.shared.createFolder(path: path, name: newFolderName)
                showCreateFolder = false
                newFolderName = ""
                await loadFiles()
            } catch {
                print("Create folder failed: \(error)")
            }
        }
    }
    
    private func batchDownload() {
        guard !selectedPaths.isEmpty else { return }
        isBatchDownloading = true
        
        Task {
            do {
                let url = try await APIClient.shared.downloadBatchFiles(paths: Array(selectedPaths))
                await MainActor.run {
                    isBatchDownloading = false
                    batchDownloadURL = url
                    // 使用系统分享
                    shareDownloadedFile(url)
                }
            } catch {
                await MainActor.run {
                    isBatchDownloading = false
                    previewErrorMessage = error.localizedDescription
                    showPreviewError = true
                }
                print("Batch download failed: \(error)")
            }
        }
    }
    
    private func shareDownloadedFile(_ url: URL) {
        let activityVC = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let rootVC = windowScene.windows.first?.rootViewController {
            // iPad 需要 popover
            if let popover = activityVC.popoverPresentationController {
                popover.sourceView = rootVC.view
                popover.sourceRect = CGRect(x: rootVC.view.bounds.midX, y: rootVC.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            rootVC.present(activityVC, animated: true)
        }
    }
}

// MARK: - 文件行视图

// MARK: - 文件操作枚举

enum FileAction {
    case preview
    case toggleStar
    case download
    case move
    case delete
    case share
}


    
struct FileRowView: View {
    let file: FileItem
    var isSelectionMode: Bool = false
    var isSelected: Bool = false
    var onAction: (FileAction) -> Void = { _ in }
    
    private let iconColors: [String: Color] = [
        "folderBlue": .blue,
        "imageGreen": .green,
        "videoPurple": .purple,
        "audioOrange": .orange,
        "documentGray": .gray
    ]
    
    var body: some View {
        if isSelectionMode {
            rowContent
        } else if file.isDirectory {
            NavigationLink {
                FileBrowserView(path: file.path)
                    .navigationTitle(file.name)
            } label: {
                rowContent
            }
        } else {
            Button {
                onAction(.preview)
            } label: {
                rowContent
            }
            .buttonStyle(.plain)
        }
    }
    
    private var rowContent: some View {
        HStack(spacing: 14) {
            // 图标或缩略图
            if canShowThumbnail {
                ThumbnailView(path: file.path, size: 40)
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(iconColor.opacity(0.15))
                        .frame(width: 40, height: 40)
                    
                    Image(systemName: file.systemIconName)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(iconColor)
                }
            }
            
            // 文件信息
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    // 星标显示在文件名左侧更醒目（如果已收藏）
                    if file.isStarred == true {
                        Image(systemName: "star.fill")
                            .font(.system(size: 12))
                            .foregroundColor(.orange)
                    }
                    
                    Text(file.name)
                        .font(.system(size: 15, weight: .medium))
                        .lineLimit(1)
                }
                
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
            
            // 更多操作菜单
            if !isSelectionMode {
                Menu {
                    Button { onAction(.preview) } label: {
                        Label("预览", systemImage: "eye")
                    }
                    
                    Button { onAction(.toggleStar) } label: {
                        Label(file.isStarred == true ? "取消收藏" : "收藏", 
                              systemImage: file.isStarred == true ? "star.slash" : "star")
                    }
                    
                    Button { onAction(.share) } label: {
                        Label("分享", systemImage: "square.and.arrow.up")
                    }
                    
                    Button { onAction(.move) } label: {
                        Label("移动", systemImage: "folder")
                    }
                    
                    Button { onAction(.download) } label: {
                        Label("下载", systemImage: "arrow.down.circle")
                    }
                    
                    Divider()
                    
                    Button(role: .destructive) { onAction(.delete) } label: {
                        Label("删除", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                        .padding(8)
                        .contentShape(Rectangle())
                }
                .highPriorityGesture(TapGesture()) // 确保在行点击中优先响应
            }
        }
        .padding(.vertical, 4)
    }
    
    private var iconColor: Color {
        iconColors[file.iconColorName] ?? .gray
    }
    
    private var canShowThumbnail: Bool {
        let extensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "hevc", "mov", "mp4"]
        let ext = (file.name as NSString).pathExtension.lowercased()
        return extensions.contains(ext)
    }
}

// MARK: - 文件网格项视图

struct FileGridItemView: View {
    let file: FileItem
    var isSelectionMode: Bool = false
    var isSelected: Bool = false
    var onTap: () -> Void = {}
    var onAction: (FileAction) -> Void = { _ in }
    
    private let iconColors: [String: Color] = [
        "folderBlue": .blue,
        "imageGreen": .green,
        "videoPurple": .purple,
        "audioOrange": .orange,
        "documentGray": .gray
    ]
    
    var body: some View {
        Group {
            if isSelectionMode {
                gridContent
                    .onTapGesture { onTap() }
            } else if file.isDirectory {
                NavigationLink {
                    FileBrowserView(path: file.path)
                        .navigationTitle(file.name)
                } label: {
                    gridContent
                }
            } else {
                Button {
                    onAction(.preview)
                } label: {
                    gridContent
                }
                .buttonStyle(.plain)
            }
        }
        .overlay(alignment: .topLeading) {
            if isSelectionMode {
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundColor(isSelected ? Color(red: 1.0, green: 0.82, blue: 0.0) : .secondary)
                    .padding(8)
            }
        }
        .overlay(alignment: .topTrailing) {
            if !isSelectionMode {
                Menu {
                    Button { onAction(.preview) } label: {
                        Label("预览", systemImage: "eye")
                    }
                    
                    Button { onAction(.toggleStar) } label: {
                        Label(file.isStarred == true ? "取消收藏" : "收藏", 
                              systemImage: file.isStarred == true ? "star.slash" : "star")
                    }
                    
                    Button { onAction(.share) } label: {
                        Label("分享", systemImage: "square.and.arrow.up")
                    }
                    
                    Button { onAction(.move) } label: {
                        Label("移动", systemImage: "folder")
                    }
                    
                    Button { onAction(.download) } label: {
                        Label("下载", systemImage: "arrow.down.circle")
                    }
                    
                    Divider()
                    
                    Button(role: .destructive) { onAction(.delete) } label: {
                        Label("删除", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle.fill")
                        .symbolRenderingMode(.palette)
                        .foregroundStyle(Color.primary, Color(UIColor.systemGray5))
                        .font(.system(size: 22))
                        .padding(6)
                        .shadow(radius: 1)
                }
                .highPriorityGesture(TapGesture()) // 确保 Menu 优先响应
            }
        }
    }
    
    private var gridContent: some View {
        VStack(spacing: 8) {
            // 图标或缩略图
            ZStack {
                if canShowThumbnail {
                    ThumbnailView(path: file.path, size: 80)
                } else {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(iconColor.opacity(0.12))
                        .frame(width: 80, height: 80)
                    
                    Image(systemName: file.systemIconName)
                        .font(.system(size: 32, weight: .medium))
                        .foregroundColor(iconColor)
                }
            }
            
            // 文件名
            Text(file.name)
                .font(.system(size: 12, weight: .medium))
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .foregroundColor(.primary)
                .frame(height: 32, alignment: .top)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(isSelected ? Color(red: 1.0, green: 0.82, blue: 0.0).opacity(0.1) : Color.clear)
        .cornerRadius(12)
    }
    
    private var iconColor: Color {
        iconColors[file.iconColorName] ?? .gray
    }
    
    private var canShowThumbnail: Bool {
        let extensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "hevc", "mov", "mp4"]
        let ext = (file.name as NSString).pathExtension.lowercased()
        return extensions.contains(ext)
    }
}

// MARK: - 文件预览视图

struct FilePreviewView: View {
    let file: FileItem
    @State private var localURL: URL?
    @State private var isLoading = true
    
    var body: some View {
        Group {
            if isLoading {
                ProgressView("加载中...")
            } else if let url = localURL {
                QuickLookPreview(url: url)
            } else {
                VStack(spacing: 20) {
                    Image(systemName: file.systemIconName)
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)
                    
                    Text(file.name)
                        .font(.headline)
                    
                    if !file.isDirectory {
                        Text(file.formattedSize)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    
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
        .navigationTitle(file.name)
        .task {
            await downloadAndPreview()
        }
    }
    
    private func downloadAndPreview() async {
        isLoading = true
        do {
            let url = try await APIClient.shared.downloadFile(path: file.path)
            await MainActor.run {
                localURL = url
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

// MARK: - QuickLook 预览包装

struct QuickLookPreview: UIViewControllerRepresentable {
    let url: URL
    
    func makeUIViewController(context: Context) -> QLPreviewController {
        let controller = QLPreviewController()
        controller.dataSource = context.coordinator
        return controller
    }
    
    func updateUIViewController(_ uiViewController: QLPreviewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(url: url)
    }
    
    class Coordinator: NSObject, QLPreviewControllerDataSource {
        let url: URL
        
        init(url: URL) {
            self.url = url
        }
        
        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
        
        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            url as QLPreviewItem
        }
    }
}

// MARK: - 文件夹选择器

struct FolderPickerView: View {
    @Binding var selectedPath: String
    var onSelect: (String) -> Void
    
    @State private var folders: [FolderTreeItem] = []
    @State private var isLoading = true
    
    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else {
                List {
                    ForEach(folders) { folder in
                        FolderPickerRow(folder: folder, onSelect: onSelect)
                    }
                }
            }
        }
        .task {
            do {
                folders = try await FileService.shared.getFolderTree()
            } catch {
                print("Load folder tree failed: \(error)")
            }
            isLoading = false
        }
    }
}

struct FolderPickerRow: View {
    let folder: FolderTreeItem
    var onSelect: (String) -> Void
    
    var body: some View {
        Button {
            onSelect(folder.path)
        } label: {
            HStack {
                Image(systemName: "folder.fill")
                    .foregroundColor(.blue)
                Text(folder.name)
                Spacer()
            }
        }
    }
}

#Preview {
    NavigationStack {
        FileBrowserView(path: "MS")
    }
}

// MARK: - 分享对话框

struct ShareDialogView: View {
    let filePath: String
    let fileName: String
    var onDismiss: () -> Void = {}
    
    @State private var password = ""
    @State private var usePassword = false
    @State private var expiresIn: ExpiryOption = .sevenDays
    @State private var isLoading = false
    @State private var shareResult: ShareResult?
    @State private var errorMessage: String?
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    enum ExpiryOption: String, CaseIterable {
        case oneDay = "1天"
        case threeDays = "3天"
        case sevenDays = "7天"
        case thirtyDays = "30天"
        case never = "永久"
        
        var days: Int? {
            switch self {
            case .oneDay: return 1
            case .threeDays: return 3
            case .sevenDays: return 7
            case .thirtyDays: return 30
            case .never: return nil
            }
        }
    }
    
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
                HStack(spacing: 12) {
                    Image(systemName: "doc.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.blue)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(fileName)
                            .font(.system(size: 15, weight: .medium))
                        Text(filePath)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
            } header: {
                Text("分享文件")
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
                    ForEach(ExpiryOption.allCases, id: \.self) { option in
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
        .navigationTitle("创建分享链接")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { onDismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    createShareLink()
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("创建")
                    }
                }
                .disabled(isLoading || (usePassword && password.isEmpty))
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
            
            Text("分享链接已创建")
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
    
    private func createShareLink() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let result = try await FileService.shared.createShareLink(
                    path: filePath,
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

// MARK: - 文件选择器

struct FilePickerView: UIViewControllerRepresentable {
    let destinationPath: String
    var onDismiss: () -> Void = {}
    
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        picker.allowsMultipleSelection = true
        picker.delegate = context.coordinator
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(destinationPath: destinationPath, onDismiss: onDismiss)
    }
    
    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let destinationPath: String
        let onDismiss: () -> Void
        
        init(destinationPath: String, onDismiss: @escaping () -> Void) {
            self.destinationPath = destinationPath
            self.onDismiss = onDismiss
        }
        
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            // TODO: 实现文件上传
            for url in urls {
                print("Selected file: \(url.lastPathComponent)")
            }
            onDismiss()
        }
        
        func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
            onDismiss()
        }
    }
}

// MARK: - 照片选择器



struct PhotoPickerView: View {
    let destinationPath: String
    var onDismiss: () -> Void = {}
    
    @State private var selectedItems: [PhotosPickerItem] = []
    
    var body: some View {
        NavigationStack {
            VStack {
                PhotosPicker(
                    selection: $selectedItems,
                    maxSelectionCount: 20,
                    matching: .any(of: [.images, .videos])
                ) {
                    VStack(spacing: 16) {
                        Image(systemName: "photo.on.rectangle.angled")
                            .font(.system(size: 48))
                            .foregroundColor(.blue)
                        
                        Text("选择照片或视频")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }
                .onChange(of: selectedItems) { _, items in
                    if !items.isEmpty {
                        // TODO: 实现照片上传
                        print("Selected \(items.count) items")
                        onDismiss()
                    }
                }
            }
            .navigationTitle("上传照片")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { onDismiss() }
                }
            }
        }
    }
}

// MARK: - 上传进度视图（简化版）

struct UploadProgressView: View {
    var onDismiss: () -> Void = {}
    
    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "没有上传任务",
                systemImage: "arrow.up.circle",
                description: Text("上传的文件将显示在这里")
            )
            .navigationTitle("上传任务")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { onDismiss() }
                }
            }
        }
    }
}
