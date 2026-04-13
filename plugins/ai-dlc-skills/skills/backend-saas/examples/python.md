# Python / FastAPI Backend Patterns

## API Response Wrapper

```python
from typing import TypeVar, Generic, Optional, List
from pydantic import BaseModel

T = TypeVar('T')

class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None
    message: Optional[str] = None
    errors: List[str] = []

    @classmethod
    def create_success(cls, data: T, message: str = None) -> "ApiResponse[T]":
        return cls(success=True, data=data, message=message)

    @classmethod
    def create_error(cls, message: str, errors: List[str] = None) -> "ApiResponse[T]":
        return cls(success=False, message=message, errors=errors or [])
```

## Service Interface (Protocol)

```python
from typing import Protocol, Optional, List
from uuid import UUID

class ItemServiceProtocol(Protocol):
    # Read
    async def get_item(self, item_id: UUID) -> Optional[ItemResponse]: ...
    async def get_items(self, request: GetItemsRequest) -> ListResponse: ...

    # Create
    async def create_item(self, request: CreateRequest) -> ItemResponse: ...

    # Update
    async def update_item(self, request: UpdateRequest) -> ItemResponse: ...
    async def update_status(self, item_id: UUID, is_active: bool) -> bool: ...

    # Delete
    async def delete_item(self, item_id: UUID) -> bool: ...

    # Validation
    async def validate_ownership(self, item_id: UUID, owner_id: UUID) -> bool: ...
    async def can_delete(self, item_id: UUID) -> bool: ...
```

## Service Implementation

```python
import logging
from uuid import UUID
from typing import Optional

logger = logging.getLogger(__name__)

class ItemService:
    def __init__(self, db: DatabaseService, mapper: Mapper):
        self._db = db
        self._mapper = mapper

    async def get_item(self, item_id: UUID) -> Optional[ItemResponse]:
        try:
            logger.info("Getting item", extra={"item_id": str(item_id)})
            
            item = await self._db.get(Item, item_id)
            if item is None:
                logger.warning("Item not found", extra={"item_id": str(item_id)})
                return None

            return self._mapper.map(item, ItemResponse)
        except Exception as e:
            logger.error("Error getting item", extra={"item_id": str(item_id)}, exc_info=e)
            raise

    async def create_item(self, request: CreateRequest) -> ItemResponse:
        try:
            logger.info("Creating item", extra={"owner_id": str(request.owner_id)})
            
            item = self._mapper.map(request, Item)
            item.id = uuid4()
            item.created_at = datetime.utcnow()
            
            await self._db.add(item)
            
            return self._mapper.map(item, ItemResponse)
        except Exception as e:
            logger.error("Error creating item", exc_info=e)
            raise
```

## Router Pattern

```python
from fastapi import APIRouter, Depends, HTTPException, status
from uuid import UUID

router = APIRouter(prefix="/items", tags=["items"])

@router.get("/{item_id}")
async def get_item(
    item_id: UUID,
    service: ItemService = Depends(get_item_service)
) -> ApiResponse[ItemResponse]:
    if item_id == UUID(int=0):
        raise HTTPException(status_code=400, detail="Invalid ID")

    try:
        item = await service.get_item(item_id)
        
        if item is None:
            return ApiResponse.create_error("Item not found")

        return ApiResponse.create_success(item)
    except Exception as e:
        logger.error("Error retrieving item", extra={"item_id": str(item_id)}, exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to retrieve item")


@router.post("/")
async def create_item(
    request: CreateRequest,
    service: ItemService = Depends(get_item_service)
) -> ApiResponse[ItemResponse]:
    try:
        logger.info("Creating item", extra={"owner_id": str(request.owner_id)})
        item = await service.create_item(request)
        return ApiResponse.create_success(item, "Item created successfully")
    except ValidationError as e:
        return ApiResponse.create_error("Invalid request", errors=e.errors())
    except Exception as e:
        logger.error("Error creating item", exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to create item")


@router.put("/")
async def update_item(
    request: UpdateRequest,
    service: ItemService = Depends(get_item_service)
) -> ApiResponse[ItemResponse]:
    try:
        # Check existence
        existing = await service.get_item(request.id)
        if existing is None:
            return ApiResponse.create_error("Item not found")

        # Validate ownership
        if not await service.validate_ownership(request.id, request.owner_id):
            raise HTTPException(status_code=403, detail="Permission denied")

        item = await service.update_item(request)
        return ApiResponse.create_success(item, "Item updated")
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating item", extra={"item_id": str(request.id)}, exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to update item")


@router.delete("/{item_id}")
async def delete_item(
    item_id: UUID,
    service: ItemService = Depends(get_item_service)
) -> ApiResponse[dict]:
    if item_id == UUID(int=0):
        raise HTTPException(status_code=400, detail="Invalid ID")

    try:
        if not await service.can_delete(item_id):
            return ApiResponse.create_error("Item has active references")

        success = await service.delete_item(item_id)
        if not success:
            return ApiResponse.create_error("Item not found")

        return ApiResponse.create_success({"id": str(item_id)}, "Item deleted")
    except Exception as e:
        logger.error("Error deleting item", extra={"item_id": str(item_id)}, exc_info=e)
        raise HTTPException(status_code=500, detail="Failed to delete item")
```

## Dependency Injection

```python
from functools import lru_cache
from fastapi import Depends

@lru_cache()
def get_settings() -> Settings:
    return Settings()

def get_db(settings: Settings = Depends(get_settings)) -> Database:
    return Database(settings.database_url)

def get_item_service(
    db: Database = Depends(get_db),
    mapper: Mapper = Depends(get_mapper)
) -> ItemService:
    return ItemService(db, mapper)
```

## Structured Logging

```python
import structlog

logger = structlog.get_logger()

# Good: Structured with named fields
logger.info("Creating item", owner_id=str(request.owner_id))
logger.error("Error updating item", item_id=str(item_id), exc_info=True)
logger.info("Bulk updating items", count=len(items), owner_id=str(owner_id))

# Bad: String interpolation
logger.info(f"Creating item for owner {request.owner_id}")
```

## Retry with Exponential Backoff

```python
import asyncio
from typing import TypeVar, Callable, Awaitable

T = TypeVar('T')

async def retry_with_backoff(
    operation: Callable[[], Awaitable[T]],
    max_retries: int = 5,
    base_delay_ms: int = 100
) -> T:
    for attempt in range(max_retries):
        try:
            return await operation()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            
            delay_ms = base_delay_ms * (2 ** attempt)
            logger.warning(
                "Retry attempt failed",
                attempt=attempt + 1,
                delay_ms=delay_ms,
                error=str(e)
            )
            await asyncio.sleep(delay_ms / 1000)
    
    raise RuntimeError("Unexpected retry failure")
```

## Pydantic Models

```python
from pydantic import BaseModel, Field
from typing import Optional, Dict
from uuid import UUID
from datetime import datetime

class Item(BaseModel):
    id: UUID
    owner_id: UUID
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(max_length=500)
    price: int = Field(ge=0)  # cents
    category: str
    image_url: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

class CreateRequest(BaseModel):
    owner_id: UUID
    name: str = Field(min_length=1, max_length=100)
    description: str
    price: int = Field(ge=0)
    category: str
    image_url: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None

class UpdateRequest(CreateRequest):
    id: UUID

class ItemResponse(BaseModel):
    id: UUID
    owner_id: UUID
    name: str
    description: str
    price: int
    category: str
    image_url: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

## Application Setup

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_database()
    yield
    # Shutdown
    await close_database()

app = FastAPI(
    title="My API",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(items_router)
app.include_router(orders_router)

# Health check
@app.get("/health")
async def health():
    return {"status": "ok"}
```
