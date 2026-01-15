import Foundation
import AVFoundation

class DailyWordService: ObservableObject {
    static let shared = DailyWordService()
    
    @Published var currentWord: WordEntry?
    @Published var currentLanguage: DailyWordLanguage = .en
    @Published var currentLevel: String = "Advanced"
    @Published var isLoading = false
    
    private let synthesizer = AVSpeechSynthesizer()
    
    // Dynamic Batching
    private var wordQueue: [WordEntry] = []
    private var seenIds: Set<String> = []
    private var currentTask: Task<Void, Never>?
    
    private init() {
        // Load saved preferences
        loadPreferences()
    }
    
    func setLanguage(_ lang: String) {
        if let l = DailyWordLanguage(rawValue: lang) {
            self.currentLanguage = l
            let savedLevel = UserDefaults.standard.string(forKey: "daily_word_level_\(l.rawValue)")
            self.currentLevel = savedLevel ?? l.defaultLevel
            resetAndFetch()
        }
    }
    
    func setLevel(_ level: String) {
        self.currentLevel = level
        UserDefaults.standard.set(level, forKey: "daily_word_level_\(currentLanguage.rawValue)")
        resetAndFetch()
    }
    
    func nextWord() {
        if wordQueue.isEmpty {
            fetchMoreWords()
        } else {
            // Pick next word from queue
            // Since server already shuffled, we can just pop
            currentWord = wordQueue.removeFirst()
            
            // Prefetch if running low
            if wordQueue.count < 5 {
                fetchMoreWords(background: true)
            }
        }
    }
    
    func speak() {
        guard let word = currentWord else { return }
        
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
        
        // Handle custom voice selection if possible, or fallback to default
        let utterance = AVSpeechUtterance(string: word.word)
        utterance.voice = AVSpeechSynthesisVoice(language: currentLanguage.speechCode)
        utterance.rate = 0.4
        
        synthesizer.speak(utterance)
    }
    
    // MARK: - API Logic
    
    private func resetAndFetch() {
        currentTask?.cancel()
        wordQueue.removeAll()
        seenIds.removeAll()
        currentWord = nil
        fetchMoreWords()
    }
    
    private func fetchMoreWords(background: Bool = false) {
        guard !isLoading else { return }
        if !background { isLoading = true }
        
        currentTask = Task {
            do {
                print("Fetching words for \(currentLanguage.rawValue) - \(currentLevel)...")
                
                // Build query
                var queryItems = [
                    URLQueryItem(name: "lang", value: currentLanguage.rawValue),
                    URLQueryItem(name: "level", value: currentLevel),
                    URLQueryItem(name: "limit", value: "50")
                ]
                
                // Exclude seen IDs to avoid repetition in session
                if !seenIds.isEmpty {
                    let idsString = seenIds.joined(separator: ",")
                    // Prevent URL too long error if set is huge, maybe cap it?
                    // For now, let's just send the last 50 seen IDs if it gets too big
                    let truncatedIds = seenIds.count > 50 ? Array(seenIds.suffix(50)) : Array(seenIds)
                     queryItems.append(URLQueryItem(name: "exclude_ids", value: truncatedIds.joined(separator: ",")))
                }
                
                let response: VocabularyResponse = try await APIClient.shared.get("/api/vocabulary", queryItems: queryItems)
                
                DispatchQueue.main.async {
                    self.isLoading = false
                    
                    let newWords = response.items.filter { !self.seenIds.contains($0.id) }
                    
                    if newWords.isEmpty {
                        print("No new words found.")
                        return 
                    }
                    
                    self.wordQueue.append(contentsOf: newWords)
                    newWords.forEach { self.seenIds.insert($0.id) }
                    
                    // If we didn't have a current word, show one immediately
                    if self.currentWord == nil {
                        self.nextWord()
                    }
                }
            } catch {
                print("Error fetching daily words: \(error)")
                DispatchQueue.main.async {
                    self.isLoading = false
                }
            }
        }
    }
    
    private func loadPreferences() {
        // Initial Fetch
         // Ideally sync with App Lang, but logic requires explicit 'setLanguage'
         // We'll set default to EN for now and trigger fetch
        setLanguage("en")
    }
}
