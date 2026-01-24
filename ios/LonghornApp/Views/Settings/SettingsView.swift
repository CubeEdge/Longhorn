import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var languageManager: LanguageManager
    @StateObject private var recentManager = RecentFilesManager.shared
    @State private var serverURL = APIClient.shared.baseURL
    @State private var cacheCleared = false
    @State private var showResetAlert = false
    
    var body: some View {
        Form {
            Section(header: Text("settings.language")) {
    
    // ... (existing code omitted for brevity in tool call, but context kept safe) ...

    private func resetPreferences() {
        // Reset AppStorage keys
        UserDefaults.standard.removeObject(forKey: "fileSortOrder")
        UserDefaults.standard.removeObject(forKey: "fileViewMode")
        
        // Synced reset with immediate feedback
        ToastManager.shared.show(
            String(localized: "toast.reset_success"),
            type: .success,
            style: .prominent
        )
    }

    private func clearAllCache() {
                Picker("settings.app_language", selection: Binding(
                    get: { languageManager.currentLanguage },
                    set: { languageManager.setLanguage($0) }
                )) {
                    ForEach(AppLanguage.allCases) { lang in
                        Text(lang.displayName).tag(lang)
                    }
                }
            }
            
            Section(header: Text("settings.recent")) {
                Picker("settings.recent_period", selection: $recentManager.period) {
                    ForEach(RecentPeriod.allCases) { period in
                        Text(period.displayName).tag(period)
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
            
            Section(header: Text("settings.cache")) {
                Button(role: .destructive) {
                    clearAllCache()
                } label: {
                    HStack {
                        Image(systemName: cacheCleared ? "checkmark.circle.fill" : "trash")
                            .foregroundColor(cacheCleared ? .green : .red)
                        Text(cacheCleared ? "settings.cache_cleared" : "settings.clear_cache")
                            .foregroundColor(cacheCleared ? .secondary : .red)
                    }
                }
                .disabled(cacheCleared)
            }
            
            // Advanced / Danger Zone
            Section(header: Text("settings.advanced")) {
                Button(role: .destructive) {
                    showResetAlert = true
                } label: {
                    Label("settings.reset_preferences", systemImage: "arrow.counterclockwise.circle.fill")
                        .foregroundColor(.red)
                }
                .alert("settings.reset_preferences", isPresented: $showResetAlert) {
                    Button("action.cancel", role: .cancel) { }
                    Button("action.confirm", role: .destructive) {
                        resetPreferences()
                    }
                } message: {
                    Text("settings.reset_message")
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
        
        // Update state and show feedback
        withAnimation {
            cacheCleared = true
        }
        ToastManager.shared.show(String(localized: "settings.cache_cleared"), type: .success)
    }
}
