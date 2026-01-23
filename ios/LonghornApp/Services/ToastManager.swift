
import SwiftUI
import Combine

enum ToastType {
    case success
    case error
    case info
    case warning
    
    var icon: String {
        switch self {
        case .success: return "checkmark.circle.fill"
        case .error: return "exclamationmark.circle.fill"
        case .info: return "info.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        }
    }
    
    var color: Color {
        switch self {
        case .success: return .green
        case .error: return .red
        case .info: return .blue
        case .warning: return .orange
        }
    }
}

struct Toast: Equatable, Identifiable {
    let id = UUID()
    let message: String
    let type: ToastType
    let duration: TimeInterval
}

class ToastManager: ObservableObject {
    static let shared = ToastManager()
    
    @Published var currentToast: Toast?
    
    private init() {}
    
    func show(_ message: String, type: ToastType = .info, duration: TimeInterval = 2.0) {
        Task { @MainActor in
            withAnimation(.snappy(duration: 0.25)) {
                self.currentToast = Toast(message: message, type: type, duration: duration)
            }
            
            // Auto hide
            try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            
            if self.currentToast?.message == message {
                withAnimation(.easeOut(duration: 0.2)) {
                    self.currentToast = nil
                }
            }
        }
    }
}
