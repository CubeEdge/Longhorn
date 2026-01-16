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
    
    @StateObject private var store = FileStore.shared
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
    @State private var showBatchShareSheet = false  // 批量分享
    
    // 单个删除确认
    @State private var showSingleDeleteConfirmation = false
    @State private var fileToDelete: FileItem?
    
    // 重命名
    @State private var showRenameAlert = false
    @State private var renameFile: FileItem?
    @State private var newFileName = ""
    
    // 复制
    @State private var showCopySheet = false
    @State private var copySourceFile: FileItem?
    
    // 详情/统计
    @State private var showStatsSheet = false
    @State private var statsFile: FileItem?
    
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
    @State private var showFilePreview = false  // 显示自定义预览面板
    
    // 批量下载
    @State private var isBatchDownloading = false
    @State private var batchDownloadURL: URL?
    
    // 搜索
    @State private var searchText = ""
    @State private var isSearching = false
    @State private var searchResults: [FileItem] = []
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    enum ViewMode: String, CaseIterable {
        case list = "view.list"
        case grid = "view.grid"
        
        var icon: String {
            switch self {
            case .list: return "list.bullet"
            case .grid: return "square.grid.2x2"
            }
        }
    }
    
    enum SortOrder: String, CaseIterable {
        case name = "sort.name"
        case date = "sort.date"
        case size = "sort.size"
        
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
            mainContent
        }
        .navigationTitle(pathTitle)
        .navigationBarTitleDisplayMode(.inline)

        .searchable(text: $searchText, prompt: Text(searchPromptKey))
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
            await store.refreshFiles(path: path)
        }
        .task {
            // 智能加载：有缓存则不请求
            await store.loadFilesIfNeeded(path: path)
        }
        .sheet(isPresented: $showCreateFolder) {
            createFolderSheet
        }
        .sheet(isPresented: $showMoveSheet) {
            moveSheet
        }
        .sheet(isPresented: $showCopySheet) {
            copySheet
        }
        .sheet(item: $statsFile) { file in
            FileStatsView(file: file) {
                statsFile = nil
            }
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
        .confirmationDialog(
            "确定要删除 \"\(fileToDelete?.name ?? "这个文件")\" 吗？",
            isPresented: $showSingleDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("删除", role: .destructive) {
                if let file = fileToDelete {
                    deleteFile(file)
                }
            }
            Button("取消", role: .cancel) {
                fileToDelete = nil
            }
        } message: {
            Text("删除后可在回收站找回")
        }
        .sheet(item: $shareFile) { file in
            ShareDialogView(
                filePath: file.path,
                fileName: file.name,
                onDismiss: { shareFile = nil }
            )
        }
        .sheet(isPresented: $showBatchShareSheet) {
            BatchShareDialogView(
                filePaths: Array(selectedPaths),
                onDismiss: {
                    showBatchShareSheet = false
                    selectedPaths.removeAll()
                    isSelectionMode = false
                }
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
        .fullScreenCover(item: $previewFile) { file in
            FilePreviewSheet(
                file: file,
                previewURL: previewURL,
                onClose: {
                    previewFile = nil
                },
                onDownload: {
                    downloadFile(file)
                },
                onShare: {
                    shareFile = file
                },
                onStar: {
                    toggleStar(file)
                }
            )
        }
        .overlay {
            if isPreviewLoading {
                ZStack {
                    Color.black.opacity(0.3)
                        .ignoresSafeArea()
                    
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.5)
                            .tint(.white)
                        Text("正在打开...")
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
    
    // MARK: - 主视图内容
    
    @ViewBuilder
    private var mainContent: some View {
        // 错误状态
        if let error = errorMessage {
            ContentUnavailableView(
                String(localized: "alert.error"),
                systemImage: "exclamationmark.triangle",
                description: Text(error)
            )
            .overlay(alignment: .bottom) {
                Button(String(localized: "action.retry")) {
                    Task { await store.refreshFiles(path: path) }
                }
                .buttonStyle(.borderedProminent)
                .padding(.bottom, 40)
            }
        } 
        // 首次加载且无缓存
        else if store.isFirstLoad(for: path) {
            ProgressView(String(localized: "browser.loading"))
                .progressViewStyle(.circular)
        }
        // 空状态
        else if displayedFiles.isEmpty {
            if isSearching && !searchText.isEmpty {
                ContentUnavailableView(
                    String(localized: "search.no_results"),
                    systemImage: "magnifyingglass",
                    description: Text("No results for \"\(searchText)\"")
                )
            } else {
                ContentUnavailableView(
                    String(localized: "browser.empty"),
                    systemImage: "folder",
                    description: Text("browser.empty")
                )
            }
        } else {
            fileListContent
        }
    }
    
    // MARK: - 搜索相关
    
    private var searchPromptKey: LocalizedStringKey {
        switch searchScope {
        case .all:
            return "search.placeholder.all"
        case .department(let code):
            return LocalizedStringKey("Search in \(code)") // Not clean but functional for dynamic
        case .personal:
            return "search.placeholder.personal"
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
                Text(selectedPaths.count == displayedFiles.count ? "action.select_none" : "action.select_all") // Using Keys
                    .font(.system(size: 14, weight: .medium))
            }
            
            Spacer()
            
            Text("已选 \(selectedPaths.count) 项")
                .font(.system(size: 14))
                .foregroundColor(.secondary)
            
            Spacer()
            
            // 批量操作按钮
            HStack(spacing: 16) {
                // 批量收藏
                Button {
                    batchToggleStar()
                } label: {
                    Image(systemName: "star")
                }
                .disabled(selectedPaths.isEmpty)
                
                Button {
                    showMoveSheet = true
                } label: {
                    Image(systemName: "folder")
                }
                .disabled(selectedPaths.isEmpty)
                
                // 批量分享
                Button {
                    showBatchShareSheet = true
                } label: {
                    Image(systemName: "square.and.arrow.up")
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
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
            // Daily Word Badge (Leading)
            // Daily Word Badge removed as per request

            // 选择模式切换
            ToolbarItem(placement: .primaryAction) {
                if isSelectionMode {
                    Button(String(localized: "action.done")) {
                        isSelectionMode = false
                        selectedPaths.removeAll()
                    }
                    .foregroundColor(accentColor)
                } else {
                    Button(String(localized: "action.select")) {
                        isSelectionMode = true
                    }
                    .foregroundColor(.primary)
                }
            }
            
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Section("view.title") {
                        ForEach(ViewMode.allCases, id: \.self) { mode in
                            Button {
                                viewMode = mode
                            } label: {
                                Label(LocalizedStringKey(mode.rawValue), systemImage: mode.icon)
                                    .foregroundColor(viewMode == mode ? .blue : .primary)
                            }
                        }
                    }
                    
                    Section("sort.title") {
                        ForEach(SortOrder.allCases, id: \.self) { order in
                            Button {
                                sortOrder = order
                            } label: {
                                Label(LocalizedStringKey(order.rawValue), systemImage: order.icon)
                                    .foregroundColor(sortOrder == order ? .blue : .primary)
                            }
                        }
                    }
                } label: {
                    Label("more.tools", systemImage: "ellipsis.circle")
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
                        Label("browser.create_folder", systemImage: "folder.badge.plus")
                    }
                    
                    Divider()
                    
                    Button {
                        showFilePicker = true
                    } label: {
                        Label("browser.upload_file", systemImage: "doc.badge.plus")
                    }
                    
                    Button {
                        showPhotoPicker = true
                    } label: {
                        Label("browser.upload_photo", systemImage: "photo.badge.plus")
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
    
    // MARK: - 上下文菜单
    
    @ViewBuilder
    private func fileContextMenu(_ file: FileItem) -> some View {
        // 预览
        if !file.isDirectory {
            Button {
                previewFile(file)
            } label: {
                Label("action.preview", systemImage: "eye")
            }
        }
        
        // 收藏
        Button {
            toggleStar(file)
        } label: {
            Label(
                file.isStarred == true ? "action.unstar" : "action.star",
                systemImage: file.isStarred == true ? "star.slash.fill" : "star.fill"
            )
        }
        
        Divider()
        
        // 分享
        if !file.isDirectory {
            Button {
                shareFile = file
            } label: {
                Label("action.share", systemImage: "square.and.arrow.up")
            }
            
            Button {
                downloadFile(file)
            } label: {
                Label("action.download", systemImage: "arrow.down.circle")
            }
        }
        
        // 移动
        Button {
            selectedPaths = [file.path]
            showMoveSheet = true
        } label: {
            Label("action.move_to", systemImage: "folder")
        }
        
        Divider()
        
        // 重命名
        Button {
            renameFile = file
            // 只显示文件名（不含后缀），保留后缀
            if file.isDirectory {
                newFileName = file.name
            } else {
                newFileName = (file.name as NSString).deletingPathExtension
            }
            showRenameAlert = true
        } label: {
            Label("action.rename", systemImage: "pencil")
        }
        
        // 复制
        Button {
            copySourceFile = file
            showCopySheet = true
        } label: {
            Label("action.copy_to", systemImage: "doc.on.doc")
        }
        
        // 详情
        Button {
            statsFile = file
            showStatsSheet = true
        } label: {
            Label("stats.details", systemImage: "info.circle")
        }
        
        // 删除
        Button(role: .destructive) {
            fileToDelete = file
            showSingleDeleteConfirmation = true
        } label: {
            Label("action.delete", systemImage: "trash")
        }
    }
    
    // MARK: - Sheet 视图
    
    private var createFolderSheet: some View {
        NavigationStack {
            Form {
                TextField("browser.folder_name_placeholder", text: $newFolderName)
            }
            .navigationTitle(Text("browser.create_folder"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.cancel") {
                        showCreateFolder = false
                        newFolderName = ""
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("action.create") {
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
            DestinationFolderPicker(
                onSelect: { targetPath in
                    moveSelectedFiles(to: targetPath)
                    showMoveSheet = false
                }
            )
            .navigationTitle(Text("action.move_to"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.cancel") {
                        showMoveSheet = false
                    }
                }
            }
        }
    }
    
    private var copySheet: some View {
        NavigationStack {
            DestinationFolderPicker(
                onSelect: { targetPath in
                    performCopy(to: targetPath)
                    showCopySheet = false
                }
            )
            .navigationTitle("复制到")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        showCopySheet = false
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
        // 从 Store 获取数据
        var sorted = store.getFiles(for: path)
        
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
    
    // Legacy loadFiles removed - replaced by store.loadFilesIfNeeded calls in .task modifier
    
    private func toggleSelection(_ path: String) {
        if selectedPaths.contains(path) {
            selectedPaths.remove(path)
        } else {
            selectedPaths.insert(path)
        }
    }
    
    private func previewFile(_ file: FileItem) {
        // Record History
        RecentFilesManager.shared.add(file)
        
        print("DEBUG PREVIEW: Tapped file: \(file.name) (isImage: \(file.isImage), isVideo: \(file.isVideo))")
        // REMOVED EARLY ASSIGNMENT: previewFile = file
        
        // 检查是否为图片或视频，如果是，则立即流式预览
        // 使用 FileItem 的属性判断，更稳健
        let isMedia = file.isImage || file.isVideo
        print("DEBUG PREVIEW: isMedia check result: \(isMedia)")
        
        if isMedia {
            // 立即弹出预览面板
            print("DEBUG PREVIEW: Immediate preview triggered")
            previewFile = file // Trigger Sheet
            isPreviewLoading = false
            return
        }
        
        // 非媒体文件，或者需要下载才能预览的文件
        isPreviewLoading = true
        
        Task {
            // 1. 先检查缓存
            if let cachedURL = await PreviewCacheManager.shared.getCachedURL(for: file.path) {
                await MainActor.run {
                    previewURL = cachedURL
                    isPreviewLoading = false
                    previewFile = file // Trigger Sheet
                }
                return
            }
            
            // 2. 缓存未命中，下载文件
            do {
                let url = try await APIClient.shared.downloadFile(path: file.path)
                
                // 3. 缓存下载的文件
                await PreviewCacheManager.shared.cache(url: url, for: file.path)
                
                await MainActor.run {
                    previewURL = url
                    isPreviewLoading = false
                    previewFile = file // Trigger Sheet
                }
            } catch {
                await MainActor.run {
                    isPreviewLoading = false
                    previewErrorMessage = error.localizedDescription
                    showPreviewError = true
                    previewFile = nil
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
            fileToDelete = file
            showSingleDeleteConfirmation = true
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
              !newFileName.isEmpty else {
            renameFile = nil
            newFileName = ""
            return
        }
        
        // 构建完整文件名（保留原有后缀）
        let finalName: String
        if file.isDirectory {
            finalName = newFileName
        } else {
            let ext = (file.name as NSString).pathExtension
            if ext.isEmpty {
                finalName = newFileName
            } else {
                finalName = newFileName + "." + ext
            }
        }
        
        // 检查名称是否有变化
        guard finalName != file.name else {
            renameFile = nil
            newFileName = ""
            return
        }
        
        Task {
            do {
                try await FileService.shared.renameFile(
                    at: file.path,
                    to: finalName
                )
                // 使缓存失效并刷新
                await FileCacheManager.shared.invalidate(path: path)
                await loadFiles(forceRefresh: true)
            } catch {
                print("Rename failed: \(error)")
                ToastManager.shared.show(error.localizedDescription, type: .error)
            }
            renameFile = nil
            newFileName = ""
            ToastManager.shared.show(String(localized: "toast.rename_success"), type: .success)
        }
    }
    
    private func deleteFile(_ file: FileItem) {
        Task {
            do {
                try await FileService.shared.deleteFile(path: file.path)
                // 删除时失效预览缓存
                if file.isDirectory {
                    await PreviewCacheManager.shared.invalidateDirectory(path: file.path)
                } else {
                    await PreviewCacheManager.shared.invalidate(path: file.path)
                }
                // 强制刷新列表以立即反映更改
                await loadFiles(forceRefresh: true)
                ToastManager.shared.show(String(localized: "toast.delete_success"), type: .success)
            } catch {
                print("Delete failed: \(error)")
                ToastManager.shared.show(error.localizedDescription, type: .error)
            }
        }
    }
    
    private func deleteSelectedFiles() {
        Task {
            do {
                let pathsToDelete = Array(selectedPaths)
                try await FileService.shared.deleteFiles(paths: pathsToDelete)
                // 批量删除时失效预览缓存
                await PreviewCacheManager.shared.invalidate(paths: pathsToDelete)
                selectedPaths.removeAll()
                isSelectionMode = false
                await loadFiles()
                ToastManager.shared.show(String(localized: "toast.delete_success"), type: .success)
            } catch {
                print("Bulk delete failed: \(error)")
                ToastManager.shared.show(error.localizedDescription, type: .error)
            }
        }
    }
    
    private func moveSelectedFiles(to destination: String) {
        Task {
            do {
                let pathsToMove = Array(selectedPaths)
                try await FileService.shared.moveFiles(paths: pathsToMove, destination: destination)
                // 移动时失效旧路径的预览缓存
                await PreviewCacheManager.shared.invalidate(paths: pathsToMove)
                selectedPaths.removeAll()
                isSelectionMode = false
                await loadFiles()
                ToastManager.shared.show(String(localized: "toast.move_success"), type: .success)
            } catch {
                print("Bulk move failed: \(error)")
                ToastManager.shared.show(error.localizedDescription, type: .error)
            }
        }
    }
    
    private func performCopy(to destination: String) {
        Task {
            do {
                if let source = copySourceFile {
                    // 单个文件复制
                    _ = try await FileService.shared.copyFile(sourcePath: source.path, targetDir: destination)
                    copySourceFile = nil
                } else if !selectedPaths.isEmpty {
                    // 批量复制（暂时循环调用，后续可优化为批量接口）
                    for path in selectedPaths {
                        _ = try await FileService.shared.copyFile(sourcePath: path, targetDir: destination)
                    }
                    isSelectionMode = false
                    await loadFiles()
                    ToastManager.shared.show(String(localized: "toast.copy_success"), type: .success)
                }
            } catch {
                print("Copy failed: \(error)")
                ToastManager.shared.show(error.localizedDescription, type: .error)
            }
        }
    }
    
    private func batchToggleStar() {
        Task {
            var successCount = 0
            for path in selectedPaths {
                do {
                    // Check if starred, if not, star it. (Greedy favoriting)
                    let isStarred = try await FileService.shared.isFileStarred(path: path)
                    if !isStarred {
                        try await FileService.shared.starFile(path: path)
                        successCount += 1
                    }
                } catch {
                    print("Failed to star \(path): \(error)")
                }
            }
            
            if successCount > 0 {
                await loadFiles()
                ToastManager.shared.show(String(localized: "toast.starred_success"), type: .success)
                isSelectionMode = false
                selectedPaths.removeAll()
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
                ToastManager.shared.show(String(localized: "toast.folder_created"), type: .success)
            } catch {
                print("Create folder failed: \(error)")
                ToastManager.shared.show(error.localizedDescription, type: .error)
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
                        Label("action.preview", systemImage: "eye")
                    }
                    
                    Button { onAction(.toggleStar) } label: {
                        Label(file.isStarred == true ? "action.unfavorite" : "action.favorite", 
                              systemImage: file.isStarred == true ? "star.slash" : "star")
                    }
                    
                    Button { onAction(.share) } label: {
                        Label("action.share", systemImage: "square.and.arrow.up")
                    }
                    
                    Button { onAction(.move) } label: {
                        Label("action.move", systemImage: "folder")
                    }
                    
                    Button { onAction(.download) } label: {
                        Label("action.download", systemImage: "arrow.down.circle")
                    }
                    
                    Divider()
                    
                    Button(role: .destructive) { onAction(.delete) } label: {
                        Label("action.delete", systemImage: "trash")
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
                        Label("action.preview", systemImage: "eye")
                    }
                    
                    Button { onAction(.toggleStar) } label: {
                        Label(file.isStarred == true ? "action.unfavorite" : "action.favorite", 
                              systemImage: file.isStarred == true ? "star.slash" : "star")
                    }
                    
                    Button { onAction(.share) } label: {
                        Label("action.share", systemImage: "square.and.arrow.up")
                    }
                    
                    Button { onAction(.move) } label: {
                        Label("action.move", systemImage: "folder")
                    }
                    
                    Button { onAction(.download) } label: {
                        Label("action.download", systemImage: "arrow.down.circle")
                    }
                    
                    Divider()
                    
                    Button(role: .destructive) { onAction(.delete) } label: {
                        Label("action.delete", systemImage: "trash")
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

// MARK: - 目标文件夹选择器

// MARK: - Destination Folder Picker
struct DestinationFolderPicker: View {
    var onSelect: (String) -> Void
    
    @State private var folders: [FolderTreeItem] = []
    @State private var isLoading = true
    
    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if folders.isEmpty {
                 ContentUnavailableView("No folders", systemImage: "folder.badge.questionmark")
            } else {
                List {
                    ForEach(folders) { folder in
                        FolderPickerRow(folder: folder, onSelect: onSelect)
                    }
                }
            }
        }
        .task {
            isLoading = true
            do {
                // 1. Try to get root tree
                let rootFolders = try await FileService.shared.getFolderTree()
                if !rootFolders.isEmpty {
                    folders = rootFolders
                } else {
                    // 2. If empty (e.g. no root access), fetch authorized locations and their trees
                    let stats = try await FileService.shared.fetchMyPermissions()
                    
                    var newFolders: [FolderTreeItem] = []
                    
                    // Fetch tree for each location concurrently
                    await withTaskGroup(of: FolderTreeItem?.self) { group in
                        for loc in stats {
                            group.addTask {
                                do {
                                    // Fetch the tree UNDER this location
                                    let children = try await FileService.shared.getFolderTree(rootPath: loc.folderPath)
                                    // Wrap it in a node representing the location itself
                                    return FolderTreeItem(name: loc.displayName, path: loc.folderPath, children: children)
                                } catch {
                                    print("Failed to load tree for \(loc.folderPath): \(error)")
                                    // If failed, still show the folder but empty? Or skip?
                                    // Let's show it with empty children so user at least sees it (implied empty)
                                    return FolderTreeItem(name: loc.displayName, path: loc.folderPath, children: [])
                                }
                            }
                        }
                        
                        for await item in group {
                            if let item = item {
                                newFolders.append(item)
                            }
                        }
                    }
                    // Sort by name for consistency
                    folders = newFolders.sorted { $0.name < $1.name }
                }
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
    @State private var isExpanded = false
    
    var body: some View {
        if let children = folder.children, !children.isEmpty {
            DisclosureGroup(isExpanded: $isExpanded) {
                ForEach(children) { child in
                    FolderPickerRow(folder: child, onSelect: onSelect)
                }
            } label: {
                folderContent
            }
        } else {
           folderContent
        }
    }
    
    var folderContent: some View {
        Button {
            onSelect(folder.path)
        } label: {
            HStack {
                Image(systemName: "folder.fill")
                    .foregroundColor(.blue)
                Text(Department(id: nil, name: folder.name).localizedName())
                    .foregroundColor(.primary)
                Spacer()
            }
        }
        .buttonStyle(.plain) // Important for List row behavior
    }
}

#Preview {
    NavigationStack {
        FileBrowserView(path: "MS")
    }
}

