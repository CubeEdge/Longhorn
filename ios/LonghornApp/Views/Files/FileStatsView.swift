//
//  FileStatsView.swift
//  LonghornApp
//
//  Compatibility shim for FileStatsView (migrated to FileDetailSheet)
//

import SwiftUI

struct FileStatsView: View {
    let file: FileItem
    var onDismiss: () -> Void = {}
    
    var body: some View {
        FileDetailSheet(file: file)
    }
}
