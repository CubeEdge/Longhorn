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
    
    // MARK: - Server API Logic
    
    private func fetchNewWord() {
        self.isLoading = true
        
        // Build URL (use server base URL from environment or hardcode for now)
        let baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://192.168.50.2:4000"
        let lang = currentLanguage.rawValue
        let lvl = currentLevel.prefix(1).uppercased() + currentLevel.dropFirst() // Normalize
        
        guard let url = URL(string: "\(baseURL)/api/vocabulary/random?language=\(lang)&level=\(lvl)") else {
            self.isLoading = false
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let data = data {
                    do {
                        let word = try JSONDecoder().decode(WordEntry.self, from: data)
                        self?.currentWord = word
                    } catch {
                        print("DailyWord decode error: \(error)")
                        // Fallback to local data if API fails
                        self?.currentWord = DailyWordsData.getRandomWord(language: self?.currentLanguage ?? .en, level: self?.currentLevel)
                    }
                } else {
                    print("DailyWord fetch error: \(error?.localizedDescription ?? "Unknown")")
                    // Fallback to local
                    self?.currentWord = DailyWordsData.getRandomWord(language: self?.currentLanguage ?? .en, level: self?.currentLevel)
                }
            }
        }.resume()
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
