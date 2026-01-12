//
//  AuthManager.swift
//  LonghornApp
//
//  认证管理器
//

import Foundation
import Security

/// 认证管理器
@MainActor
class AuthManager: ObservableObject {
    static let shared = AuthManager()
    
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let tokenKey = "com.kinefinity.longhorn.token"
    private let userKey = "com.kinefinity.longhorn.user"
    
    /// 当前 Token
    var token: String? {
        get { getTokenFromKeychain() }
        set {
            if let value = newValue {
                saveTokenToKeychain(value)
            } else {
                deleteTokenFromKeychain()
            }
        }
    }
    
    private init() {
        // 启动时检查是否有保存的登录状态
        checkSavedSession()
    }
    
    // MARK: - 公开方法
    
    /// 登录
    func login(username: String, password: String) async {
        isLoading = true
        errorMessage = nil
        
        do {
            let loginRequest = LoginRequest(username: username, password: password)
            let response: LoginResponse = try await APIClient.shared.post("/api/login", body: loginRequest)
            
            // 保存登录状态
            token = response.token
            currentUser = response.user
            saveUserToDefaults(response.user)
            isAuthenticated = true
            
            print("[Auth] Login successful: \(response.user.username)")
            
        } catch let error as APIError {
            errorMessage = error.errorDescription
            print("[Auth] Login failed: \(error.errorDescription ?? "Unknown")")
        } catch {
            errorMessage = "登录失败: \(error.localizedDescription)"
            print("[Auth] Login failed: \(error)")
        }
        
        isLoading = false
    }
    
    /// 登出
    func logout() {
        token = nil
        currentUser = nil
        isAuthenticated = false
        UserDefaults.standard.removeObject(forKey: userKey)
        print("[Auth] Logged out")
    }
    
    // MARK: - 私有方法
    
    /// 检查保存的登录会话
    private func checkSavedSession() {
        guard token != nil else {
            print("[Auth] No saved session")
            return
        }
        
        // 尝试恢复用户信息
        if let userData = UserDefaults.standard.data(forKey: userKey),
           let user = try? JSONDecoder().decode(User.self, from: userData) {
            currentUser = user
            isAuthenticated = true
            print("[Auth] Restored session for: \(user.username)")
            
            // 异步验证 token 是否仍然有效
            Task {
                await validateToken()
            }
        }
    }
    
    /// 验证 Token 是否有效
    private func validateToken() async {
        do {
            let _: UserStatsResponse = try await APIClient.shared.get("/api/user/stats")
            print("[Auth] Token validation successful")
        } catch {
            print("[Auth] Token validation failed, logging out")
            logout()
        }
    }
    
    /// 保存用户信息到 UserDefaults
    private func saveUserToDefaults(_ user: User) {
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: userKey)
        }
    }
    
    // MARK: - Keychain 操作
    
    private func saveTokenToKeychain(_ token: String) {
        let data = token.data(using: .utf8)!
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tokenKey,
            kSecValueData as String: data
        ]
        
        // 先删除旧的
        SecItemDelete(query as CFDictionary)
        
        // 添加新的
        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            print("[Keychain] Failed to save token: \(status)")
        }
    }
    
    private func getTokenFromKeychain() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tokenKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        guard status == errSecSuccess,
              let data = dataTypeRef as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    private func deleteTokenFromKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: tokenKey
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - 辅助结构

private struct LoginRequest: Codable {
    let username: String
    let password: String
}

private struct UserStatsResponse: Codable {
    let uploadCount: Int?
    let storageUsed: Int64?
    let shareCount: Int?
}
