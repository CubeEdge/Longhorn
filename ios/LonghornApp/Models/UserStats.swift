import Foundation

struct UserStats: Codable {
    let uploadCount: Int
    let storageUsed: Int
    let starredCount: Int
    let shareCount: Int
    let lastLogin: String
    let accountCreated: String
    let username: String
    let role: String
    
    /// Placeholder for skeleton loading state
    static var placeholder: UserStats {
        UserStats(uploadCount: 0, storageUsed: 0, starredCount: 0, shareCount: 0, lastLogin: "", accountCreated: "", username: "", role: "")
    }
}
