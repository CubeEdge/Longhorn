import SwiftUI

struct PersonalTabRootView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var store = DashboardStore.shared
    
    var body: some View {
        NavigationView {
            List {
                // MARK: - User Profile Header
                if let user = authManager.currentUser {
                    Section {
                        HStack(spacing: 16) {
                            ZStack {
                                Circle()
                                    .fill(Color(UIColor.systemGray5))
                                    .frame(width: 60, height: 60)
                                Text(user.username.prefix(1).uppercased())
                                    .font(.title2)
                                    .fontWeight(.semibold)
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text(user.username)
                                    .font(.title3)
                                    .fontWeight(.semibold)
                                Text(user.role.rawValue)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(.vertical, 8)
                    }
                }
                
                // MARK: - Personal Space Entry
                Section {
                    NavigationLink(destination: PersonalSpaceView()) {
                        Label {
                            VStack(alignment: .leading) {
                                Text("personal.space")
                                    .font(.headline)
                                Text("personal.my_files")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        } icon: {
                            Image(systemName: "folder.fill")
                                .foregroundColor(.blue)
                                .font(.title2)
                        }
                        .padding(.vertical, 4)
                    }
                }
                
                // MARK: - Core Stats
                Section(header: Text("personal.core_stats")) {
                    NavigationLink(destination: DetailStatsView(title: String(localized: "personal.core_stats"), stats: store.userStats ?? UserStats.placeholder)) {
                        HStack {
                            StatItem(title: String(localized: "stats.upload"), value: store.userStats.map { "\($0.uploadCount)" } ?? "—", icon: "doc.fill", color: .blue)
                            Divider()
                            StatItem(title: String(localized: "stats.storage"), value: store.userStats.map { formatBytes($0.storageUsed) } ?? "—", icon: "externaldrive.fill", color: .orange)
                            Divider()
                            StatItem(title: String(localized: "stats.starred"), value: store.userStats.map { "\($0.starredCount)" } ?? "—", icon: "star.fill", color: .yellow)
                        }
                        .padding(.vertical, 8)
                    }
                    .disabled(store.userStats == nil)
                }
                
                // MARK: - Other Links (Optional)
                Section {
                    NavigationLink(destination: StarredView()) {
                        Label("stats.starred", systemImage: "star.square.fill")
                            .foregroundColor(.primary)
                    }
                    NavigationLink(destination: SharesListView()) {
                        Label("quick.my_shares", systemImage: "link.circle.fill")
                            .foregroundColor(.primary)
                    }
                }
            }
            .navigationTitle(Text("personal.title"))
            .task {
                await store.loadUserStatsIfNeeded()
            }
            .refreshable {
                await store.refreshUserStats()
            }
        }
    }
    
    private func formatBytes(_ bytes: Int) -> String {
        ByteCountFormatter().string(fromByteCount: Int64(bytes))
    }
}

struct StatItem: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(color)
                .font(.title2)
            
            VStack(spacing: 2) {
                Text(value)
                    .font(.headline)
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
    }
}
