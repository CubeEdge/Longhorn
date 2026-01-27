import SwiftUI

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
                                
                                if let meaning = word.meaning {
                                    Text(meaning)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .lineLimit(1)
                                }
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
