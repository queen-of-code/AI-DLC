---
name: architecture
description: Apply software architecture best practices and design patterns. Use when designing systems, refactoring code, making architectural decisions, or reviewing code structure.
type: skill
aidlc_phases: [design, review, validate]
tags: [architecture, design-patterns, refactoring, system-design]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---

# Software Architecture

## When to Use

- Designing new systems or features
- Making decisions about code organization
- Refactoring existing code
- Reviewing architectural patterns
- Choosing between different approaches

## Core Principles

### SOLID Principles

| Principle | Description | Violation Sign |
|-----------|-------------|----------------|
| **S**ingle Responsibility | A class should have one reason to change | Class doing too many things |
| **O**pen/Closed | Open for extension, closed for modification | Frequent edits to existing classes |
| **L**iskov Substitution | Subtypes must be substitutable for base types | Checks for specific types in code |
| **I**nterface Segregation | Many specific interfaces over one general | Clients implementing unused methods |
| **D**ependency Inversion | Depend on abstractions, not concretions | Hard-coded dependencies |

### Separation of Concerns

Organize code into distinct layers:

```
┌─────────────────────────────┐
│     Presentation Layer      │  UI, API endpoints, CLI
├─────────────────────────────┤
│      Application Layer      │  Use cases, orchestration
├─────────────────────────────┤
│        Domain Layer         │  Business logic, entities
├─────────────────────────────┤
│    Infrastructure Layer     │  Database, external services
└─────────────────────────────┘
```

**Key rules:**
- Each layer only depends on layers below it
- Domain layer has no external dependencies
- Infrastructure implements interfaces defined in domain

## Design Patterns

### Dependency Injection

Prefer constructor injection for required dependencies:

```python
# Good: Dependencies are explicit and testable
class OrderService:
    def __init__(self, repository: OrderRepository, notifier: Notifier):
        self.repository = repository
        self.notifier = notifier

# Bad: Hidden dependencies, hard to test
class OrderService:
    def __init__(self):
        self.repository = PostgresOrderRepository()
        self.notifier = EmailNotifier()
```

### Repository Pattern

Abstract data access behind a clean interface:

```python
class UserRepository(Protocol):
    def get_by_id(self, user_id: str) -> User | None: ...
    def save(self, user: User) -> None: ...
    def find_by_email(self, email: str) -> User | None: ...
```

### Service Layer

Encapsulate business operations:

```python
class UserService:
    def register(self, email: str, password: str) -> User:
        # Validation
        # Business logic
        # Persistence
        # Side effects (email, events)
```

## Architectural Decisions

### Monolith vs Microservices

**Start with a monolith when:**
- Team is small (< 10 developers)
- Domain is not well understood
- Rapid iteration is needed
- Deployment simplicity is important

**Consider microservices when:**
- Clear bounded contexts exist
- Independent scaling is required
- Different tech stacks needed per service
- Team is large enough to own services

### API Design

**REST conventions:**
- Use nouns for resources: `/users`, `/orders`
- Use HTTP methods correctly: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- Return appropriate status codes
- Support filtering, pagination, sorting

**GraphQL considerations:**
- Use for complex, nested data requirements
- When clients need flexibility in queries
- Avoid for simple CRUD operations

### Database Design

**Normalization:**
- Start normalized (3NF) for transactional data
- Denormalize strategically for read performance
- Use views for complex queries

**Indexing strategy:**
- Index columns used in WHERE, JOIN, ORDER BY
- Consider composite indexes for common query patterns
- Monitor slow queries and add indexes as needed

## Caching Strategies

| Strategy | Use Case | Invalidation |
|----------|----------|--------------|
| **Cache-aside** | Read-heavy, tolerates stale data | TTL or explicit invalidation |
| **Write-through** | Consistency important | On write |
| **Write-behind** | Write-heavy, eventual consistency | Async batch writes |

**Cache placement:**
- **L1**: Application memory (fastest, per-instance)
- **L2**: Distributed cache like Redis (shared, fast)
- **L3**: CDN (edge, for static/semi-static content)

## Event-Driven Architecture

Use events for:
- Decoupling services
- Async processing
- Audit trails
- Notifications

**Event patterns:**
- **Event notification**: Something happened, minimal data
- **Event-carried state**: Include data to avoid callbacks
- **Event sourcing**: Events as source of truth

## Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **God class** | One class does everything | Split by responsibility |
| **Spaghetti code** | Tangled dependencies | Clear layering |
| **Golden hammer** | Same solution for everything | Choose appropriate tools |
| **Premature optimization** | Optimizing before needed | Measure first |
| **Copy-paste programming** | Duplicated code | Extract and reuse |

## Decision Framework

When facing an architectural decision:

1. **Understand requirements**: What problem are we solving?
2. **List constraints**: Time, budget, team skills, scale
3. **Identify options**: What approaches are viable?
4. **Evaluate trade-offs**: Pros/cons of each option
5. **Document decision**: Record the why, not just the what
6. **Plan for change**: How can we evolve this later?

## Additional Resources

For detailed pattern examples, see [patterns/](patterns/) directory.
