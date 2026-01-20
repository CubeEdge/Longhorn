//
//  LoginView.swift
//  LonghornApp
//
//  登录界面
//

import SwiftUI

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager
    
    @State private var username = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var isAnimating = false
    @State private var showServerSettings = false
    
    // 品牌色
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0) // #FFD200
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // 背景渐变
                LinearGradient(
                    gradient: Gradient(colors: [
                        Color(red: 0.08, green: 0.08, blue: 0.10),
                        Color(red: 0.12, green: 0.12, blue: 0.16)
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                // 背景装饰
                Circle()
                    .fill(accentColor.opacity(0.1))
                    .frame(width: 400, height: 400)
                    .blur(radius: 100)
                    .offset(x: -100, y: -200)
                
                Circle()
                    .fill(Color.blue.opacity(0.1))
                    .frame(width: 300, height: 300)
                    .blur(radius: 80)
                    .offset(x: 150, y: 300)
                
                // 主内容
                ScrollView {
                    VStack(spacing: 40) {
                        Spacer()
                            .frame(height: geometry.size.height * 0.1)
                        
                        // Logo 区域
                        logoSection
                        
                        // 登录表单
                        loginForm
                        
                        Spacer()
                        
                        // 服务器设置
                        serverSettingsButton
                    }
                    .padding(.horizontal, 32)
                    .frame(minHeight: geometry.size.height)
                }
            }
        }
        .sheet(isPresented: $showServerSettings) {
            ServerSettingsView()
        }
    }
    
    // MARK: - 子视图
    
    private var logoSection: some View {
        VStack(spacing: 16) {
            // Logo 图标
            ZStack {
                RoundedRectangle(cornerRadius: 24)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [accentColor, accentColor.opacity(0.8)]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 80, height: 80)
                    .shadow(color: accentColor.opacity(0.4), radius: 20, x: 0, y: 10)
                
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundColor(.black)
            }
            .rotationEffect(.degrees(-5))
            .scaleEffect(isAnimating ? 1.0 : 0.8)
            .opacity(isAnimating ? 1.0 : 0.5)
            .animation(.spring(response: 0.6, dampingFraction: 0.7), value: isAnimating)
            .onAppear {
                isAnimating = true
            }
            
            VStack(spacing: 8) {
                Text("Longhorn")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)
                
                Text("像空气一样自由流动")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
    }
    
    private var loginForm: some View {
        VStack(spacing: 20) {
            usernameField
            passwordField
            errorDisplay
            loginButton
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color.white.opacity(0.05))
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(.ultraThinMaterial)
                        .opacity(0.3)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
        )
    }
    
    private var usernameField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("用户名")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white.opacity(0.7))
            
            HStack(spacing: 12) {
                Image(systemName: "person.fill")
                    .foregroundColor(.white.opacity(0.5))
                    .frame(width: 20)
                
                TextField("", text: $username)
                    .foregroundColor(.white)
                    .autocapitalization(.none)
                    .textContentType(.username)
                    .placeholder(when: username.isEmpty) {
                        Text("请输入用户名")
                            .foregroundColor(.white.opacity(0.3))
                    }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
            )
        }
    }
    
    private var passwordField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("密码")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.white.opacity(0.7))
            
            HStack(spacing: 12) {
                Image(systemName: "lock.fill")
                    .foregroundColor(.white.opacity(0.5))
                    .frame(width: 20)
                
                Group {
                    if showPassword {
                        TextField("", text: $password)
                    } else {
                        SecureField("", text: $password)
                    }
                }
                .foregroundColor(.white)
                .textContentType(.password)
                .placeholder(when: password.isEmpty) {
                    Text("请输入密码")
                        .foregroundColor(.white.opacity(0.3))
                }
                
                Button(action: { showPassword.toggle() }) {
                    Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                        .foregroundColor(.white.opacity(0.5))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(0.08))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
            )
        }
    }
    
    @ViewBuilder
    private var errorDisplay: some View {
        if let error = authManager.errorMessage {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundColor(.red)
                Text(error)
                    .font(.system(size: 13))
                    .foregroundColor(.red)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.red.opacity(0.15))
            )
        }
    }
    
    private var loginButton: some View {
        Button(action: login) {
            HStack {
                if authManager.isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .black))
                } else {
                    Text("登录")
                        .font(.system(size: 17, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isFormValid ? accentColor : Color.gray.opacity(0.5))
            )
            .foregroundColor(.black)
        }
        .disabled(!isFormValid || authManager.isLoading)
        .padding(.top, 8)
    }
    
    private var serverSettingsButton: some View {
        Button(action: { showServerSettings = true }) {
            HStack(spacing: 8) {
                Image(systemName: "gearshape.fill")
                Text("服务器设置")
            }
            .font(.system(size: 14, weight: .medium))
            .foregroundColor(.white.opacity(0.5))
        }
        .padding(.bottom, 32)
    }
    
    // MARK: - 方法
    
    private var isFormValid: Bool {
        !username.trimmingCharacters(in: .whitespaces).isEmpty &&
        !password.isEmpty
    }
    
    private func login() {
        Task {
            await authManager.login(username: username, password: password)
        }
    }
}

// MARK: - 服务器设置视图

struct ServerSettingsView: View {
    @Environment(\.dismiss) var dismiss
    @State private var serverURL: String = APIClient.shared.baseURL
    
    private let accentColor = Color(red: 1.0, green: 0.82, blue: 0.0)
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("服务器地址", text: $serverURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .keyboardType(.URL)
                } header: {
                    Text("服务器地址")
                } footer: {
                    Text("例如: http://192.168.1.100:3000 或 https://your-domain.com")
                        .font(.caption)
                }
            }
            .navigationTitle("服务器设置")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("保存") {
                        APIClient.shared.baseURL = serverURL
                        dismiss()
                    }
                    .foregroundColor(accentColor)
                }
            }
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - 辅助扩展

extension View {
    func placeholder<Content: View>(
        when shouldShow: Bool,
        alignment: Alignment = .leading,
        @ViewBuilder placeholder: () -> Content
    ) -> some View {
        ZStack(alignment: alignment) {
            placeholder().opacity(shouldShow ? 1 : 0)
            self
        }
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthManager.shared)
}
