//
//  ContentView.swift
//  LonghornApp
//
//  根视图：根据登录状态显示登录页或主界面
//

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var languageManager: LanguageManager
    
    @ObservedObject private var toastManager = ToastManager.shared
    
    var body: some View {
        ZStack(alignment: .top) {
            Group {
                if authManager.isAuthenticated {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            .animation(.easeInOut(duration: 0.3), value: authManager.isAuthenticated)
            .id(languageManager.currentLanguageCode)
            
            // Toast Overlay - 底部显示
            if let toast = toastManager.currentToast {
                ToastView(toast: toast)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .zIndex(100)
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .padding(.bottom, 100) // 避开TabBar
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager.shared)
}
