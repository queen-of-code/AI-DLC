# SwiftUI Patterns

## View Modifiers

### Custom View Modifier

```swift
struct CardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(12)
            .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
    }
}

extension View {
    func cardStyle() -> some View {
        modifier(CardStyle())
    }
}

// Usage
Text("Hello")
    .cardStyle()
```

### Conditional Modifier

```swift
extension View {
    @ViewBuilder
    func `if`<Content: View>(
        _ condition: Bool,
        transform: (Self) -> Content
    ) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

// Usage
Text("Hello")
    .if(isHighlighted) { view in
        view.foregroundColor(.yellow)
    }
```

## Environment Values

### Custom Environment Value

```swift
// Define the key
struct ThemeKey: EnvironmentKey {
    static let defaultValue: Theme = .system
}

extension EnvironmentValues {
    var theme: Theme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

// Usage in parent
ContentView()
    .environment(\.theme, .dark)

// Usage in child
struct ChildView: View {
    @Environment(\.theme) var theme
    
    var body: some View {
        Text("Current theme: \(theme.rawValue)")
    }
}
```

## Preference Keys

### Collecting Child Data

```swift
// Define preference key
struct SizePreferenceKey: PreferenceKey {
    static var defaultValue: CGSize = .zero
    
    static func reduce(value: inout CGSize, nextValue: () -> CGSize) {
        value = nextValue()
    }
}

// Report size from child
struct ChildView: View {
    var body: some View {
        GeometryReader { geometry in
            Color.clear
                .preference(key: SizePreferenceKey.self, value: geometry.size)
        }
    }
}

// Read in parent
struct ParentView: View {
    @State private var childSize: CGSize = .zero
    
    var body: some View {
        VStack {
            ChildView()
            Text("Child size: \(childSize.width) x \(childSize.height)")
        }
        .onPreferenceChange(SizePreferenceKey.self) { size in
            childSize = size
        }
    }
}
```

## Animations

### Basic Animations

```swift
struct AnimatedButton: View {
    @State private var isPressed = false
    
    var body: some View {
        Button("Tap me") {
            // Action
        }
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .animation(.spring(response: 0.3), value: isPressed)
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
    }
}
```

### Matched Geometry Effect

```swift
struct HeroAnimation: View {
    @Namespace private var animation
    @State private var isExpanded = false
    
    var body: some View {
        VStack {
            if isExpanded {
                DetailView()
                    .matchedGeometryEffect(id: "card", in: animation)
            } else {
                CardView()
                    .matchedGeometryEffect(id: "card", in: animation)
                    .onTapGesture {
                        withAnimation(.spring()) {
                            isExpanded = true
                        }
                    }
            }
        }
    }
}
```

### Phase Animator (iOS 17+)

```swift
struct PulsingView: View {
    var body: some View {
        Circle()
            .fill(.blue)
            .frame(width: 100, height: 100)
            .phaseAnimator([false, true]) { content, phase in
                content
                    .scaleEffect(phase ? 1.2 : 1.0)
                    .opacity(phase ? 0.8 : 1.0)
            } animation: { phase in
                .easeInOut(duration: 1.0)
            }
    }
}
```

## Gestures

### Combined Gestures

```swift
struct DraggableCard: View {
    @State private var offset = CGSize.zero
    @State private var isDragging = false
    
    var body: some View {
        RoundedRectangle(cornerRadius: 12)
            .fill(Color.blue)
            .frame(width: 200, height: 150)
            .offset(offset)
            .scaleEffect(isDragging ? 1.05 : 1.0)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        offset = value.translation
                        isDragging = true
                    }
                    .onEnded { _ in
                        withAnimation(.spring()) {
                            offset = .zero
                            isDragging = false
                        }
                    }
            )
    }
}
```

## Async Image Loading

```swift
struct RemoteImage: View {
    let url: URL
    
    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty:
                ProgressView()
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            case .failure:
                Image(systemName: "photo")
                    .foregroundColor(.gray)
            @unknown default:
                EmptyView()
            }
        }
    }
}
```

## State Restoration

```swift
struct ContentView: View {
    @SceneStorage("selectedTab") private var selectedTab = 0
    @SceneStorage("searchText") private var searchText = ""
    
    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tag(0)
            SearchView(searchText: $searchText)
                .tag(1)
            ProfileView()
                .tag(2)
        }
    }
}
```

## Focus State

```swift
struct LoginForm: View {
    enum Field: Hashable {
        case email, password
    }
    
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focusedField: Field?
    
    var body: some View {
        Form {
            TextField("Email", text: $email)
                .focused($focusedField, equals: .email)
                .submitLabel(.next)
                .onSubmit { focusedField = .password }
            
            SecureField("Password", text: $password)
                .focused($focusedField, equals: .password)
                .submitLabel(.done)
                .onSubmit { login() }
        }
        .onAppear {
            focusedField = .email
        }
    }
    
    func login() {
        focusedField = nil
        // Perform login
    }
}
```

## Error Handling

```swift
struct ContentView: View {
    @State private var error: AppError?
    @State private var showingError = false
    
    var body: some View {
        Button("Load Data") {
            Task {
                do {
                    try await loadData()
                } catch let appError as AppError {
                    error = appError
                    showingError = true
                }
            }
        }
        .alert("Error", isPresented: $showingError, presenting: error) { _ in
            Button("OK", role: .cancel) {}
            Button("Retry") { retry() }
        } message: { error in
            Text(error.localizedDescription)
        }
    }
}
```

## Share Sheet

```swift
struct ShareButton: View {
    let item: ShareableItem
    
    var body: some View {
        ShareLink(
            item: item.url,
            subject: Text(item.title),
            message: Text(item.description)
        ) {
            Label("Share", systemImage: "square.and.arrow.up")
        }
    }
}
```
