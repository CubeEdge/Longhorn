//
//  ImageCacheService.swift
//  LonghornApp
//
//  内存图片缓存服务 - 用于平滑滚动体验
//

import UIKit

class ImageCacheService {
    static let shared = ImageCacheService()
    
    private let cache = NSCache<NSString, UIImage>()
    
    private init() {
        // Limit memory usage
        cache.countLimit = 200 // Cache up to 200 images
        cache.totalCostLimit = 100 * 1024 * 1024 // 100 MB limit
    }
    
    func image(for key: String) -> UIImage? {
        return cache.object(forKey: key as NSString)
    }
    
    func insertImage(_ image: UIImage, for key: String) {
        cache.setObject(image, forKey: key as NSString)
    }
    
    func removeImage(for key: String) {
        cache.removeObject(forKey: key as NSString)
    }
    
    func clearCache() {
        cache.removeAllObjects()
    }
}
