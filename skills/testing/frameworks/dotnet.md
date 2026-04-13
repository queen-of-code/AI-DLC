# .NET Testing (xUnit / NUnit)

## Project Setup

```xml
<!-- Tests.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.*" />
    <PackageReference Include="xunit" Version="2.*" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.*" />
    <PackageReference Include="Moq" Version="4.*" />
    <PackageReference Include="Bogus" Version="35.*" />
    <PackageReference Include="FluentAssertions" Version="6.*" />
    <PackageReference Include="AutoMapper" Version="12.*" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\Server\Server.csproj" />
  </ItemGroup>
</Project>
```

## Test Class Structure

### xUnit

```csharp
using Xunit;
using Moq;
using FluentAssertions;

public class ItemServiceTests
{
    private readonly Mock<IDatabaseService> _mockDatabase;
    private readonly Mock<IMapper> _mockMapper;
    private readonly Mock<ILogger<ItemService>> _mockLogger;
    private readonly ItemService _sut;  // System Under Test

    public ItemServiceTests()
    {
        // Constructor runs before each test (like [SetUp])
        _mockDatabase = new Mock<IDatabaseService>();
        _mockMapper = new Mock<IMapper>();
        _mockLogger = new Mock<ILogger<ItemService>>();
        
        _sut = new ItemService(
            _mockDatabase.Object,
            _mockMapper.Object,
            _mockLogger.Object
        );
    }

    [Fact]
    public async Task GetItemAsync_WhenExists_ReturnsItem()
    {
        // Arrange
        var itemId = Guid.NewGuid();
        var item = new Item { Id = itemId, Name = "Test" };
        var expected = new ItemResponse { Id = itemId, Name = "Test" };
        
        _mockDatabase
            .Setup(db => db.Get<Item>(itemId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);
        _mockMapper
            .Setup(m => m.Map<ItemResponse>(item))
            .Returns(expected);

        // Act
        var result = await _sut.GetItemAsync(itemId);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(expected.Id);
        result.Name.Should().Be(expected.Name);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task CreateItemAsync_WithInvalidName_ThrowsValidationException(string? name)
    {
        // Arrange
        var request = new CreateItemRequest { Name = name!, Price = 100 };

        // Act
        var act = () => _sut.CreateItemAsync(request);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage("*Name*");
    }

    [Theory]
    [MemberData(nameof(GetInvalidPriceTestData))]
    public async Task CreateItemAsync_WithInvalidPrice_ThrowsValidationException(
        int price, 
        string expectedErrorPart)
    {
        // Arrange
        var request = new CreateItemRequest { Name = "Valid", Price = price };

        // Act
        var act = () => _sut.CreateItemAsync(request);

        // Assert
        await act.Should().ThrowAsync<ValidationException>()
            .WithMessage($"*{expectedErrorPart}*");
    }

    public static IEnumerable<object[]> GetInvalidPriceTestData()
    {
        yield return new object[] { -100, "negative" };
        yield return new object[] { 0, "zero" };
        yield return new object[] { int.MaxValue, "exceeds" };
    }
}
```

### NUnit

```csharp
using NUnit.Framework;
using Moq;

[TestFixture]
public class ItemServiceTests
{
    private Mock<IDatabaseService> _mockDatabase = null!;
    private Mock<IMapper> _mockMapper = null!;
    private ItemService _sut = null!;

    [SetUp]
    public void SetUp()
    {
        _mockDatabase = new Mock<IDatabaseService>();
        _mockMapper = new Mock<IMapper>();
        _sut = new ItemService(_mockDatabase.Object, _mockMapper.Object);
    }

    [TearDown]
    public void TearDown()
    {
        // Cleanup if needed
    }

    [Test]
    public async Task GetItemAsync_WhenExists_ReturnsItem()
    {
        // Arrange
        var itemId = Guid.NewGuid();
        var item = new Item { Id = itemId };
        
        _mockDatabase
            .Setup(db => db.Get<Item>(itemId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(item);

        // Act
        var result = await _sut.GetItemAsync(itemId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.Id, Is.EqualTo(itemId));
    }

    [TestCase("")]
    [TestCase("   ")]
    [TestCase(null)]
    public void CreateItemAsync_WithInvalidName_ThrowsException(string? name)
    {
        // Arrange
        var request = new CreateItemRequest { Name = name! };

        // Act & Assert
        Assert.ThrowsAsync<ValidationException>(
            () => _sut.CreateItemAsync(request)
        );
    }
}
```

## Moq Patterns

### Basic Setup

```csharp
// Return value
_mockService
    .Setup(s => s.GetAsync(It.IsAny<Guid>()))
    .ReturnsAsync(new Item());

// Return null
_mockService
    .Setup(s => s.GetAsync(It.IsAny<Guid>()))
    .ReturnsAsync((Item?)null);

// Throw exception
_mockService
    .Setup(s => s.GetAsync(It.IsAny<Guid>()))
    .ThrowsAsync(new NotFoundException());

// Conditional return
_mockService
    .Setup(s => s.GetAsync(It.Is<Guid>(id => id == targetId)))
    .ReturnsAsync(targetItem);

// Sequence of returns
_mockService
    .SetupSequence(s => s.GetAsync(It.IsAny<Guid>()))
    .ReturnsAsync(item1)
    .ReturnsAsync(item2)
    .ThrowsAsync(new Exception());
```

### Verification

```csharp
// Verify called once
_mockService.Verify(
    s => s.SaveAsync(It.IsAny<Item>()),
    Times.Once
);

// Verify called with specific argument
_mockService.Verify(
    s => s.SaveAsync(It.Is<Item>(i => i.Name == "Expected")),
    Times.Once
);

// Verify never called
_mockService.Verify(
    s => s.DeleteAsync(It.IsAny<Guid>()),
    Times.Never
);

// Verify call count
_mockService.Verify(
    s => s.GetAsync(It.IsAny<Guid>()),
    Times.Exactly(3)
);
```

### Callbacks

```csharp
// Capture argument
Item? capturedItem = null;
_mockService
    .Setup(s => s.SaveAsync(It.IsAny<Item>()))
    .Callback<Item>(item => capturedItem = item)
    .Returns(Task.CompletedTask);

// Act
await _sut.CreateAsync(request);

// Assert on captured
capturedItem.Should().NotBeNull();
capturedItem!.Name.Should().Be(request.Name);
```

## FluentAssertions

```csharp
// Basic assertions
result.Should().NotBeNull();
result.Should().Be(expected);
result.Should().BeEquivalentTo(expected);

// Collections
items.Should().HaveCount(3);
items.Should().Contain(expectedItem);
items.Should().BeInAscendingOrder(i => i.Name);
items.Should().AllSatisfy(i => i.IsActive.Should().BeTrue());

// Strings
name.Should().StartWith("Test");
name.Should().Contain("expected");
name.Should().MatchRegex(@"^\d{4}-\d{2}$");

// Numbers
price.Should().BePositive();
price.Should().BeInRange(100, 1000);
price.Should().BeApproximately(99.99m, 0.01m);

// Exceptions
var act = () => _sut.Process(null!);
act.Should().Throw<ArgumentNullException>()
    .WithParameterName("input");

var actAsync = () => _sut.ProcessAsync(null!);
await actAsync.Should().ThrowAsync<ValidationException>()
    .WithMessage("*required*");

// Object graphs
actual.Should().BeEquivalentTo(expected, options => options
    .Excluding(x => x.Id)
    .Excluding(x => x.CreatedAt)
);
```

## Test Data with Bogus

```csharp
using Bogus;

public static class TestDataFactory
{
    private static readonly Faker _faker = new Faker();
    
    // Simple factory
    public static TestUser CreateUser(string? email = null)
    {
        return new TestUser
        {
            Id = Guid.NewGuid(),
            Email = email ?? _faker.Internet.Email(),
            Name = _faker.Name.FullName(),
            Age = _faker.Random.Int(18, 80)
        };
    }
    
    // Faker rule sets
    private static readonly Faker<Item> ItemFaker = new Faker<Item>()
        .RuleFor(i => i.Id, f => Guid.NewGuid())
        .RuleFor(i => i.Name, f => f.Commerce.ProductName())
        .RuleFor(i => i.Description, f => f.Commerce.ProductDescription())
        .RuleFor(i => i.Price, f => f.Random.Int(100, 10000))
        .RuleFor(i => i.Category, f => f.PickRandom("digital", "physical"))
        .RuleFor(i => i.IsActive, f => f.Random.Bool(0.9f))
        .RuleFor(i => i.CreatedAt, f => f.Date.Past(1));
    
    public static Item CreateItem() => ItemFaker.Generate();
    public static List<Item> CreateItems(int count) => ItemFaker.Generate(count);
    
    // With customization
    public static Item CreateInactiveItem() => 
        ItemFaker.Clone()
            .RuleFor(i => i.IsActive, false)
            .Generate();
}
```

## AutoMapper Configuration Tests

```csharp
public class MappingProfileTests
{
    [Fact]
    public void AllProfiles_ShouldHaveValidConfiguration()
    {
        // Arrange
        var config = new MapperConfiguration(cfg =>
        {
            cfg.AddProfile<ItemMappingProfile>();
            cfg.AddProfile<UserMappingProfile>();
            cfg.AddProfile<OrderMappingProfile>();
        });

        // Act & Assert - catches ALL mapping errors
        config.AssertConfigurationIsValid();
    }

    [Fact]
    public void ItemMappingProfile_MapsEntityToResponse_Correctly()
    {
        // Arrange
        var config = new MapperConfiguration(cfg => 
            cfg.AddProfile<ItemMappingProfile>());
        var mapper = config.CreateMapper();
        
        var entity = TestDataFactory.CreateItem();

        // Act
        var response = mapper.Map<ItemResponse>(entity);

        // Assert
        response.Should().BeEquivalentTo(entity, options => options
            .ExcludingMissingMembers()  // Ignore fields not in response
        );
    }
}
```

## Integration Test Base

```csharp
public abstract class IntegrationTestBase : IAsyncLifetime
{
    protected HttpClient Client { get; private set; } = null!;
    protected WebApplicationFactory<Program> Factory { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        Factory = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(builder =>
            {
                builder.ConfigureServices(services =>
                {
                    // Replace real services with test doubles
                    services.RemoveAll<IDatabaseService>();
                    services.AddSingleton<IDatabaseService, InMemoryDatabaseService>();
                });
            });

        Client = Factory.CreateClient();
        
        await SeedTestData();
    }

    public async Task DisposeAsync()
    {
        Client.Dispose();
        await Factory.DisposeAsync();
    }

    protected virtual Task SeedTestData() => Task.CompletedTask;

    protected async Task<T> GetAsync<T>(string url)
    {
        var response = await Client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>() 
            ?? throw new InvalidOperationException("Null response");
    }

    protected async Task<T> PostAsync<T>(string url, object body)
    {
        var response = await Client.PostAsJsonAsync(url, body);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>()
            ?? throw new InvalidOperationException("Null response");
    }
}
```

## Running Tests

```bash
# Run all tests
dotnet test

# Run specific project
dotnet test ./Tests/Tests.csproj

# Run with filter
dotnet test --filter "FullyQualifiedName~ItemService"
dotnet test --filter "Category=Integration"

# Run with verbosity
dotnet test --logger "console;verbosity=detailed"

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"
```
