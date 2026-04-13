---
name: mobile-apple
description: iOS and macOS development patterns using Swift, SwiftUI, and UIKit including app architecture, data persistence, and platform conventions. Use when building Apple platform apps or following Human Interface Guidelines.
type: skill
aidlc_phases: [design, build, test]
tags: [ios, macos, swift, swiftui, uikit, apple, mobile]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---

# Apple Platform Development

## When to Use

- Building iOS or macOS applications
- Choosing between SwiftUI and UIKit
- Implementing app architecture
- Managing data persistence
- Following Apple Human Interface Guidelines
- Handling app lifecycle

## SwiftUI vs UIKit

### Decision Matrix

| Factor | SwiftUI | UIKit |
|--------|---------|-------|
| iOS Target | 14+ (ideal: 15+) | All versions |
| Development Speed | Faster | Slower |
| Customization | Growing | Full control |
| Preview Support | Excellent | Limited |
| Learning Curve | Lower | Higher |
| Complex Animations | Improving | Mature |
| Table/Collection Views | Good (LazyVStack) | Excellent |

### When to Use SwiftUI

- New apps targeting iOS 15+
- Rapid prototyping
- Simple to moderate UI complexity
- Cross-platform (iOS, macOS, watchOS)
- Teams new to iOS development

### When to Use UIKit

- Complex custom animations
- Advanced collection view layouts
- Apps requiring iOS 13 support
- Highly customized text editing
- Camera/media capture interfaces

### Hybrid Approach

```swift
// Use UIKit view in SwiftUI
struct CameraView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
}

// Use SwiftUI view in UIKit
let swiftUIView = ContentView()
let hostingController = UIHostingController(rootView: swiftUIView)
present(hostingController, animated: true)
```

## Architecture Patterns

### MVVM (Recommended for SwiftUI)

```
┌─────────────────────────────────────────────────┐
│  View (SwiftUI)                                 │
│  - Observes ViewModel                           │
│  - Sends user actions                           │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  ViewModel (@Observable / ObservableObject)     │
│  - Transforms model data for display            │
│  - Handles user actions                         │
│  - Coordinates with services                    │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│  Model / Services                               │
│  - Business logic                               │
│  - Data access                                  │
│  - Network calls                                │
└─────────────────────────────────────────────────┘
```

### Implementation

```swift
// Model
struct User: Identifiable, Codable {
    let id: UUID
    var name: String
    var email: String
}

// ViewModel (iOS 17+ with @Observable)
@Observable
class UserListViewModel {
    var users: [User] = []
    var isLoading = false
    var error: Error?
    
    private let userService: UserServiceProtocol
    
    init(userService: UserServiceProtocol = UserService()) {
        self.userService = userService
    }
    
    func loadUsers() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            users = try await userService.fetchUsers()
        } catch {
            self.error = error
        }
    }
    
    func deleteUser(_ user: User) async {
        do {
            try await userService.delete(user)
            users.removeAll { $0.id == user.id }
        } catch {
            self.error = error
        }
    }
}

// View
struct UserListView: View {
    @State private var viewModel = UserListViewModel()
    
    var body: some View {
        List(viewModel.users) { user in
            UserRow(user: user)
                .swipeActions {
                    Button(role: .destructive) {
                        Task { await viewModel.deleteUser(user) }
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
        }
        .overlay {
            if viewModel.isLoading {
                ProgressView()
            }
        }
        .task {
            await viewModel.loadUsers()
        }
    }
}
```

### Service Layer

```swift
// Protocol for testability
protocol UserServiceProtocol {
    func fetchUsers() async throws -> [User]
    func delete(_ user: User) async throws
}

// Implementation
class UserService: UserServiceProtocol {
    private let networkClient: NetworkClient
    
    init(networkClient: NetworkClient = .shared) {
        self.networkClient = networkClient
    }
    
    func fetchUsers() async throws -> [User] {
        try await networkClient.get("/api/users")
    }
    
    func delete(_ user: User) async throws {
        try await networkClient.delete("/api/users/\(user.id)")
    }
}
```

## Data Persistence

### Choosing a Solution

| Solution | Use Case | Complexity |
|----------|----------|------------|
| **UserDefaults** | Small amounts, preferences | Low |
| **File System** | Documents, large files | Low |
| **SwiftData** | Structured data, iOS 17+ | Medium |
| **Core Data** | Complex data, iOS 13+ | High |
| **Keychain** | Sensitive data, credentials | Low |

### SwiftData (iOS 17+)

```swift
// Model
@Model
class Task {
    var title: String
    var isCompleted: Bool
    var createdAt: Date
    
    init(title: String, isCompleted: Bool = false) {
        self.title = title
        self.isCompleted = isCompleted
        self.createdAt = Date()
    }
}

// App setup
@main
struct MyApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: Task.self)
    }
}

// View with SwiftData
struct TaskListView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \Task.createdAt, order: .reverse) private var tasks: [Task]
    
    var body: some View {
        List(tasks) { task in
            TaskRow(task: task)
        }
    }
    
    func addTask(title: String) {
        let task = Task(title: title)
        context.insert(task)
    }
}
```

### UserDefaults

```swift
// Type-safe wrapper
@propertyWrapper
struct UserDefault<T> {
    let key: String
    let defaultValue: T
    
    var wrappedValue: T {
        get { UserDefaults.standard.object(forKey: key) as? T ?? defaultValue }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }
}

// Usage
class Settings {
    @UserDefault(key: "isDarkMode", defaultValue: false)
    static var isDarkMode: Bool
    
    @UserDefault(key: "lastSyncDate", defaultValue: nil)
    static var lastSyncDate: Date?
}
```

### Keychain

```swift
// Simple keychain wrapper
class KeychainManager {
    static let shared = KeychainManager()
    
    func save(_ data: Data, for key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed
        }
    }
    
    func load(for key: String) throws -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess else { return nil }
        return result as? Data
    }
}
```

## Networking

### Modern Async/Await

```swift
class NetworkClient {
    static let shared = NetworkClient()
    
    private let session: URLSession
    private let decoder: JSONDecoder
    
    init(session: URLSession = .shared) {
        self.session = session
        self.decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }
    
    func get<T: Decodable>(_ path: String) async throws -> T {
        let url = URL(string: "https://api.example.com\(path)")!
        let (data, response) = try await session.data(from: url)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200..<300 ~= httpResponse.statusCode else {
            throw NetworkError.invalidResponse
        }
        
        return try decoder.decode(T.self, from: data)
    }
    
    func post<T: Decodable, U: Encodable>(_ path: String, body: U) async throws -> T {
        var request = URLRequest(url: URL(string: "https://api.example.com\(path)")!)
        request.httpMethod = "POST"
        request.httpBody = try JSONEncoder().encode(body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let (data, _) = try await session.data(for: request)
        return try decoder.decode(T.self, from: data)
    }
}
```

## App Lifecycle

### SwiftUI App Lifecycle

```swift
@main
struct MyApp: App {
    @Environment(\.scenePhase) private var scenePhase
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            switch newPhase {
            case .active:
                // App is in foreground
                refreshData()
            case .inactive:
                // App is transitioning
                break
            case .background:
                // App is in background
                saveState()
            @unknown default:
                break
            }
        }
    }
}
```

## Navigation

### NavigationStack (iOS 16+)

```swift
struct ContentView: View {
    @State private var path = NavigationPath()
    
    var body: some View {
        NavigationStack(path: $path) {
            List(items) { item in
                NavigationLink(value: item) {
                    ItemRow(item: item)
                }
            }
            .navigationDestination(for: Item.self) { item in
                ItemDetailView(item: item)
            }
            .navigationDestination(for: User.self) { user in
                UserProfileView(user: user)
            }
        }
    }
    
    func navigateTo(_ item: Item) {
        path.append(item)
    }
    
    func popToRoot() {
        path.removeLast(path.count)
    }
}
```

## Human Interface Guidelines

### Key Principles

| Principle | Implementation |
|-----------|----------------|
| **Clarity** | Clear hierarchy, readable text |
| **Deference** | Content first, minimal chrome |
| **Depth** | Meaningful transitions, layering |

### Platform Conventions

- Use SF Symbols for icons
- Follow safe area guidelines
- Support Dynamic Type
- Implement Dark Mode
- Handle different device sizes
- Support accessibility features

### Accessibility

```swift
struct ProductCard: View {
    let product: Product
    
    var body: some View {
        VStack {
            Image(product.imageName)
                .accessibilityHidden(true) // Decorative
            
            Text(product.name)
                .font(.headline)
            
            Text(product.price, format: .currency(code: "USD"))
                .foregroundColor(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(product.name), \(product.price)")
        .accessibilityHint("Double tap to view details")
    }
}
```

## Additional Resources

For implementation examples, see [examples/](examples/) directory.
