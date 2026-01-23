import Foundation

enum DailyWordLanguage: String, Codable, CaseIterable {
    case de = "de"
    case ja = "ja"
    case en = "en"
    case zh = "zh"
    
    var flag: String {
        switch self {
        case .de: return "🇩🇪"
        case .ja: return "🇯🇵"
        case .en: return "🇺🇸"
        case .zh: return "📚"
        }
    }
    
    var speechCode: String {
        switch self {
        case .de: return "de-DE"
        case .ja: return "ja-JP"
        case .en: return "en-US"
        case .zh: return "zh-CN"
        }
    }
    
    var defaultLevel: String {
        switch self {
        case .de: return "A1"
        case .ja: return "N5"
        case .en: return "Advanced"
        case .zh: return "Idioms"
        }
    }
    
    var availableLevels: [String] {
        switch self {
        case .de: return ["A1", "A2", "B1"]
        case .ja: return ["N5", "N4", "N3"]
        case .en: return ["Advanced"]
        case .zh: return ["Idioms"]
        }
    }
}

struct WordExample: Codable, Identifiable {
    var id: String { sentence } // derived identity
    let sentence: String
    let translation: String
}

struct WordEntry: Codable, Identifiable {
    let id: Int
    let word: String
    let phonetic: String?
    let meaning: String
    let meaningZh: String
    let partOfSpeech: String?
    let examples: [WordExample]
    let image: String?
    let level: String?
    
    // Fallback decoding for flexibility
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decodeIfPresent(Int.self, forKey: .id) ?? 0
        self.word = try container.decode(String.self, forKey: .word)
        self.phonetic = try container.decodeIfPresent(String.self, forKey: .phonetic)
        self.meaning = try container.decode(String.self, forKey: .meaning)
        self.meaningZh = try container.decode(String.self, forKey: .meaningZh)
        self.partOfSpeech = try container.decodeIfPresent(String.self, forKey: .partOfSpeech)
        self.examples = try container.decodeIfPresent([WordExample].self, forKey: .examples) ?? []
        self.image = try container.decodeIfPresent(String.self, forKey: .image)
        self.level = try container.decodeIfPresent(String.self, forKey: .level)
    }
    
    init(id: Int = 0, word: String, phonetic: String?, meaning: String, meaningZh: String, partOfSpeech: String?, examples: [WordExample], image: String?, level: String?) {
        self.id = id
        self.word = word
        self.phonetic = phonetic
        self.meaning = meaning
        self.meaningZh = meaningZh
        self.partOfSpeech = partOfSpeech
        self.examples = examples
        self.image = image
        self.level = level
    }

    // Server returns snake_case
    enum CodingKeys: String, CodingKey {
        case id
        case word
        case phonetic
        case meaning
        case meaningZh = "meaning_zh"
        case partOfSpeech = "part_of_speech"
        case examples
        case image
        case level
    }
}

struct VocabularyResponse: Codable {
    let items: [WordEntry]
    let hasMore: Bool
}
