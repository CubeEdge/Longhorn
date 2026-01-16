import SwiftUI

struct PersonalSpaceView: View {
    @EnvironmentObject var authManager: AuthManager
    
    var body: some View {
        FileBrowserView(
            path: "Members/\(authManager.currentUser?.username ?? "")",
            searchScope: .personal
        )
        .navigationTitle("个人空间")
    }
}
