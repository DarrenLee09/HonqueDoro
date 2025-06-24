using HonqueDoro.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Add Entity Framework
builder.Services.AddDbContext<HonqueDoroContext>(options =>
{
    // Use In-Memory database for development/demo purposes
    // For production, you would use SQL Server or another database provider
    options.UseInMemoryDatabase("HonqueDoroDb");
    
    // Uncomment below for SQL Server (and update connection string in appsettings.json)
    // options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
});

// Add CORS for Angular frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:4200") // Angular dev server
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    
    // Seed the database with initial data
    using (var scope = app.Services.CreateScope())
    {
        var context = scope.ServiceProvider.GetRequiredService<HonqueDoroContext>();
        context.Database.EnsureCreated();
        await SampleDataService.SeedSampleDataAsync(context);
    }
}

app.UseHttpsRedirection();

// Enable CORS
app.UseCors();

app.UseAuthorization();

app.MapControllers();

// Add some basic health check endpoint
app.MapGet("/health", () => "HonqueDoro API is running!");

app.Run();
