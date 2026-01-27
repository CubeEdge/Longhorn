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
    nonisolated func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        // Move file on background thread
        do {
            let safeTempURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try FileManager.default.moveItem(at: location, to: safeTempURL)
            
            Task { @MainActor in
                self.continuation?.resume(returning: safeTempURL)
                self.continuation = nil
            }
        } catch {
            let err = error
            Task { @MainActor in
                self.continuation?.resume(throwing: err)
                self.continuation = nil
            }
        }
    }
    
    nonisolated func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
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
    
    nonisolated func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            Task { @MainActor in
                if let continuation = self.continuation {
                    continuation.resume(throwing: error)
                    self.continuation = nil
                }
            }
        }
    }
}
