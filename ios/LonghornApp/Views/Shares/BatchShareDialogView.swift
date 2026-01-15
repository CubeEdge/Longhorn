//
//  BatchShareDialogView.swift
//  LonghornApp
//
//  批量分享对话框
//

import SwiftUI

struct BatchShareDialogView: View {
    let filePaths: [String]
    var onDismiss: () -> Void = {}
    
    @State private var name = ""
    @State private var password = ""
    @State private var usePassword = false
    @State private var expiresIn: ShareExpiryOption = .sevenDays
    @State private var selectedLanguage = "zh" // Default to Chinese
    @State private var isLoading = false
    @State private var shareResult: ShareResult?
    @State private var errorMessage: String?
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        NavigationStack {
            if let result = shareResult {
                shareSuccessView(result)
            } else {
                shareSettingsForm
            }
        }
    }
    
    private var shareSettingsForm: some View {
        Form {
            Section("share.content") {
                HStack {
                    Image(systemName: "doc.on.doc.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.blue)
                    
                    Text("\(Text("share.selected_count")) \(filePaths.count)")
                        .font(.system(size: 15, weight: .medium))
                }
            }
            
            Section(header: Text("share.collection_name"), footer: Text("share.collection_desc")) {
                TextField("share.collection_name_placeholder", text: $name)
            }
            
            Section("share.access_control") {
                Toggle("share.set_password", isOn: $usePassword)
                
                if usePassword {
                    SecureField("share.password", text: $password)
                }
            }
            
            Section("share.link_validity") {
                Picker("permission.validity", selection: $expiresIn) {
                    ForEach(ShareExpiryOption.allCases, id: \.self) { option in
                        Text(option.localizedName).tag(option)
                    }
                }
                .pickerStyle(.menu)
            }
            
            // 语言设置
            Section(header: Text("语言设置")) {
                Picker("界面语言", selection: $selectedLanguage) {
                    Text("中文").tag("zh")
                    Text("English").tag("en")
                    Text("Deutsch").tag("de")
                    Text("日本語").tag("ja")
                }
                .pickerStyle(.menu)
            }
            
            if let error = errorMessage {
                Section {
                    Text(error)
                        .foregroundColor(.red)
                }
            }
        }
        .navigationTitle(Text("share.batch_create"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("action.cancel") { onDismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    createBatchShare()
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("action.done")
                    }
                }
                .disabled(isLoading || name.isEmpty)
                .foregroundColor(accentColor)
            }
        }
    }
    
    private func shareSuccessView(_ result: ShareResult) -> some View {
        VStack(spacing: 24) {
            Spacer()
            
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.green)
            
            Text("share.success") // "Share Collection Created" - reusing "share.success"
                .font(.system(size: 20, weight: .semibold))
            
            VStack(spacing: 12) {
                Text(result.shareUrl)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundColor(.secondary)
                    .padding()
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)
                
                Button {
                    UIPasteboard.general.string = result.shareUrl
                    ToastManager.shared.show("链接已复制", type: .success)
                } label: {
                    Label("action.copy_link", systemImage: "doc.on.doc")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.black)
                        .padding(.horizontal, 24)
                        .padding(.vertical, 12)
                        .background(accentColor)
                        .cornerRadius(12)
                }
                
                // 信息展示：有效期 & 语言
                HStack(spacing: 16) {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .foregroundColor(.secondary)
                        Text(expiresIn.localizedName)
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                    }
                    
                    HStack(spacing: 4) {
                        Image(systemName: "globe")
                            .foregroundColor(.secondary)
                        Text(languageName(selectedLanguage))
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal)
            
            Spacer()
            
            Button("action.done") { onDismiss() }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
                .padding()
        }
        .navigationTitle(Text("share.success"))
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func languageName(_ code: String) -> String {
        switch code {
        case "zh": return "中文"
        case "en": return "English"
        case "de": return "Deutsch"
        case "ja": return "日本語"
        default: return code
        }
    }
    
    private func createBatchShare() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let result = try await FileService.shared.createShareCollection(
                    paths: filePaths,
                    name: name,
                    password: usePassword ? password : nil,
                    expiresInDays: expiresIn.days,
                    language: selectedLanguage
                )
                
                await MainActor.run {
                    shareResult = result
                    isLoading = false
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
