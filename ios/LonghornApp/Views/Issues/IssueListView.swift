//
//  IssueListView.swift
//  LonghornApp
//
//  工单列表视图
//

import SwiftUI

struct IssueListView: View {
    @StateObject private var store = IssueStore()
    @State private var showingCreateSheet = false
    @State private var showingFilterSheet = false
    @State private var selectedIssue: Issue?
    
    var body: some View {
        NavigationStack {
            Group {
                if store.isLoading && store.issues.isEmpty {
                    ProgressView()
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = store.error, store.issues.isEmpty {
                    ContentUnavailableView {
                        Label(String(localized: "error.title"), systemImage: "exclamationmark.triangle")
                    } description: {
                        Text(error)
                    } actions: {
                        Button(String(localized: "action.retry")) {
                            Task { await store.refresh() }
                        }
                    }
                } else if store.issues.isEmpty {
                    ContentUnavailableView {
                        Label(String(localized: "issues.empty"), systemImage: "tray")
                    } description: {
                        Text(String(localized: "issues.empty.description"))
                    } actions: {
                        Button {
                            showingCreateSheet = true
                        } label: {
                            Text(String(localized: "issues.create"))
                        }
                    }
                } else {
                    issueList
                }
            }
            .navigationTitle(String(localized: "issues.title"))
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showingFilterSheet = true
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingCreateSheet = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .searchable(text: $store.searchQuery, prompt: String(localized: "issues.search"))
            .onSubmit(of: .search) {
                Task { await store.search(store.searchQuery) }
            }
            .refreshable {
                await store.refresh()
            }
            .sheet(isPresented: $showingCreateSheet) {
                IssueCreateView { newIssue in
                    Task { await store.refresh() }
                }
            }
            .sheet(isPresented: $showingFilterSheet) {
                IssueFilterSheet(
                    selectedStatus: $store.statusFilter,
                    selectedCategory: $store.categoryFilter,
                    onApply: {
                        Task { await store.refresh() }
                    }
                )
            }
            .sheet(item: $selectedIssue) { issue in
                IssueDetailView(issueId: issue.id)
            }
            .task {
                if store.issues.isEmpty {
                    await store.loadIssues(refresh: true)
                }
            }
        }
    }
    
    private var issueList: some View {
        List {
            // 筛选状态提示
            if store.statusFilter != nil || store.categoryFilter != nil {
                HStack {
                    if let status = store.statusFilter {
                        IssueFilterTag(label: status.localizedName, color: status.color) {
                            store.statusFilter = nil
                            Task { await store.refresh() }
                        }
                    }
                    if let category = store.categoryFilter {
                        IssueFilterTag(label: category.localizedName, color: .blue) {
                            store.categoryFilter = nil
                            Task { await store.refresh() }
                        }
                    }
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
            }
            
            ForEach(store.issues) { issue in
                IssueRowView(issue: issue)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedIssue = issue
                    }
                    .onAppear {
                        // 加载更多
                        if issue.id == store.issues.last?.id, store.hasMore {
                            Task { await store.loadMore() }
                        }
                    }
            }
            
            if store.isLoading && !store.issues.isEmpty {
                HStack {
                    Spacer()
                    ProgressView()
                    Spacer()
                }
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.plain)
    }
}

// MARK: - 工单行视图

struct IssueRowView: View {
    let issue: Issue
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // 标题行
            HStack {
                Text(issue.issueNumber)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(.systemGray5))
                    .cornerRadius(4)
                
                Spacer()
                
                // 严重程度
                SeverityBadge(severity: issue.severity)
            }
            
            // 标题
            Text(issue.title)
                .font(.headline)
                .lineLimit(2)
            
            // 状态和类别
            HStack(spacing: 8) {
                StatusBadge(status: issue.status)
                CategoryBadge(category: issue.category)
                Spacer()
            }
            
            // 底部信息
            HStack {
                if let productName = issue.productName {
                    Label(productName, systemImage: "shippingbox")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                
                Spacer()
                
                Text(issue.formattedCreatedAt)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - 状态徽章

struct StatusBadge: View {
    let status: IssueStatus
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: status.iconName)
                .font(.caption2)
            Text(status.localizedName)
                .font(.caption)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(status.color.opacity(0.15))
        .foregroundStyle(status.color)
        .cornerRadius(6)
    }
}

// MARK: - 严重程度徽章

struct SeverityBadge: View {
    let severity: IssueSeverity
    
    var body: some View {
        Text(severity.localizedName)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(severity.color.opacity(0.15))
            .foregroundStyle(severity.color)
            .cornerRadius(6)
    }
}

// MARK: - 类别徽章

struct CategoryBadge: View {
    let category: IssueCategory
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: category.iconName)
                .font(.caption2)
            Text(category.localizedName)
                .font(.caption)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(.systemGray5))
        .foregroundStyle(.secondary)
        .cornerRadius(6)
    }
}

// MARK: - 筛选面板

struct IssueFilterSheet: View {
    @Binding var selectedStatus: IssueStatus?
    @Binding var selectedCategory: IssueCategory?
    let onApply: () -> Void
    
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section(String(localized: "issues.filter.status")) {
                    Button {
                        selectedStatus = nil
                    } label: {
                        HStack {
                            Text(String(localized: "issues.filter.all"))
                            Spacer()
                            if selectedStatus == nil {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                    
                    ForEach(IssueStatus.allCases, id: \.rawValue) { status in
                        Button {
                            selectedStatus = status
                        } label: {
                            HStack {
                                StatusBadge(status: status)
                                Spacer()
                                if selectedStatus == status {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.blue)
                                }
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }
                
                Section(String(localized: "issues.filter.category")) {
                    Button {
                        selectedCategory = nil
                    } label: {
                        HStack {
                            Text(String(localized: "issues.filter.all"))
                            Spacer()
                            if selectedCategory == nil {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                    
                    ForEach(IssueCategory.allCases, id: \.rawValue) { category in
                        Button {
                            selectedCategory = category
                        } label: {
                            HStack {
                                CategoryBadge(category: category)
                                Spacer()
                                if selectedCategory == category {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.blue)
                                }
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }
            }
            .navigationTitle(String(localized: "issues.filter.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "action.cancel")) {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button(String(localized: "action.apply")) {
                        onApply()
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: - 筛选标签（工单专用）

struct IssueFilterTag: View {
    let label: String
    let color: Color
    let onRemove: () -> Void
    
    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.caption)
            Button {
                onRemove()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.caption)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(color.opacity(0.15))
        .foregroundStyle(color)
        .cornerRadius(16)
    }
}

#Preview {
    IssueListView()
}
