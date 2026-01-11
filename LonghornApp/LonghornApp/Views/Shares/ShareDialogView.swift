//
//  ShareDialogView.swift
//  LonghornApp
//
//  分享对话框 - 设置密码、有效期
//

import SwiftUI

struct ShareDialogView: View {
    let filePath: String
    let fileName: String
    var onDismiss: () -> Void = {}
    
    @State private var password = ""
    @State private var usePassword = false
    @State private var expiresIn: ExpiryOption = .sevenDays
    @State private var isLoading = false
    @State private var shareResult: ShareResult?
    @State private var errorMessage: String?
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    enum ExpiryOption: String, CaseIterable {
        case oneDay = "1天"
        case threeDays = "3天"
        case sevenDays = "7天"
        case thirtyDays = "30天"
        case never = "永久"
        
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
            Section {
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
            } header: {
                Text("分享文件")
            }
            
            // 密码设置
            Section {
                Toggle("设置访问密码", isOn: $usePassword)
                
                if usePassword {
                    HStack {
                        SecureField("密码", text: $password)
                        
                        Button {
                            password = generateRandomPassword()
                        } label: {
                            Image(systemName: "dice")
                                .foregroundColor(accentColor)
                        }
                    }
                }
            } header: {
                Text("访问控制")
            } footer: {
                if usePassword {
                    Text("访问者需要输入密码才能下载文件")
                }
            }
            
            // 有效期
            Section {
                Picker("有效期", selection: $expiresIn) {
                    ForEach(ExpiryOption.allCases, id: \.self) { option in
                        Text(option.rawValue).tag(option)
                    }
                }
                .pickerStyle(.menu)
            } header: {
                Text("链接有效期")
            } footer: {
                Text("过期后链接将失效，需要重新创建")
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
        .navigationTitle("创建分享链接")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") {
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
                        Text("创建")
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
            
            Text("分享链接已创建")
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
                } label: {
                    Label("复制链接", systemImage: "doc.on.doc")
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
                        Text("密码: \(password)")
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                        
                        Button {
                            UIPasteboard.general.string = password
                        } label: {
                            Image(systemName: "doc.on.doc")
                                .font(.system(size: 12))
                                .foregroundColor(accentColor)
                        }
                    }
                }
                
                // 有效期提示
                HStack {
                    Image(systemName: "clock")
                        .foregroundColor(.secondary)
                    Text("有效期: \(expiresIn.rawValue)")
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal)
            
            Spacer()
            
            // 完成按钮
            Button {
                onDismiss()
            } label: {
                Text("完成")
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
        .navigationTitle("分享成功")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("完成") {
                    onDismiss()
                }
                .foregroundColor(accentColor)
            }
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
                    expiresInDays: expiresIn.days
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

// MARK: - 批量分享对话框

struct BatchShareDialogView: View {
    let filePaths: [String]
    var onDismiss: () -> Void = {}
    
    @State private var name = ""
    @State private var password = ""
    @State private var usePassword = false
    @State private var expiresIn: ShareDialogView.ExpiryOption = .sevenDays
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
            Section {
                Text("已选择 \(filePaths.count) 个文件")
                    .font(.system(size: 15, weight: .medium))
            } header: {
                Text("分享内容")
            }
            
            Section {
                TextField("分享名称", text: $name)
            } header: {
                Text("合集名称")
            } footer: {
                Text("给这个分享合集起个名字")
            }
            
            Section {
                Toggle("设置访问密码", isOn: $usePassword)
                
                if usePassword {
                    SecureField("密码", text: $password)
                }
            } header: {
                Text("访问控制")
            }
            
            Section {
                Picker("有效期", selection: $expiresIn) {
                    ForEach(ShareDialogView.ExpiryOption.allCases, id: \.self) { option in
                        Text(option.rawValue).tag(option)
                    }
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
        .navigationTitle("批量分享")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("取消") { onDismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button {
                    createBatchShare()
                } label: {
                    if isLoading {
                        ProgressView()
                    } else {
                        Text("创建")
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
            
            Text("分享合集已创建")
                .font(.system(size: 20, weight: .semibold))
            
            Text(result.shareUrl)
                .font(.system(size: 14, design: .monospaced))
                .foregroundColor(.secondary)
                .padding()
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
            
            Button {
                UIPasteboard.general.string = result.shareUrl
            } label: {
                Label("复制链接", systemImage: "doc.on.doc")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.black)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(accentColor)
                    .cornerRadius(12)
            }
            
            Spacer()
            
            Button("完成") { onDismiss() }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(12)
                .padding()
        }
        .navigationTitle("分享成功")
        .navigationBarTitleDisplayMode(.inline)
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
                    expiresInDays: expiresIn.days
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

#Preview {
    ShareDialogView(filePath: "MS/test.pdf", fileName: "test.pdf")
}
