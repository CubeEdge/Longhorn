import SwiftUI

struct BrowseView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var navManager: NavigationManager
    @StateObject private var dailyWordService = DailyWordService.shared
    @StateObject private var recentManager = RecentFilesManager.shared
    
    @State private var navPath = NavigationPath()
    
    // Departments (Hardcoded for now as per MainTabView logic)
    private let departments = [
        Department(id: 1, name: "MS"),
        Department(id: 2, name: "OP"),
        Department(id: 3, name: "RD"),
        Department(id: 4, name: "RE")
    ]
    
    @State private var showWordSheet = false
    @State private var authorizedLocations: [AuthorizedLocation] = []
    
    // Computed property to filter departments based on user role
    private var filteredDepartments: [Department] {
        guard let user = authManager.currentUser else { return [] }
        
        // Admin sees all departments
        if user.isAdmin {
            return departments
        }
        
        // Others see only their department
        if let userDeptName = user.departmentName {
             // Create a dummy Dept to parse the user's dept Code
            let userDept = Department(id: 0, name: userDeptName)
            return departments.filter { $0.code == userDept.code }
        }
        
        return []
    }
    
    var body: some View {
        NavigationStack(path: $navPath) {
            List {
                // MARK: - Search
                Section {
                    NavigationLink(destination: GlobalSearchView()) {
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.secondary)
                            Text("browse.search")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                
                // MARK: - Locations (Departments)
                Section(header: Text("browse.locations")) {
                    ForEach(filteredDepartments) { dept in
                        NavigationLink(destination: 
                            DepartmentFileBrowserWrapper(department: dept)
                        ) {
                            HStack {
                                Image(systemName: dept.iconName) // Dynamic icon
                                    .foregroundColor(.blue)
                                .foregroundColor(.blue)
                                Text(dept.displayName)
                                    .foregroundColor(.primary)
                            }
                        }
                    }
                    
                    // Authorized Folders (Special Permissions)
                    ForEach(authorizedLocations) { loc in
                        NavigationLink(destination: FileBrowserView(path: loc.folderPath)) {
                            HStack {
                                Image(systemName: "folder.badge.person.crop")
                                    .foregroundColor(.orange)
                                VStack(alignment: .leading) {
                                    Text(loc.displayName)
                                        .foregroundColor(.primary)
                                    if loc.displayName != loc.folderPath {
                                        Text(loc.folderPath)
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
                
                // MARK: - Library
                Section(header: Text("browse.library")) {
                    NavigationLink(destination: SharesListView()) {
                        Label("quick.my_shares", systemImage: "square.and.arrow.up")
                    }
                    
                    NavigationLink(destination: StarredView()) {
                        Label("quick.starred", systemImage: "star.fill")
                    }
                    
                    NavigationLink(destination: RecentFilesListView()) {
                        Label("home.recent", systemImage: "clock")
                    }
                }
                
                // MARK: - Daily Word
                Section {
                    DailyWordCompactCard(service: dailyWordService, showSheet: $showWordSheet)
                }
            }
            .listStyle(InsetGroupedListStyle())
            .navigationTitle(Text("tab.browse"))
            .navigationDestination(for: String.self) { path in
                FileBrowserView(path: path)
            }
            .sheet(isPresented: $showWordSheet) {
                DailyWordSheet(service: dailyWordService)
            }
            .onAppear {
                if dailyWordService.currentWord == nil {
                    dailyWordService.nextWord() 
                }
                
                // Fetch authorized locations
                Task {
                    do {
                        authorizedLocations = try await FileService.shared.fetchMyPermissions()
                    } catch {
                        print("Failed to fetch permissions: \(error)")
                    }
                }
            }
            .onChange(of: navManager.jumpToPath) { _, newPath in
                if let path = newPath {
                    print("[Navigation] Jumping to path: \(path)")
                    navPath.append(path)
                    navManager.jumpToPath = nil // Consume event
                }
            }
        }
    }
}
 
// Wrapper to handle navigation to department files
struct DepartmentFileBrowserWrapper: View {
    let department: Department
    
    var body: some View {
        FileBrowserView(
            path: department.code, // Assuming root path is the code
            searchScope: .department(department.code)
        )
        .navigationTitle(department.displayName)
    }
}

struct RecentFileCell: View {
    let file: FileItem
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white)
                    .shadow(color: .black.opacity(0.1), radius: 3)
                    .frame(width: 100, height: 100)
                
                Image(systemName: file.systemIconName)
                    .font(.largeTitle)
                    .foregroundColor(Color(file.iconColorName))
            }
            
            Text(file.name)
                .font(.caption)
                .lineLimit(2)
                .frame(width: 100, alignment: .leading)
        }
    }
}

// Temporary Color Extension for Icon Colors if not defined
extension Color {
    init(_ name: String) {
        // Fallback or use asset catalog
        // Assuming asset names match or using system colors
        switch name {
        case "folderBlue": self = .blue
        case "imageGreen": self = .green
        case "videoPurple": self = .purple
        case "audioOrange": self = .orange
        default: self = .gray
        }
    }
}

