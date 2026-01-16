//
//  WebView.swift
//  LonghornApp
//
//  Created by Kine on 2024/6/17.
//

import SwiftUI
import WebKit

struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Allow inline media playback
        config.allowsInlineMediaPlayback = true
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .black // Black background for preview
        webView.scrollView.backgroundColor = .black
        
        // Disable scrolling if we want a static image feel (optional, but Zoom logic usually handled by ScrollView)
        // For standard preview, we usually want to allow zoom.
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
        // Only load if the URL changed to avoid reload
        if uiView.url != url {
            uiView.load(request)
        }
    }
}
