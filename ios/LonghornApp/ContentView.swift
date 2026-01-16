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
            
            // Toast Overlay
            if let toast = toastManager.currentToast {
                ToastView(toast: toast)
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(100)
                    .padding(.top, 60) // Safe Area / Dynamic Island padding
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AuthManager.shared)
}
