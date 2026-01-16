import SwiftUI

class LanguageManager: ObservableObject {
    static let shared = LanguageManager()
    
    @AppStorage("longhorn_language") var currentLanguageCode: String = {
        let systemLang = Locale.current.language.languageCode?.identifier ?? "en"
        // Map system codes to our app codes if necessary
        if ["zh", "zh-Hans", "zh-Hant"].contains(systemLang) || systemLang.starts(with: "zh") {
            return "zh-Hans"
        } else if ["de", "ja", "en"].contains(systemLang) {
            return systemLang
        }
        return "en"
    }()
    
    var locale: Locale {
        return Locale(identifier: currentLanguageCode)
    }
    
    var currentLanguage: AppLanguage {
        AppLanguage(rawValue: currentLanguageCode) ?? .en
    }
    
    func setLanguage(_ language: AppLanguage) {
        objectWillChange.send()
        currentLanguageCode = language.rawValue
        // Sync DailyWordService
        DailyWordService.shared.setLanguage(language.dailyWordCode)
    }
}

enum AppLanguage: String, CaseIterable, Identifiable {
    case en = "en"
    case zh = "zh-Hans"
    case de = "de"
    case ja = "ja"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .en: return "English"
        case .zh: return "简体中文"
        case .de: return "Deutsch"
        case .ja: return "日本語"
        }
    }
    
    var dailyWordCode: String {
        switch self {
        case .zh: return "zh"
        default: return rawValue
        }
    }
}
