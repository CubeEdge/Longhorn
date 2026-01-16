import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var dailyWordService = DailyWordService.shared
    @StateObject private var recentManager = RecentFilesManager.shared
    
    @Binding var selectedTab: MainTabView.Tab
    @Binding var selectedDepartment: Department?
    
    @State private var showWordSheet = false
    @State private var searchText = ""
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // 1. Search Bar Header
                    searchHeader
                    
                    // 2. Recent Files
                    if !recentManager.recentFiles.isEmpty {
                        recentFilesSection
                    }
                    
                    // 3. Quick Actions Grid
                    quickActionsGrid
                    
                    // 4. Daily Word
                    DailyWordHeroCard(service: dailyWordService, showSheet: $showWordSheet)
                    
                    Spacer(minLength: 40)
                }
                .padding()
            }
            .navigationBarHidden(true)
            .sheet(isPresented: $showWordSheet) {
                DailyWordSheet(service: dailyWordService)
            }
            .onAppear {
                if dailyWordService.currentWord == nil {
                    dailyWordService.nextWord() // Silent load
                }
            }
        }
    }
    
    // MARK: - Components
    
    private var searchHeader: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Title
            HStack {
                Text("home.title")
                    .font(.largeTitle.bold())
                Spacer()
                // Avatar
                NavigationLink(destination: SettingsView()) {
                    ZStack {
                        Circle()
                            .fill(Color.blue.opacity(0.1))
                            .frame(width: 40, height: 40)
                        Text(String(authManager.currentUser?.username.prefix(1) ?? "U").uppercased())
                            .font(.headline)
                            .foregroundColor(.blue)
                    }
                }
            }
            
            // Search Bar (Fake, acts as button)
            NavigationLink(destination: GlobalSearchView()) {
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    Text("home.search_placeholder")
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .padding(12)
                .background(Color(UIColor.secondarySystemBackground))
                .cornerRadius(10)
            }
        }
    }
    
    private var recentFilesSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            recentFilesHeader
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(recentManager.recentFiles) { file in
                         FileCard(file: file)
                    }
                }
            }
        }
    }
    
    private var recentFilesHeader: some View {
        HStack {
            Text("home.recent")
                .font(.headline)
            Spacer()
        }
    }
    
    private var quickActionsGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("home.quick_access")
                .font(.headline)
            
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                // My Department (Assuming MyDepartmentView exists or reused logic)
                Button(action: {
                     // Action for department
                     if let userDeptName = authManager.currentUser?.departmentName {
                         // Create a Department object. `code` is computed from `name`.
                         selectedDepartment = Department(id: nil, name: userDeptName) 
                     }
                }) {
                    QuickActionButton(
                        title: String(localized: "quick.my_department"),
                        icon: "building.2.fill",
                        color: .blue
                    )
                }
                
                // My Shares
                NavigationLink(destination: SharesListView()) {
                    QuickActionButton(
                        title: String(localized: "quick.my_shares"),
                        icon: "square.and.arrow.up.fill",
                        color: .green
                    )
                }
                
                // Starred
                NavigationLink(destination: StarredView()) {
                    QuickActionButton(
                        title: String(localized: "quick.starred"),
                        icon: "star.fill",
                        color: .orange
                    )
                }
                
                // Recycle Bin
                NavigationLink(destination: RecycleBinListView()) {
                    QuickActionButton(
                        title: String(localized: "quick.recycle_bin"),
                        icon: "trash.fill",
                        color: .red
                    )
                }
            }
        }
    }
}

// MARK: - Subviews

struct QuickActionButton: View {
    let title: String
    let icon: String
    let color: Color
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
                .frame(width: 30)
            
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundColor(.primary)
            
            Spacer()
        }
        .padding()
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct FileCard: View {
    let file: FileItem
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Icon
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white)
                    .shadow(color: .black.opacity(0.05), radius: 2)
                
                if file.isDirectory {
                    Image(systemName: "folder.fill")
                        .font(.title)
                        .foregroundColor(.blue)
                } else {
                    // Simple icon logic
                    Image(systemName: iconFor(file))
                        .font(.title)
                        .foregroundColor(.secondary)
                }
            }
            .frame(width: 60, height: 60)
            
            Text(file.name)
                .font(.caption)
                .lineLimit(2)
                .frame(maxWidth: 60, alignment: .leading)
        }
        .frame(width: 60)
    }
    
    func iconFor(_ file: FileItem) -> String {
        // Simplified mapping
        if file.name.hasSuffix(".pdf") { return "doc.text.fill" }
        if file.name.hasSuffix(".jpg") || file.name.hasSuffix(".png") { return "photo.fill" }
        return "doc.fill"
    }
}

