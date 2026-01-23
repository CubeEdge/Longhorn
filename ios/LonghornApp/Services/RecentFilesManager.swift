import Foundation

// MARK: - 最近打开时间区间

enum RecentPeriod: String, CaseIterable, Identifiable {
    case today = "today"
    case week = "week"
    case twoWeeks = "twoWeeks"
    case month = "month"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .today: return String(localized: "recent.period.today")
        case .week: return String(localized: "recent.period.week")
        case .twoWeeks: return String(localized: "recent.period.two_weeks")
        case .month: return String(localized: "recent.period.month")
        }
    }
    
    var days: Int {
        switch self {
        case .today: return 1
        case .week: return 7
        case .twoWeeks: return 14
        case .month: return 30
        }
    }
}

// MARK: - 最近打开管理器

class RecentFilesManager: ObservableObject {
    static let shared = RecentFilesManager()
    
    @Published var recentFiles: [RecentFileEntry] = []
    @Published var period: RecentPeriod {
        didSet {
            UserDefaults.standard.set(period.rawValue, forKey: periodKey)
        }
    }
    
    private let maxRecents = 100 // 存储更多记录，按时间过滤显示
    private let key = "recentFilesV2"
    private let periodKey = "recentPeriod"
    
    private init() {
        // 加载用户设置的时间区间
        if let savedPeriod = UserDefaults.standard.string(forKey: periodKey),
           let period = RecentPeriod(rawValue: savedPeriod) {
            self.period = period
        } else {
            self.period = .month // 默认30天
        }
        loadRecents()
    }
    
    /// 过滤后的最近文件列表（按时间区间）
    var filteredFiles: [FileItem] {
        let cutoffDate = Calendar.current.date(byAdding: .day, value: -period.days, to: Date()) ?? Date()
        return recentFiles
            .filter { $0.accessDate >= cutoffDate }
            .map { $0.file }
    }
    
    func add(_ file: FileItem) {
        // 移除已存在的记录（更新时间）
        recentFiles.removeAll { $0.file.id == file.id }
        
        // 添加到最前面
        let entry = RecentFileEntry(file: file, accessDate: Date())
        recentFiles.insert(entry, at: 0)
        
        // 裁剪超出限制的记录
        if recentFiles.count > maxRecents {
            recentFiles = Array(recentFiles.prefix(maxRecents))
        }
        
        saveRecents()
    }
    
    private func saveRecents() {
        if let encoded = try? JSONEncoder().encode(recentFiles) {
            UserDefaults.standard.set(encoded, forKey: key)
        }
    }
    
    private func loadRecents() {
        // 尝试加载新格式
        if let data = UserDefaults.standard.data(forKey: key) {
            do {
                recentFiles = try JSONDecoder().decode([RecentFileEntry].self, from: data)
                return
            } catch {
                print("[RecentFiles] Failed to decode v2 format: \(error)")
            }
        }
        
        // 尝试迁移旧格式
        if let oldData = UserDefaults.standard.data(forKey: "recentFiles") {
            do {
                let oldFiles = try JSONDecoder().decode([FileItem].self, from: oldData)
                // 迁移为新格式，使用当前时间作为访问时间
                recentFiles = oldFiles.map { RecentFileEntry(file: $0, accessDate: Date()) }
                saveRecents()
                // 清理旧数据
                UserDefaults.standard.removeObject(forKey: "recentFiles")
                print("[RecentFiles] Migrated \(oldFiles.count) files from old format")
            } catch {
                print("[RecentFiles] Failed to migrate old format: \(error)")
            }
        }
    }
}

// MARK: - 最近文件记录

struct RecentFileEntry: Codable, Identifiable {
    let file: FileItem
    let accessDate: Date
    
    var id: String { file.id }
}
