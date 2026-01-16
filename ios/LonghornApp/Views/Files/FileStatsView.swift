//
//  FileStatsView.swift
//  LonghornApp
//
//  文件访问统计视图
//

import SwiftUI

struct FileStatsView: View {
    let file: FileItem
    var onDismiss: () -> Void = {}
    
    @State private var logs: [AccessLog] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("加载中...")
                } else if let error = errorMessage {
                    ContentUnavailableView(
                        "加载失败",
                        systemImage: "exclamationmark.triangle",
                        description: Text(error)
                    )
                } else if logs.isEmpty {
                    ContentUnavailableView(
                        "暂无访问记录",
                        systemImage: "chart.bar",
                        description: Text("该文件还没有被访问过")
                    )
                } else {
                    List(logs) { log in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(log.username ?? "未知用户")
                                    .font(.headline)
                                Spacer()
                                Text("\(log.count)次")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            
                            HStack {
                                Text(log.email ?? "")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(log.formattedLastAccess)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("访问统计")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { onDismiss() }
                }
            }
            .task {
                do {
                    logs = try await FileService.shared.getFileStats(path: file.path)
                    isLoading = false
                } catch {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

#Preview {
    FileStatsView(file: FileItem(
        name: "test.txt",
        path: "test.txt",
        isDirectory: false,
        size: 1024,
        modifiedAt: nil,
        uploaderId: 1,
        uploaderName: "User",
        isStarred: false,
        accessCount: 10
    ))
}
