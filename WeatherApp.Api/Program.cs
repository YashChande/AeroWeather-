using Microsoft.EntityFrameworkCore;
using WeatherApp.Api.Data;
using WeatherApp.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure SQLite Database
builder.Services.AddDbContext<WeatherDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Register HttpClient and WeatherService
builder.Services.AddHttpClient();
builder.Services.AddScoped<WeatherService>();

var app = builder.Build();

// Handle CORS preflight OPTIONS requests manually before routing
// This ensures Render/proxy doesn't 405 them
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("Access-Control-Allow-Origin", context.Request.Headers["Origin"].FirstOrDefault() ?? "*");
    context.Response.Headers.Append("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    context.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    context.Response.Headers.Append("Access-Control-Allow-Credentials", "true");

    if (context.Request.Method == "OPTIONS")
    {
        context.Response.StatusCode = 204;
        await context.Response.CompleteAsync();
        return;
    }

    await next();
});

app.UseRouting();
app.UseCors("AllowAll");
app.UseAuthorization();

app.MapControllers();

// Apply migrations on startup (for demonstration purposes)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<WeatherDbContext>();
    db.Database.Migrate();
}

app.Run();
