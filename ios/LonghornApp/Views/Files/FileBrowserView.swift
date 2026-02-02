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
    @StateObject private var store = FileStore.shared  // Smart caching store
    @State private var isLoading = true
    @State private var errorMessage: String?
    @AppStorage("fileViewMode") private var viewMode: ViewMode = .list
    @AppStorage("fileSortOrder") private var sortOrder: SortOrder = .date
    
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
    
    // 取消收藏确认
    @State private var showUnstarConfirmation = false
    @State private var fileToUnstar: FileItem?
    
    // 单个删除确认
    @State private var showSingleDeleteConfirmation = false
    @State private var fileToDelete: FileItem?
    
    // 重命名
    @State private var showRenameAlert = false
    @State private var renameFile: FileItem?
    @State private var newFileName = ""
    
    // 复制
    @State private var copySourceFile: FileItem?
    @State private var isCopyMode = false
    
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
    
    @ObservedObject private var uploadService = UploadService.shared
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    private var dynamicUploadDetents: Set<PresentationDetent> {
        let taskCount = uploadService.activeTasks.count
        if taskCount <= 2 {
            return [.height(280)]
        } else if taskCount <= 4 {
            return [.height(450), .large]
        } else {
            return [.medium, .large]
        }
    }
    
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
        contentView
        .navigationTitle(pathTitle)
        .navigationBarTitleDisplayMode(.inline)

        .searchable(text: $searchText, prompt: Text(searchPromptKey))
        .onSubmit(of: .search) {
            performSearch()
        }
        .onChange(of: searchText) { oldValue, newValue in
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
            // Initial load (visible)
            await loadFiles()
            
            // Polling loop (silent, every 5s)
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 5 * 1_000_000_000)
                if !Task.isCancelled {
                    await loadFiles(forceRefresh: true, silent: true)
                }
            }
        }
        .onReceive(uploadService.$activeTasks) { tasks in
            let active = tasks.filter { task in
                task.status == .uploading || task.status == .pending || task.status == .merging
            }.count
            activeUploadCount = active
            if active > 0 {
                showUploadProgress = true
            }
        }
        .sheet(isPresented: $showCreateFolder) {
            createFolderSheet
        }
        .sheet(isPresented: $showMoveSheet) {
            moveSheet
        }

        .sheet(item: $statsFile) { file in
            FileDetailSheet(file: file)
        }
        .confirmationDialog(
            String(localized: "browser.delete_confirm_message"),
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button(String(localized: "action.delete"), role: .destructive) {
                deleteSelectedFiles()
            }
            Button(String(localized: "action.cancel"), role: .cancel) {}
        } message: {
            Text("browser.delete_bin_message")
        }
        // 取消收藏确认对话框
        .confirmationDialog(
            String(localized: "starred.confirm_unstar_single"),
            isPresented: $showUnstarConfirmation,
            titleVisibility: .visible
        ) {
            Button(String(localized: "action.unstar"), role: .destructive) {
                if let file = fileToUnstar {
                    performUnstar(file)
                }
                fileToUnstar = nil
            }
            Button(String(localized: "action.cancel"), role: .cancel) {
                fileToUnstar = nil
            }
        } message: {
            if let file = fileToUnstar {
                Text(String(format: String(localized: "starred.confirm_unstar_message"), file.name))
            }
        }
        .confirmationDialog(
            String(localized: "alert.confirm_delete"),
            isPresented: $showSingleDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button(String(localized: "action.delete"), role: .destructive) {
                if let file = fileToDelete {
                    deleteFile(file)
                }
            }
            Button(String(localized: "action.cancel"), role: .cancel) {
                fileToDelete = nil
            }
        } message: {
            if let file = fileToDelete {
                // 修复：先获取本地化字符串，再拼接文件名，避免将文件名作为键的一部分进行查找
                Text("\(String(localized: "browser.delete_single_message")) \"\(file.name)\"")
            }
        }
        .sheet(item: $shareFile) { file in
            ShareDialogView(
                filePath: file.path,
                fileName: file.name,
                onDismiss: { shareFile = nil }
            )
            .presentationDetents([.fraction(0.7)])
            .presentationDragIndicator(.visible)
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
            .presentationDetents([.fraction(0.8)])
            .presentationDragIndicator(.visible)
        }
        .fullScreenCover(isPresented: $showFilePicker) {
            FilePickerView(
                destinationPath: path,
                onDismiss: {
                    showFilePicker = false
                    Task { await loadFiles() }
                }
            )
        }
        .fullScreenCover(isPresented: $showPhotoPicker) {
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
                .presentationDetents(dynamicUploadDetents)
        }
        .fullScreenCover(item: $previewFile) { file in
            FilePreviewSheet(
                initialFile: file,
                allFiles: displayedFiles,
                onClose: {
                    previewFile = nil
                },
                onDownload: { downloadTarget in
                    downloadFile(downloadTarget)
                },
                onShare: { shareTarget in
                    shareFile = shareTarget
                },
                onStar: { starTarget in
                    toggleStar(starTarget)
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
                        Text("status.opening")
                            .foregroundStyle(.white)
                            .font(.headline)
                    }
                    .padding(30)
                    .background(Material.ultraThinMaterial)
                    .cornerRadius(16)
                }
            }
        }
        .alert(String(localized: "alert.preview_failed"), isPresented: $showPreviewError) {
            Button(String(localized: "action.ok"), role: .cancel) { }
        } message: {
            Text(previewErrorMessage)
        }
        .alert(String(localized: "action.rename"), isPresented: $showRenameAlert) {
            TextField(String(localized: "browser.new_name_placeholder"), text: $newFileName)
            Button(String(localized: "action.cancel"), role: .cancel) {
                renameFile = nil
                newFileName = ""
            }
            Button(String(localized: "action.ok")) {
                performRename()
            }
        } message: {
            if let file = renameFile {
                Text("action.rename_message \(file.name)")
            }
        }
    }
    
    // MARK: - 搜索相关
    
    private var searchPromptKey: LocalizedStringKey {
        switch searchScope {
        case .all:
            return "search.placeholder.all"
        case .department(let code):
            // 使用本地化的部门名称
            let deptName = LocalizationHelper.localizedByCode(code) ?? code
            return LocalizedStringKey("在\(deptName)中搜索")
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
                                Label("action.delete", systemImage: "trash")
                            }
                            
                            Button {
                                toggleStar(file)
                            } label: {
                                Label(
                                    file.isStarred == true ? "action.unstar" : "action.star",
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
            
            Text(String(format: String(localized: "common.selected_count"), selectedPaths.count))
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
                    Button("action.done") {
                        isSelectionMode = false
                        selectedPaths.removeAll()
                    }
                    .foregroundColor(accentColor)
                } else {
                    Button("action.select") {
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
            isCopyMode = true
            showMoveSheet = true
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
        DestinationFolderPicker(
            initialPath: path,
            title: isCopyMode ? String(localized: "action.copy_to") : String(localized: "action.move_to"),
            onSelect: { destination in
                if isCopyMode {
                    performCopy(to: destination)
                } else {
                    moveSelectedFiles(to: destination)
                }
                showMoveSheet = false
            },
            onCancel: {
                showMoveSheet = false
                copySourceFile = nil
            }
        )
        .presentationDetents([.medium, .large])
    }
    
    // MARK: - 计算属性
    
    private var contentView: some View {
        ZStack {
            if isLoading {
                ProgressView(String(localized: "browser.loading"))
                    .progressViewStyle(.circular)
            } else if let error = errorMessage {
                ContentUnavailableView(
                    String(localized: "alert.error"),
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
                .overlay(alignment: .bottom) {
                    Button(String(localized: "action.retry")) {
                        Task { await loadFiles() }
                    }
                    .buttonStyle(.borderedProminent)
                    .padding(.bottom, 40)
                }
            } else if displayedFiles.isEmpty {
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
    }
    
    private var pathTitle: String {
        if path.lowercased().hasPrefix("members/") {
            return String(localized: "browser.personal_space")
        }
        
        // 获取路径的最后一部分
        let lastComponent = path.components(separatedBy: "/").last ?? ""
        
        // 检查是否是部门代码（MS, OP, RD, GE, RE等）
        let deptCodes = ["MS", "OP", "RD", "GE", "RE"]
        if deptCodes.contains(lastComponent.uppercased()) {
            // 使用LocalizationHelper获取本地化的部门名称
            return LocalizationHelper.localizedByCode(lastComponent.uppercased()) ?? lastComponent
        }
        
        return lastComponent.isEmpty ? String(localized: "browser.files") : lastComponent
    }
    
    private var sortedFiles: [FileItem] {
        // 优先使用 Store 缓存，如果为空则使用本地 files
        let sourceFiles = store.getFiles(for: path).isEmpty ? files : store.getFiles(for: path)
        var sorted = sourceFiles
        
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
    
    private func loadFiles(forceRefresh: Bool = false, silent: Bool = false) async {
        // 1. 强制刷新时（如下拉刷新），必须等待服务器响应
        //    这样 .refreshable 的指示器才会在数据加载完成后消失
        if forceRefresh {
            // 仅在首次加载（无数据）时显示全屏 Loading
            // 有数据时，下拉刷新依靠系统自带的 refreshable 指示器
            if !silent && files.isEmpty {
                isLoading = true
            }
            errorMessage = nil
            
            if !silent {
                // 下拉刷新体验优化：增加 0.5 秒最小驻留时间，防止列表迅速回弹
                // 并行执行：实际刷新 + 最小计时
                async let fetch: () = refreshFromServer(silent: silent)
                async let delay: ()? = try? Task.sleep(nanoseconds: 500_000_000)
                _ = await (fetch, delay)
            } else {
                await refreshFromServer(silent: silent)
            }
            
            isLoading = false
            return
        }
        
        // 2. 非强制刷新：优先检查 FileStore 缓存（支持乐观更新）
        let cachedFiles = store.getFiles(for: path)
        if !cachedFiles.isEmpty {
            // 使用缓存数据立即更新UI
            if files != cachedFiles {
                files = cachedFiles
            }
            isLoading = false
            
            // 后台静默刷新（如果缓存可能过期）
            if !silent {
                Task {
                    await refreshFromServer(silent: true)
                }
            }
            return
        }
        
        // 3. 没有缓存，从服务器加载
        if files.isEmpty && !silent {
            isLoading = true
        }
        errorMessage = nil
        
        await refreshFromServer(silent: silent)
    }
    
    /// 从服务器刷新数据并同步到 FileStore
    private func refreshFromServer(silent: Bool) async {
        do {
            let (loadedFiles, fromCache) = try await FileService.shared.getFilesWithCache(
                path: path,
                forceRefresh: true  // FileService 层面强制刷新，因为 FileStore 已经处理了缓存逻辑
            )
            
            // Sync Deletion Logic: 检测是否有文件被删除
            if !files.isEmpty && !loadedFiles.isEmpty {
                let oldPaths = Set(files.map { $0.path })
                let newPaths = Set(loadedFiles.map { $0.path })
                
                let deletedPaths = oldPaths.subtracting(newPaths)
                if !deletedPaths.isEmpty {
                    print("[Sync] Detected \(deletedPaths.count) deleted files. Invalidating preview cache.")
                    await PreviewCacheManager.shared.invalidate(paths: Array(deletedPaths))
                }
            }
            
            // 更新本地状态和共享缓存
            files = loadedFiles
            store.setFiles(loadedFiles, for: path)
            
            if fromCache && !silent {
                print("[Cache] Loaded \(loadedFiles.count) files from FileService cache")
            }
        } catch let error as APIError {
            if files.isEmpty && !silent {
                errorMessage = error.errorDescription
            }
        } catch {
            if files.isEmpty && !silent {
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
            isCopyMode = false
            showMoveSheet = true
        case .copy:
            copySourceFile = file
            isCopyMode = true
            showMoveSheet = true
        case .rename:
            renameFile = file
            if file.isDirectory {
                newFileName = file.name
            } else {
                newFileName = (file.name as NSString).deletingPathExtension
            }
            showRenameAlert = true
        case .details:
            statsFile = file
        case .delete:
            fileToDelete = file
            showSingleDeleteConfirmation = true
        case .download:
            downloadFile(file)
        }
    }

    
    private func toggleStar(_ file: FileItem) {
        let wasStarred = file.isStarred == true
        
        // 取消收藏需要确认
        if wasStarred {
            fileToUnstar = file
            showUnstarConfirmation = true
            return
        }
        
        // 收藏操作直接执行
        performStar(file)
    }
    
    /// 执行收藏操作（乐观更新）
    private func performStar(_ file: FileItem) {
        // 创建更新后的文件对象
        let updatedFile = FileItem(
            name: file.name,
            path: file.path,
            isDirectory: file.isDirectory,
            size: file.size,
            modifiedAt: file.modifiedAt,
            uploaderId: file.uploaderId,
            uploaderName: file.uploaderName,
            isStarred: true,
            accessCount: file.accessCount
        )
        
        // 乐观更新：同时更新本地状态和 FileStore 缓存
        if let index = files.firstIndex(where: { $0.path == file.path }) {
            files[index] = updatedFile
        }
        
        // 更新 FileStore 缓存以确保 sortedFiles 立即反映变化
        var cachedFiles = store.getFiles(for: path)
        if let index = cachedFiles.firstIndex(where: { $0.path == file.path }) {
            cachedFiles[index] = updatedFile
            store.setFiles(cachedFiles, for: path)
        }
        
        ToastManager.shared.show(String(localized: "toast.starred_success"), type: .success)
        AppEvents.notifyStarredChanged(path: file.path)
        
        // 后台发送网络请求
        Task {
            do {
                try await FileService.shared.starFile(path: file.path)
            } catch {
                // 409 表示文件已被收藏，视为成功
                if case APIError.serverError(let code, _) = error, code == 409 {
                    print("File already starred (409), treating as success")
                    return  // 不回滚，不显示错误
                }
                
                print("Star failed: \(error)")
                // 回滚
                if let index = files.firstIndex(where: { $0.path == file.path }) {
                    var revertedFile = files[index]
                    revertedFile = FileItem(
                        name: revertedFile.name,
                        path: revertedFile.path,
                        isDirectory: revertedFile.isDirectory,
                        size: revertedFile.size,
                        modifiedAt: revertedFile.modifiedAt,
                        uploaderId: revertedFile.uploaderId,
                        uploaderName: revertedFile.uploaderName,
                        isStarred: false,
                        accessCount: revertedFile.accessCount
                    )
                    files[index] = revertedFile
                }
                ToastManager.shared.show(String(localized: "toast.star_failed"), type: .error)
            }
        }
    }
    
    /// 确认后执行取消收藏
    private func performUnstar(_ file: FileItem) {
        // 创建更新后的文件对象
        let updatedFile = FileItem(
            name: file.name,
            path: file.path,
            isDirectory: file.isDirectory,
            size: file.size,
            modifiedAt: file.modifiedAt,
            uploaderId: file.uploaderId,
            uploaderName: file.uploaderName,
            isStarred: false,
            accessCount: file.accessCount
        )
        
        // 乐观更新：同时更新本地状态和 FileStore 缓存
        if let index = files.firstIndex(where: { $0.path == file.path }) {
            files[index] = updatedFile
        }
        
        // 更新 FileStore 缓存以确保 sortedFiles 立即反映变化
        var cachedFiles = store.getFiles(for: path)
        if let index = cachedFiles.firstIndex(where: { $0.path == file.path }) {
            cachedFiles[index] = updatedFile
            store.setFiles(cachedFiles, for: path)
        }
        
        ToastManager.shared.show(String(localized: "toast.unstarred_success"), type: .success)
        AppEvents.notifyStarredChanged(path: file.path)
        
        // 后台发送网络请求
        Task {
            do {
                try await FileService.shared.unstarByPath(path: file.path)
            } catch {
                print("Unstar failed: \(error)")
                // 回滚
                if let index = files.firstIndex(where: { $0.path == file.path }) {
                    var revertedFile = files[index]
                    revertedFile = FileItem(
                        name: revertedFile.name,
                        path: revertedFile.path,
                        isDirectory: revertedFile.isDirectory,
                        size: revertedFile.size,
                        modifiedAt: revertedFile.modifiedAt,
                        uploaderId: revertedFile.uploaderId,
                        uploaderName: revertedFile.uploaderName,
                        isStarred: true,
                        accessCount: revertedFile.accessCount
                    )
                    files[index] = revertedFile
                }
                ToastManager.shared.show(String(localized: "toast.star_failed"), type: .error)
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
            ToastManager.shared.show(String(localized: "toast.rename_success"), type: .success, style: .prominent)
        }
    }
    
    private func deleteFile(_ file: FileItem) {
        // Optimistic UI Update: Remove immediately
        withAnimation {
            files.removeAll { $0.path == file.path }
            store.deleteFile(file, in: path)
        }
        
        // 立即显示Toast
        ToastManager.shared.show(String(localized: "toast.delete_success"), type: .success, style: .prominent)
        
        // 后台执行删除请求
        Task {
            do {
                try await FileService.shared.deleteFile(path: file.path)
                
                // Invalidate previews in background
                if file.isDirectory {
                    await PreviewCacheManager.shared.invalidateDirectory(path: file.path)
                } else {
                    await PreviewCacheManager.shared.invalidate(path: file.path)
                }
            } catch {
                print("Delete failed: \(error)")
                // 静默处理错误，因为UI已经更新
            }
        }
    }
    
    private func deleteSelectedFiles() {
        // Optimistic UI Update
        let pathsToDelete = Array(selectedPaths)
        withAnimation {
            files.removeAll { selectedPaths.contains($0.path) }
            // Note: Store update for bulk delete might be complex, relying on refresh if user navigates back
            // But for current view, files array is key.
        }
        
        // 立即显示Toast和清空选择
        ToastManager.shared.show(String(localized: "toast.delete_success"), type: .success, style: .prominent)
        isSelectionMode = false
        selectedPaths.removeAll()

        // 后台执行删除请求
        Task {
            do {
                try await FileService.shared.deleteFiles(paths: pathsToDelete)
                
                await PreviewCacheManager.shared.invalidate(paths: pathsToDelete)
                
                // Also update cache for consistency
                for path in pathsToDelete {
                    store.invalidateCache(for: path)
                }
            } catch {
                print("Bulk delete failed: \(error)")
                // 静默处理错误，因为UI已经更新
            }
        }
    }
    
    private func moveSelectedFiles(to destination: String) {
        // 捕获需要移动的文件对象（用于后续更新目标缓存）
        let itemsToMove = files.filter { selectedPaths.contains($0.path) }
        let pathsToMove = itemsToMove.map(\.path)
        
        // Optimistic UI Update (Current View)
        withAnimation {
            files.removeAll { selectedPaths.contains($0.path) }
        }
        
        // Optimistic Cache Update (Current Folder)
        // 确保当前文件夹的缓存也立即更新，防止导航回来时显示旧数据
        for item in itemsToMove {
            store.deleteFile(item, in: path)
        }
        
        isSelectionMode = false
        selectedPaths.removeAll()
        
        Task {
            do {
                try await FileService.shared.moveFiles(paths: pathsToMove, destination: destination)
                
                await PreviewCacheManager.shared.invalidate(paths: pathsToMove)
                ToastManager.shared.show(String(localized: "toast.move_success"), type: .success, style: .prominent)
                
                // Optimistic Cache Update (Destination Folder)
                // 手动将文件添加到目标文件夹的缓存中，实现“进入即显示”
                for item in itemsToMove {
                    var newItem = item
                    // 更新路径: destination + / + filename
                    let newPath = (destination as NSString).appendingPathComponent(item.name)
                    newItem.path = newPath
                    store.addFile(newItem, to: destination)
                }
                
            } catch {
                await loadFiles() // Rollback
                errorMessage = error.localizedDescription
                ToastManager.shared.show(String(localized: "toast.move_failed"), type: .error)
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
                    ToastManager.shared.show(String(localized: "toast.copy_success"), type: .success, style: .prominent)
                }
            } catch {
                print("Copy failed: \(error)")
                ToastManager.shared.show(error.localizedDescription, type: .error)
            }
        }
    }
    
    private func batchToggleStar() {
        // 获取选中的文件列表
        let selectedFiles = files.filter { selectedPaths.contains($0.path) }
        guard !selectedFiles.isEmpty else { return }
        
        // 乐观更新：立即更新本地状态和缓存
        var starredCount = 0
        var unstarredCount = 0
        
        for file in selectedFiles {
            let newStarredState = !(file.isStarred ?? false)
            if newStarredState {
                starredCount += 1
            } else {
                unstarredCount += 1
            }
            
            let updatedFile = FileItem(
                name: file.name,
                path: file.path,
                isDirectory: file.isDirectory,
                size: file.size,
                modifiedAt: file.modifiedAt,
                uploaderId: file.uploaderId,
                uploaderName: file.uploaderName,
                isStarred: newStarredState,
                accessCount: file.accessCount
            )
            
            // 更新本地 files 数组
            if let index = files.firstIndex(where: { $0.path == file.path }) {
                files[index] = updatedFile
            }
            
            // 更新 FileStore 缓存
            var cachedFiles = store.getFiles(for: path)
            if let index = cachedFiles.firstIndex(where: { $0.path == file.path }) {
                cachedFiles[index] = updatedFile
                store.setFiles(cachedFiles, for: path)
            }
        }
        
        // 显示 Toast
        if starredCount > 0 && unstarredCount > 0 {
            ToastManager.shared.show(String(localized: "toast.batch_star_toggle"), type: .success)
        } else if starredCount > 0 {
            ToastManager.shared.show(String(localized: "toast.starred_success"), type: .success)
        } else {
            ToastManager.shared.show(String(localized: "toast.unstarred_success"), type: .success)
        }
        
        // 退出选择模式
        isSelectionMode = false
        selectedPaths.removeAll()
        
        // 后台并发发送网络请求
        Task {
            await withTaskGroup(of: Void.self) { group in
                for file in selectedFiles {
                    group.addTask {
                        do {
                            if file.isStarred == true {
                                // 原来是收藏 -> 取消收藏
                                try await FileService.shared.unstarByPath(path: file.path)
                            } else {
                                // 原来未收藏 -> 收藏
                                try await FileService.shared.starFile(path: file.path)
                            }
                        } catch {
                            print("Batch star toggle failed for \(file.path): \(error)")
                        }
                    }
                }
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
                ToastManager.shared.show(String(localized: "toast.folder_created"), type: .success, style: .prominent)
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
    case copy
    case rename
    case details
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
                    
                    Button { onAction(.download) } label: {
                        Label("action.download", systemImage: "arrow.down.circle")
                    }

                    Button { onAction(.move) } label: {
                        Label("action.move", systemImage: "folder")
                    }
                    
                    Button { onAction(.copy) } label: {
                        Label("action.copy_to", systemImage: "doc.on.doc")
                    }
                    
                    Button { onAction(.rename) } label: {
                        Label("action.rename", systemImage: "pencil")
                    }
                    
                    Button { onAction(.details) } label: {
                        Label("stats.details", systemImage: "info.circle")
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
                    
                    Button { onAction(.download) } label: {
                        Label("action.download", systemImage: "arrow.down.circle")
                    }

                    Button { onAction(.move) } label: {
                        Label("action.move", systemImage: "folder")
                    }
                    
                    Button { onAction(.copy) } label: {
                        Label("action.copy_to", systemImage: "doc.on.doc")
                    }
                    
                    Button { onAction(.rename) } label: {
                        Label("action.rename", systemImage: "pencil")
                    }
                    
                    Button { onAction(.details) } label: {
                        Label("stats.details", systemImage: "info.circle")
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
            ZStack(alignment: .bottomTrailing) {
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
                
                // 收藏角标
                if file.isStarred == true {
                    Image(systemName: "star.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.orange)
                        .shadow(color: .black.opacity(0.3), radius: 1, x: 0, y: 1)
                        .padding(4)
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
    var initialPath: String?
    var title: String
    var confirmButtonTitle: String? = nil  // 新增：可自定义确认按钮文字
    var onSelect: (String) -> Void
    var onCancel: () -> Void
    
    @State private var folders: [FolderTreeItem] = []
    @State private var isLoading = true
    @State private var navPath = NavigationPath()
    
    var body: some View {
        NavigationStack(path: $navPath) {
            Group {
                if isLoading {
                    ProgressView()
                } else if folders.isEmpty {
                     ContentUnavailableView(String(localized: "folder_picker.no_folders"), systemImage: "folder.badge.questionmark")
                } else {
                    FolderSelectionView(
                        folders: folders,
                        currentPath: "",
                        confirmButtonTitle: confirmButtonTitle ?? String(localized: "action.move"),
                        onSelect: onSelect
                    )
                    .navigationDestination(for: FolderTreeItem.self) { folder in
                        FolderSelectionView(
                            folders: folder.children ?? [],
                            currentPath: folder.path,
                            confirmButtonTitle: confirmButtonTitle ?? String(localized: "action.move"),
                            onSelect: onSelect
                        )
                        .navigationTitle(localizedName(for: folder.name))
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.cancel") { onCancel() }
                }
            }
        }
        .task {
            // Load logic here (simplified for brevity, keeps existing logic)
            isLoading = true
            await loadTree()
            isLoading = false
            
            // Resolve initial path
            if let initialPath = initialPath, !initialPath.isEmpty {
                resolveInitialPath(initialPath)
            }
        }
    }
    
    private func resolveInitialPath(_ path: String) {
        var currentLevel = folders
        var resolvedPath = [FolderTreeItem]()
        
        // Find matching node sequence
        // We look for nodes that are along the path
        // var pathComponents = [String]()
        // Hacky: finding nodes by checking matches
        
        while !currentLevel.isEmpty {
            // Find a child that the target path starts with (or is equal to)
            // Note: Folder paths are full paths e.g. /A, /A/B
            guard let node = currentLevel.first(where: { 
                $0.path == path || (path.hasPrefix($0.path + "/") && !$0.path.isEmpty) || ($0.path.isEmpty && !path.isEmpty)
                // Root handling: if root path is "", every path hasPrefix(""/).
                // If we are at root level (folders), and we have root node "", it matches.
            }) else {
                break
            }
            
            // Found a matching node (e.g. /A)
            resolvedPath.append(node)
            
            // If exact match, we are done
            if node.path == path { break }
            
            // Continue deeper
            currentLevel = node.children ?? []
        }
        
        // Update Nav Path
        for item in resolvedPath {
            navPath.append(item)
        }
    }
    
    // Extracted loader to reuse
    private func loadTree() async {
        // ... (Original loading logic)
        // Since I cannot easily copy-paste the huge block inside replace_file_content without bloating,
        // I will assume the user wants me to KEEP the loading logic.
        // I will Paste the Full Implementation of Loading Logic from previous step here.
        // See below.
        
        // Fallback loader
        func loadFallback() async {
            do {
                let stats = try await FileService.shared.fetchMyPermissions()
                var newFolders: [FolderTreeItem] = []
                await withTaskGroup(of: FolderTreeItem?.self) { group in
                    for loc in stats {
                        group.addTask {
                            do {
                                let children = try await FileService.shared.getFolderTree(rootPath: loc.folderPath)
                                return FolderTreeItem(name: loc.displayName, path: loc.folderPath, children: children)
                            } catch {
                                return FolderTreeItem(name: loc.displayName, path: loc.folderPath, children: [])
                            }
                        }
                    }
                    for await item in group {
                        if let item = item { newFolders.append(item) }
                    }
                }
                folders = newFolders.sorted { $0.name < $1.name }
            } catch {
                print("Fallback loading failed: \(error)")
            }
        }
        
        do {
            let rootNodes = try await FileService.shared.getFolderTree()
            if let rootNode = rootNodes.first {
                var processedFolders: [FolderTreeItem] = []
                let children = rootNode.children ?? []
                let membersNode = children.first { $0.path.lowercased() == "members" }
                for child in children {
                    if child.path.lowercased() != "members" && !child.name.hasPrefix(".") {
                        processedFolders.append(child)
                    }
                }
                if let membersNode = membersNode, let memberChildren = membersNode.children {
                    let currentUsername = AuthManager.shared.currentUser?.username.lowercased() ?? ""
                    if let personalNode = memberChildren.first(where: { $0.name.lowercased() == currentUsername }) {
                        processedFolders.insert(personalNode, at: 0)
                    }
                }
                if !processedFolders.isEmpty {
                    folders = processedFolders
                } else {
                    await loadFallback()
                }
            } else {
                await loadFallback()
            }
        } catch {
            await loadFallback()
        }
    }
    
    private func localizedName(for name: String) -> String {
        Department(id: nil, name: name).localizedName()
    }
}

struct FolderSelectionView: View {
    let folders: [FolderTreeItem]
    let currentPath: String
    let confirmButtonTitle: String  // 新增：可自定义确认按钮文字
    let onSelect: (String) -> Void
    
    var body: some View {
        List {
            ForEach(folders) { folder in
                NavigationLink(value: folder) {
                    HStack {
                        Image(systemName: "folder.fill")
                            .foregroundColor(Color(red: 1.0, green: 0.82, blue: 0.0))
                        Text(localizedName(for: folder.name))
                            .foregroundColor(.primary)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .listStyle(.plain)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(confirmButtonTitle) {
                    onSelect(currentPath)
                }
            }
        }
    }
    
    private func localizedName(for name: String) -> String {
        Department(id: nil, name: name).localizedName()
    }
}

#Preview {
    NavigationStack {
        FileBrowserView(path: "MS")
    }
}

// MARK: - 统一的文件详情视图

struct FileDetailSheet: View {
    let file: FileItem
    @Environment(\.dismiss) private var dismiss
    
    @State private var selectedTab = 0
    @State private var accessLogs: [AccessLog] = []
    @State private var isLoadingLogs = false
    @State private var errorMsg: String?
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Segmented Control
                Picker("Tabs", selection: $selectedTab) {
                    Text("title.file_info").tag(0)
                    Text("title.access_logs").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()
                
                TabView(selection: $selectedTab) {
                    // Tab 0: Basic Info
                    infoList
                        .tag(0)
                    
                    // Tab 1: Access Logs
                    logsList
                        .tag(1)
                }
                #if os(iOS)
                .tabViewStyle(.page(indexDisplayMode: .never))
                #endif
            }
            .navigationTitle(file.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("action.close") {
                        dismiss()
                    }
                }
            }
            .task {
                // 预加载日志
                if file.accessCount ?? 0 > 0 {
                    await loadLogs()
                }
            }
        }
    }
    
    // MARK: - Info Tab
    
    private var infoList: some View {
        List {
            Section {
                // 文件名
                LabeledContent("label.name", value: file.name)
                
                // 大小
                LabeledContent("label.size", value: file.formattedSize)
                
                // 类型
                let ext = (file.name as NSString).pathExtension.uppercased()
                if !ext.isEmpty {
                    LabeledContent("label.type", value: ext)
                }
            }
            
            Section("label.upload_info") {
                // 上传者
                if let uploader = file.uploaderName {
                    LabeledContent("label.uploader", value: uploader)
                } else {
                    LabeledContent("label.uploader", value: "-")
                }
                
                // 上传时间
                if let date = file.modifiedAt {
                    LabeledContent("label.upload_date", value: formatDate(date))
                } else {
                    LabeledContent("label.upload_date", value: "-")
                }
            }
            
            Section("label.statistics") {
                // 访问次数
                if let count = file.accessCount {
                    LabeledContent("label.access_count", value: "\(count)")
                } else {
                    LabeledContent("label.access_count", value: "0")
                }
                
                // 分享次数
                if let shareCount = file.shareCount {
                    LabeledContent("label.share_count", value: "\(shareCount)")
                } else {
                    LabeledContent("label.share_count", value: "0")
                }
                
                // 收藏次数
                if let starCount = file.starCount {
                    LabeledContent("label.star_count", value: "\(starCount)")
                } else {
                    LabeledContent("label.star_count", value: "0")
                }
            }
            
            Section("label.path") {
                Text(file.path)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(.secondary)
                    .contextMenu {
                        Button {
                            UIPasteboard.general.string = file.path
                        } label: {
                            Label("action.copy", systemImage: "doc.on.doc")
                        }
                    }
            }
        }
    }
    
    // MARK: - Logs Tab
    
    private var logsList: some View {
        Group {
            if isLoadingLogs && accessLogs.isEmpty {
                ProgressView()
            } else if let error = errorMsg {
                ContentUnavailableView(
                    "stats.load_error",
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            } else if accessLogs.isEmpty {
                ContentUnavailableView(
                    "stats.no_logs",
                    systemImage: "chart.bar.doc.horizontal",
                    description: Text(String(localized: "stats.no_logs_desc", defaultValue: "该文件暂无访问记录"))
                )
            } else {
                List(accessLogs) { log in
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(log.username ?? String(localized: "stats.unknown_user"))
                                .font(.headline)
                            Spacer()
                            HStack(spacing: 4) {
                                Text("label.access_count")
                                Text("\(log.count)")
                            }
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        }
                        
                        HStack {
                            if let email = log.email {
                                Text(email)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(log.formattedLastAccess)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .refreshable {
                    await loadLogs()
                }
            }
        }
        .onChange(of: selectedTab) { oldValue, newValue in
            if newValue == 1 && accessLogs.isEmpty {
                Task {
                    await loadLogs()
                }
            }
        }
    }
    
    private func loadLogs() async {
        isLoadingLogs = true
        errorMsg = nil
        do {
            let logs = try await FileService.shared.getFileStats(path: file.path)
            await MainActor.run {
                self.accessLogs = logs
                self.isLoadingLogs = false
            }
        } catch {
            await MainActor.run {
                self.errorMsg = error.localizedDescription
                self.isLoadingLogs = false
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        displayFormatter.locale = Locale.current
        return displayFormatter.string(from: date)
    }
}


