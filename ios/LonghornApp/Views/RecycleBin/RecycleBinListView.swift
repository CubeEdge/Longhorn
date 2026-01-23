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
                ProgressView("common.loading")
            } else if let error = errorMessage {
                ContentUnavailableView(
                    String(localized: "error.load_failed"),
                    systemImage: "exclamationmark.triangle",
                    description: Text(error)
                )
            } else if items.isEmpty {
                ContentUnavailableView(
                    String(localized: "recycle_bin.empty"),
                    systemImage: "trash",
                    description: Text("recycle_bin.empty_description")
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
                                        Label("recycle_bin.restore", systemImage: "arrow.uturn.backward")
                                    }
                                    .tint(.green)
                                }
                                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                    Button(role: .destructive) {
                                        permanentlyDeleteItem(item)
                                    } label: {
                                        Label("recycle_bin.delete_permanently", systemImage: "trash.fill")
                                    }
                                }
                        }
                    }
                    .listStyle(.plain)
                    .environment(\.editMode, .constant(isSelectionMode ? .active : .inactive))
                }
            }
        }
        .navigationTitle(Text("recycle_bin.title"))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                HStack {
                    if !items.isEmpty {
                        Button(isSelectionMode ? String(localized: "action.done") : String(localized: "action.select")) {
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
                            Text("recycle_bin.clear")
                                .foregroundColor(.red)
                        }
                    }
                }
            }
        }
        .confirmationDialog(String(localized: "recycle_bin.confirm_clear"), isPresented: $showClearConfirm, titleVisibility: .visible) {
            Button(String(localized: "recycle_bin.clear_all"), role: .destructive) {
                clearAll()
            }
            Button("action.cancel", role: .cancel) { }
        } message: {
            Text("recycle_bin.clear_warning")
        }
        .confirmationDialog(String(format: String(localized: "recycle_bin.confirm_delete_count"), selectedIds.count), isPresented: $showBatchDeleteConfirm, titleVisibility: .visible) {
            Button(String(localized: "recycle_bin.delete_permanently"), role: .destructive) {
                batchDelete()
            }
            Button("action.cancel", role: .cancel) { }
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
            Button(selectedIds.count == items.count ? String(localized: "common.deselect_all") : String(localized: "common.select_all")) {
                if selectedIds.count == items.count {
                    selectedIds.removeAll()
                } else {
                    selectedIds = Set(items.map { $0.id })
                }
            }
            .font(.system(size: 14, weight: .medium))
            
            Spacer()
            
            Text(String(format: String(localized: "common.selected_count"), selectedIds.count))
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
            // Add slight delay for smoother refresh UX
            try await Task.sleep(nanoseconds: 500_000_000) // 0.5s
            items = try await FileService.shared.getRecycleBin()
        } catch is CancellationError {
            return
        } catch let error as URLError where error.code == .cancelled {
            return
        } catch let error as NSError where error.code == NSURLErrorCancelled {
            return
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
    
    private let imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]
    
    var body: some View {
        HStack(spacing: 14) {
            // 缩略图或图标
            if isImageFile {
                // 使用 deleted_path 获取回收站中的缩略图
                RecycleBinThumbnailView(path: item.deletedPath, size: 44)
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.gray.opacity(0.15))
                        .frame(width: 44, height: 44)
                    
                    Image(systemName: item.isDirectory ? "folder.fill" : "doc.fill")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.gray)
                }
            }
            
            // 信息
            VStack(alignment: .leading, spacing: 4) {
                Text(item.name)
                    .font(.system(size: 15, weight: .medium))
                    .lineLimit(1)
                    .strikethrough(true, color: .secondary)
                
                HStack(spacing: 8) {
                    Text(String(format: String(localized: "recycle_bin.original_location"), item.originalPath))
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }
            
            Spacer()
            
            // 删除时间
            VStack(alignment: .trailing, spacing: 2) {
                Text("recycle_bin.deleted_at")
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
    
    private var isImageFile: Bool {
        let ext = (item.name as NSString).pathExtension.lowercased()
        return imageExtensions.contains(ext)
    }
}

// MARK: - 回收站缩略图视图
struct RecycleBinThumbnailView: View {
    let path: String
    var size: CGFloat = 44
    
    @State private var image: UIImage?
    @State private var isLoading = true
    @State private var loadFailed = false
    
    private var thumbnailURL: URL? {
        // 回收站缩略图使用特殊的 API 端点
        let cleanPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let encodedPath = cleanPath.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? cleanPath
        return URL(string: "\(APIClient.shared.baseURL)/api/recycle-bin/thumbnail?path=\(encodedPath)&size=\(Int(size * 2))")
    }
    
    var body: some View {
        Group {
            if let image = image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
                    .frame(width: size, height: size)
                    .clipped()
                    .cornerRadius(8)
                    .overlay(
                        // 删除线效果
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.red.opacity(0.3), lineWidth: 1)
                    )
            } else {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.gray.opacity(0.15))
                        .frame(width: size, height: size)
                    
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.5)
                    } else {
                        Image(systemName: "photo.fill")
                            .foregroundColor(.gray)
                    }
                }
            }
        }
        .task {
            await loadThumbnail()
        }
    }
    
    private func loadThumbnail() async {
        guard let url = thumbnailURL else {
            loadFailed = true
            isLoading = false
            return
        }
        
        do {
            var request = URLRequest(url: url)
            if let token = AuthManager.shared.token {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  (200...299).contains(httpResponse.statusCode),
                  let loadedImage = UIImage(data: data) else {
                loadFailed = true
                isLoading = false
                return
            }
            
            await MainActor.run {
                image = loadedImage
                isLoading = false
            }
        } catch {
            await MainActor.run {
                loadFailed = true
                isLoading = false
            }
        }
    }
}

#Preview {
    NavigationStack {
        RecycleBinListView()
    }
}
