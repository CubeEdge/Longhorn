import SwiftUI
import AVFoundation

struct DailyWordBadge: View {
    @StateObject private var service = DailyWordService.shared
    @State private var showSheet = false
    
    // Sync with App Language if needed, but for now independent
    // This allows user to learn a specific language regardless of App UI
    
    var body: some View {
        Button(action: {
            showSheet = true
        }) {
            HStack(spacing: 6) {
                Image(systemName: "book.fill")
                    .font(.system(size: 11))
                
                if service.isLoading && service.currentWord == nil {
                    ProgressView()
                        .scaleEffect(0.7)
                        .frame(maxWidth: 80)
                } else if let word = service.currentWord {
                    Text(word.word)
                        .font(.system(size: 12, weight: .medium))
                        .lineLimit(1)
                        .frame(maxWidth: 80)
                } else {
                    Text("Daily Word")
                        .font(.system(size: 12, weight: .medium))
                }
                
                Text(service.currentLanguage.flag)
                    .font(.system(size: 10))
            }
            .padding(.vertical, 4)
            .padding(.horizontal, 10)
            .background(Color.yellow.opacity(0.15))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.yellow.opacity(0.3), lineWidth: 1)
            )
            .cornerRadius(12)
        }
        .foregroundColor(.primary)
        .sheet(isPresented: $showSheet) {
            DailyWordSheet(service: service)
        }
    }
}

struct DailyWordSheet: View {
    @ObservedObject var service: DailyWordService
    @Environment(\.dismiss) var dismiss
    
    var availableLevels: [String] {
        service.currentLanguage.availableLevels
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                // Background Gradient
                LinearGradient(gradient: Gradient(colors: [Color.blue.opacity(0.1), Color.purple.opacity(0.05)]), startPoint: .topLeading, endPoint: .bottomTrailing)
                    .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        
                        if let word = service.currentWord {
                            // Main Word Card
                            VStack(spacing: 16) {
                                if let emoji = word.image {
                                    Text(emoji)
                                        .font(.system(size: 60))
                                }
                                
                                HStack(spacing: 12) {
                                    Text(word.word)
                                        .font(.system(size: 32, weight: .bold))
                                        .foregroundColor(.primary)
                                    
                                    Button(action: {
                                        service.speak()
                                    }) {
                                        Image(systemName: "speaker.wave.2.fill")
                                            .foregroundColor(.blue)
                                            .padding(10)
                                            .background(Color.blue.opacity(0.1))
                                            .clipShape(Circle())
                                    }
                                }
                                
                                if let phonetic = word.phonetic {
                                    Text(phonetic)
                                        .font(.system(size: 16, weight: .medium))
                                        .foregroundColor(.secondary)
                                        .italic()
                                }
                                
                                if let pos = word.partOfSpeech {
                                    Text(pos)
                                        .font(.caption)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.blue.opacity(0.1))
                                        .foregroundColor(.blue)
                                        .cornerRadius(4)
                                }
                            }
                            .padding(.vertical, 20)
                            
                            // Meaning Card
                            VStack(alignment: .leading, spacing: 12) {
                                Label("daily_word.meaning", systemImage: "book")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                
                                Text(word.meaning)
                                    .font(.body)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                
                                Divider()
                                
                                Text(word.meaningZh)
                                    .font(.body)
                                    .foregroundColor(.blue)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .padding()
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 120, alignment: .top) // Fixed minHeight to prevent jitter
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(16)
                            
                            // Examples Card
                            VStack(alignment: .leading, spacing: 16) {
                                Label("daily_word.examples", systemImage: "text.quote")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                
                                if !word.examples.isEmpty {
                                    ForEach(word.examples) { example in
                                        VStack(alignment: .leading, spacing: 8) {
                                            HStack(alignment: .top, spacing: 8) {
                                                Text("•")
                                                    .foregroundColor(.blue)
                                                    .font(.headline)
                                                
                                                VStack(alignment: .leading, spacing: 4) {
                                                    Text(example.sentence)
                                                        .font(.system(.body, design: .serif))
                                                        .fontWeight(.medium)
                                                        .fixedSize(horizontal: false, vertical: true)
                                                        .foregroundColor(.primary)
                                                        .frame(maxWidth: .infinity, alignment: .leading)
                                                    
                                                    Text(example.translation)
                                                        .font(.footnote)
                                                        .foregroundColor(.secondary)
                                                        .frame(maxWidth: .infinity, alignment: .leading)
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    Text("...") // Placeholder
                                        .foregroundColor(.secondary)
                                        .frame(maxWidth: .infinity, alignment: .center)
                                }
                            }
                            .padding()
                            .frame(maxWidth: .infinity)
                            .frame(minHeight: 160, alignment: .top) // Fixed minHeight for stability
                            .background(Color(UIColor.secondarySystemBackground))
                            .cornerRadius(16)
                        } else {
                            ProgressView()
                        }
                        
                        // Controls
                        VStack(spacing: 20) {
                            // Level Selector
                            if availableLevels.count > 1 {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack {
                                        ForEach(availableLevels, id: \.self) { level in
                                            Button(action: {
                                                service.setLevel(level)
                                            }) {
                                                Text(level)
                                                    .font(.system(size: 14, weight: .medium))
                                                    .padding(.horizontal, 16)
                                                    .padding(.vertical, 8)
                                                    .background(service.currentLevel == level ? Color.blue : Color(UIColor.tertiarySystemFill))
                                                    .foregroundColor(service.currentLevel == level ? .white : .primary)
                                                    .cornerRadius(8)
                                            }
                                        }
                                    }
                                    .padding(.horizontal)
                                }
                            }
                            
                            Button(action: {
                                withAnimation {
                                    service.nextWord()
                                }
                            }) {
                                HStack {
                                    Image(systemName: "arrow.clockwise")
                                    Text("daily_word.next")
                                }
                                .font(.headline)
                                .foregroundColor(.blue)
                                .padding()
                                .frame(maxWidth: .infinity)
                                .background(Color.blue.opacity(0.1))
                                .cornerRadius(12)
                            }
                        }
                        .padding(.top, 10)
                        
                        Spacer(minLength: 40)
                    }
                    .padding()
                }
            }
            .navigationTitle(Text("daily_word.title"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Menu {
                        ForEach(DailyWordLanguage.allCases, id: \.self) { lang in
                            Button(action: {
                                service.setLanguage(lang.rawValue)
                            }) {
                                if service.currentLanguage == lang {
                                    Label(lang.rawValue.uppercased() + " " + lang.flag, systemImage: "checkmark")
                                } else {
                                    Text(lang.rawValue.uppercased() + " " + lang.flag)
                                }
                            }
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(service.currentLanguage.flag)
                            Text(service.currentLanguage.rawValue.uppercased())
                                .font(.caption)
                                .fontWeight(.bold)
                            Image(systemName: "chevron.down")
                                .font(.caption2)
                        }
                        .padding(6)
                        .background(Color(UIColor.tertiarySystemFill))
                        .cornerRadius(8)
                    }
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
            }
        }
    }
}
