//
//  IssueDetailView.swift
//  LonghornApp
//
//  工单详情视图
//

import SwiftUI
import PhotosUI

struct IssueDetailView: View {
    let issueId: Int
    
    @State private var issue: Issue?
    @State private var comments: [IssueComment] = []
    @State private var attachments: [IssueAttachment] = []
    @State private var isLoading = true
    @State private var error: String?
    
    @State private var newComment = ""
    @State private var isSubmittingComment = false
    
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var isUploadingPhoto = false
    
    @State private var showingStatusSheet = false
    
    @Environment(\.dismiss) private var dismiss
    
    private let service = IssueService.shared
    
    var body: some View {
        NavigationStack {
            Group {
                if isLoading && issue == nil {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = error, issue == nil {
                    ContentUnavailableView {
                        Label(String(localized: "error.title"), systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button(String(localized: "action.retry")) {
                            Task { await loadDetail() }
                        }
                    }
                } else if let issue = issue {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            // 基本信息卡片
                            issueInfoCard(issue)
                            
                            // 产品信息
                            if issue.productName != nil || issue.serialNumber != nil {
                                productInfoCard(issue)
                            }
                            
                            // 客户信息
                            if issue.customerName != nil {
                                customerInfoCard(issue)
                            }
                            
                            // 附件区域
                            attachmentsSection
                            
                            // 评论区域
                            commentsSection
                        }
                        .padding()
                    }
                } else {
                    ContentUnavailableView(String(localized: "issues.notfound"), systemImage: "doc.questionmark")
                }
            }
            .navigationTitle(issue?.issueNumber ?? String(localized: "issues.detail"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "action.close")) {
                        dismiss()
                    }
                }
                
                if issue != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Menu {
                            Button {
                                showingStatusSheet = true
                            } label: {
                                Label(String(localized: "issues.changeStatus"), systemImage: "arrow.triangle.2.circlepath")
                            }
                        } label: {
                            Image(systemName: "ellipsis.circle")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingStatusSheet) {
                if let issue = issue {
                    StatusChangeSheet(currentStatus: issue.status) { newStatus in
                        Task { await updateStatus(newStatus) }
                    }
                }
            }
            .task {
                await loadDetail()
            }
        }
    }
    
    // MARK: - 基本信息卡片
    
    private func issueInfoCard(_ issue: Issue) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // 标题
            Text(issue.title)
                .font(.title2)
                .fontWeight(.bold)
            
            // 状态、严重程度、类别
            HStack(spacing: 8) {
                StatusBadge(status: issue.status)
                SeverityBadge(severity: issue.severity)
                CategoryBadge(category: issue.category)
            }
            
            Divider()
            
            // 详细信息
            if let description = issue.description, !description.isEmpty {
                Text(description)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
            
            Divider()
            
            // 元信息
            VStack(spacing: 8) {
                InfoRow(label: String(localized: "issues.source"), value: issue.source.localizedName)
                InfoRow(label: String(localized: "issues.createdBy"), value: issue.createdByName ?? "-")
                if let assignedName = issue.assignedToName {
                    InfoRow(label: String(localized: "issues.assignedTo"), value: assignedName)
                }
                InfoRow(label: String(localized: "issues.createdAt"), value: issue.formattedCreatedAt)
                if let updatedAt = issue.formattedUpdatedAt {
                    InfoRow(label: String(localized: "issues.updatedAt"), value: updatedAt)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
    
    // MARK: - 产品信息卡片
    
    private func productInfoCard(_ issue: Issue) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(String(localized: "issues.productInfo"), systemImage: "shippingbox")
                .font(.headline)
            
            Divider()
            
            if let productName = issue.productName {
                InfoRow(label: String(localized: "issues.product"), value: productName)
            }
            if let serialNumber = issue.serialNumber {
                InfoRow(label: String(localized: "issues.serialNumber"), value: serialNumber)
            }
            if let batchNumber = issue.batchNumber {
                InfoRow(label: String(localized: "issues.batchNumber"), value: batchNumber)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
    
    // MARK: - 客户信息卡片
    
    private func customerInfoCard(_ issue: Issue) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(String(localized: "issues.customerInfo"), systemImage: "person.crop.circle")
                .font(.headline)
            
            Divider()
            
            if let customerName = issue.customerName {
                InfoRow(label: String(localized: "issues.customer"), value: customerName)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
    
    // MARK: - 附件区域
    
    private var attachmentsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(String(localized: "issues.attachments"), systemImage: "paperclip")
                    .font(.headline)
                
                Spacer()
                
                PhotosPicker(selection: $selectedPhotos, maxSelectionCount: 5, matching: .images) {
                    Label(String(localized: "issues.addPhoto"), systemImage: "photo.badge.plus")
                        .font(.subheadline)
                }
                .onChange(of: selectedPhotos) { _, newItems in
                    Task { await uploadSelectedPhotos(newItems) }
                }
            }
            
            Divider()
            
            if isUploadingPhoto {
                HStack {
                    ProgressView()
                    Text(String(localized: "issues.uploading"))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            if attachments.isEmpty {
                Text(String(localized: "issues.noAttachments"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 80))], spacing: 12) {
                    ForEach(attachments) { attachment in
                        AttachmentThumbnail(attachment: attachment)
                    }
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
    
    // MARK: - 评论区域
    
    private var commentsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(String(localized: "issues.comments") + " (\(comments.count))", systemImage: "bubble.left.and.bubble.right")
                .font(.headline)
            
            Divider()
            
            // 添加评论
            HStack {
                TextField(String(localized: "issues.addComment"), text: $newComment, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3)
                
                Button {
                    Task { await submitComment() }
                } label: {
                    if isSubmittingComment {
                        ProgressView()
                    } else {
                        Image(systemName: "paperplane.fill")
                    }
                }
                .disabled(newComment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmittingComment)
            }
            
            // 评论列表
            if comments.isEmpty {
                Text(String(localized: "issues.noComments"))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 20)
            } else {
                ForEach(comments) { comment in
                    CommentRow(comment: comment)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 8, y: 2)
    }
    
    // MARK: - 方法
    
    private func loadDetail() async {
        isLoading = true
        error = nil
        
        do {
            let response = try await service.fetchIssueDetail(id: issueId)
            issue = response.issue
            comments = response.comments
            attachments = response.attachments
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    private func submitComment() async {
        guard !newComment.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        
        isSubmittingComment = true
        
        do {
            let comment = try await service.addComment(issueId: issueId, content: newComment)
            comments.append(comment)
            newComment = ""
        } catch {
            // Handle error silently or show toast
        }
        
        isSubmittingComment = false
    }
    
    private func uploadSelectedPhotos(_ items: [PhotosPickerItem]) async {
        guard !items.isEmpty else { return }
        
        isUploadingPhoto = true
        
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self) {
                let fileName = "photo_\(Date().timeIntervalSince1970).jpg"
                do {
                    try await service.uploadAttachment(issueId: issueId, imageData: data, fileName: fileName)
                } catch {
                    // Handle error
                }
            }
        }
        
        // 刷新附件列表
        await loadDetail()
        
        selectedPhotos = []
        isUploadingPhoto = false
    }
    
    private func updateStatus(_ newStatus: IssueStatus) async {
        do {
            try await service.updateIssueStatus(id: issueId, status: newStatus)
            await loadDetail()
        } catch {
            // Handle error
        }
    }
}

// MARK: - 辅助视图

struct InfoRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
        }
        .font(.subheadline)
    }
}

struct CommentRow: View {
    let comment: IssueComment
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(comment.username ?? String(localized: "issues.anonymousUser"))
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                Text(comment.formattedCreatedAt)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Text(comment.content)
                .font(.body)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

struct AttachmentThumbnail: View {
    let attachment: IssueAttachment
    
    var body: some View {
        VStack {
            if attachment.isImage {
                AsyncImage(url: nil) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Rectangle()
                        .fill(Color(.systemGray5))
                        .overlay {
                            Image(systemName: "photo")
                                .foregroundStyle(.secondary)
                        }
                }
                .frame(width: 80, height: 80)
                .cornerRadius(8)
            } else {
                Rectangle()
                    .fill(Color(.systemGray5))
                    .frame(width: 80, height: 80)
                    .cornerRadius(8)
                    .overlay {
                        VStack {
                            Image(systemName: "doc")
                            Text(attachment.fileName)
                                .font(.caption2)
                                .lineLimit(1)
                        }
                        .foregroundStyle(.secondary)
                    }
            }
        }
    }
}

// MARK: - 状态变更面板

struct StatusChangeSheet: View {
    let currentStatus: IssueStatus
    let onSelect: (IssueStatus) -> Void
    
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                ForEach(IssueStatus.allCases, id: \.rawValue) { status in
                    Button {
                        onSelect(status)
                        dismiss()
                    } label: {
                        HStack {
                            StatusBadge(status: status)
                            Spacer()
                            if status == currentStatus {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
            .navigationTitle(String(localized: "issues.changeStatus"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "action.cancel")) {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    IssueDetailView(issueId: 1)
}
