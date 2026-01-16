import SwiftUI

struct DailyWordCompactCard: View {
    @ObservedObject var service: DailyWordService
    @Binding var showSheet: Bool
    
    var body: some View {
        Button(action: {
            showSheet = true
        }) {
            HStack(spacing: 12) {
                // Icon / Flag
                ZStack {
                    Circle()
                        .fill(Color.blue.opacity(0.1))
                        .frame(width: 44, height: 44)
                    Text(service.currentLanguage.flag)
                        .font(.title2)
                }
                
                // Content
                VStack(alignment: .leading, spacing: 2) {
                    Text("daily_word.title")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    if let word = service.currentWord {
                        Text(word.word)
                            .font(.headline)
                            .foregroundColor(.primary)
                    } else if service.isLoading {
                        Text("Loading...")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    } else {
                        Text("daily_word.title") // Fallback or "Start"
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                // Action
                Button(action: {
                    service.speak()
                }) {
                    Image(systemName: "speaker.wave.2.circle.fill")
                        .font(.title2)
                        .foregroundColor(.blue)
                }
                .padding(.trailing, 8)
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.tertiaryLabel)
            }
            .padding(12)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(12)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

extension Color {
    static var tertiaryLabel: Color {
        Color(UIColor.tertiaryLabel)
    }
}
