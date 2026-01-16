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
}
