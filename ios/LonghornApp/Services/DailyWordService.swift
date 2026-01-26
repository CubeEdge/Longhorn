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
    
    // MARK: - Vocabulary Library Logic
    
    private var libraryKey: String { "longhorn_daily_word_library_\(currentLanguage.rawValue)" }
    @Published private(set) var downloadedWords: [WordEntry] = []
    
    @Published var isUpdating = false
    @Published var updateProgress: Double = 0.0
    
    var vocabularyCount: Int { downloadedWords.count }
    
    // Check if we need to hydrate the library on startup
    func checkForUpdates() {
        loadLibrary()
        
        let targetCount = 100
        if downloadedWords.count < targetCount {
            print("[DailyWord] Library size \(downloadedWords.count)/\(targetCount). Starting silent update.")
            startBatchUpdate(target: targetCount)
        }
    }
    
    func forceRefresh() {
        print("[DailyWord] Force refresh triggered.")
        startBatchUpdate(target: downloadedWords.count + 20, force: true) // Fetch 20 new words
    }
    
    private func loadLibrary() {
        if let data = UserDefaults.standard.data(forKey: libraryKey),
           let words = try? JSONDecoder().decode([WordEntry].self, from: data) {
            self.downloadedWords = words
        }
    }
    
    private func saveLibrary() {
        if let data = try? JSONEncoder().encode(downloadedWords) {
            UserDefaults.standard.set(data, forKey: libraryKey)
        }
    }
    
    private func startBatchUpdate(target: Int, force: Bool = false) {
        guard !isUpdating else { return }
        isUpdating = true
        updateProgress = 0.1 // Show starting state
        
        let needed = target - downloadedWords.count
        let batchSize = force ? 20 : max(needed, 10) // Fetch at least 10 or needed amount
        let countToFetch = min(batchSize, 50) // Cap at 50 per batch
        
        print("[DailyWord] Batch fetching \(countToFetch) words via API...")
        
        // Use proper Base URL from APIClient configuration
        let baseURL = APIClient.shared.baseURL
        let lang = currentLanguage.rawValue
        let lvl = currentLevel.prefix(1).uppercased() + currentLevel.dropFirst()
        
        guard let url = URL(string: "\(baseURL)/api/vocabulary/batch?language=\(lang)&level=\(lvl)&count=\(countToFetch)") else {
            self.isUpdating = false
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("[DailyWord] Network Error: \(error.localizedDescription)")
                DispatchQueue.main.async { self.isUpdating = false }
                return
            }
            
            guard let data = data else {
                print("[DailyWord] No data received")
                DispatchQueue.main.async { self.isUpdating = false }
                return
            }
            
            // Debug: Print raw JSON
            if let jsonStr = String(data: data, encoding: .utf8) {
                print("[DailyWord] Received JSON: \(jsonStr)")
            }
            
            do {
                let decoder = JSONDecoder()
                let newWords = try decoder.decode([WordEntry].self, from: data)
                
                DispatchQueue.main.async {
                    self.isUpdating = false
                    // Merge and Save
                    var addedCount = 0
                    for word in newWords {
                        if !self.downloadedWords.contains(where: { $0.word == word.word }) {
                            self.downloadedWords.append(word)
                            addedCount += 1
                        }
                    }
                    
                    self.saveLibrary()
                    self.updateProgress = 1.0 // Complete
                    print("[DailyWord] Batch update complete. Added \(addedCount) new words. Library size: \(self.downloadedWords.count)")
                    
                    // Refresh current word if needed
                    if self.currentWord == nil || self.isFallbackWord(self.currentWord!) {
                         self.nextWord() 
                    }
                }
            } catch {
                // improved error handling
                if let apiError = try? JSONDecoder().decode(APIError.self, from: data) {
                    print("[DailyWord] Server API Error: \(apiError.error)")
                } else {
                    print("[DailyWord] Decoding Error: \(error)")
                    if let str = String(data: data, encoding: .utf8) {
                        print("[DailyWord] Raw Response: \(str)")
                    }
                }
                DispatchQueue.main.async { self.isUpdating = false }
            }
        }.resume()
    }
    
    struct APIError: Codable {
        let error: String
    }

    
    // Legacy single fetch removed / unused for library building
    private func fetchSingleWordForLibrary(completion: @escaping (Bool) -> Void) {
        // ... kept for fallback if needed, or remove? 
        // Removing to keep code clean as we switched to batch.
    }
    
    private func isFallbackWord(_ word: WordEntry) -> Bool {
        // Simple check if it's in the static fallback list
        let staticWords = DailyWordsData.getRandomWord(language: currentLanguage, level: currentLevel)
        // This is a weak check, but assuming fallback words are limited. 
        // Better: Check if it exists in downloadedWords.
        return !downloadedWords.contains(where: { $0.word == word.word })
    }

    // MARK: - Legacy / Hybrid Fetch
    
    private func fetchNewWord() {
        // 1. Try to pick random from Local Library
        if !downloadedWords.isEmpty {
            self.currentWord = downloadedWords.randomElement()
        } 
        // 2. Fallback to Static Data
        else {
             self.currentWord = DailyWordsData.getRandomWord(language: currentLanguage, level: currentLevel)
        }
        
        // 3. Trigger background update if library is small
        if downloadedWords.count < 10 {
            checkForUpdates()
        }
    }
    
    private func loadPreferences() {
        // ... (existing implementation) ...
        // Normalize
        // ...
        
        // Load Level
        let savedLevel = UserDefaults.standard.string(forKey: "daily_word_level_\(currentLanguage.rawValue)")
        self.currentLevel = savedLevel ?? currentLanguage.defaultLevel
        
        loadLibrary() // Load library before fetching
        fetchNewWord()
        
        // Startup check
        checkForUpdates()
    }
}
