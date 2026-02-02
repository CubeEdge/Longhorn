//
//  IssueCreateView.swift
//  LonghornApp
//
//  创建工单视图
//

import SwiftUI
import PhotosUI

struct IssueCreateView: View {
    let onCreate: (Issue) -> Void
    
    @State private var title = ""
    @State private var description = ""
    @State private var severity: IssueSeverity = .medium
    @State private var category: IssueCategory = .hardware
    @State private var source: IssueSource = .onlineFeedback
    @State private var serialNumber = ""
    @State private var batchNumber = ""
    
    // 产品选择
    @State private var products: [Product] = []
    @State private var selectedProduct: Product?
    @State private var productSearchQuery = ""
    @State private var showingProductPicker = false
    
    // 客户选择
    @State private var customers: [Customer] = []
    @State private var selectedCustomer: Customer?
    @State private var customerSearchQuery = ""
    @State private var showingCustomerPicker = false
    
    // 图片附件
    @State private var selectedPhotos: [PhotosPickerItem] = []
    @State private var photoData: [Data] = []
    
    @State private var isSubmitting = false
    @State private var error: String?
    
    @Environment(\.dismiss) private var dismiss
    
    private let service = IssueService.shared
    
    var body: some View {
        NavigationStack {
            Form {
                // 基本信息
                Section(String(localized: "issues.basicInfo")) {
                    TextField(String(localized: "issues.title"), text: $title)
                    
                    TextField(String(localized: "issues.description"), text: $description, axis: .vertical)
                        .lineLimit(3...6)
                }
                
                // 分类信息
                Section(String(localized: "issues.classification")) {
                    Picker(String(localized: "issues.severity"), selection: $severity) {
                        ForEach(IssueSeverity.allCases, id: \.rawValue) { level in
                            HStack {
                                Circle()
                                    .fill(level.color)
                                    .frame(width: 10, height: 10)
                                Text(level.localizedName)
                            }
                            .tag(level)
                        }
                    }
                    
                    Picker(String(localized: "issues.category"), selection: $category) {
                        ForEach(IssueCategory.allCases, id: \.rawValue) { cat in
                            Label(cat.localizedName, systemImage: cat.iconName)
                                .tag(cat)
                        }
                    }
                    
                    Picker(String(localized: "issues.source"), selection: $source) {
                        ForEach(IssueSource.allCases, id: \.rawValue) { src in
                            Text(src.localizedName)
                                .tag(src)
                        }
                    }
                }
                
                // 产品信息
                Section(String(localized: "issues.productInfo")) {
                    Button {
                        showingProductPicker = true
                    } label: {
                        HStack {
                            Text(String(localized: "issues.product"))
                                .foregroundStyle(.primary)
                            Spacer()
                            Text(selectedProduct?.displayName ?? String(localized: "issues.selectProduct"))
                                .foregroundStyle(selectedProduct == nil ? .secondary : .primary)
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    TextField(String(localized: "issues.serialNumber"), text: $serialNumber)
                    
                    TextField(String(localized: "issues.batchNumber"), text: $batchNumber)
                }
                
                // 客户信息
                Section(String(localized: "issues.customerInfo")) {
                    Button {
                        showingCustomerPicker = true
                    } label: {
                        HStack {
                            Text(String(localized: "issues.customer"))
                                .foregroundStyle(.primary)
                            Spacer()
                            Text(selectedCustomer?.displayName ?? String(localized: "issues.selectCustomer"))
                                .foregroundStyle(selectedCustomer == nil ? .secondary : .primary)
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                
                // 图片附件
                Section {
                    PhotosPicker(selection: $selectedPhotos, maxSelectionCount: 5, matching: .images) {
                        HStack {
                            Label(String(localized: "issues.addPhoto"), systemImage: "photo.badge.plus")
                            Spacer()
                            if !photoData.isEmpty {
                                Text("\(photoData.count)")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onChange(of: selectedPhotos) { _, newItems in
                        Task { await loadPhotos(newItems) }
                    }
                    
                    if !photoData.isEmpty {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(photoData.indices, id: \.self) { index in
                                    if let uiImage = UIImage(data: photoData[index]) {
                                        Image(uiImage: uiImage)
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                            .frame(width: 60, height: 60)
                                            .cornerRadius(8)
                                            .overlay(alignment: .topTrailing) {
                                                Button {
                                                    photoData.remove(at: index)
                                                    if index < selectedPhotos.count {
                                                        selectedPhotos.remove(at: index)
                                                    }
                                                } label: {
                                                    Image(systemName: "xmark.circle.fill")
                                                        .foregroundStyle(.white, .red)
                                                        .font(.caption)
                                                }
                                                .offset(x: 6, y: -6)
                                            }
                                    }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                    }
                } header: {
                    Text(String(localized: "issues.attachments"))
                } footer: {
                    Text(String(localized: "issues.photoHint"))
                }
                
                // 错误提示
                if let error = error {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle(String(localized: "issues.create"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "action.cancel")) {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await submitIssue() }
                    } label: {
                        if isSubmitting {
                            ProgressView()
                        } else {
                            Text(String(localized: "action.submit"))
                        }
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSubmitting)
                }
            }
            .sheet(isPresented: $showingProductPicker) {
                ProductPickerSheet(
                    products: products,
                    selected: $selectedProduct,
                    searchQuery: $productSearchQuery,
                    onSearch: { query in
                        Task { await loadProducts(query) }
                    }
                )
            }
            .sheet(isPresented: $showingCustomerPicker) {
                CustomerPickerSheet(
                    customers: customers,
                    selected: $selectedCustomer,
                    searchQuery: $customerSearchQuery,
                    onSearch: { query in
                        Task { await loadCustomers(query) }
                    }
                )
            }
            .task {
                await loadProducts(nil)
                await loadCustomers(nil)
            }
        }
    }
    
    // MARK: - 方法
    
    private func loadProducts(_ search: String?) async {
        do {
            products = try await service.fetchProducts(search: search)
        } catch {
            // Silently handle
        }
    }
    
    private func loadCustomers(_ search: String?) async {
        do {
            customers = try await service.fetchCustomers(search: search)
        } catch {
            // Silently handle
        }
    }
    
    private func loadPhotos(_ items: [PhotosPickerItem]) async {
        photoData = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self) {
                photoData.append(data)
            }
        }
    }
    
    private func submitIssue() async {
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            error = String(localized: "issues.error.titleRequired")
            return
        }
        
        isSubmitting = true
        error = nil
        
        do {
            let issue = try await service.createIssue(
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                description: description.isEmpty ? nil : description,
                severity: severity,
                category: category,
                source: source,
                productId: selectedProduct?.id,
                customerId: selectedCustomer?.id,
                serialNumber: serialNumber.isEmpty ? nil : serialNumber,
                batchNumber: batchNumber.isEmpty ? nil : batchNumber
            )
            
            // 上传附件图片
            for (index, data) in photoData.enumerated() {
                let fileName = "photo_\(index + 1)_\(Date().timeIntervalSince1970).jpg"
                try await service.uploadAttachment(issueId: issue.id, imageData: data, fileName: fileName)
            }
            
            onCreate(issue)
            dismiss()
            
        } catch {
            self.error = error.localizedDescription
        }
        
        isSubmitting = false
    }
}

// MARK: - 产品选择器

struct ProductPickerSheet: View {
    let products: [Product]
    @Binding var selected: Product?
    @Binding var searchQuery: String
    let onSearch: (String?) -> Void
    
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                // 清除选择
                Button {
                    selected = nil
                    dismiss()
                } label: {
                    HStack {
                        Text(String(localized: "issues.noSelection"))
                            .foregroundStyle(.secondary)
                        Spacer()
                        if selected == nil {
                            Image(systemName: "checkmark")
                                .foregroundStyle(.blue)
                        }
                    }
                }
                
                ForEach(products) { product in
                    Button {
                        selected = product
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(product.name)
                                if let model = product.model {
                                    Text(model)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if selected?.id == product.id {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
            .searchable(text: $searchQuery, prompt: String(localized: "issues.searchProduct"))
            .onSubmit(of: .search) {
                onSearch(searchQuery.isEmpty ? nil : searchQuery)
            }
            .navigationTitle(String(localized: "issues.selectProduct"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "action.cancel")) {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

// MARK: - 客户选择器

struct CustomerPickerSheet: View {
    let customers: [Customer]
    @Binding var selected: Customer?
    @Binding var searchQuery: String
    let onSearch: (String?) -> Void
    
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                // 清除选择
                Button {
                    selected = nil
                    dismiss()
                } label: {
                    HStack {
                        Text(String(localized: "issues.noSelection"))
                            .foregroundStyle(.secondary)
                        Spacer()
                        if selected == nil {
                            Image(systemName: "checkmark")
                                .foregroundStyle(.blue)
                        }
                    }
                }
                
                ForEach(customers) { customer in
                    Button {
                        selected = customer
                        dismiss()
                    } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(customer.displayName)
                                if let contact = customer.contactSummary {
                                    Text(contact)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Spacer()
                            if selected?.id == customer.id {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.blue)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
            .searchable(text: $searchQuery, prompt: String(localized: "issues.searchCustomer"))
            .onSubmit(of: .search) {
                onSearch(searchQuery.isEmpty ? nil : searchQuery)
            }
            .navigationTitle(String(localized: "issues.selectCustomer"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(String(localized: "action.cancel")) {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}

#Preview {
    IssueCreateView { _ in }
}
