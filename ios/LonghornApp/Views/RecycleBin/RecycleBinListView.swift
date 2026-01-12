//
//  RecycleBinListView.swift
//  LonghornApp
//
//  回收站视图（完整实现 - 支持批量操作）
//

import SwiftUI

struct RecycleBinListView: View {
    @State private var items: [RecycleBinItem] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showClearConfirm = false
    
    // 选择模式
    @State private var isSelectionMode = false
    @State private var selectedIds: Set<Int> = []
    @State private var showBatchDeleteConfirm = false
    
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
            } else if items.isEmpty {
                ContentUnavailableView(
                    "回收站为空",
                    systemImage: "trash",
                    description: Text("删除的文件会在这里保留30天")
                )
            } else {
                VStack(spacing: 0) {
                    // 批量操作栏
                    if isSelectionMode && !selectedIds.isEmpty {
                        batchActionBar
                    }
                    
                    List(selection: isSelectionMode ? $selectedIds : nil) {
                        ForEach(items) { item in
                            RecycleBinItemRow(item: item)
                                .tag(item.id)
                                .swipeActions(edge: .leading) {
                                    Button {
                                        restoreItem(item)
                                    } label: {
                                        Label("恢复", systemImage: "arrow.uturn.backward")
                                    }
                                    .tint(.green)
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        permanentlyDeleteItem(item)
                                    } label: {
                                        Label("永久删除", systemImage: "trash.fill")
                                    }
                                }
                        }
                    }
                    .listStyle(.plain)
                    .environment(\.editMode, .constant(isSelectionMode ? .active : .inactive))
                }
            }
        }
        .navigationTitle("回收站")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                HStack {
                    if !items.isEmpty {
                        Button(isSelectionMode ? "完成" : "选择") {
                            isSelectionMode.toggle()
                            if !isSelectionMode {
                                selectedIds.removeAll()
                            }
                        }
                    }
                    
                    if !isSelectionMode && !items.isEmpty {
                        Button(role: .destructive) {
                            showClearConfirm = true
                        } label: {
                            Text("清空")
                                .foregroundColor(.red)
                        }
                    }
                }
            }
        }
        .confirmationDialog("确定要清空回收站吗？", isPresented: $showClearConfirm, titleVisibility: .visible) {
            Button("清空回收站", role: .destructive) {
                clearAll()
            }
            Button("取消", role: .cancel) { }
        } message: {
            Text("此操作不可撤销，所有文件将被永久删除。")
        }
        .confirmationDialog("确定要永久删除所选的\(selectedIds.count)个项目吗？", isPresented: $showBatchDeleteConfirm, titleVisibility: .visible) {
            Button("永久删除", role: .destructive) {
                batchDelete()
            }
            Button("取消", role: .cancel) { }
        }
        .refreshable {
            await loadItems()
        }
        .task {
            await loadItems()
        }
    }
    
    // MARK: - 批量操作栏
    
    private var batchActionBar: some View {
        HStack {
            Button(selectedIds.count == items.count ? "取消全选" : "全选") {
                if selectedIds.count == items.count {
                    selectedIds.removeAll()
                } else {
                    selectedIds = Set(items.map { $0.id })
                }
            }
            .font(.system(size: 14, weight: .medium))
            
            Spacer()
            
            Text("已选 \(selectedIds.count) 项")
                .font(.system(size: 14))
                .foregroundColor(.secondary)
            
            Spacer()
            
            // 批量恢复
            Button {
                batchRestore()
            } label: {
                Image(systemName: "arrow.uturn.backward")
                    .font(.system(size: 18))
            }
            .foregroundColor(.green)
            
            // 批量删除
            Button {
                showBatchDeleteConfirm = true
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 18))
            }
            .foregroundColor(.red)
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(Color(UIColor.secondarySystemBackground))
    }
    
    // MARK: - 数据操作
    
    private func loadItems() async {
        isLoading = true
        errorMessage = nil
        
        do {
            items = try await FileService.shared.getRecycleBin()
        } catch let error as APIError {
            errorMessage = error.errorDescription
        } catch {
            errorMessage = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func restoreItem(_ item: RecycleBinItem) {
        Task {
            do {
                try await FileService.shared.restoreFile(id: item.id)
                await loadItems()
            } catch {
                print("Restore failed: \(error)")
            }
        }
    }
    
    private func permanentlyDeleteItem(_ item: RecycleBinItem) {
        Task {
            do {
                try await FileService.shared.permanentlyDelete(id: item.id)
                await loadItems()
            } catch {
                print("Permanent delete failed: \(error)")
            }
        }
    }
    
    private func clearAll() {
        Task {
            do {
                try await FileService.shared.clearRecycleBin()
                await loadItems()
            } catch {
                print("Clear recycle bin failed: \(error)")
            }
        }
    }
    
    private func batchRestore() {
        Task {
            for id in selectedIds {
                try? await FileService.shared.restoreFile(id: id)
            }
            selectedIds.removeAll()
            isSelectionMode = false
            await loadItems()
        }
    }
    
    private func batchDelete() {
        Task {
            for id in selectedIds {
                try? await FileService.shared.permanentlyDelete(id: id)
            }
            selectedIds.removeAll()
            isSelectionMode = false
            await loadItems()
        }
    }
}

struct RecycleBinItemRow: View {
    let item: RecycleBinItem
    
    var body: some View {
        HStack(spacing: 14) {
            // 图标
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.gray.opacity(0.15))
                    .frame(width: 40, height: 40)
                
                Image(systemName: item.isDirectory ? "folder.fill" : "doc.fill")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(.gray)
            }
            
            // 信息
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                    .strikethrough(true, color: .secondary)
                
                HStack(spacing: 8) {
                    Text("原位置: \(item.originalPath)")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            // 删除时间
            VStack(alignment: .trailing, spacing: 2) {
                Text("删除于")
                    .font(.system(size: 10))
                    .foregroundColor(.secondary)
                
                Text(formatDate(item.deletionDate))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        guard let date = formatter.date(from: dateString) else { return dateString }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateFormat = "MM/dd"
        return displayFormatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        RecycleBinListView()
    }
}
