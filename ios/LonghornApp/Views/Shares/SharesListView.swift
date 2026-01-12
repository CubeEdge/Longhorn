//
//  SharesListView.swift
//  LonghornApp
//
//  分享管理视图（文件分享 + 合集分享）
//

import SwiftUI

struct SharesListView: View {
    @State private var shares: [ShareLink] = []
    @State private var collections: [ShareCollection] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedTab: ShareTab = .files
    
    // 选择模式
    @State private var isSelectionMode = false
    @State private var selectedShareIds: Set<Int> = []
    @State private var selectedCollectionIds: Set<Int> = []
    @State private var showDeleteConfirmation = false
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    enum ShareTab: String, CaseIterable {
        case files = "文件"
        case collections = "合集"
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Tab 选择器
            Picker("类型", selection: $selectedTab) {
                ForEach(ShareTab.allCases, id: \.self) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()
            
            // 内容
            ZStack {
                if isLoading {
                    ProgressView("加载中...")
                } else if let error = errorMessage {
                    ContentUnavailableView(
                        "加载失败",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else {
                    switch selectedTab {
                    case .files:
                        fileSharesContent
                    case .collections:
                        collectionsContent
                    }
                }
            }
        }
        .navigationTitle("我的分享")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(isSelectionMode ? "完成" : "选择") {
                    isSelectionMode.toggle()
                    if !isSelectionMode {
                        selectedShareIds.removeAll()
                        selectedCollectionIds.removeAll()
                    }
                }
            }
        }
        .confirmationDialog(
            "确定要删除所选的\(currentSelectionCount)个分享吗？",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("删除", role: .destructive) {
                batchDelete()
            }
            Button("取消", role: .cancel) {}
        }
        .refreshable {
            await loadData()
        }
        .task {
            await loadData()
        }
    }
    
    private var currentSelectionCount: Int {
        selectedTab == .files ? selectedShareIds.count : selectedCollectionIds.count
    }
    
    // MARK: - 文件分享列表
    
    @ViewBuilder
    private var fileSharesContent: some View {
        if shares.isEmpty {
            ContentUnavailableView(
                "暂无分享",
                systemImage: "square.and.arrow.up",
                description: Text("你创建的分享链接将显示在这里")
            )
        } else {
            VStack(spacing: 0) {
                // 批量操作栏
                if isSelectionMode && !selectedShareIds.isEmpty {
                    batchActionBar(count: selectedShareIds.count, selectAll: {
                        selectedShareIds = Set(shares.map { $0.id })
                    }, deselectAll: {
                        selectedShareIds.removeAll()
                    })
                }
                
                List(selection: isSelectionMode ? $selectedShareIds : nil) {
                    ForEach(shares) { share in
                        ShareItemRow(share: share, onDelete: {
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
        if collections.isEmpty {
            ContentUnavailableView(
                "暂无合集",
                systemImage: "rectangle.stack",
                description: Text("批量分享文件时会创建合集")
            )
        } else {
            VStack(spacing: 0) {
                if isSelectionMode && !selectedCollectionIds.isEmpty {
                    batchActionBar(count: selectedCollectionIds.count, selectAll: {
                        selectedCollectionIds = Set(collections.map { $0.id })
                    }, deselectAll: {
                        selectedCollectionIds.removeAll()
                    })
                }
                
                List(selection: isSelectionMode ? $selectedCollectionIds : nil) {
                    ForEach(collections) { collection in
                        CollectionItemRow(collection: collection, onDelete: {
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
            Button(count == (selectedTab == .files ? shares.count : collections.count) ? "取消全选" : "全选") {
                if count == (selectedTab == .files ? shares.count : collections.count) {
                    deselectAll()
                } else {
                    selectAll()
                }
            }
            .font(.system(size: 14, weight: .medium))
            
            Spacer()
            
            Text("已选 \(count) 项")
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
    
    // MARK: - 数据加载
    
    private func loadData() async {
        isLoading = true
        errorMessage = nil
        
        do {
            async let sharesTask = ShareService.shared.getMyShares()
            async let collectionsTask = ShareService.shared.getMyCollections()
            
            shares = try await sharesTask
            collections = try await collectionsTask
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func deleteShare(_ share: ShareLink) {
        Task {
            do {
                try await ShareService.shared.deleteShare(id: share.id)
                await loadData()
            } catch {
                print("Delete share failed: \(error)")
            }
        }
    }
    
    private func deleteCollection(_ collection: ShareCollection) {
        Task {
            do {
                try await ShareService.shared.deleteCollection(id: collection.id)
                await loadData()
            } catch {
                print("Delete collection failed: \(error)")
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
            await loadData()
        }
    }
}

// MARK: - 文件分享行

struct ShareItemRow: View {
    let share: ShareLink
    let onDelete: () -> Void
    
    @State private var showCopied = false
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // 文件名
            HStack {
                Image(systemName: "doc.fill")
                    .foregroundColor(.secondary)
                
                Text(share.fileName ?? "文件")
                    .font(.system(size: 15, weight: .semibold))
                    .lineLimit(1)
                
                Spacer()
                
                // 状态标签
                if share.isExpired {
                    Text("已过期")
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
                        Text("永久")
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
                        Text(showCopied ? "已复制" : "复制链接")
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
                
                Button(role: .destructive) {
                    onDelete()
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                }
                .buttonStyle(.plain)
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
    let onDelete: () -> Void
    
    @State private var showCopied = false
    
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
                    Text("已过期")
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
                        Text("\(count) 个文件")
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
                        Text(showCopied ? "已复制" : "复制链接")
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
                
                Button(role: .destructive) {
                    onDelete()
                } label: {
                    Image(systemName: "trash")
                        .font(.system(size: 14))
                        .foregroundColor(.red)
                }
                .buttonStyle(.plain)
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

#Preview {
    NavigationStack {
        SharesListView()
    }
}
