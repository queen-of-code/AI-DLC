# Pytest Best Practices

## Project Structure

```
project/
├── src/
│   └── myapp/
│       ├── __init__.py
│       ├── models.py
│       └── services.py
├── tests/
│   ├── __init__.py
│   ├── conftest.py          # Shared fixtures
│   ├── unit/
│   │   ├── test_models.py
│   │   └── test_services.py
│   ├── integration/
│   │   └── test_api.py
│   └── e2e/
│       └── test_flows.py
└── pytest.ini
```

## Configuration (pytest.ini)

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
addopts = -v --tb=short
markers =
    slow: marks tests as slow
    integration: marks tests as integration tests
```

## Fixtures

```python
# conftest.py - shared across all tests

import pytest
from myapp.database import Database

@pytest.fixture
def db():
    """Provides a clean database for each test."""
    database = Database(":memory:")
    database.create_tables()
    yield database
    database.close()

@pytest.fixture
def client(db):
    """Provides a test client with database."""
    from myapp.app import create_app
    app = create_app(db)
    return app.test_client()

@pytest.fixture
def sample_user(db):
    """Creates a sample user in the database."""
    user = User(email="test@example.com", name="Test User")
    db.save(user)
    return user
```

## Parametrized Tests

```python
@pytest.mark.parametrize("input,expected", [
    ("hello", "HELLO"),
    ("World", "WORLD"),
    ("", ""),
    ("123", "123"),
])
def test_uppercase(input, expected):
    assert input.upper() == expected

@pytest.mark.parametrize("email,valid", [
    ("user@example.com", True),
    ("user@domain.co.uk", True),
    ("invalid", False),
    ("@missing.com", False),
    ("", False),
])
def test_email_validation(email, valid):
    assert is_valid_email(email) == valid
```

## Mocking with pytest-mock

```python
def test_external_api_call(mocker):
    # Mock the external call
    mock_get = mocker.patch('requests.get')
    mock_get.return_value.json.return_value = {"status": "ok"}
    
    result = fetch_status()
    
    assert result == "ok"
    mock_get.assert_called_once_with("https://api.example.com/status")

def test_time_dependent_code(mocker):
    # Freeze time
    mock_now = mocker.patch('myapp.utils.datetime')
    mock_now.now.return_value = datetime(2024, 1, 1, 12, 0, 0)
    
    result = get_greeting()
    
    assert result == "Good afternoon"
```

## Exception Testing

```python
def test_raises_on_invalid_input():
    with pytest.raises(ValueError) as exc_info:
        validate_age(-1)
    
    assert "must be positive" in str(exc_info.value)

def test_raises_specific_error():
    with pytest.raises(UserNotFoundError):
        user_service.get_user("nonexistent")
```

## Async Tests

```python
import pytest

@pytest.mark.asyncio
async def test_async_fetch():
    result = await fetch_data("https://api.example.com")
    assert result is not None

@pytest.mark.asyncio
async def test_async_with_mock(mocker):
    mock_fetch = mocker.patch('aiohttp.ClientSession.get')
    mock_fetch.return_value.__aenter__.return_value.json = \
        mocker.AsyncMock(return_value={"data": "test"})
    
    result = await async_api_call()
    
    assert result["data"] == "test"
```

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific markers
pytest -m "not slow"
pytest -m integration

# Run specific test file
pytest tests/unit/test_models.py

# Run specific test
pytest tests/unit/test_models.py::test_user_creation

# Run with verbose output
pytest -v

# Stop on first failure
pytest -x
```
