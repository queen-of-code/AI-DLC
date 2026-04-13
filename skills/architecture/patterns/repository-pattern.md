# Repository Pattern Examples

## Python Example

```python
from abc import ABC, abstractmethod
from typing import Optional, List
from dataclasses import dataclass

@dataclass
class User:
    id: str
    email: str
    name: str

class UserRepository(ABC):
    @abstractmethod
    def get_by_id(self, user_id: str) -> Optional[User]:
        pass
    
    @abstractmethod
    def get_by_email(self, email: str) -> Optional[User]:
        pass
    
    @abstractmethod
    def save(self, user: User) -> None:
        pass
    
    @abstractmethod
    def delete(self, user_id: str) -> None:
        pass
    
    @abstractmethod
    def list_all(self, limit: int = 100, offset: int = 0) -> List[User]:
        pass

# PostgreSQL implementation
class PostgresUserRepository(UserRepository):
    def __init__(self, connection_pool):
        self.pool = connection_pool
    
    def get_by_id(self, user_id: str) -> Optional[User]:
        with self.pool.connection() as conn:
            row = conn.execute(
                "SELECT id, email, name FROM users WHERE id = %s",
                (user_id,)
            ).fetchone()
            return User(*row) if row else None
    
    # ... other implementations

# In-memory implementation for testing
class InMemoryUserRepository(UserRepository):
    def __init__(self):
        self.users: dict[str, User] = {}
    
    def get_by_id(self, user_id: str) -> Optional[User]:
        return self.users.get(user_id)
    
    def save(self, user: User) -> None:
        self.users[user.id] = user
    
    # ... other implementations
```

## TypeScript Example

```typescript
interface User {
  id: string;
  email: string;
  name: string;
}

interface UserRepository {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: string): Promise<void>;
  list(options?: { limit?: number; offset?: number }): Promise<User[]>;
}

// PostgreSQL implementation
class PostgresUserRepository implements UserRepository {
  constructor(private db: Database) {}

  async getById(id: string): Promise<User | null> {
    const row = await this.db.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [id]
    );
    return row ? { id: row.id, email: row.email, name: row.name } : null;
  }

  async save(user: User): Promise<void> {
    await this.db.query(
      `INSERT INTO users (id, email, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET email = $2, name = $3`,
      [user.id, user.email, user.name]
    );
  }

  // ... other implementations
}

// In-memory for testing
class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  async getById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  // ... other implementations
}
```

## Swift Example

```swift
protocol UserRepository {
    func getById(_ id: String) async throws -> User?
    func getByEmail(_ email: String) async throws -> User?
    func save(_ user: User) async throws
    func delete(_ id: String) async throws
    func list(limit: Int, offset: Int) async throws -> [User]
}

struct User: Codable, Identifiable {
    let id: String
    var email: String
    var name: String
}

// Core Data implementation
class CoreDataUserRepository: UserRepository {
    private let context: NSManagedObjectContext
    
    init(context: NSManagedObjectContext) {
        self.context = context
    }
    
    func getById(_ id: String) async throws -> User? {
        let request = UserEntity.fetchRequest()
        request.predicate = NSPredicate(format: "id == %@", id)
        
        let results = try context.fetch(request)
        return results.first.map { User(id: $0.id, email: $0.email, name: $0.name) }
    }
    
    // ... other implementations
}

// In-memory for testing
class InMemoryUserRepository: UserRepository {
    private var users: [String: User] = [:]
    
    func getById(_ id: String) async throws -> User? {
        return users[id]
    }
    
    func save(_ user: User) async throws {
        users[user.id] = user
    }
    
    // ... other implementations
}
```

## When to Use

- When you need to swap data sources (testing, migrations)
- When business logic shouldn't know about persistence details
- When you want consistent data access patterns
- When you need to add caching or other cross-cutting concerns

## When to Skip

- Very simple CRUD applications
- When using an ORM that already provides this abstraction
- Prototypes where flexibility isn't needed yet
