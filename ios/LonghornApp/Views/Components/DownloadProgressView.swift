//
//  DownloadProgressView.swift
//  LonghornApp
//
//  通用下载进度指示器 - 显示已下载/总大小，下载速度
//

import SwiftUI

struct DownloadProgressView: View {
    let downloadedBytes: Int64
    let totalBytes: Int64
    let speed: Double  // bytes per second
    
    private var progress: Double {
        guard totalBytes > 0 else { return 0 }
        return Double(downloadedBytes) / Double(totalBytes)
    }
    
    private var progressText: String {
        let downloaded = formatBytes(downloadedBytes)
        let total = formatBytes(totalBytes)
        return "\(downloaded) / \(total)"
    }
    
    private var speedText: String {
        formatSpeed(speed)
    }
    
    var body: some View {
        VStack(spacing: 12) {
            // 圆形进度圈
            ZStack {
                Circle()
                    .stroke(Color.white.opacity(0.3), lineWidth: 4)
                    .frame(width: 60, height: 60)
                
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(Color.white, style: StrokeStyle(lineWidth: 4, lineCap: .round))
                    .frame(width: 60, height: 60)
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut(duration: 0.3), value: progress)
                
                Text("\(Int(progress * 100))%")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.white)
            }
            
            // 大小信息
            Text(progressText)
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.8))
            
            // 速度信息
            if speed > 0 {
                Text(speedText)
                    .font(.system(size: 11))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
    }
    
    private func formatBytes(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
    
    private func formatSpeed(_ bytesPerSecond: Double) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        let formatted = formatter.string(fromByteCount: Int64(bytesPerSecond))
        return "\(formatted)/s"
    }
}

// MARK: - Preview
#Preview {
    ZStack {
        Color.black
        DownloadProgressView(
            downloadedBytes: 2_500_000,
            totalBytes: 5_000_000,
            speed: 1_200_000
        )
    }
}
