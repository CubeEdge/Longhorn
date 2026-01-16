//
//  SharesListView.swift
//  LonghornApp
//
//  分享管理视图（文件分享 + 合集分享）
//

import SwiftUI

struct SharesListView: View {
    @StateObject private var store = ShareStore.shared
    @State private var selectedTab: ShareTab = .files
    
    // 选择模式
    @State private var isSelectionMode = false
    @State private var selectedShareIds: Set<Int> = []
    @State private var selectedCollectionIds: Set<Int> = []
    @State private var showDeleteConfirmation = false
    
    // 编辑相关
    @State private var showEditSheet = false
    @State private var editShareItem: ShareLink?
    @State private var editCollectionItem: ShareCollection?
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    enum ShareTab: String, CaseIterable {
        case files = "files"
        case collections = "collections"
        
        var title: LocalizedStringKey {
            switch self {
            case .files: return "share.tab.files"
            case .collections: return "share.tab.collections"
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab 选择器 - 始终可见，不受加载状态影响
            Picker("share.list.type", selection: $selectedTab) {
                ForEach(ShareTab.allCases, id: \.self) { tab in
                    Text(tab.title).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()
            
            // 内容区域 - 始终显示结构，只有数据变化
            if let error = store.errorMessage {
                ContentUnavailableView(
                    String(localized: "alert.error"),
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            } else if store.isFirstLoad && store.shares.isEmpty && store.collections.isEmpty {
                // 仅在首次加载且没有缓存数据时显示 loading
                VStack {
                    ProgressView()
                    Text("browser.loading")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 8)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                // 正常显示列表内容
                switch selectedTab {
                case .files:
                    fileSharesContent
                case .collections:
                    collectionsContent
                }
            }
        }
        .task {
            // 使用智能加载：有缓存则不请求
            await store.loadDataIfNeeded()
        }
        .navigationTitle(Text("quick.my_shares"))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(isSelectionMode ? "action.done" : "action.select") {
                    isSelectionMode.toggle()
                    if !isSelectionMode {
                        selectedShareIds.removeAll()
                        selectedCollectionIds.removeAll()
                    }
                }
            }
        }
        .confirmationDialog(
            "share.confirm_delete_count",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible,
            presenting: currentSelectionCount
        ) { count in
            Button("action.delete", role: .destructive) {
                batchDelete()
            }
            Button("action.cancel", role: .cancel) {}
        } message: { count in
             Text("share.confirm_delete_count \(count)")
        }
        .refreshable {
            // 下拉强制刷新
            await store.refreshData()
        }

        .sheet(isPresented: $showEditSheet) {
            if let share = editShareItem {
                EditShareSheet(
                    isCollection: false,
                    id: share.id,
                    initialHasPassword: share.hasPassword,
                    initialExpiresAt: share.expiresAt,
                    onDismiss: {
                        showEditSheet = false
                        editShareItem = nil
                        Task { await store.refreshData() }
                    }
                )
            } else if let collection = editCollectionItem {
                EditShareSheet(
                    isCollection: true,
                    id: collection.id,
                    initialHasPassword: collection.hasPassword ?? false,
                    initialExpiresAt: collection.expiresAt,
                    onDismiss: {
                        showEditSheet = false
                        editCollectionItem = nil
                        Task { await store.refreshData() }
                    }
                )
            }
        }
    }
    
    private var currentSelectionCount: Int {
        selectedTab == .files ? selectedShareIds.count : selectedCollectionIds.count
    }
    
    // MARK: - 文件分享列表
    
    @ViewBuilder
    private var fileSharesContent: some View {
        if store.shares.isEmpty {
            ContentUnavailableView(
                String(localized: "share.no_files"),
                systemImage: "square.and.arrow.up",
                description: Text("share.no_files_desc")
            )
        } else {
            VStack(spacing: 0) {
                // 批量操作栏
                if isSelectionMode && !selectedShareIds.isEmpty {
                    batchActionBar(count: selectedShareIds.count, selectAll: {
                        selectedShareIds = Set(store.shares.map { $0.id })
                    }, deselectAll: {
                        selectedShareIds.removeAll()
                    })
                }
                
                List(selection: isSelectionMode ? $selectedShareIds : nil) {
                    ForEach(store.shares) { share in
                        ShareItemRow(share: share, onEdit: {
                            editShareItem = share
                            showEditSheet = true
                        }, onDelete: {
                            deleteShare(share)
                        })
                        .tag(share.id)
                    }
                }
                .listStyle(.plain)
                .environment(\.editMode, .constant(isSelectionMode ? .active : .inactive))
            }
        }
    }
    
    // MARK: - 合集列表
    
    @ViewBuilder
    private var collectionsContent: some View {
        if store.collections.isEmpty {
            ContentUnavailableView(
                String(localized: "share.no_collections"),
                systemImage: "rectangle.stack",
                description: Text("share.no_collections_desc")
            )
        } else {
            VStack(spacing: 0) {
                if isSelectionMode && !selectedCollectionIds.isEmpty {
                    batchActionBar(count: selectedCollectionIds.count, selectAll: {
                        selectedCollectionIds = Set(store.collections.map { $0.id })
                    }, deselectAll: {
                        selectedCollectionIds.removeAll()
                    })
                }
                
                List(selection: isSelectionMode ? $selectedCollectionIds : nil) {
                    ForEach(store.collections) { collection in
                        CollectionItemRow(collection: collection, onEdit: {
                            editCollectionItem = collection
                            showEditSheet = true
                        }, onDelete: {
                            deleteCollection(collection)
                        })
                        .tag(collection.id)
                    }
                }
                .listStyle(.plain)
                .environment(\.editMode, .constant(isSelectionMode ? .active : .inactive))
            }
        }
    }
    
    // MARK: - 批量操作栏
    
    private func batchActionBar(count: Int, selectAll: @escaping () -> Void, deselectAll: @escaping () -> Void) -> some View {
        HStack {
            Button(count == (selectedTab == .files ? store.shares.count : store.collections.count) ? "common.cancel_selection" : "action.select_all") {
                if count == (selectedTab == .files ? store.shares.count : store.collections.count) {
                    deselectAll()
                } else {
                    selectAll()
                }
            }
            .font(.system(size: 14, weight: .medium))
            
            Spacer()
            
            Text("common.selected_count \(count)")
                .font(.system(size: 14))
                .foregroundColor(.secondary)
            
            Spacer()
            
            Button(role: .destructive) {
                showDeleteConfirmation = true
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 18))
            }
            .disabled(count == 0)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(Color(UIColor.secondarySystemBackground))
    }
    
    // MARK: - 操作方法
    
    private func deleteShare(_ share: ShareLink) {
        Task {
            do {
                try await store.deleteShare(share.id)
                ToastManager.shared.show(String(localized: "share.delete_success"), type: .success)
            } catch {
                print("Delete share failed: \(error)")
                ToastManager.shared.show(String(localized: "share.delete_failed"), type: .error)
            }
        }
    }
    
    private func deleteCollection(_ collection: ShareCollection) {
        Task {
            do {
                try await store.deleteCollection(collection.id)
                ToastManager.shared.show(String(localized: "share.delete_success"), type: .success)
            } catch {
                print("Delete collection failed: \(error)")
                ToastManager.shared.show(String(localized: "share.delete_failed"), type: .error)
            }
        }
    }
    
    private func batchDelete() {
        Task {
            if selectedTab == .files {
                for id in selectedShareIds {
                    try? await ShareService.shared.deleteShare(id: id)
                }
                selectedShareIds.removeAll()
            } else {
                for id in selectedCollectionIds {
                    try? await ShareService.shared.deleteCollection(id: id)
                }
                selectedCollectionIds.removeAll()
            }
            isSelectionMode = false
            await store.refreshData()
        }
    }
}

// MARK: - 文件分享行

struct ShareItemRow: View {
    let share: ShareLink
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    @State private var showCopied = false
    @State private var showDeleteConfirmation = false
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 文件名
            HStack {
                Image(systemName: "doc.fill")
                    .foregroundColor(.secondary)
                
                Text(share.fileName ?? String(localized: "file.type.generic"))
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                
                Spacer()
                
                // 状态标签
                if share.isExpired {
                    Text("share.status.expired")
                        .font(.system(size: 11, weight: .medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.15))
                        .foregroundColor(.red)
                        .cornerRadius(4)
                } else if share.hasPassword {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.orange)
                }
            }
            
            // 信息行
            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Image(systemName: "eye")
                        .font(.system(size: 11))
                    Text("\(share.accessCount)")
                        .font(.system(size: 12))
                }
                .foregroundColor(.secondary)
                
                if let expiry = share.formattedExpiresAt {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                        .font(.system(size: 11))
                        Text(expiry)
                            .font(.system(size: 12))
                    }
                    .foregroundColor(.secondary)
                } else {
                    HStack(spacing: 4) {
                        Image(systemName: "infinity")
                            .font(.system(size: 11))
                        Text("share.status.permanent")
                            .font(.system(size: 12))
                    }
                    .foregroundColor(.secondary)
                }
            }
            
            // 操作按钮
            HStack(spacing: 12) {
                Button {
                    copyLink()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12))
                        Text(showCopied ? "share.status.copied" : "share.action.copy_link")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(accentColor.opacity(0.15))
                    .foregroundColor(accentColor)
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
                
                Spacer()
                
                Button {
                    onEdit()
                } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 14))
                        .foregroundColor(.blue)
                }
                .buttonStyle(.plain)
                
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                }
                .buttonStyle(.plain)
                .confirmationDialog(
                    String(localized: "alert.confirm_delete"),
                    isPresented: $showDeleteConfirmation,
                    titleVisibility: .visible
                ) {
                    Button(String(localized: "action.delete"), role: .destructive) {
                        onDelete()
                    }
                    Button(String(localized: "action.cancel"), role: .cancel) {}
                } message: {
                    Text("确定删除分享「\(share.fileName ?? share.filePath)」？")
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    private func copyLink() {
        let url = ShareService.shared.getShareURL(token: share.token)
        UIPasteboard.general.string = url
        
        withAnimation {
            showCopied = true
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                showCopied = false
            }
        }
    }
}

// MARK: - 合集分享行

struct CollectionItemRow: View {
    let collection: ShareCollection
    let onEdit: () -> Void
    let onDelete: () -> Void
    
    @State private var showCopied = false
    @State private var showDeleteConfirmation = false
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 合集名称
            HStack {
                Image(systemName: "rectangle.stack.fill")
                    .foregroundColor(.blue)
                
                Text(collection.name)
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                
                Spacer()
                
                // 状态
                if collection.isExpired {
                    Text("share.status.expired")
                        .font(.system(size: 11, weight: .medium))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.15))
                        .foregroundColor(.red)
                        .cornerRadius(4)
                } else if collection.hasPassword == true {
                    Image(systemName: "lock.fill")
                        .font(.system(size: 12))
                        .foregroundColor(.orange)
                }
            }
            
            // 信息行
            HStack(spacing: 16) {
                // 文件数量
                if let count = collection.itemCount {
                    HStack(spacing: 4) {
                        Image(systemName: "doc")
                            .font(.system(size: 11))
                        Text("share.collection.file_count \(count)")
                            .font(.system(size: 12))
                    }
                    .foregroundColor(.secondary)
                }
                
                // 访问次数
                HStack(spacing: 4) {
                    Image(systemName: "eye")
                        .font(.system(size: 11))
                    Text("\(collection.accessCount)")
                        .font(.system(size: 12))
                }
                .foregroundColor(.secondary)
                
                // 过期时间
                if let expiry = collection.formattedExpiresAt {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.system(size: 11))
                        Text(expiry)
                            .font(.system(size: 12))
                    }
                    .foregroundColor(.secondary)
                }
            }
            
            // 操作按钮
            HStack(spacing: 12) {
                Button {
                    copyLink()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: showCopied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 12))
                        Text(showCopied ? "share.status.copied" : "share.action.copy_link")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(accentColor.opacity(0.15))
                    .foregroundColor(accentColor)
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
                
                Spacer()
                
                Button {
                    onEdit()
                } label: {
                    Image(systemName: "pencil")
                        .font(.system(size: 14))
                        .foregroundColor(.blue)
                }
                .buttonStyle(.plain)
                
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                }
                .buttonStyle(.plain)
                .confirmationDialog(
                    String(localized: "alert.confirm_delete"),
                    isPresented: $showDeleteConfirmation,
                    titleVisibility: .visible
                ) {
                    Button(String(localized: "action.delete"), role: .destructive) {
                        onDelete()
                    }
                    Button(String(localized: "action.cancel"), role: .cancel) {}
                } message: {
                    Text("确定删除合集「\(collection.name)」？")
                }
            }
        }
        .padding(.vertical, 8)
    }
    
    private func copyLink() {
        let url = ShareService.shared.getCollectionURL(token: collection.token)
        UIPasteboard.general.string = url
        
        withAnimation {
            showCopied = true
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            withAnimation {
                showCopied = false
            }
        }
    }
    }


// MARK: - 编辑分享 Sheet

struct EditShareSheet: View {
    let isCollection: Bool
    let id: Int
    let initialHasPassword: Bool
    let initialExpiresAt: String?
    var onDismiss: () -> Void
    
    @State private var password = ""
    @State private var usePassword: Bool
    @State private var useExpiry: Bool
    @State private var expiryDate = Date()
    @State private var isSaving = false
    @State private var errorMessage: String?
    
    init(isCollection: Bool, id: Int, initialHasPassword: Bool, initialExpiresAt: String?, onDismiss: @escaping () -> Void) {
        self.isCollection = isCollection
        self.id = id
        self.initialHasPassword = initialHasPassword
        self.initialExpiresAt = initialExpiresAt
        self.onDismiss = onDismiss
        
        _usePassword = State(initialValue: initialHasPassword)
        _useExpiry = State(initialValue: initialExpiresAt != nil)
        
        if let initialExpiresAt = initialExpiresAt {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: initialExpiresAt) {
                _expiryDate = State(initialValue: date)
            }
        }
    }
    
    var body: some View {
        NavigationStack {
            Form {
                Section("share.edit.password_protect") {
                    Toggle("share.edit.set_password", isOn: $usePassword)
                    if usePassword {
                        SecureField("share.edit.enter_password", text: $password)
                        if initialHasPassword && password.isEmpty {
                             Text("share.edit.password_hint").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                
                Section("share.edit.validity") {
                    Toggle("share.edit.set_validity", isOn: $useExpiry)
                    if useExpiry {
                        DatePicker("share.edit.expiry_date", selection: $expiryDate, in: Date()..., displayedComponents: .date)
                    }
                }
                
                if let error = errorMessage {
                    Section {
                        Text(error).foregroundColor(.red)
                    }
                }
            }
            .navigationTitle(isCollection ? "share.edit.title_collection" : "share.edit.title_file")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.cancel") { onDismiss() }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("action.save") { save() }
                        .disabled(isSaving)
                }
            }
            .overlay {
                if isSaving {
                    ProgressView()
                }
            }
        }
        .presentationDetents([.medium])
    }
    
    private func save() {
        isSaving = true
        errorMessage = nil
        
        Task {
            do {
                // 计算有效期天数
                var days: Int? = nil
                if useExpiry {
                    let interval = expiryDate.timeIntervalSince(Date())
                    days = Int(ceil(interval / (24 * 3600)))
                    if days ?? 0 <= 0 { days = 1 } // 至少1天
                } else if initialExpiresAt != nil {
                    // 如果之前有有效期，现在关闭了，传 -1 表示清除
                    days = -1
                }
                
                let pwd = (usePassword && !password.isEmpty) ? password : nil
                let removePwd = !usePassword && initialHasPassword
                
                if isCollection {
                    try await ShareService.shared.updateCollection(
                        id: id,
                        password: pwd,
                        removePassword: removePwd,
                        expiresInDays: days
                    )
                } else {
                    try await ShareService.shared.updateShare(
                        id: id,
                        password: pwd,
                        removePassword: removePwd,
                        expiresInDays: days
                    )
                }
                
                await MainActor.run {
                    onDismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isSaving = false
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        SharesListView()
    }
}
