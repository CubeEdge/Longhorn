import SwiftUI

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let iconColor: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(iconColor.opacity(0.15))
                    .frame(width: 40, height: 40)
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(iconColor)
            }
            Text(value).font(.system(size: 24, weight: .bold))
            Text(title).font(.system(size: 13)).foregroundColor(.secondary)
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(16)
    }
}
