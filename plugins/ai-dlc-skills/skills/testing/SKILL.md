---
name: testing
description: Apply comprehensive testing best practices including unit, integration, and e2e tests. Use when writing tests, reviewing test coverage, designing testable code, or setting up test infrastructure.
type: skill
aidlc_phases: [build, test, review]
tags: [testing, unit-tests, integration-tests, e2e, tdd]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---

# Testing Best Practices

## When to Use

- Writing new tests
- Reviewing existing test coverage
- Designing code for testability
- Setting up test infrastructure
- Debugging flaky tests
- Deciding what and how to test

## Test Pyramid

```
         ╱╲
        ╱  ╲         E2E Tests
       ╱────╲        (Few, slow, expensive)
      ╱      ╲
     ╱────────╲      Integration Tests
    ╱          ╲     (Some, medium speed)
   ╱────────────╲
  ╱              ╲   Unit Tests
 ╱────────────────╲  (Many, fast, cheap)
```

**Guidelines:**
- **Unit tests**: 70% of tests - test individual functions/classes in isolation
- **Integration tests**: 20% of tests - test component interactions
- **E2E tests**: 10% of tests - test complete user flows

## Unit Testing

### AAA Pattern (Arrange, Act, Assert)

```python
def test_user_can_change_email():
    # Arrange - set up test data and dependencies
    user = User(id="123", email="old@example.com")
    new_email = "new@example.com"
    
    # Act - perform the action being tested
    user.change_email(new_email)
    
    # Assert - verify the expected outcome
    assert user.email == new_email
```

### Test Naming

Use descriptive names that explain the scenario:

```python
# Good
def test_login_fails_when_password_is_incorrect():
def test_order_total_includes_shipping_for_orders_under_fifty():
def test_user_receives_welcome_email_after_registration():

# Bad
def test_login():
def test_order():
def test_user():
```

### What Makes a Good Unit Test

| Property | Description |
|----------|-------------|
| **Fast** | Runs in milliseconds |
| **Isolated** | No dependencies on external systems |
| **Repeatable** | Same result every time |
| **Self-validating** | Clear pass/fail, no manual checking |
| **Timely** | Written close to the code |

### Test One Thing

Each test should verify one specific behavior:

```python
# Good - separate tests for separate behaviors
def test_empty_cart_has_zero_total():
    cart = Cart()
    assert cart.total == 0

def test_cart_total_sums_item_prices():
    cart = Cart()
    cart.add(Item(price=10))
    cart.add(Item(price=20))
    assert cart.total == 30

# Bad - testing multiple behaviors
def test_cart():
    cart = Cart()
    assert cart.total == 0
    cart.add(Item(price=10))
    assert len(cart.items) == 1
    assert cart.total == 10
```

## Integration Testing

### When to Write Integration Tests

- Database queries and transactions
- API endpoint behavior
- Service-to-service communication
- File system operations
- Cache interactions

### Database Integration Tests

```python
@pytest.fixture
def db_session():
    # Setup - create test database
    engine = create_engine("postgresql://localhost/test_db")
    Session = sessionmaker(bind=engine)
    session = Session()
    
    yield session
    
    # Teardown - clean up
    session.rollback()
    session.close()

def test_user_repository_saves_user(db_session):
    repo = UserRepository(db_session)
    user = User(email="test@example.com", name="Test")
    
    repo.save(user)
    
    found = repo.get_by_email("test@example.com")
    assert found is not None
    assert found.name == "Test"
```

### API Integration Tests

```python
def test_create_user_endpoint(client):
    response = client.post("/users", json={
        "email": "new@example.com",
        "name": "New User"
    })
    
    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"
```

## End-to-End Testing

### When to Write E2E Tests

- Critical user journeys (checkout, signup, login)
- Smoke tests for deployments
- Cross-browser compatibility
- Mobile responsiveness

### E2E Test Best Practices

1. **Test user flows, not implementation**: Click buttons, fill forms, verify outcomes
2. **Use stable selectors**: `data-testid` attributes over CSS classes
3. **Wait for elements**: Don't use fixed delays, wait for conditions
4. **Isolate test data**: Each test creates its own data
5. **Clean up after**: Reset state for next test

## Mocking and Stubbing

### When to Mock

- External services (APIs, databases in unit tests)
- Time-dependent code
- Random number generators
- File systems
- Network calls

### Mock Patterns

```python
# Stub - returns canned data
def test_gets_user_from_api(mocker):
    mock_api = mocker.patch('api.get_user')
    mock_api.return_value = {"id": "123", "name": "Test"}
    
    result = user_service.fetch_user("123")
    
    assert result.name == "Test"

# Spy - verifies interactions
def test_sends_notification_on_signup(mocker):
    spy = mocker.spy(notification_service, 'send')
    
    user_service.register("new@example.com")
    
    spy.assert_called_once_with(
        "new@example.com",
        "Welcome!"
    )
```

### Avoid Over-Mocking

```python
# Bad - mocking everything, test proves nothing
def test_user_creation(mocker):
    mocker.patch('db.save')
    mocker.patch('email.send')
    mocker.patch('validator.validate', return_value=True)
    
    result = create_user("test@example.com")
    
    assert result is not None  # What did we actually test?

# Good - mock only external boundaries
def test_user_creation(mocker, db_session):
    mocker.patch('email.send')  # Mock external service
    
    result = create_user("test@example.com", db_session)  # Real DB
    
    assert db_session.query(User).filter_by(email="test@example.com").first()
```

## Test Coverage

### Coverage Goals

| Coverage Type | Target | Notes |
|---------------|--------|-------|
| Line coverage | 80%+ | Good baseline |
| Branch coverage | 70%+ | Tests conditionals |
| Critical paths | 100% | Payment, auth, data integrity |

### Coverage Anti-Patterns

- **Chasing 100%**: Diminishing returns past 80-90%
- **Coverage without assertions**: Code runs but nothing verified
- **Testing getters/setters**: Low value, high noise

## Test Data

### Builders and Factories

```python
# Factory for creating test objects
class UserFactory:
    @staticmethod
    def create(**overrides):
        defaults = {
            "id": str(uuid4()),
            "email": f"user-{uuid4()}@test.com",
            "name": "Test User",
            "created_at": datetime.now()
        }
        return User(**{**defaults, **overrides})

# Usage
def test_user_name_validation():
    user = UserFactory.create(name="")
    
    with pytest.raises(ValidationError):
        user.validate()
```

## TDD Workflow

When practicing Test-Driven Development:

1. **Red**: Write a failing test for the desired behavior
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Improve code while keeping tests green

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Write Test │────▶│  Make Pass  │────▶│  Refactor   │
│   (Red)     │     │  (Green)    │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
       ▲                                        │
       └────────────────────────────────────────┘
```

## Debugging Flaky Tests

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Random failures | Race conditions | Add proper waits/synchronization |
| Fails only in CI | Environment differences | Match CI environment locally |
| Fails when run with others | Shared state | Isolate test data |
| Fails at certain times | Time-dependent code | Mock time |

## Additional Resources

For framework-specific guidance, see [frameworks/](frameworks/) directory.
