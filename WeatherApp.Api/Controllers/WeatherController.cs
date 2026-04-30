using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WeatherApp.Api.Data;
using WeatherApp.Api.Models;
using WeatherApp.Api.Services;

namespace WeatherApp.Api.Controllers
{
    [ApiController]
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
