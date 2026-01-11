//
//  SearchListView.swift
//  LonghornApp
//
//  搜索视图
//

import SwiftUI

struct SearchListView: View {
    @State private var searchText = ""
    @State private var results: [FileItem] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    
    var body: some View {
        List {
            if !hasSearched {
                // 搜索提示
                Section {
                    VStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary)
                        
                        Text("搜索文件和文件夹")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                }
                .listRowBackground(Color.clear)
            } else if results.isEmpty && !isSearching {
                // 无结果
                Section {
                    ContentUnavailableView(
                        "未找到结果",
                        systemImage: "magnifyingglass",
                        description: Text("尝试使用其他关键词搜索")
                    )
                }
                .listRowBackground(Color.clear)
            } else {
                // 搜索结果
                ForEach(results) { file in
                    FileRowView(file: file)
                }
            }
        }
        .listStyle(.plain)
        .navigationTitle("搜索")
        .searchable(text: $searchText, prompt: "搜索文件名...")
        .onSubmit(of: .search) {
            performSearch()
        }
        .onChange(of: searchText) { _, newValue in
            if newValue.isEmpty {
                results = []
                hasSearched = false
            }
        }
        .overlay {
            if isSearching {
                ProgressView("搜索中...")
            }
        }
    }
    
    private func performSearch() {
        guard !searchText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        
        isSearching = true
        hasSearched = true
        
        Task {
            do {
                results = try await FileService.shared.searchFiles(query: searchText)
            } catch {
                print("Search failed: \(error)")
                results = []
            }
            isSearching = false
        }
    }
}

#Preview {
    NavigationStack {
        SearchListView()
    }
}
