using System.Text.Json;
using WeatherApp.Api.Models;

namespace WeatherApp.Api.Services
{
    public class WeatherService
    {
        private readonly HttpClient _httpClient;

        public WeatherService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<WeatherRecord?> FetchWeatherAsync(string location)
        {
            // 1. Geocode
            var geocodeUrl = $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(location)}&count=1";
            var geocodeResponse = await _httpClient.GetAsync(geocodeUrl);
            
            if (!geocodeResponse.IsSuccessStatusCode) return null;

            var geocodeContent = await geocodeResponse.Content.ReadAsStringAsync();
            using var geocodeJson = JsonDocument.Parse(geocodeContent);
            
            if (!geocodeJson.RootElement.TryGetProperty("results", out var results) || results.GetArrayLength() == 0)
                return null;

            var firstResult = results[0];
            var lat = firstResult.GetProperty("latitude").GetDouble();
            var lon = firstResult.GetProperty("longitude").GetDouble();
            var resolvedName = firstResult.GetProperty("name").GetString() ?? location;

            // 2. Fetch Weather
            var weatherUrl = $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code";
            var weatherResponse = await _httpClient.GetAsync(weatherUrl);

            if (!weatherResponse.IsSuccessStatusCode) return null;

            var weatherContent = await weatherResponse.Content.ReadAsStringAsync();
            using var weatherJson = JsonDocument.Parse(weatherContent);

            var current = weatherJson.RootElement.GetProperty("current");
            var temperature = current.GetProperty("temperature_2m").GetDouble();
            var humidity = current.GetProperty("relative_humidity_2m").GetDouble();
            var windSpeed = current.GetProperty("wind_speed_10m").GetDouble();
            var weatherCode = current.GetProperty("weather_code").GetInt32();

            var condition = GetConditionFromCode(weatherCode);

            return new WeatherRecord
            {
                Location = resolvedName,
                Temperature = temperature,
                Humidity = humidity,
                WindSpeed = windSpeed,
                Condition = condition,
                LastUpdated = DateTime.UtcNow
            };
        }

        private string GetConditionFromCode(int code)
        {
            // Simple mapping based on WMO Weather interpretation codes
            return code switch
            {
                0 => "Clear sky",
                1 or 2 or 3 => "Partly cloudy",
                45 or 48 => "Fog",
                51 or 53 or 55 => "Drizzle",
                61 or 63 or 65 => "Rain",
                71 or 73 or 75 => "Snow",
                95 or 96 or 99 => "Thunderstorm",
                _ => "Unknown"
            };
        }
    }
}
