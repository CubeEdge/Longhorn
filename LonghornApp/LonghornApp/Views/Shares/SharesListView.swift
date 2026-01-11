//
//  SharesView.swift
//  LonghornApp
//
//  分享管理视图（完整实现）
//

import SwiftUI

struct SharesListView: View {
    @State private var shares: [ShareLink] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var showCreateShare = false
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
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
            } else if shares.isEmpty {
                ContentUnavailableView(
                    "暂无分享",
                    systemImage: "square.and.arrow.up",
                    description: Text("你创建的分享链接将显示在这里")
                )
            } else {
                List {
                    ForEach(shares) { share in
                        ShareItemRow(share: share, onDelete: {
                            deleteShare(share)
                        })
                    }
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("我的分享")
        .refreshable {
            await loadShares()
        }
        .task {
            await loadShares()
        }
    }
    
    private func loadShares() async {
        isLoading = true
        errorMessage = nil
        
        do {
            shares = try await ShareService.shared.getMyShares()
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
                await loadShares()
            } catch {
                print("Delete share failed: \(error)")
            }
        }
    }
}

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
                // 访问次数
                HStack(spacing: 4) {
                    Image(systemName: "eye")
                        .font(.system(size: 11))
                    Text("\(share.accessCount)")
                        .font(.system(size: 12))
                }
                .foregroundColor(.secondary)
                
                // 过期时间
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
                // 复制链接
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
                
                // 删除
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

#Preview {
    NavigationStack {
        SharesListView()
    }
}
