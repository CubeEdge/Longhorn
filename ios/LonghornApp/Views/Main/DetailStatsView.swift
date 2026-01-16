import SwiftUI

struct DetailStatsView: View {
    let title: String
    let stats: UserStats
    
    // In a real app, we might want different view types (personal detail vs department dashboard)
    // For now, we will display generic detailed stats.
    
    var body: some View {
        List {
            Section(header: Text("stats.core_metrics")) {
                DetailStatRow(title: String(localized: "stats.upload"), value: "\(stats.uploadCount)", icon: "doc.fill", color: .blue)
                DetailStatRow(title: String(localized: "stats.storage"), value: formatBytes(stats.storageUsed), icon: "externaldrive.fill", color: .orange)
                 DetailStatRow(title: String(localized: "stats.starred"), value: "\(stats.starredCount)", icon: "star.fill", color: .yellow)
                DetailStatRow(title: String(localized: "personal.share_count"), value: "\(stats.shareCount)", icon: "link", color: .green)
            }
            
            // Placeholder for expanded data
            Section(header: Text("stats.activity_analysis")) {
                NavigationLink(destination: Text("Coming Soon: Activity Chart")) {
                    Label("stats.activity_trend", systemImage: "chart.xyaxis.line")
                }
                NavigationLink(destination: Text("Coming Soon: Contribution")) {
                    Label("stats.contribution", systemImage: "person.3.sequence.fill")
                }
            }
        }
        .navigationTitle(title)
        .listStyle(InsetGroupedListStyle())
    }
    
    private func formatBytes(_ bytes: Int) -> String {
        ByteCountFormatter().string(fromByteCount: Int64(bytes))
    }
}

struct DetailStatRow: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 30)
             Text(title)
                .foregroundColor(.primary)
            Spacer()
            Text(value)
                .foregroundColor(.secondary)
        }
    }
}
