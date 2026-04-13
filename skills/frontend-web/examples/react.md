# React Patterns

## API Client

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<ApiResponse<T>> {
  const session = getSession();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (session?.token) {
    headers['Authorization'] = session.token;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const rawData = await response.json();

  // Normalize PascalCase/camelCase
  const parsed: ApiResponse<T> = {
    success: rawData.success ?? rawData.Success,
    data: rawData.data ?? rawData.Data,
    message: rawData.message ?? rawData.Message,
    errors: rawData.errors ?? rawData.Errors ?? []
  };

  if (!response.ok) {
    throw new Error(parsed.message || `HTTP error: ${response.status}`);
  }

  return parsed;
}
```

## API Functions (apis/)

```typescript
// apis/itemsApi.ts
import { apiRequest } from '../utils/apiClient';
import type { Item, CreateItemRequest } from '../types/item';

export const getItems = async (ownerId: string): Promise<Item[]> => {
  const response = await apiRequest<Item[]>(`/items/owner/${ownerId}`);
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Failed to get items');
  }
  return response.data;
};

export const getItem = async (itemId: string): Promise<Item> => {
  const response = await apiRequest<Item>(`/items/${itemId}`);
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Failed to get item');
  }
  return response.data;
};

export const createItem = async (request: CreateItemRequest): Promise<Item> => {
  const response = await apiRequest<Item>('/items/create', {
    method: 'POST',
    body: request,
  });
  if (!response.success || !response.data) {
    throw new Error(response.message || 'Failed to create item');
  }
  return response.data;
};
```

## Query Hooks (hooks/)

```typescript
// hooks/useItems.ts
import { useQuery } from '@tanstack/react-query';
import { getItems } from '../apis/itemsApi';

interface UseItemsProps {
  ownerId?: string;
  category?: string;
  enabled?: boolean;
}

export const useItems = ({ ownerId, category, enabled = true }: UseItemsProps) => {
  return useQuery({
    queryKey: ['items', ownerId, category],  // Include all filter params
    queryFn: () => getItems(ownerId!),
    enabled: enabled && !!ownerId,
    staleTime: 5 * 60 * 1000,  // 5 minutes
    gcTime: 10 * 60 * 1000,    // 10 minutes
  });
};

// hooks/useItem.ts
export const useItem = (itemId: string | undefined) => {
  return useQuery({
    queryKey: ['item', itemId],
    queryFn: () => getItem(itemId!),
    enabled: !!itemId,
  });
};
```

## Mutation Hooks

```typescript
// hooks/useCreateItem.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createItem } from '../apis/itemsApi';
import { toast } from 'sonner';

export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createItem,
    onSuccess: (newItem) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Item created');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to create item');
    },
  });
};
```

## Auth Context

```typescript
// contexts/AuthContext.tsx
import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';

interface User {
  userId: string;
  email: string;
  token: string;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const initializeAuth = (): User | null => {
  const stored = localStorage.getItem('user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      localStorage.removeItem('user');
    }
  }
  return null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(initializeAuth);

  const login = useCallback((profile: User) => {
    setUser(profile);
    localStorage.setItem('user', JSON.stringify(profile));
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    localStorage.removeItem('user');
  }, []);

  const isAuthenticated = useMemo(() => !!user, [user]);

  // Memoize entire context value
  const value = useMemo(
    () => ({ user, login, logout, isAuthenticated }),
    [user, login, logout, isAuthenticated]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

## Feature Context with Reducer

```typescript
// contexts/SelectionContext.tsx
import { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';

interface SelectionState {
  items: SelectedItem[];
  isLoading: boolean;
  error: string | null;
}

type SelectionAction =
  | { type: 'ADD_ITEM'; payload: SelectedItem }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'CLEAR' };

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'ADD_ITEM':
      return { ...state, items: [...state.items, action.payload] };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.id !== action.payload) };
    case 'CLEAR':
      return { items: [], isLoading: false, error: null };
    default:
      return state;
  }
}

const SelectionContext = createContext<SelectionContextType | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(selectionReducer, {
    items: [],
    isLoading: false,
    error: null,
  });

  const actions = useMemo(() => ({
    addItem: (item: SelectedItem) => dispatch({ type: 'ADD_ITEM', payload: item }),
    removeItem: (id: string) => dispatch({ type: 'REMOVE_ITEM', payload: id }),
    clear: () => dispatch({ type: 'CLEAR' }),
  }), []);

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within SelectionProvider');
  }
  return context;
}
```

## Query Key Factory

```typescript
export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (filters: ItemFilters) => [...itemKeys.lists(), filters] as const,
  details: () => [...itemKeys.all, 'detail'] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
};

// Usage
useQuery({ queryKey: itemKeys.detail(itemId), ... });
useQuery({ queryKey: itemKeys.list({ ownerId, category }), ... });

// Invalidation
queryClient.invalidateQueries({ queryKey: itemKeys.all });
queryClient.invalidateQueries({ queryKey: itemKeys.lists() });
```

## TypeScript Types

```typescript
// types/item.ts
export interface Item {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateItemRequest {
  ownerId: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

export interface UpdateItemRequest extends CreateItemRequest {
  id: string;
}

// Constants as const for type safety
export const CATEGORIES = ['digital', 'physical', 'subscription'] as const;
export type Category = typeof CATEGORIES[number];
```

## Retry with Fallback

```typescript
export async function retryWithFallback<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  fallbackValue: T
): Promise<T> {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      retries++;
      const delay = Math.min(1000 * 2 ** retries, 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return fallbackValue;
}
```

## Prefetch Hook

```typescript
export const usePrefetchItem = () => {
  const queryClient = useQueryClient();

  return useCallback((itemId: string) => {
    queryClient.prefetchQuery({
      queryKey: itemKeys.detail(itemId),
      queryFn: () => getItem(itemId),
      staleTime: 5 * 60 * 1000,
    });
  }, [queryClient]);
};

// Usage - prefetch on hover
function ItemLink({ item }: { item: Item }) {
  const prefetch = usePrefetchItem();
  
  return (
    <Link
      to={`/items/${item.id}`}
      onMouseEnter={() => prefetch(item.id)}
    >
      {item.name}
    </Link>
  );
}
```

## Error Boundary

```typescript
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong</div>;
    }
    return this.props.children;
  }
}
```
