import SwiftUI

struct MoreTabRootView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var store = DashboardStore.shared
    
    @State private var showError = false
    @State private var errorMessage = ""
    
    var body: some View {
        NavigationView {
            List {
                // Section 1: Dashboard
                Section(header: Text("more.dashboard")) {
                    // Department Dashboard Entry (Hidden for Admin, Visible for others)
                    if authManager.currentUser?.isAdmin == false {
                        if let stats = store.deptStats {
                            NavigationLink(destination: DetailStatsView(title: String(localized: "more.dept_overview"), stats: UserStats(uploadCount: stats.fileCount, storageUsed: Int(stats.storageUsed), starredCount: 0, shareCount: stats.memberCount, lastLogin: "N/A", accountCreated: "N/A", username: stats.departmentName ?? "Department", role: "lead"))) {
                                VStack(alignment: .leading, spacing: 10) {
                                    HStack {
                                        Image(systemName: "chart.bar.xaxis")
                                            .foregroundColor(.blue)
                                        Text("more.dept_overview")
                                            .font(.headline)
                                        Spacer()
                                        Text("stats.details")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    
                                    HStack {
                                        StatItem(title: String(localized: "stats.files"), value: "\(stats.fileCount)", icon: "doc.fill", color: .blue)
                                        Divider()
                                        StatItem(title: String(localized: "stats.storage"), value: ByteCountFormatter.string(fromByteCount: stats.storageUsed, countStyle: .file), icon: "externaldrive.fill", color: .orange)
                                        Divider()
                                        StatItem(title: String(localized: "stats.members"), value: "\(stats.memberCount)", icon: "person.2.fill", color: .green)
                                    }
                                }
                                .padding(.vertical, 8)
                            }
                        } else if store.deptStatsLoading {
                            ProgressView(String(localized: "browser.loading"))
                        } else {
                            Text("error.dept_load_fail")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    // System Dashboard (Visible for Admin)
                    if authManager.currentUser?.isAdmin == true {
                        NavigationLink(destination: SystemDashboardView(stats: store.systemStats ?? SystemStats.placeholder)) {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Image(systemName: "server.rack")
                                        .foregroundColor(.purple)
                                    Text("more.system_overview")
                                        .font(.headline)
                                    Spacer()
                                    Text("stats.details")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                HStack {
                                    StatItem(title: String(localized: "stats.files"), value: store.systemStats.map { "\($0.totalFiles)" } ?? "—", icon: "doc.on.doc.fill", color: .purple)
                                    Divider()
                                    StatItem(title: String(localized: "stats.storage"), value: store.systemStats.map { ByteCountFormatter.string(fromByteCount: $0.storage.used, countStyle: .file) } ?? "—", icon: "xmark.bin.fill", color: .red)
                                    Divider()
                                    StatItem(title: String(localized: "stats.today_files"), value: store.systemStats.map { "\($0.todayStats.count)" } ?? "—", icon: "doc.badge.plus", color: .blue)
                                }
                            }
                            .padding(.vertical, 8)
                        }
                        .disabled(store.systemStats == nil && !showError)
                        
                        // Error overlay (only show if there's an error)
                        if showError {
                            Button(action: {
                                Task { await loadStats() }
                            }) {
                                HStack {
                                    Image(systemName: "exclamationmark.triangle")
                                        .foregroundColor(.orange)
                                    Text(errorMessage)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Spacer()
                                    Text("action.retry")
                                        .font(.caption)
                                        .foregroundColor(.blue)
                                }
                            }
                        }
                    }
                }
                
                // Section 2: Management (Visible to Admin/Lead)
                if authManager.currentUser?.isAdmin == true || authManager.currentUser?.isLead == true {
                    Section(header: Text("more.management")) {
                        NavigationLink(destination: TeamManagementView()) {
                            Label("more.team_management", systemImage: "person.2.circle")
                        }
                    }
                }
                
                // Section 3: Utilities
                Section(header: Text("more.tools")) {
                    NavigationLink(destination: SettingsView()) { // Assuming SettingsView handles Language
                        Label("settings.title", systemImage: "gear")
                    }
                    
                    NavigationLink(destination: RecycleBinListView()) {
                        Label("quick.recycle_bin", systemImage: "trash")
                    }
                }
                
                // Section 4: Account
                Section {
                    Button(role: .destructive, action: {
                        authManager.logout()
                    }) {
                        Label("more.logout", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }
            }
            .listStyle(InsetGroupedListStyle())
            .navigationTitle(Text("tab.more"))
            .task {
                await loadStats()
            }
            .refreshable {
                await loadStats()
            }
        }
    }

    private func loadStats() async {
        showError = false
        if authManager.currentUser?.isAdmin == true {
            await store.loadSystemStatsIfNeeded()
        } else {
            await store.loadDeptStatsIfNeeded()
        }
    }
}

struct SystemDashboardView: View {
    let stats: SystemStats
    
    var body: some View {
        List {
            Section(header: Text("核心指标")) {
                DetailStatRow(title: "总文件数", value: "\(stats.totalFiles)", icon: "doc.on.doc.fill", color: .purple)
                DetailStatRow(title: "已用存储", value: ByteCountFormatter.string(fromByteCount: stats.storage.used, countStyle: .file), icon: "xmark.bin.fill", color: .red)
                DetailStatRow(title: "存储总量的", value: "\(stats.storage.percentage)%", icon: "chart.pie.fill", color: .blue)
                DetailStatRow(title: "今日上传", value: "\(stats.todayStats.count)", icon: "arrow.up.circle", color: .green)
            }
            
            Section(header: Text("存储分析")) {
                NavigationLink(destination: Text("Coming Soon: Storage Chart")) {
                    Label("查看存储趋势", systemImage: "chart.xyaxis.line")
                }
            }
        }
        .navigationTitle("系统仪表盘")
        .listStyle(InsetGroupedListStyle())
    }
}
