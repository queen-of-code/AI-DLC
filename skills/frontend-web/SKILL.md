---
name: frontend-web
description: Modern web development patterns for React, Vue, and vanilla JS including component architecture, state management, and performance. Use when building web UIs, optimizing frontend performance, or implementing accessibility.
type: skill
aidlc_phases: [design, build, test]
tags: [frontend, react, vue, javascript, typescript, accessibility, performance]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---

# Frontend Web Development

## When to Use

- Building web user interfaces
- Implementing component architecture
- Managing application state
- Optimizing performance
- Ensuring accessibility
- Handling forms and validation

## Component Architecture

### Component Types

| Type | Purpose | State | Examples |
|------|---------|-------|----------|
| **Presentational** | UI rendering | None/props only | Button, Card, Avatar |
| **Container** | Data fetching, logic | Yes | UserList, OrderPage |
| **Layout** | Page structure | Minimal | Header, Sidebar, Grid |
| **Feature** | Complete feature | Yes | LoginForm, Checkout |

### Component Structure

```
components/
├── ui/                    # Presentational (reusable)
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── Button.css
│   ├── Input/
│   └── Card/
├── features/              # Feature-specific
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   └── SignupForm.tsx
│   └── dashboard/
│       └── DashboardStats.tsx
└── layout/                # Layout components
    ├── Header.tsx
    ├── Sidebar.tsx
    └── PageLayout.tsx
```

### Component Patterns

**Composition over Props**

```tsx
// Good: Composable
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>

// Avoid: Prop overload
<Card 
  title="Title"
  body="Content"
  footer="Actions"
  showBorder
  variant="elevated"
  ...dozens more props
/>
```

**Render Props / Slots**

```tsx
// React: Render props
<DataFetcher url="/api/users">
  {({ data, loading, error }) => (
    loading ? <Spinner /> : <UserList users={data} />
  )}
</DataFetcher>

// Vue: Slots
<template>
  <DataFetcher url="/api/users" v-slot="{ data, loading }">
    <Spinner v-if="loading" />
    <UserList v-else :users="data" />
  </DataFetcher>
</template>
```

## State Management

### When to Use What

| State Type | Location | Example |
|------------|----------|---------|
| **Local UI** | Component state | Modal open/closed |
| **Form** | Form library | Input values |
| **Server** | React Query/SWR | API data |
| **Global UI** | Context/Store | Theme, sidebar |
| **Global App** | Store | User session |

### React State Patterns

```tsx
// Local state
const [count, setCount] = useState(0);

// Server state with React Query
const { data, isLoading } = useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
});

// Global state with Context
const ThemeContext = createContext<Theme>('light');

function App() {
  const [theme, setTheme] = useState<Theme>('light');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Layout />
    </ThemeContext.Provider>
  );
}

// Zustand for complex global state
const useStore = create((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),
}));
```

### Avoid Prop Drilling

```tsx
// Bad: Passing through multiple levels
<App>
  <Header user={user} />     // needs user
    <Nav user={user} />      // just passing through
      <Avatar user={user} /> // actually uses user

// Good: Context or composition
<App>
  <UserProvider>
    <Header />
      <Nav />
        <Avatar />  // Gets user from context
```

## Performance

### React Optimization

```tsx
// Memoize expensive computations
const sortedItems = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// Memoize callbacks
const handleClick = useCallback((id: string) => {
  selectItem(id);
}, [selectItem]);

// Memoize components (use sparingly)
const ExpensiveList = memo(({ items }) => {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

### Code Splitting

```tsx
// Route-based splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Component-based splitting
const HeavyChart = lazy(() => import('./components/HeavyChart'));
```

### Image Optimization

```tsx
// Use next/image or similar
<Image
  src="/photo.jpg"
  alt="Description"
  width={800}
  height={600}
  loading="lazy"
  placeholder="blur"
/>

// Responsive images
<picture>
  <source media="(min-width: 800px)" srcSet="large.jpg" />
  <source media="(min-width: 400px)" srcSet="medium.jpg" />
  <img src="small.jpg" alt="Description" />
</picture>
```

### Virtual Lists

```tsx
// For long lists (1000+ items)
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  width={300}
  itemCount={items.length}
  itemSize={50}
>
  {({ index, style }) => (
    <div style={style}>{items[index].name}</div>
  )}
</FixedSizeList>
```

## Accessibility

### Essential Practices

| Practice | Implementation |
|----------|----------------|
| Semantic HTML | Use correct elements (`<button>`, `<nav>`, `<main>`) |
| Keyboard nav | Tab order, focus management |
| ARIA labels | When semantic HTML isn't enough |
| Color contrast | 4.5:1 for text, 3:1 for large text |
| Alt text | Descriptive for images |

### Component Accessibility

```tsx
// Good: Accessible button
<button
  onClick={handleClick}
  aria-label="Close dialog"
  aria-expanded={isOpen}
>
  <CloseIcon aria-hidden="true" />
</button>

// Good: Accessible form
<label htmlFor="email">Email address</label>
<input
  id="email"
  type="email"
  aria-required="true"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? "email-error" : undefined}
/>
{errors.email && (
  <span id="email-error" role="alert">
    {errors.email}
  </span>
)}
```

### Focus Management

```tsx
// Return focus after modal closes
function Modal({ isOpen, onClose, children }) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement as HTMLElement;
      closeButtonRef.current?.focus();
    } else {
      previousFocus.current?.focus();
    }
  }, [isOpen]);

  // ...
}
```

## Forms

### Form Handling

```tsx
// React Hook Form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    await login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      
      <input type="password" {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}
      
      <button type="submit">Login</button>
    </form>
  );
}
```

### Validation Patterns

```typescript
// Zod schema
const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be 18 or older').optional(),
  role: z.enum(['admin', 'user', 'guest']),
});

// Yup schema
const userSchema = yup.object({
  name: yup.string().min(2).required(),
  email: yup.string().email().required(),
  age: yup.number().min(18),
});
```

## Error Handling

### Error Boundaries

```tsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logErrorToService(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <Dashboard />
</ErrorBoundary>
```

### API Error Handling

```tsx
function useApiQuery(url) {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new ApiError(res.status, res.statusText);
        return res.json();
      })
      .then(data => setState({ data, error: null, loading: false }))
      .catch(error => setState({ data: null, error, loading: false }));
  }, [url]);

  return state;
}
```

## Responsive Design

### Breakpoints

```css
/* Mobile first */
.container {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: 3rem;
    max-width: 1200px;
  }
}
```

### Tailwind Responsive

```tsx
<div className="
  grid 
  grid-cols-1      /* Mobile: 1 column */
  md:grid-cols-2   /* Tablet: 2 columns */
  lg:grid-cols-3   /* Desktop: 3 columns */
  gap-4
">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

## Additional Resources

For component examples, see [examples/](examples/) directory.
