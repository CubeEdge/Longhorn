import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var languageManager: LanguageManager
    @State private var serverURL = APIClient.shared.baseURL
    
    var body: some View {
        Form {
            Section(header: Text("settings.language")) {
                Picker("settings.app_language", selection: Binding(
                    get: { languageManager.currentLanguage },
                    set: { languageManager.setLanguage($0) }
                )) {
                    ForEach(AppLanguage.allCases) { lang in
                        Text(lang.displayName).tag(lang)
                    }
                }
            }
            
            Section(header: Text("settings.server")) {
                TextField("settings.server_url", text: $serverURL)
                    .textContentType(.URL)
                    .autocapitalization(.none)
                    .onSubmit {
                        APIClient.shared.baseURL = serverURL
                    }
            }
            
            Section(header: Text("settings.about")) {
                HStack {
                    Text("settings.version")
                    Spacer()
                    Text("1.0.0")
                        .foregroundColor(.secondary)
                }
            }
            
            Section(header: Text("缓存管理")) {
                Button(role: .destructive) {
                    clearAllCache()
                } label: {
                    HStack {
                        Image(systemName: "trash")
                        Text("清除所有图片缓存")
                    }
                }
            }
        }
        .navigationTitle(Text("settings.title"))
    }
    
    private func clearAllCache() {
        // Clear in-memory thumbnail cache
        ImageCacheService.shared.clearCache()
        
        // Clear disk preview cache
        Task {
            await PreviewCacheManager.shared.clearAll()
        }
        
        ToastManager.shared.show("缓存已清除", type: .success)
    }
}
