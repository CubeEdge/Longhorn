
import SwiftUI

struct ToastView: View {
    let toast: Toast
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: toast.type.icon)
                .font(.title3)
                .foregroundColor(toast.style == .prominent ? .white : toast.type.color)
            
            Text(toast.message)
                .font(toast.style == .prominent ? .headline : .subheadline)
                .fontWeight(toast.style == .prominent ? .bold : .medium)
                .foregroundColor(toast.style == .prominent ? .white : .primary)
                .lineLimit(2)
            
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(backgroundView)
        .cornerRadius(25)
        .shadow(color: .black.opacity(0.15), radius: 10, x: 0, y: 5)
        .padding(.horizontal, 24)
        .padding(.bottom, 8) // Lift up slightly
    }
    
    @ViewBuilder
    private var backgroundView: some View {
        if toast.style == .prominent {
            toast.type.color
        } else {
            ZStack {
                Rectangle()
                    .fill(.ultraThinMaterial)
                Rectangle()
                    .fill(Color(UIColor.systemBackground).opacity(0.5))
            }
        }
    }
}

#Preview {
    VStack {
        ToastView(toast: Toast(message: "文件上传成功", type: .success, style: .prominent, duration: 2))
        ToastView(toast: Toast(message: "网络连接失败", type: .error, style: .standard, duration: 2))
    }
    .padding()
    .background(Color.gray)
}
