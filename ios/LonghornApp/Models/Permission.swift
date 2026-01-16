
import Foundation

enum AccessType: String, Codable {
    case read = "Read"
    case contribute = "Contribute"
    case full = "Full"
}

struct Permission: Codable, Identifiable {
    let id: Int
    let userId: Int
    let folderPath: String
    let accessType: AccessType
    let expiresAt: String?
    let createdAt: String?
    
    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case folderPath = "folder_path"
        case accessType = "access_type"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }
}
