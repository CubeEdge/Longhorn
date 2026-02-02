import Foundation
import AVFoundation

class DailyWordService: ObservableObject {
    static let shared = DailyWordService()
    
    @Published var currentWord: WordEntry?
    @Published var currentLanguage: DailyWordLanguage = .en
    @Published var currentLevel: String = "Advanced"
    @Published var isLoading = false
    
    // Batch Management
    @Published private(set) var batchWords: [WordEntry] = []
    @Published var currentIndex: Int = 0 {
        didSet {
            updateCurrentWord()
        }
    }
    
    @Published var isUpdating = false // Loading state for batch
    @Published var updateProgress: Double = 0.0
    
    private let synthesizer = AVSpeechSynthesizer()
    
    // Computed property for UI binding
    var batchSize: Int { batchWords.count }
    var currentProgressDisplay: String {
        guard !batchWords.isEmpty else { return "0/0" }
        return "\(currentIndex + 1)/\(batchWords.count)"
    }
    
    private var libraryKey: String { "longhorn_daily_word_batch_\(currentLanguage.rawValue)" }
    
    private init() {
        loadPreferences()
    }
    
    // MARK: - Actions
    
    func setLanguage(_ lang: String) {
        if let l = DailyWordLanguage(rawValue: lang) {
            self.currentLanguage = l
            UserDefaults.standard.set(lang, forKey: "longhorn_daily_word_language")
            
            let savedLevel = UserDefaults.standard.string(forKey: "daily_word_level_\(l.rawValue)")
            self.currentLevel = savedLevel ?? l.defaultLevel
            
            // Reload batch for the new language
            loadBatch()
            
            // If empty, fetch new batch
            if batchWords.isEmpty {
                startBatchUpdate()
            } else {
                // Reset index to 0 or saved index? Let's reset to 0 for simplicity on lang switch
                currentIndex = 0
                updateCurrentWord()
            }
        }
    }
    
    func setLevel(_ level: String) {
        self.currentLevel = level
        UserDefaults.standard.set(level, forKey: "daily_word_level_\(currentLanguage.rawValue)")
        // Level change requires new batch? Yes.
        startBatchUpdate()
    }
    
    func nextWord() {
        guard !batchWords.isEmpty else { return }
        currentIndex = (currentIndex + 1) % batchWords.count
        updateCurrentWord()
    }
    
    func prevWord() {
        guard !batchWords.isEmpty else { return }
        currentIndex = (currentIndex - 1 + batchWords.count) % batchWords.count
        updateCurrentWord()
    }
    
    func forceRefresh() {
        print("[DailyWord] Force new batch triggered.")
        ToastManager.shared.show("Refreshing vocabulary...", type: .info)
        startBatchUpdate()
    }

    func clearCache() {
        print("[DailyWord] Clearing all cache...")
        let keys = [
            "longhorn_daily_word_language",
            "longhorn_daily_word_batch_en",
            "longhorn_daily_word_batch_de",
            "longhorn_daily_word_batch_ja",
            "longhorn_daily_word_batch_zh",
            "daily_word_level_en",
            "daily_word_level_de",
            "daily_word_level_ja",
            "daily_word_level_zh",
            "longhorn_daily_word_library_en", // Legacy keys
            "longhorn_daily_word_library_de",
            "longhorn_daily_word_library_ja",
            "longhorn_daily_word_library_zh"
        ]
        
        for key in keys {
            UserDefaults.standard.removeObject(forKey: key)
        }
        
        // Reset state to defaults
        self.currentLanguage = .en
        self.currentLevel = "Advanced"
        self.batchWords = []
        self.currentIndex = 0
        self.currentWord = nil
        
        // Reload (will likely trigger empty fetch or waiting state)
        loadBatch()
        ToastManager.shared.show("Vocabulary cache cleared", type: .success)
    }
    
    private func updateCurrentWord() {
        guard !batchWords.isEmpty, batchWords.indices.contains(currentIndex) else {
            currentWord = nil
            return
        }
        currentWord = batchWords[currentIndex]
    }
    
    // MARK: - Batch Logic
    
    // Defines the key for the legacy accumulation-style library
    private var legacyLibraryKey: String { "longhorn_daily_word_library_\(currentLanguage.rawValue)" }
    
    private func loadBatch() {
        // 1. Try to load new Batch format
        if let data = UserDefaults.standard.data(forKey: libraryKey),
           let words = try? JSONDecoder().decode([WordEntry].self, from: data),
           !words.isEmpty {
            self.batchWords = words
            
            // Check if supplement needed
            if batchWords.count < 100 {
                let needed = 100 - batchWords.count
                print("[DailyWord] Batch deficient (\(batchWords.count)/100). Auto-fetching \(needed) more...")
                fetchSupplementalBatch(count: needed)
            }
            return
        }
        
        // 2. If no batch found, try to migrate from Legacy Library
        print("[DailyWord] No batch found. Checking legacy library...")
        if let data = UserDefaults.standard.data(forKey: legacyLibraryKey),
           let legacyWords = try? JSONDecoder().decode([WordEntry].self, from: data),
           !legacyWords.isEmpty {
            
            // Migrate: Take up to 100 recent words
            let migrationCount = min(legacyWords.count, 100)
            let migratedBatch = Array(legacyWords.prefix(migrationCount))
            
            self.batchWords = migratedBatch
            self.saveBatch() // Save to new key
            
            print("[DailyWord] Migrated \(migrationCount) words from legacy library.")
            
            // Auto-fill if migrated count < 100
            if migratedBatch.count < 100 {
                let needed = 100 - migratedBatch.count
                print("[DailyWord] Legacy batch deficient (\(migratedBatch.count)/100). Auto-fetching \(needed) more...")
                fetchSupplementalBatch(count: needed)
            }
            
        } else {
            // 3. Completely empty
            self.batchWords = []
        }
    }
    
    private func saveBatch() {
        if let data = try? JSONEncoder().encode(batchWords) {
            UserDefaults.standard.set(data, forKey: libraryKey)
        }
    }
    
    private func startBatchUpdate() {
        guard !isUpdating else { return }
        isUpdating = true
        updateProgress = 0.1
        
        let countToFetch = 100
        print("[DailyWord] Fetching fresh batch of \(countToFetch) words...")
        
        fetchBatch(count: countToFetch, isAppend: false)
    }
    
    // Fetches additional words to fill up to 100
    private func fetchSupplementalBatch(count: Int) {
        guard !isUpdating else { return }
        isUpdating = true
        updateProgress = 0.1
        
        print("[DailyWord] Supplemental fetch for \(count) words...")
        fetchBatch(count: count, isAppend: true)
    }
    
    private func fetchBatch(count: Int, isAppend: Bool) {
        let lang = currentLanguage.rawValue
        let lvl = currentLevel.prefix(1).uppercased() + currentLevel.dropFirst()
        
        let queryItems = [
            URLQueryItem(name: "language", value: lang),
            URLQueryItem(name: "level", value: lvl),
            URLQueryItem(name: "count", value: String(count))
        ]
        
        Task {
            do {
                let newWords: [WordEntry] = try await APIClient.shared.get("/api/vocabulary/batch", queryItems: queryItems)
                
                await MainActor.run {
                    self.isUpdating = false
                    
                    if isAppend {
                        // Append logic (Supplemental)
                        // Filter duplicates just in case
                        let existingIDs = Set(self.batchWords.map { $0.id })
                        let uniqueNew = newWords.filter { !existingIDs.contains($0.id) }
                        
                        self.batchWords.append(contentsOf: uniqueNew)
                        print("[DailyWord] Appended \(uniqueNew.count) supplemental words.")
                    } else {
                        // Replace logic (Refresh)
                        self.batchWords = newWords
                        self.currentIndex = 0
                        print("[DailyWord] Replaced batch with \(newWords.count) words.")
                        ToastManager.shared.show("Updated \(newWords.count) new words!", type: .success)
                    }
                    
                    self.updateCurrentWord()
                    self.saveBatch()
                    self.updateProgress = 1.0
                }
            } catch {
                print("[DailyWord] Fetch Error: \(error.localizedDescription). Using local fallback.")
                await MainActor.run {
                    self.isUpdating = false
                    
                    // Fallback to local data
                    let localWords = DailyWordsData.getRandomWord(language: currentLanguage, level: currentLevel)
                    var fallbackBatch: [WordEntry] = []
                    
                    // Generate a small batch from local data
                    for _ in 0..<min(count, 10) {
                        let word = DailyWordsData.getRandomWord(language: currentLanguage, level: currentLevel)
                        fallbackBatch.append(word)
                    }
                    
                    if !fallbackBatch.isEmpty {
                        if isAppend {
                            self.batchWords.append(contentsOf: fallbackBatch)
                        } else {
                            self.batchWords = fallbackBatch
                            self.currentIndex = 0
                        }
                        self.updateCurrentWord()
                        self.saveBatch()
                        ToastManager.shared.show("Using offline vocabulary", type: .info)
                    } else {
                        ToastManager.shared.show("Update failed: \(error.localizedDescription)", type: .error)
                    }
                }
            }
        }
    }
    
    // MARK: - Speech
    
    func speak() {
        guard let word = currentWord else { return }
        speak(text: word.word)
    }
    
    func speak(text: String) {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: currentLanguage.speechCode)
        utterance.rate = 0.4
        
        synthesizer.speak(utterance)
    }
    
    // MARK: - Init Logic
    
    private func loadPreferences() {
        if let savedLang = UserDefaults.standard.string(forKey: "longhorn_daily_word_language"),
           let l = DailyWordLanguage(rawValue: savedLang) {
            self.currentLanguage = l
        }
        
        let savedLevel = UserDefaults.standard.string(forKey: "daily_word_level_\(currentLanguage.rawValue)")
        self.currentLevel = savedLevel ?? currentLanguage.defaultLevel
        
        loadBatch()
        
        if batchWords.isEmpty {
            startBatchUpdate()
        } else {
            currentIndex = 0
            updateCurrentWord()
        }
    }
}

