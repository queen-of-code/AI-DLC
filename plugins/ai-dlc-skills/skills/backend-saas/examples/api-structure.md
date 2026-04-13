# API Project Structure

## Python (FastAPI)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry
│   ├── config.py               # Settings and configuration
│   ├── dependencies.py         # Dependency injection
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── router.py       # Combines all routers
│   │   │   ├── users.py        # User endpoints
│   │   │   ├── orders.py       # Order endpoints
│   │   │   └── health.py       # Health checks
│   │   └── deps.py             # API dependencies
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── security.py         # Auth, JWT, hashing
│   │   ├── exceptions.py       # Custom exceptions
│   │   └── middleware.py       # Custom middleware
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py             # SQLAlchemy models
│   │   └── order.py
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── user.py             # Pydantic schemas
│   │   └── order.py
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── user_service.py     # Business logic
│   │   └── order_service.py
│   │
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base.py             # Base repository
│   │   ├── user_repository.py  # Data access
│   │   └── order_repository.py
│   │
│   └── db/
│       ├── __init__.py
│       ├── session.py          # Database session
│       └── migrations/         # Alembic migrations
│
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # Pytest fixtures
│   ├── unit/
│   └── integration/
│
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## Node.js (Express/NestJS)

```
backend/
├── src/
│   ├── index.ts                # Entry point
│   ├── app.ts                  # Express/Nest app setup
│   ├── config/
│   │   ├── index.ts            # Configuration
│   │   └── database.ts         # DB config
│   │
│   ├── api/
│   │   ├── v1/
│   │   │   ├── index.ts        # Router setup
│   │   │   ├── users/
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   ├── users.repository.ts
│   │   │   │   └── users.dto.ts
│   │   │   └── orders/
│   │   │       └── ...
│   │   └── middleware/
│   │       ├── auth.ts
│   │       ├── validation.ts
│   │       └── error-handler.ts
│   │
│   ├── models/
│   │   ├── user.model.ts
│   │   └── order.model.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   └── email.service.ts
│   │
│   ├── utils/
│   │   ├── logger.ts
│   │   └── helpers.ts
│   │
│   └── types/
│       └── index.d.ts
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── prisma/                     # If using Prisma
│   └── schema.prisma
│
├── package.json
├── tsconfig.json
├── Dockerfile
└── docker-compose.yml
```

## Go

```
backend/
├── cmd/
│   └── api/
│       └── main.go             # Entry point
│
├── internal/
│   ├── config/
│   │   └── config.go           # Configuration
│   │
│   ├── api/
│   │   ├── router.go           # Route setup
│   │   ├── middleware/
│   │   │   ├── auth.go
│   │   │   └── logging.go
│   │   └── handlers/
│   │       ├── users.go
│   │       └── orders.go
│   │
│   ├── domain/
│   │   ├── user.go             # Domain models
│   │   └── order.go
│   │
│   ├── service/
│   │   ├── user_service.go     # Business logic
│   │   └── order_service.go
│   │
│   ├── repository/
│   │   ├── user_repo.go        # Data access
│   │   └── order_repo.go
│   │
│   └── database/
│       └── postgres.go         # DB connection
│
├── pkg/                        # Shared packages
│   ├── logger/
│   └── validator/
│
├── migrations/
│
├── go.mod
├── go.sum
├── Dockerfile
└── Makefile
```

## Common Patterns

### Entry Point

```python
# Python FastAPI
from fastapi import FastAPI
from app.api.v1 import router
from app.core.middleware import setup_middleware

app = FastAPI(title="My API", version="1.0.0")
setup_middleware(app)
app.include_router(router, prefix="/api/v1")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Dependency Injection

```python
# dependencies.py
from functools import lru_cache
from app.config import Settings

@lru_cache()
def get_settings():
    return Settings()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_user_service(db: Session = Depends(get_db)):
    return UserService(UserRepository(db))
```

### Error Handling

```python
# exceptions.py
class AppException(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        self.code = code
        self.message = message
        self.status_code = status_code

class NotFoundError(AppException):
    def __init__(self, resource: str, id: str):
        super().__init__(
            code="NOT_FOUND",
            message=f"{resource} with id {id} not found",
            status_code=404
        )

# Handler
@app.exception_handler(AppException)
async def app_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}}
    )
```
