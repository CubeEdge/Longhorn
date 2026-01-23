import Foundation

@MainActor
class FileDownloader: NSObject, ObservableObject {
    @Published var progress: Double = 0.0
    @Published var downloadedBytes: Int64 = 0
    @Published var totalBytes: Int64 = 0
    @Published var speed: Double = 0.0  // bytes per second
    
    private var continuation: CheckedContinuation<URL, Error>?
    private var downloadTask: URLSessionDownloadTask?
    private var lastUpdateTime: Date = Date()
    private var lastBytesWritten: Int64 = 0
    
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.default
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()
    
    func downloadFile(from url: URL) async throws -> URL {
        // Reset state
        self.progress = 0.0
        self.downloadedBytes = 0
        self.totalBytes = 0
        self.speed = 0.0
        self.lastUpdateTime = Date()
        self.lastBytesWritten = 0
        
        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let task = session.downloadTask(with: url)
            self.downloadTask = task
            task.resume()
        }
    }
    
    func cancel() {
        downloadTask?.cancel()
        continuation?.resume(throwing: URLError(.cancelled))
        continuation = nil
    }
}

extension FileDownloader: URLSessionDownloadDelegate {
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let continuation = self.continuation else { return }
        
        do {
            // Move the downloaded file to the temp path we want, or just return the location?
            // The method signature implies we want to move it.
            // Actually, let's just return the temporary location and let the caller handle the move,
            // or better, let's keep the signature simple and return the location.
            // But wait, `didFinishDownloadingTo` gives a temporary location that is deleted after this method returns.
            // So we MUST move it here.
            
            // However, our `downloadFile` function doesn't know where to move it to unless we stored `destinationURL` in the class.
            // To keep it clean, let's store the target destination in a property or map.
            // For this simple single-use instance, let's modify the class to store `destinationURL`.
            // BUT, `downloadFile` is async.
            
            // Let's change the design slightly:
            // The `downloadFile` takes a destination. We store it? 
            // Or simpler: We don't implement `downloadFile(to:)` but `downloadFile() -> URL`.
            // And we move it in the delegate? No.
            // We move it in the delegate to a safe temp spot, then return that spot.
            
            let safeTempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try FileManager.default.moveItem(at: location, to: safeTempURL)
            continuation.resume(returning: safeTempURL)
            self.continuation = nil
            
        } catch {
            continuation.resume(throwing: error)
            self.continuation = nil
        }
    }
    
    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        Task { @MainActor in
            self.downloadedBytes = totalBytesWritten
            self.totalBytes = totalBytesExpectedToWrite
            
            if totalBytesExpectedToWrite > 0 {
                self.progress = Double(totalBytesWritten) / Double(totalBytesExpectedToWrite)
            }
            
            // Calculate speed
            let now = Date()
            let elapsed = now.timeIntervalSince(self.lastUpdateTime)
            if elapsed >= 0.5 {  // Update speed every 0.5 seconds
                let bytesChange = totalBytesWritten - self.lastBytesWritten
                self.speed = Double(bytesChange) / elapsed
                self.lastUpdateTime = now
                self.lastBytesWritten = totalBytesWritten
            }
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error, let continuation = self.continuation {
            continuation.resume(throwing: error)
            self.continuation = nil
        }
    }
}
