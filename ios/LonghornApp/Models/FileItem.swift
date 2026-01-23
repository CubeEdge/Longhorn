//
//  FileItem.swift
//  LonghornApp
//
//  文件/文件夹数据模型
//

import Foundation
import UniformTypeIdentifiers

/// 文件项模型
struct FileItem: Codable, Identifiable, Hashable {
    var name: String
    var path: String
    let isDirectory: Bool
    let size: Int64?
    let modifiedAt: Date?
    let uploaderId: Int?
    let uploaderName: String?
    let isStarred: Bool?
    let accessCount: Int?
    let shareCount: Int?
    let starCount: Int?
    
    // 使用 path 作为唯一标识
    var id: String { path }
    
    init(name: String, path: String, isDirectory: Bool, size: Int64? = nil, modifiedAt: Date? = nil, uploaderId: Int? = nil, uploaderName: String? = nil, isStarred: Bool? = nil, accessCount: Int? = nil, shareCount: Int? = nil, starCount: Int? = nil) {
        self.name = name
        self.path = path
        self.isDirectory = isDirectory
        self.size = size
        self.modifiedAt = modifiedAt
        self.uploaderId = uploaderId
        self.uploaderName = uploaderName
        self.isStarred = isStarred
        self.accessCount = accessCount
        self.shareCount = shareCount
        self.starCount = starCount
    }

    enum CodingKeys: String, CodingKey {
        case name, path, size
        case isDirectory = "isDirectory"
        case modifiedAt = "mtime"
        case uploaderId = "uploader_id"
        case uploaderName = "uploader_name"
        case isStarred = "starred"
        case accessCount = "access_count"
        case shareCount = "share_count"
        case starCount = "star_count"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        path = try container.decode(String.self, forKey: .path)
        isDirectory = try container.decodeIfPresent(Bool.self, forKey: .isDirectory) ?? false
        size = try container.decodeIfPresent(Int64.self, forKey: .size)
        uploaderId = try container.decodeIfPresent(Int.self, forKey: .uploaderId)
        uploaderName = try container.decodeIfPresent(String.self, forKey: .uploaderName)
        isStarred = try container.decodeIfPresent(Bool.self, forKey: .isStarred)
        accessCount = try container.decodeIfPresent(Int.self, forKey: .accessCount)
        shareCount = try container.decodeIfPresent(Int.self, forKey: .shareCount)
        starCount = try container.decodeIfPresent(Int.self, forKey: .starCount)
        
        // 解析日期 - 支持多种格式
        if let mtimeString = try container.decodeIfPresent(String.self, forKey: .modifiedAt) {
            modifiedAt = Self.parseDate(from: mtimeString)
        } else {
            modifiedAt = nil
        }
    }
    
    /// 解析多种日期格式
    private static func parseDate(from string: String) -> Date? {
        // 格式1: ISO8601 带毫秒 (2026-01-11T14:58:00.000Z)
        let iso8601WithMillis = ISO8601DateFormatter()
        iso8601WithMillis.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = iso8601WithMillis.date(from: string) {
            return date
        }
        
        // 格式2: ISO8601 不带毫秒 (2026-01-11T14:58:00Z)
        let iso8601 = ISO8601DateFormatter()
        iso8601.formatOptions = [.withInternetDateTime]
        if let date = iso8601.date(from: string) {
            return date
        }
        
        // 格式3: JavaScript toISOString 格式
        let jsFormatter = DateFormatter()
        jsFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
        jsFormatter.locale = Locale(identifier: "en_US_POSIX")
        if let date = jsFormatter.date(from: string) {
            return date
        }
        
        // 格式4: 简单日期格式
        let simpleFormatter = DateFormatter()
        simpleFormatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        simpleFormatter.locale = Locale(identifier: "en_US_POSIX")
        if let date = simpleFormatter.date(from: string) {
            return date
        }
        
        return nil
    }
    
    /// 文件扩展名
    var fileExtension: String {
        (name as NSString).pathExtension.lowercased()
    }
    
    /// 是否为图片
    var isImage: Bool {
        ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tiff"].contains(fileExtension)
    }
    
    /// 是否为视频
    var isVideo: Bool {
        ["mp4", "mov", "m4v", "avi", "mkv", "wmv", "flv", "webm"].contains(fileExtension)
    }
    
    /// 是否为音频
    var isAudio: Bool {
        ["mp3", "m4a", "wav", "aac", "flac", "ogg", "wma"].contains(fileExtension)
    }
    
    /// 是否为文档
    var isDocument: Bool {
        ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "pages", "numbers", "key"].contains(fileExtension)
    }
    
    /// 格式化文件大小
    var formattedSize: String {
        guard let size = size else { return "" }
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: size)
    }
    
    /// 格式化修改时间
    var formattedDate: String {
        guard let date = modifiedAt else { return "" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
    
    /// 系统图标名称
    var systemIconName: String {
        if isDirectory {
            return "folder.fill"
        }
        if isImage {
            return "photo.fill"
        }
        if isVideo {
            return "film.fill"
        }
        if isAudio {
            return "music.note"
        }
        if isDocument {
            switch fileExtension {
            case "pdf": return "doc.fill"
            case "doc", "docx": return "doc.text.fill"
            case "xls", "xlsx": return "tablecells.fill"
            case "ppt", "pptx": return "doc.richtext.fill"
            default: return "doc.fill"
            }
        }
        return "doc.fill"
    }
    
    /// 图标颜色
    var iconColorName: String {
        if isDirectory {
            return "folderBlue"
        }
        if isImage {
            return "imageGreen"
        }
        if isVideo {
            return "videoPurple"
        }
        if isAudio {
            return "audioOrange"
        }
        return "documentGray"
    }
}

/// 收藏项
/// 收藏项
struct StarredItem: Codable, Identifiable {
    let id: Int
    let filePath: String
    let name: String?
    let path: String?
    let size: Int64?
    let starredAt: String?
    let isDirectory: Bool?
    
    enum CodingKeys: String, CodingKey {
        case id, name, path, size
        case filePath = "file_path"
        case starredAt = "starredAt"
        case isDirectory
    }
    
    /// 获取显示用的文件名
    var displayName: String {
        name ?? (filePath as NSString).lastPathComponent
    }
    
    /// 获取完整路径
    var fullPath: String {
        path ?? filePath
    }
    
    /// 转换为 FileItem 以便使用 FilePreviewView
    func toFileItem() -> FileItem {
        FileItem(
            name: displayName,
            path: fullPath,
            isDirectory: isDirectory ?? false,
            size: size,
            modifiedAt: nil,
            uploaderId: nil,
            uploaderName: nil,
            isStarred: true,
            accessCount: nil,
            shareCount: nil,
            starCount: nil
        )
    }
}

/// 回收站项
struct RecycleBinItem: Codable, Identifiable {
    let id: Int
    let name: String
    let originalPath: String
    let deletedPath: String
    let deletionDate: String
    let userId: Int?
    let deletedBy: String?  // JOIN 返回的用户名
    private let _isDirectory: IntBool  // SQLite 返回 0/1
    
    var isDirectory: Bool { _isDirectory.value }
    
    enum CodingKeys: String, CodingKey {
        case id, name
        case originalPath = "original_path"
        case deletedPath = "deleted_path"
        case deletionDate = "deletion_date"
        case userId = "user_id"
        case deletedBy = "deleted_by"
        case _isDirectory = "is_directory"
    }
}

/// 辅助类型：将 SQLite 的 0/1 转换为 Bool
struct IntBool: Codable {
    let value: Bool
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        // 尝试解码为 Bool
        if let boolValue = try? container.decode(Bool.self) {
            value = boolValue
        // 尝试解码为 Int (0/1)
        } else if let intValue = try? container.decode(Int.self) {
            value = intValue != 0
        } else {
            value = false
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(value)
    }
}
