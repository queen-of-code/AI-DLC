# C# / .NET Backend Patterns

## API Response Wrapper

```csharp
public class ApiResponse<T>
{
    public T? Data { get; set; }
    public bool Success { get; set; }
    public string? Message { get; set; }
    public List<string> Errors { get; set; } = new();

    public static ApiResponse<T> CreateSuccess(T data, string? message = null)
    {
        return new ApiResponse<T>
        {
            Data = data,
            Success = true,
            Message = message
        };
    }

    public static ApiResponse<T> CreateError(string message, List<string>? errors = null)
    {
        return new ApiResponse<T>
        {
            Success = false,
            Message = message,
            Errors = errors ?? new List<string>()
        };
    }
}
```

## Service Interface Pattern

```csharp
public interface IItemService
{
    // Read
    Task<ItemResponse?> GetItemAsync(Guid id, CancellationToken ct = default);
    Task<ListResponse> GetItemsAsync(GetItemsRequest request, CancellationToken ct = default);

    // Create
    Task<ItemResponse> CreateItemAsync(CreateRequest request, CancellationToken ct = default);

    // Update
    Task<ItemResponse> UpdateItemAsync(UpdateRequest request, CancellationToken ct = default);
    Task<bool> UpdateStatusAsync(Guid id, bool isActive, CancellationToken ct = default);

    // Delete
    Task<bool> DeleteItemAsync(Guid id, CancellationToken ct = default);

    // Validation
    Task<bool> ValidateOwnershipAsync(Guid itemId, Guid ownerId, CancellationToken ct = default);
    Task<bool> CanDeleteAsync(Guid id, CancellationToken ct = default);
}
```

## Service Implementation

```csharp
public class ItemService : IItemService
{
    private readonly IDatabaseService _databaseService;
    private readonly IMapper _mapper;
    private readonly ILogger<ItemService> _logger;

    public ItemService(
        IDatabaseService databaseService,
        IMapper mapper,
        ILogger<ItemService> logger)
    {
        _databaseService = databaseService;
        _mapper = mapper;
        _logger = logger;
    }

    public async Task<ItemResponse?> GetItemAsync(Guid id, CancellationToken ct = default)
    {
        try
        {
            _logger.LogInformation("Getting item {ItemId}", id);
            
            var item = await _databaseService.Get<Item>(id, ct);
            if (item == null)
            {
                _logger.LogWarning("Item not found: {ItemId}", id);
                return null;
            }

            return _mapper.Map<ItemResponse>(item);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting item {ItemId}", id);
            throw;
        }
    }
}
```

## Controller Pattern

```csharp
[ApiController]
[Route("api/[controller]")]
public class ItemsController : ControllerBase
{
    private readonly IItemService _service;
    private readonly ILogger<ItemsController> _logger;

    public ItemsController(IItemService service, ILogger<ItemsController> logger)
    {
        _service = service;
        _logger = logger;
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetItem(Guid id)
    {
        if (id == Guid.Empty)
            return BadRequest(ApiResponse<ItemResponse>.CreateError("Invalid ID"));

        try
        {
            var item = await _service.GetItemAsync(id);
            
            if (item == null)
                return NotFound(ApiResponse<ItemResponse>.CreateError("Item not found"));

            return Ok(ApiResponse<ItemResponse>.CreateSuccess(item));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving item {ItemId}", id);
            return StatusCode(500, ApiResponse<ItemResponse>.CreateError("Failed to retrieve item"));
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ApiResponse<ItemResponse>.CreateError(
                "Invalid request data",
                ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList()
            ));
        }

        try
        {
            _logger.LogInformation("Creating item for owner {OwnerId}", request.OwnerId);
            var item = await _service.CreateItemAsync(request);
            return Ok(ApiResponse<ItemResponse>.CreateSuccess(item, "Item created successfully"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating item");
            return StatusCode(500, ApiResponse<ItemResponse>.CreateError("Failed to create item"));
        }
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdateRequest request)
    {
        try
        {
            // Check existence
            var existing = await _service.GetItemAsync(request.Id);
            if (existing == null)
                return NotFound(ApiResponse<ItemResponse>.CreateError("Item not found"));

            // Validate ownership
            if (!await _service.ValidateOwnershipAsync(request.Id, request.OwnerId))
                return StatusCode(403, ApiResponse<ItemResponse>.CreateError("Permission denied"));

            var item = await _service.UpdateItemAsync(request);
            return Ok(ApiResponse<ItemResponse>.CreateSuccess(item, "Item updated"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating item {ItemId}", request.Id);
            return StatusCode(500, ApiResponse<ItemResponse>.CreateError("Failed to update item"));
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        if (id == Guid.Empty)
            return BadRequest(ApiResponse<object>.CreateError("Invalid ID"));

        try
        {
            if (!await _service.CanDeleteAsync(id))
                return BadRequest(ApiResponse<object>.CreateError("Item has active references"));

            var success = await _service.DeleteItemAsync(id);
            if (!success)
                return NotFound(ApiResponse<object>.CreateError("Item not found"));

            return Ok(ApiResponse<object>.CreateSuccess(new { id }, "Item deleted"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting item {ItemId}", id);
            return StatusCode(500, ApiResponse<object>.CreateError("Failed to delete item"));
        }
    }
}
```

## Dependency Injection Registration

```csharp
// Simple registration
builder.Services.AddScoped<IItemService, ItemService>();
builder.Services.AddScoped<IOrderService, OrderService>();

// Factory pattern for complex dependencies
builder.Services.AddSingleton<IStreamingService, StreamingService>(sp => 
{
    var httpClientFactory = sp.GetRequiredService<IHttpClientFactory>();
    var logger = sp.GetRequiredService<ILogger<StreamingService>>();
    var config = sp.GetRequiredService<IConfiguration>();
    
    var apiKey = config.GetValue<string>("External:ApiKey") 
        ?? throw new InvalidOperationException("ApiKey missing");
    
    return new StreamingService(httpClientFactory, logger, apiKey);
});

// Named HTTP clients
builder.Services.AddHttpClient("ExternalApi", client =>
{
    client.BaseAddress = new Uri(config.GetValue<string>("ExternalApi:Url")!);
    client.DefaultRequestHeaders.Add("Accept", "application/json");
});
```

## Structured Logging

```csharp
// Good: Structured with named properties
_logger.LogInformation("Creating item for owner {OwnerId}", request.OwnerId);
_logger.LogError(ex, "Error updating item {ItemId}", itemId);
_logger.LogInformation("Bulk updating {Count} items for owner {OwnerId}", count, ownerId);

// Bad: String interpolation loses structure
_logger.LogInformation($"Creating item for owner {request.OwnerId}");
```

## Retry with Exponential Backoff

```csharp
private async Task<T?> GetWithRetryAsync<T>(Guid id, CancellationToken ct = default)
{
    const int maxRetries = 5;
    const int baseDelayMs = 100;
    
    for (int attempt = 0; attempt < maxRetries; attempt++)
    {
        try
        {
            var item = await _databaseService.Get<T>(id, ct);
            if (item != null) return item;

            if (attempt < maxRetries - 1)
            {
                var delayMs = baseDelayMs * (int)Math.Pow(2, attempt);
                await Task.Delay(delayMs, ct);
            }
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Attempt {Attempt} failed for {Id}", attempt + 1, id);
            if (attempt == maxRetries - 1) throw;
            
            var delayMs = baseDelayMs * (int)Math.Pow(2, attempt);
            await Task.Delay(delayMs, ct);
        }
    }
    return default;
}
```

## AutoMapper Profile

```csharp
public class ItemMappingProfile : Profile
{
    public ItemMappingProfile()
    {
        // Entity -> Response
        CreateMap<Item, ItemResponse>();
        
        // Create request -> Entity (generate ID)
        CreateMap<CreateRequest, Item>()
            .ForMember(dest => dest.Id, opt => opt.MapFrom(_ => Guid.NewGuid()))
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(_ => DateTime.UtcNow));
        
        // Update request -> Entity
        CreateMap<UpdateRequest, Item>();
        
        // Handle nulls
        CreateMap<CreateRequest, Item>()
            .ForMember(dest => dest.ImageUrl, 
                opt => opt.MapFrom(src => src.ImageUrl ?? string.Empty));
    }
}
```

## Program.cs Organization

```csharp
var builder = WebApplication.CreateBuilder(args);

// 1. Configuration
var config = builder.Configuration;

// 2. Environment-specific setup
if (builder.Environment.IsProduction())
{
    builder.Logging.AddCloudLogging();
}

// 3. CORS
builder.Services.AddCors(options => { /* ... */ });

// 4. HTTP clients
builder.Services.AddHttpClient<IExternalService>();

// 5. Core services (singleton)
builder.Services.AddSingleton<IDatabaseService, DatabaseService>();

// 6. Business services (scoped)
builder.Services.AddScoped<IItemService, ItemService>();

// 7. AutoMapper
builder.Services.AddAutoMapper(typeof(ItemMappingProfile));

// 8. Controllers
builder.Services.AddControllers()
    .AddJsonOptions(opt => opt.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

var app = builder.Build();

// Middleware pipeline
app.UseMiddleware<ExceptionMiddleware>();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapGet("/health", () => new { Status = "OK" });

app.Run();
```
