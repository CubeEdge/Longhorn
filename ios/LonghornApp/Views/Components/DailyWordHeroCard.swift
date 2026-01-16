import SwiftUI

struct DailyWordHeroCard: View {
    @ObservedObject var service: DailyWordService
    @Binding var showSheet: Bool
    
    var body: some View {
        Button(action: {
            showSheet = true
        }) {
            ZStack(alignment: .bottomLeading) {
                // Background with Gradient
                RoundedRectangle(cornerRadius: 24)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [Color(hex: "4A90E2"), Color(hex: "9013FE")]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: Color.purple.opacity(0.3), radius: 15, x: 0, y: 10)
                
                // Decorative Emoji Background
                if let emoji = service.currentWord?.image {
                    GeometryReader { geo in
                        Text(emoji)
                            .font(.system(size: 150))
                            .opacity(0.1)
                            .position(x: geo.size.width - 40, y: 60)
                            .blur(radius: 2)
                    }
                }
                
                // Content
                VStack(alignment: .leading, spacing: 16) {
                    
                    // Header: Language & Refresh
                    HStack {
                        HStack(spacing: 6) {
                            Text(service.currentLanguage.flag)
                            Text(service.currentLanguage.rawValue.uppercased())
                                .font(.caption.bold())
                                .foregroundColor(.white.opacity(0.9))
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Material.thinMaterial)
                        .cornerRadius(20)
                        
                        Spacer()
                        
                        // Next Word Button (Inline)
                        Button(action: {
                            let generator = UIImpactFeedbackGenerator(style: .light)
                            generator.impactOccurred()
                            withAnimation {
                                service.nextWord()
                            }
                        }) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                                .font(.system(size: 16, weight: .medium))
                                .foregroundColor(.white)
                                .padding(8)
                                .background(Material.thinMaterial)
                                .clipShape(Circle())
                        }
                    }
                    
                    Spacer()
                    
                    if service.isLoading && service.currentWord == nil {
                        HStack {
                            Spacer()
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            Spacer()
                        }
                        .padding(.bottom, 30)
                    } else if let word = service.currentWord {
                        // Word & Phonetic
                        VStack(alignment: .leading, spacing: 4) {
                            HStack(alignment: .lastTextBaseline) {
                                Text(word.word)
                                    .font(.system(size: 36, weight: .bold))
                                    .foregroundColor(.white)
                                    .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
                                
                                if let phonetic = word.phonetic {
                                    Text(phonetic)
                                        .font(.system(size: 18, weight: .light))
                                        .foregroundColor(.white.opacity(0.8))
                                }
                            }
                            
                            HStack {
                                Text(word.partOfSpeech ?? "")
                                    .font(.caption)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.white.opacity(0.2))
                                    .cornerRadius(4)
                                    .foregroundColor(.white)
                                
                                Text(word.meaning)
                                    .font(.system(size: 16, weight: .medium))
                                    .foregroundColor(.white.opacity(0.95))
                                    .lineLimit(1)
                            }
                            
                            // Example Sentence (Featured)
                            if let firstExample = word.examples.first {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("“\(firstExample.sentence)”")
                                        .font(.system(size: 15, weight: .medium, design: .serif))
                                        .italic()
                                        .foregroundColor(.white.opacity(0.9))
                                        .lineLimit(2)
                                        .padding(.top, 4)
                                    
                                    Text(firstExample.translation)
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.7))
                                        .lineLimit(1)
                                }
                                .padding(.top, 4)
                            }
                        }
                        
                        // Footer Actions
                        HStack {
                            Spacer()
                            Button(action: {
                                service.speak()
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "speaker.wave.2.fill")
                                    Text("daily_word.listen")
                                }
                                .font(.caption.bold())
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.white.opacity(0.2))
                                .cornerRadius(20)
                            }
                        }
                    } else {
                         Text("daily_word.title")
                            .foregroundColor(.white)
                    }
                }
                .padding(20)
            }
            .frame(height: 240) // Slightly taller to accommodate example
        }
        .buttonStyle(PlainButtonStyle())
    }
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
