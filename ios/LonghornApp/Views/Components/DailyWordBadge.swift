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
                
                // Index Counter in Badge (Optional, but consistent with web)
                if !service.batchWords.isEmpty {
                    Text("\(service.currentIndex + 1)/\(service.batchWords.count)")
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                }
                
                Text(service.currentLanguage.flag)
                    .font(.system(size: 10))
                
                // Phase 8: Context Topic Badge
                if let topic = service.currentWord?.topic {
                    Text(topic.uppercased())
                        .font(.system(size: 9, weight: .bold))
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(Color.blue.opacity(0.2))
                        .foregroundColor(.blue)
                        .cornerRadius(4)
                }
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
    @State private var showList = false
    
    var availableLevels: [String] {
        service.currentLanguage.availableLevels
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                background
                
                VStack(spacing: 0) {
                    // Toolbar
                    HStack {
                        leadingToolbar
                        Spacer()
                        trailingToolbar
                    }
                    .padding(.horizontal)
                    .padding(.top, 16)
                    .padding(.bottom, 8)
                    
                    if service.batchWords.isEmpty {
                        emptyView
                    } else if service.currentWord != nil {
                        // SWIPEABLE CONTENT
                        TabView(selection: $service.currentIndex) {
                            ForEach(Array(service.batchWords.enumerated()), id: \.element.id) { index, word in
                                wordContentView(word)
                                    .tag(index)
                                    .padding(.horizontal)
                            }
                        }
                        .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                        
                        // Bottom Handle for List
                        Button(action: { showList = true }) {
                            VStack(spacing: 4) {
                                Capsule()
                                    .fill(Color.secondary.opacity(0.3))
                                    .frame(width: 36, height: 5)
                                    .padding(.top, 8)
                                    
                                Text("\(service.currentIndex + 1) / \(service.batchWords.count)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                                    .padding(.bottom, 8)
                            }
                            .frame(maxWidth: .infinity)
                            .background(Color.white.opacity(0.01)) // Hit area
                        }
                    } else {
                        loadingView
                    }
                }
            }
            .navigationTitle(Text("daily_word.title"))
            .navigationBarHidden(true) // Custom toolbar used
            .sheet(isPresented: $showList) {
                if #available(iOS 16.0, *) {
                    DailyWordListView(isPresented: $showList)
                        .presentationDetents([.medium, .large])
                } else {
                    DailyWordListView(isPresented: $showList)
                }
            }
        }
    }
    
    // MARK: - Subviews
    
    private var background: some View {
        LinearGradient(gradient: Gradient(colors: [Color.blue.opacity(0.1), Color.purple.opacity(0.05)]), startPoint: .topLeading, endPoint: .bottomTrailing)
            .ignoresSafeArea()
    }
    
    @ViewBuilder
    private var mainContent: some View {
        if let word = service.currentWord {
            wordContentView(word)
        } else if service.isUpdating {
            loadingView
        } else {
            emptyView
        }
    }
    
    private func wordContentView(_ word: WordEntry) -> some View {
        VStack(spacing: 16) {
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
                        service.speak(text: word.word)
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
            .frame(minHeight: 120, alignment: .top)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(16)
            
            // Examples Card
            VStack(alignment: .leading, spacing: 16) {
                Label("daily_word.examples", systemImage: "text.quote")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                if !word.examples.isEmpty {
                    ForEach(word.examples.prefix(2)) { example in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(alignment: .top, spacing: 8) {
                                Text("•")
                                    .foregroundColor(.blue)
                                    .font(.headline)
                                
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack(alignment: .top, spacing: 6) {
                                        Text(example.sentence)
                                            .font(.system(.body, design: .serif))
                                            .fontWeight(.medium)
                                            .fixedSize(horizontal: false, vertical: true)
                                            .foregroundColor(.primary)
                                            .frame(maxWidth: .infinity, alignment: .leading)
                                            
                                        Button(action: {
                                            service.speak(text: example.sentence)
                                        }) {
                                            Image(systemName: "speaker.wave.2.circle.fill")
                                                .foregroundColor(.blue.opacity(0.8))
                                                .font(.system(size: 22))
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                        .offset(y: -2)
                                    }
                                    
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
            .frame(minHeight: 160, alignment: .top)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(16)
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Fetching new batch...")
                .foregroundColor(.secondary)
        }
        .frame(minHeight: 300)
    }
    
    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "book.closed")
                .font(.system(size: 40))
                .foregroundColor(.secondary)
            Text("No words in batch.")
                .foregroundColor(.secondary)
            Button("Get Words") {
                service.forceRefresh()
            }
            .padding()
            .background(Color.blue)
            .foregroundColor(.white)
            .cornerRadius(8)
        }
        .frame(minHeight: 300)
    }
    

    
    private var leadingToolbar: some View {
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
    
    private var trailingToolbar: some View {
        // Options Menu (Level, Refresh & Close)
        Menu {
            Section {
                Button(action: {
                    let generator = UIImpactFeedbackGenerator(style: .medium)
                    generator.impactOccurred()
                    service.forceRefresh()
                }) {
                    Label("New Batch (Refresh)", systemImage: "arrow.triangle.2.circlepath")
                }
                
                Button(action: {
                    service.clearCache()
                    dismiss()
                }) {
                    Label("Clear Cache", systemImage: "trash")
                }
            }
            
            if availableLevels.count > 1 {
                Section("Level") {
                    ForEach(availableLevels, id: \.self) { level in
                        Button(action: {
                            service.setLevel(level)
                        }) {
                            if service.currentLevel == level {
                                Label(level, systemImage: "checkmark")
                            } else {
                                Text(level)
                            }
                        }
                    }
                }
            }
            
            Section {
                Button(role: .destructive, action: { dismiss() }) {
                    Label("Close", systemImage: "xmark")
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.body)
                .foregroundColor(.primary)
                .padding(8)
                .background(Color(UIColor.tertiarySystemFill))
                .clipShape(Circle())
        }
    }
    }

struct DailyWordListView: View {
    @ObservedObject var service = DailyWordService.shared
    @Binding var isPresented: Bool
    
    var body: some View {
        NavigationView {
            List {
                ForEach(Array(service.batchWords.enumerated()), id: \.element.id) { index, word in
                    Button(action: {
                        service.currentIndex = index
                        isPresented = false
                    }) {
                        HStack {
                            Text("\(index + 1).")
                                .font(.caption)
                                .foregroundColor(.secondary)
                                .frame(width: 30, alignment: .leading)
                            
                            VStack(alignment: .leading) {
                                Text(word.word)
                                    .font(.headline)
                                    .foregroundColor(.primary)
                                
                                Text(word.meaning)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .lineLimit(1)
                            }
                            
                            Spacer()
                            
                            if index == service.currentIndex {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.blue)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .navigationTitle(localizedTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { isPresented = false }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.gray)
                    }
                }
            }
        }
    }
    
    private var localizedTitle:String {
        let lang = service.currentLanguage.rawValue.uppercased()
        return "Playlist (\(lang))"
    }
}
