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
    
    // MARK: - Server API Logic (Cache-First Strategy)
    
    private let cacheKey = "longhorn_daily_word_cache"
    
    private func fetchNewWord() {
        // 1. IMMEDIATELY show cached or local word (no loading state)
        if let cachedWord = loadCachedWord() {
            self.currentWord = cachedWord
        } else {
            // Fallback to local data if no cache
            self.currentWord = DailyWordsData.getRandomWord(language: currentLanguage, level: currentLevel)
        }
        
        // 2. Fetch from server in BACKGROUND (silent update)
        let baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://192.168.50.2:4000"
        let lang = currentLanguage.rawValue
        let lvl = currentLevel.prefix(1).uppercased() + currentLevel.dropFirst()
        
        guard let url = URL(string: "\(baseURL)/api/vocabulary/random?language=\(lang)&level=\(lvl)") else {
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let data = data else {
                print("DailyWord fetch error: \(error?.localizedDescription ?? "Unknown")")
                return
            }
            
            do {
                let word = try JSONDecoder().decode(WordEntry.self, from: data)
                DispatchQueue.main.async {
                    self?.currentWord = word
                    self?.cacheWord(word)
                }
            } catch {
                print("DailyWord decode error: \(error)")
            }
        }.resume()
    }
    
    private func cacheWord(_ word: WordEntry) {
        if let data = try? JSONEncoder().encode(word) {
            UserDefaults.standard.set(data, forKey: "\(cacheKey)_\(currentLanguage.rawValue)")
        }
    }
    
    private func loadCachedWord() -> WordEntry? {
        guard let data = UserDefaults.standard.data(forKey: "\(cacheKey)_\(currentLanguage.rawValue)") else {
            return nil
        }
        return try? JSONDecoder().decode(WordEntry.self, from: data)
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
