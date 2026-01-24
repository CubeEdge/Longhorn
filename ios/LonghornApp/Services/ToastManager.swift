
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

enum ToastStyle {
    case standard   // Glassmorphic, subtle
    case prominent  // Solid color, bold, haptic feedback
}

struct Toast: Equatable, Identifiable {
    let id = UUID()
    let message: String
    let type: ToastType
    let style: ToastStyle
    let duration: TimeInterval
}

class ToastManager: ObservableObject {
    static let shared = ToastManager()
    
    @Published var currentToast: Toast?
    
    private init() {}
    
    func show(_ message: String, type: ToastType = .info, style: ToastStyle = .standard, duration: TimeInterval = 2.0) {
        Task { @MainActor in
            // Haptic feedback for prominent toasts
            if style == .prominent {
                let generator = UINotificationFeedbackGenerator()
                switch type {
                case .success: generator.notificationOccurred(.success)
                case .error: generator.notificationOccurred(.error)
                case .warning: generator.notificationOccurred(.warning)
                default: break
                }
            }
            
            withAnimation(.snappy(duration: 0.25)) {
                self.currentToast = Toast(message: message, type: type, style: style, duration: duration)
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
