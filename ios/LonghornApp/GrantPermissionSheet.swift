
import SwiftUI

struct GrantPermissionSheet: View {
    let user: User
    @Binding var isPresented: Bool
    var onGrant: () -> Void
    
    @State private var folderPath: String = ""
    @State private var showFolderPicker = false
    @State private var accessType: AccessType = .read
    
    // Expiry State
    enum ExpiryOption: String, CaseIterable {
        case sevenDays = "permission.expiry.7days"
        case oneMonth = "permission.expiry.1month"
        case forever = "permission.expiry.forever"
        case custom = "permission.expiry.custom"
        
        var localizedName: LocalizedStringKey {
            LocalizedStringKey(rawValue)
        }
    }
    
    @State private var expiryOption: ExpiryOption = .sevenDays
    @State private var customDate: Date = Date().addingTimeInterval(86400 * 30)
    
    @State private var isLoading = false
    @State private var errorMessage: String?
    
    var body: some View {
        NavigationStack {
            Form {
                Section(header: Text("permission.authorized_directory")) {
                    HStack {
                        Image(systemName: "folder")
                            .foregroundColor(.blue)
                        Text(folderPath.isEmpty ? String(localized: "permission.select_folder_placeholder") : folderPath)
                            .foregroundColor(folderPath.isEmpty ? .secondary : .primary)
                        Spacer()
                        if !folderPath.isEmpty {
                            Button(action: { showFolderPicker = true }) {
                                Image(systemName: "pencil")
                            }
                        }
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        showFolderPicker = true
                    }
                }
                
                Section(header: Text("permission.type")) {
                    Picker("permission.type", selection: $accessType) {
                        Text("permission.read").tag(AccessType.read)
                        Text("permission.contribute").tag(AccessType.contribute)
                        Text("permission.full").tag(AccessType.full)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    
                    Text(permissionDescription)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 4)
                }
                
                Section(header: Text("permission.validity")) {
                    Picker("permission.validity", selection: $expiryOption) {
                        ForEach(ExpiryOption.allCases, id: \.self) { option in
                            Text(option.localizedName).tag(option)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    
                    if expiryOption == .custom {
                        DatePicker("permission.expiry_date", selection: $customDate, displayedComponents: .date)
                    }
                }
                
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle(Text("permission.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("action.cancel") {
                        isPresented = false
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("action.confirm") {
                        grant()
                    }
                    .disabled(folderPath.isEmpty || isLoading)
                }
            }
            .sheet(isPresented: $showFolderPicker) {
                NavigationStack {
                    DestinationFolderPicker(
                        onSelect: { path in
                            folderPath = path
                            showFolderPicker = false
                        }
                    )
                    .navigationTitle(Text("action.select"))
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("action.cancel") {
                                showFolderPicker = false
                            }
                        }
                    }
                }
            }
        }
    }
    
    var permissionDescription: LocalizedStringKey {
        switch accessType {
        case .read: return "permission.desc.read"
        case .contribute: return "permission.desc.contribute"
        case .full: return "permission.desc.full"
        }
    }
    
    private func grant() {
        isLoading = true
        errorMessage = nil
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        
        var expiryString: String? = nil
        let now = Date()
        
        switch expiryOption {
        case .sevenDays:
            if let date = Calendar.current.date(byAdding: .day, value: 7, to: now) {
                expiryString = formatter.string(from: date)
            }
        case .oneMonth:
            if let date = Calendar.current.date(byAdding: .month, value: 1, to: now) {
                expiryString = formatter.string(from: date)
            }
        case .forever:
            expiryString = nil
        case .custom:
            expiryString = formatter.string(from: customDate)
        }
        
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
