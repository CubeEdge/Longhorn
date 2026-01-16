import Foundation

class RecentFilesManager: ObservableObject {
    static let shared = RecentFilesManager()
    
    @Published var recentFiles: [FileItem] = []
    
    private let maxRecents = 10
    private let key = "recentFiles"
    
    private init() {
        loadRecents()
    }
    
    func add(_ file: FileItem) {
        // Remove existing if present (to move to top)
        recentFiles.removeAll { $0.id == file.id }
        
        // Add to front
        recentFiles.insert(file, at: 0)
        
        // Trim
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
        if let data = UserDefaults.standard.data(forKey: key) {
            do {
                recentFiles = try JSONDecoder().decode([FileItem].self, from: data)
            } catch {
                print("Failed to decode Recent Files: \(error). Clearing cache.")
                UserDefaults.standard.removeObject(forKey: key)
                recentFiles = []
            }
        }
    }
}
