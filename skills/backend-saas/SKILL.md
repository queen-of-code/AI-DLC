---
name: backend-saas
description: SaaS backend development patterns including API design, multi-tenancy, authentication, and scalability. Use when building backend services, APIs, SaaS infrastructure, or designing system architecture.
type: skill
aidlc_phases: [design, build, test]
tags: [backend, saas, api, multi-tenancy, authentication, scalability]
requires: []
author: Melissa Benua
created_at: 2026-03-07
updated_at: 2026-03-07
---

# SaaS Backend Development

## When to Use

- Building backend APIs
- Designing multi-tenant systems
- Implementing authentication/authorization
- Setting up observability
- Planning for scale
- Handling background jobs

## API Design

### RESTful Conventions

| Method | Path | Action | Status Codes |
|--------|------|--------|--------------|
| GET | /resources | List all | 200, 204 |
| GET | /resources/:id | Get one | 200, 404 |
| POST | /resources | Create | 201, 400, 422 |
| PUT | /resources/:id | Replace | 200, 404 |
| PATCH | /resources/:id | Update | 200, 404 |
| DELETE | /resources/:id | Remove | 204, 404 |

### Response Format

```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 100
  }
}
```

### Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is invalid",
    "details": [
      { "field": "email", "message": "must be a valid email" }
    ]
  }
}
```

### Pagination

```
GET /api/users?page=2&per_page=20
GET /api/users?cursor=abc123&limit=20  (cursor-based)
```

### Filtering and Sorting

```
GET /api/users?status=active&role=admin
GET /api/users?sort=-created_at,name  (- for descending)
```

## Multi-Tenancy

### Strategies

| Strategy | Isolation | Complexity | Cost |
|----------|-----------|------------|------|
| **Shared DB, Shared Schema** | Low | Low | Low |
| **Shared DB, Separate Schema** | Medium | Medium | Medium |
| **Separate Database** | High | High | High |

### Row-Level Security (Shared Schema)

```sql
-- Every table has tenant_id
CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    -- ...
);

-- RLS policy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
    USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- Set tenant context per request
SET app.tenant_id = 'tenant-uuid-here';
```

### Application-Level Filtering

```python
class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Extract tenant from subdomain, header, or JWT
        tenant_id = self.extract_tenant(request)
        request.tenant_id = tenant_id
        return self.get_response(request)

class TenantQuerySet:
    def get_queryset(self):
        return super().get_queryset().filter(
            tenant_id=self.request.tenant_id
        )
```

## Authentication & Authorization

### JWT Structure

```json
{
  "header": { "alg": "RS256", "typ": "JWT" },
  "payload": {
    "sub": "user-id",
    "tenant_id": "tenant-id",
    "roles": ["admin", "user"],
    "exp": 1234567890,
    "iat": 1234567800
  }
}
```

### Token Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│ Access Token│────▶│   API Call  │
│             │     │  (15 min)   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │            ┌──────▼──────┐
       │            │   Expired   │
       │            └──────┬──────┘
       │                   │
       │            ┌──────▼──────┐
       └───────────▶│   Refresh   │
                    │  (7 days)   │
                    └─────────────┘
```

### Role-Based Access Control (RBAC)

```python
# Define permissions
PERMISSIONS = {
    "admin": ["read", "write", "delete", "manage_users"],
    "editor": ["read", "write"],
    "viewer": ["read"],
}

# Check permission
def require_permission(permission):
    def decorator(func):
        def wrapper(request, *args, **kwargs):
            user_permissions = PERMISSIONS.get(request.user.role, [])
            if permission not in user_permissions:
                raise PermissionDenied()
            return func(request, *args, **kwargs)
        return wrapper
    return decorator

@require_permission("write")
def update_resource(request, resource_id):
    # ...
```

### API Keys

```python
# Generate API key
import secrets
api_key = secrets.token_urlsafe(32)

# Store hashed
from hashlib import sha256
key_hash = sha256(api_key.encode()).hexdigest()

# Validate
def validate_api_key(provided_key):
    provided_hash = sha256(provided_key.encode()).hexdigest()
    return ApiKey.objects.filter(key_hash=provided_hash).exists()
```

## Rate Limiting

### Strategies

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| **Fixed Window** | Reset every interval | Simple, some burst |
| **Sliding Window** | Rolling time window | Smoother limits |
| **Token Bucket** | Tokens refill over time | Allow bursts |
| **Leaky Bucket** | Constant output rate | Smooth traffic |

### Implementation

```python
# Redis-based sliding window
import redis
import time

def is_rate_limited(user_id, limit=100, window=60):
    r = redis.Redis()
    key = f"rate_limit:{user_id}"
    now = time.time()
    
    pipe = r.pipeline()
    pipe.zremrangebyscore(key, 0, now - window)
    pipe.zadd(key, {str(now): now})
    pipe.zcard(key)
    pipe.expire(key, window)
    results = pipe.execute()
    
    return results[2] > limit
```

### Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
Retry-After: 60  (when limited)
```

## Background Jobs

### Queue Patterns

```python
# Task definition
@celery.task(bind=True, max_retries=3)
def send_email(self, user_id, template):
    try:
        user = User.objects.get(id=user_id)
        EmailService.send(user.email, template)
    except Exception as exc:
        self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

# Enqueue
send_email.delay(user_id="123", template="welcome")

# With priority
send_email.apply_async(
    args=[user_id, template],
    queue="high_priority"
)
```

### Job Types

| Type | Use Case | Example |
|------|----------|---------|
| Fire-and-forget | Non-critical | Analytics events |
| Delayed | Scheduled | Reminders |
| Recurring | Periodic | Reports |
| Batch | Bulk processing | Imports |

## Database Patterns

### Migrations

```python
# Safe migration practices
class Migration:
    # 1. Add nullable column first
    operations = [
        AddColumn('users', 'new_field', nullable=True),
    ]

# Deploy code that writes to new field
# Backfill existing data

class Migration:
    # 2. Make non-nullable after backfill
    operations = [
        AlterColumn('users', 'new_field', nullable=False),
    ]
```

### Connection Pooling

```python
# Configure pool size based on:
# - Number of app instances
# - Database max_connections
# - Expected concurrency

DATABASE_CONFIG = {
    'pool_size': 10,
    'max_overflow': 20,
    'pool_timeout': 30,
    'pool_recycle': 1800,
}
```

## Observability

### Logging

```python
import structlog

logger = structlog.get_logger()

# Structured logs
logger.info(
    "user_created",
    user_id=user.id,
    tenant_id=tenant.id,
    email=user.email,
)

# Include request context
logger = logger.bind(
    request_id=request.id,
    tenant_id=request.tenant_id,
)
```

### Metrics

```python
from prometheus_client import Counter, Histogram

request_count = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

request_latency = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

# In middleware
with request_latency.labels(method, endpoint).time():
    response = handle_request(request)
request_count.labels(method, endpoint, response.status).inc()
```

### Distributed Tracing

```python
from opentelemetry import trace

tracer = trace.get_tracer(__name__)

with tracer.start_as_current_span("process_order") as span:
    span.set_attribute("order_id", order_id)
    span.set_attribute("tenant_id", tenant_id)
    
    # Child span
    with tracer.start_as_current_span("validate_inventory"):
        validate_inventory(order)
    
    with tracer.start_as_current_span("charge_payment"):
        charge_payment(order)
```

## Health Checks

```python
@app.route('/health')
def health():
    """Kubernetes readiness probe"""
    return {"status": "ok"}

@app.route('/health/live')
def liveness():
    """Kubernetes liveness probe"""
    return {"status": "ok"}

@app.route('/health/ready')
def readiness():
    """Check dependencies"""
    checks = {
        "database": check_database(),
        "redis": check_redis(),
        "external_api": check_external_api(),
    }
    
    if all(checks.values()):
        return {"status": "ok", "checks": checks}
    else:
        return {"status": "degraded", "checks": checks}, 503
```

## Additional Resources

For reference implementations, see [examples/](examples/) directory.
