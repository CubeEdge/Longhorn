import SwiftUI

struct FolderPickerView: View {
    @Binding var selectedPath: String
    var onSelect: (String) -> Void
    
    @State private var currentPath: String = ""
    @State private var items: [FileItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    var body: some View {
        List {
            if !currentPath.isEmpty {
                Button(action: goUp) {
                    HStack {
                        Image(systemName: "arrow.turn.up.left")
                            .foregroundColor(.blue)
                        Text("返回上一级")
                            .foregroundColor(.primary)
                    }
                }
            }
            
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, alignment: .center)
            } else if let error = errorMessage {
                Text(error)
                    .foregroundColor(.red)
            } else if items.isEmpty {
                Text("此文件夹为空或没有子文件夹")
                    .foregroundColor(.secondary)
                    .italic()
            } else {
                ForEach(items) { item in
                    HStack {
                        Image(systemName: "folder.fill")
                            .foregroundColor(.yellow)
                        Text(item.name)
                        Spacer()
                        
                        Button("进入") {
                            loadFiles(path: item.path)
                        }
                        .buttonStyle(BorderlessButtonStyle())
                        .foregroundColor(.blue)
                        .padding(.trailing, 8)
                        
                        Button("选择") {
                            onSelect(item.path)
                        }
                        .buttonStyle(BorderedButtonStyle())
                    }
                }
            }
        }
        .navigationTitle(currentPath.isEmpty ? "根目录" : currentPath)
        .onAppear {
            loadFiles(path: currentPath)
        }
    }
    
    private func loadFiles(path: String) {
        currentPath = path
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                items = try await AdminService.shared.fetchFiles(path: path)
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
    
    private func goUp() {
        let components = currentPath.split(separator: "/").map(String.init)
        if !components.isEmpty {
            let parentPath = components.dropLast().joined(separator: "/")
            loadFiles(path: parentPath)
        } else {
            loadFiles(path: "")
        }
    }
}
