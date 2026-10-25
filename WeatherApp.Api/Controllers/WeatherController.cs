using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WeatherApp.Api.Data;
using WeatherApp.Api.Models;
using WeatherApp.Api.Services;

namespace WeatherApp.Api.Controllers
{
    [ApiController]
    [EnableCors("AllowAll")]
    [Route("api/[controller]")]
    public class WeatherController : ControllerBase
    {
        private readonly WeatherDbContext _dbContext;
        private readonly WeatherService _weatherService;

        public WeatherController(WeatherDbContext dbContext, WeatherService weatherService)
        {
            _dbContext = dbContext;
            _weatherService = weatherService;
        }

        [HttpGet("ping", Order = -1)]
        public IActionResult Ping()
        {
            return Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
        }

        [HttpGet("diag/{location}", Order = -1)]
        public async Task<IActionResult> Diag(string location)
        {
            var diag = await _weatherService.GetDiagnosticInfoAsync(location);
            return Ok(diag);
        }

        [HttpPost]
        public async Task<IActionResult> SaveWeather([FromBody] WeatherRecord record)
        {
            if (record == null || string.IsNullOrWhiteSpace(record.Location))
            {
                return BadRequest("Invalid weather record");
            }

            var cachedWeather = await _dbContext.WeatherRecords
                .FirstOrDefaultAsync(w => w.Location.ToLower() == record.Location.ToLower());

            if (cachedWeather != null)
            {
                cachedWeather.Temperature = record.Temperature;
                cachedWeather.Humidity = record.Humidity;
                cachedWeather.WindSpeed = record.WindSpeed;
                cachedWeather.Condition = record.Condition;
                cachedWeather.IsDay = record.IsDay;
                cachedWeather.LastUpdated = DateTime.UtcNow;
            }
            else
            {
                record.LastUpdated = DateTime.UtcNow;
                _dbContext.WeatherRecords.Add(record);
            }

            await _dbContext.SaveChangesAsync();
            return Ok(cachedWeather ?? record);
        }

        [HttpGet("{location}")]
        public async Task<IActionResult> GetWeather(string location)
        {
            // 1. Check cache (database)
            var cachedWeather = await _dbContext.WeatherRecords
                .FirstOrDefaultAsync(w => w.Location.ToLower() == location.ToLower());

            if (cachedWeather != null && (DateTime.UtcNow - cachedWeather.LastUpdated).TotalMinutes < 15)
            {
                return Ok(cachedWeather);
            }

            // 2. Fetch from API
            var newWeather = await _weatherService.FetchWeatherAsync(location);

            if (newWeather == null)
            {
                return NotFound($"Weather data not found for location: {location}");
            }

            // 3. Update cache
            if (cachedWeather != null)
            {
                cachedWeather.Temperature = newWeather.Temperature;
                cachedWeather.Humidity = newWeather.Humidity;
                cachedWeather.WindSpeed = newWeather.WindSpeed;
                cachedWeather.Condition = newWeather.Condition;
                cachedWeather.LastUpdated = newWeather.LastUpdated;
            }
            else
            {
                _dbContext.WeatherRecords.Add(newWeather);
            }

            await _dbContext.SaveChangesAsync();

            var returnRecord = cachedWeather ?? newWeather;
            return Ok(returnRecord);
        }
    }
}
