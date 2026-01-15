//
//  ShareDialogView.swift
//  LonghornApp
//
//  分享对话框 - 设置密码、有效期
//

import SwiftUI

// MARK: - 分享有效期选项

enum ShareExpiryOption: String, CaseIterable {
    case oneDay = "share.expiry.1day"
    case threeDays = "share.expiry.3days"
    case sevenDays = "permission.expiry.7days"
    case thirtyDays = "permission.expiry.1month" // Reusing 1 month key approx, or make new
    case never = "permission.expiry.forever"
    
    var localizedName: LocalizedStringKey {
        LocalizedStringKey(rawValue)
    }
    
    var days: Int? {
        switch self {
        case .oneDay: return 1
        case .threeDays: return 3
        case .sevenDays: return 7
        case .thirtyDays: return 30
        case .never: return nil
        }
    }
}

struct ShareDialogView: View {
    let filePath: String
    let fileName: String
    var onDismiss: () -> Void = {}
    
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
                // 分享成功结果
                shareSuccessView(result)
            } else {
                // 分享设置表单
                shareSettingsForm
            }
        }
    }
    
    // MARK: - 分享设置表单
    
    private var shareSettingsForm: some View {
        Form {
            // 文件信息
            Section("share.file_info") {
                HStack(spacing: 12) {
                    Image(systemName: "doc.fill")
                        .font(.system(size: 24))
                        .foregroundColor(.blue)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(fileName)
                            .font(.system(size: 15, weight: .medium))
                        Text(filePath)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                }
                .padding(.vertical, 4)
            }
            
            // 密码设置
            Section(header: Text("share.access_control"), footer: usePassword ? Text("share.need_password") : nil) {
                Toggle("share.set_password", isOn: $usePassword)
                
                if usePassword {
                    HStack {
                        SecureField("share.password", text: $password)
                        
                        Button {
                            password = generateRandomPassword()
                        } label: {
                            Image(systemName: "dice")
                                .foregroundColor(accentColor)
                        }
                    }
                }
            }
            
            // 有效期
            Section(header: Text("share.link_validity"), footer: Text("share.link_expiry_desc")) {
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
            
            // 错误信息
            if let error = errorMessage {
                Section {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.system(size: 14))
                }
            }
        }
        .navigationTitle(Text("share.create_link"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("action.cancel") {
                    onDismiss()
                }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    createShareLink()
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("action.done") // Create
                    }
                }
                .disabled(isLoading || (usePassword && password.isEmpty))
                .foregroundColor(accentColor)
            }
        }
    }
    
    // MARK: - 分享成功视图
    
    private func shareSuccessView(_ result: ShareResult) -> some View {
        VStack(spacing: 24) {
            Spacer()
            
            // 成功图标
            ZStack {
                Circle()
                    .fill(Color.green.opacity(0.15))
                    .frame(width: 80, height: 80)
                
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 48))
                    .foregroundColor(.green)
            }
            
            Text("share.success")
                .font(.system(size: 20, weight: .semibold))
            
            // 链接显示
            VStack(spacing: 12) {
                Text(result.shareUrl)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)
                
                // 复制按钮
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
                
                // 密码提示
                if usePassword && !password.isEmpty {
                    HStack {
                        Image(systemName: "lock.fill")
                            .foregroundColor(.secondary)
                        Text("Password: \(password)")
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                        
                        Button {
                            UIPasteboard.general.string = password
                            ToastManager.shared.show("密码已复制", type: .success)
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 12))
                                .foregroundColor(accentColor)
                        }
                    }
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
            
            // 底部只有一个完成按钮
            Button {
                onDismiss()
            } label: {
                Text("action.done")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(12)
            }
            .padding(.horizontal)
            .padding(.bottom)
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
    
    // MARK: - 方法
    
    private func createShareLink() {
        isLoading = true
        errorMessage = nil
        
        Task {
            do {
                let result = try await FileService.shared.createShareLink(
                    path: filePath,
                    password: usePassword ? password : nil,
                    expiresInDays: expiresIn.days,
                    language: selectedLanguage
                )
                
                await MainActor.run {
                    shareResult = result
                    isLoading = false
                }
            } catch let error as APIError {
                await MainActor.run {
                    errorMessage = error.errorDescription
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
    
    private func generateRandomPassword() -> String {
        let chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        return String((0..<6).map { _ in chars.randomElement()! })
    }
}

#Preview {
    ShareDialogView(filePath: "MS/test.pdf", fileName: "test.pdf")
}
