import Foundation
import AVFoundation

class DailyWordService: ObservableObject {
    static let shared = DailyWordService()
    
    @Published var currentWord: WordEntry?
    @Published var currentLanguage: DailyWordLanguage = .en
    @Published var currentLevel: String = "Advanced"
    @Published var isLoading = false
    
    private let synthesizer = AVSpeechSynthesizer()
    
    private init() {
        loadPreferences()
    }
    
    func setLanguage(_ lang: String) {
        if let l = DailyWordLanguage(rawValue: lang) {
            self.currentLanguage = l
            // Persist module specific language preference
            UserDefaults.standard.set(lang, forKey: "longhorn_daily_word_language")
            
            let savedLevel = UserDefaults.standard.string(forKey: "daily_word_level_\(l.rawValue)")
            self.currentLevel = savedLevel ?? l.defaultLevel
            fetchNewWord()
        }
    }
    
    func setLevel(_ level: String) {
        self.currentLevel = level
        UserDefaults.standard.set(level, forKey: "daily_word_level_\(currentLanguage.rawValue)")
        fetchNewWord()
    }
    
    func nextWord() {
        fetchNewWord()
    }
    
    func speak() {
        guard let word = currentWord else { return }
        
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        
        let utterance = AVSpeechUtterance(string: word.word)
        utterance.voice = AVSpeechSynthesisVoice(language: currentLanguage.speechCode)
        utterance.rate = 0.4
        
        synthesizer.speak(utterance)
    }
    
    // MARK: - Local Data Logic
    
    private func fetchNewWord() {
        self.isLoading = true
        // Fetch immediately
        self.currentWord = DailyWordsData.getRandomWord(language: self.currentLanguage, level: self.currentLevel)
        self.isLoading = false
    }
    
    private func loadPreferences() {
        // 1. Try to load specific Daily Word language preference
        var langCode = UserDefaults.standard.string(forKey: "longhorn_daily_word_language")
        
        // 2. Fallback to App Language if not set
        if langCode == nil {
            langCode = UserDefaults.standard.string(forKey: "longhorn_language")
        }
        
        // 3. Fallback to System Language
        if langCode == nil {
            let systemLang = Locale.current.language.languageCode?.identifier ?? "en"
            if ["zh", "zh-Hans", "zh-Hant"].contains(systemLang) || systemLang.starts(with: "zh") {
                langCode = "zh"
            } else if ["de", "ja", "en"].contains(systemLang) {
                langCode = systemLang
            } else {
                langCode = "en"
            }
        }
        
        // Normalize for DailyWordLanguage enum
        if langCode == "zh-Hans" || langCode == "zh-Hant" {
            langCode = "zh"
        }
        
        if let code = langCode, let l = DailyWordLanguage(rawValue: code) {
            self.currentLanguage = l
        } else {
            self.currentLanguage = .en
        }
        
        // Load Level
        let savedLevel = UserDefaults.standard.string(forKey: "daily_word_level_\(currentLanguage.rawValue)")
        self.currentLevel = savedLevel ?? currentLanguage.defaultLevel
        
        fetchNewWord()
    }
}
