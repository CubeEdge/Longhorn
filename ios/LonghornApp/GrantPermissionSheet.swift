
import SwiftUI

struct GrantPermissionSheet: View {
    let user: User
    @Binding var isPresented: Bool
    var onGrant: () -> Void
    
    @State private var folderPath: String = ""
    @State private var showFolderPicker = false
    @State private var accessType: AccessType = .read
    @State private var expiresAt: Date = Date().addingTimeInterval(86400 * 30) // Default 30 days
    @State private var isPermanent = false
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("授权目录")) {
                    HStack {
                        Image(systemName: "folder")
                            .foregroundColor(.blue)
                        Text(folderPath.isEmpty ? "选择文件夹" : folderPath)
                            .foregroundColor(folderPath.isEmpty ? .secondary : .primary)
                        Spacer()
                        Button("选择") {
                            showFolderPicker = true
                        }
                    }
                }
                
                Section(header: Text("权限类型")) {
                    Picker("权限", selection: $accessType) {
                        Text("只读 (Read)").tag(AccessType.read)
                        Text("协作 (Contribute)").tag(AccessType.contribute)
                        Text("完全控制 (Full)").tag(AccessType.full)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                Section(header: Text("有效期")) {
                    Toggle("永久有效", isOn: $isPermanent)
                    
                    if !isPermanent {
                        DatePicker("过期时间", selection: $expiresAt, displayedComponents: .date)
                    }
                }
                
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("增加授权")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("确定") {
                        grant()
                    }
                    .disabled(folderPath.isEmpty || isLoading)
                }
            }
            .sheet(isPresented: $showFolderPicker) {
                NavigationStack {
                    FolderPickerView(
                        selectedPath: $folderPath,
                        onSelect: { path in
                            folderPath = path
                            showFolderPicker = false
                        }
                    )
                    .navigationTitle("选择目录")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("取消") {
                                showFolderPicker = false
                            }
                        }
                    }
                }
            }
        }
    }
    
    private func grant() {
        isLoading = true
        errorMessage = nil
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let expiryString = isPermanent ? nil : formatter.string(from: expiresAt)
        
        Task {
            do {
                try await AdminService.shared.grantPermission(
                    userId: user.id,
                    folderPath: folderPath,
                    accessType: accessType,
                    expiresAt: expiryString
                )
                await MainActor.run {
                    onGrant()
                    isPresented = false
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}
