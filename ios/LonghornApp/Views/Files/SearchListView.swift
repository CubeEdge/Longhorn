//
//  SearchListView.swift
//  LonghornApp
//
//  搜索视图（支持类型筛选）
//

import SwiftUI

struct SearchListView: View {
    @State private var searchText = ""
    @State private var results: [FileItem] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    @State private var selectedType: FileTypeFilter = .all
    
    enum FileTypeFilter: String, CaseIterable {
        case all = "filter.all"
        case image = "filter.image"
        case video = "filter.video"
        case document = "filter.document"
        case audio = "filter.audio"
        
        var typeParameter: String? {
            switch self {
            case .all: return nil
            case .image: return "image"
            case .video: return "video"
            case .document: return "document"
            case .audio: return "audio"
            }
        }
        
        var localizedName: String {
            String(localized: LocalizedStringResource(stringLiteral: self.rawValue))
        }
        
        var icon: String {
            switch self {
            case .all: return "square.grid.2x2"
            case .image: return "photo"
            case .video: return "film"
            case .document: return "doc.text"
            case .audio: return "music.note"
            }
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // 类型筛选器
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(FileTypeFilter.allCases, id: \.self) { type in
                        FilterChip(
                            title: type.localizedName,
                            icon: type.icon,
                            isSelected: selectedType == type
                        ) {
                            selectedType = type
                            if hasSearched {
                                performSearch()
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 12)
            }
            .background(Color(UIColor.secondarySystemBackground))
            
            // 搜索结果列表
            List {
                if !hasSearched {
                    Section {
                        VStack(spacing: 8) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 40))
                                .foregroundColor(.secondary)
                            
                            Text("search.instruction")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                    }
                    .listRowBackground(Color.clear)
                } else if results.isEmpty && !isSearching {
                    Section {
                        ContentUnavailableView(
                            String(localized: "search.no_results"),
                            systemImage: "magnifyingglass",
                            description: Text("search.no_results.description")
                        )
                    }
                    .listRowBackground(Color.clear)
                } else {
                    ForEach(results) { file in
                        NavigationLink {
                            if file.isDirectory {
                                FileBrowserView(path: file.path)
                            } else {
                                // 预览文件 - 在搜索中目前保持简单
                                Text("search.file_detail \(file.name)")
                            }
                        } label: {
                            FileRowView(file: file)
                        }
                    }
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("search.title")
        .searchable(text: $searchText, prompt: Text("search.placeholder"))
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
                ProgressView("search.searching")
            }
        }
    }
    
    private func performSearch() {
        guard !searchText.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        
        isSearching = true
        hasSearched = true
        
        Task {
            do {
                results = try await FileService.shared.searchFiles(
                    query: searchText,
                    type: selectedType.typeParameter
                )
            } catch {
                print("Search failed: \(error)")
                results = []
            }
            isSearching = false
        }
    }
}

// MARK: - 筛选标签

struct FilterChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                Text(title)
                    .font(.system(size: 13, weight: .medium))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(isSelected ? accentColor : Color(UIColor.tertiarySystemBackground))
            .foregroundColor(isSelected ? .black : .primary)
            .cornerRadius(20)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        SearchListView()
    }
}
