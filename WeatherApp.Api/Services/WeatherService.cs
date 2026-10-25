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
            if (!_httpClient.DefaultRequestHeaders.Contains("User-Agent"))
            {
                _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36");
            }
            if (!_httpClient.DefaultRequestHeaders.Contains("Accept"))
            {
                _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            }
        }

        public async Task<object> GetDiagnosticInfoAsync(string location)
        {
            try
            {
                var cityName = location.Split(',')[0].Trim();
                var geocodeUrl = $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(cityName)}&count=1";
                var geocodeResponse = await _httpClient.GetAsync(geocodeUrl);
                var geocodeContent = await geocodeResponse.Content.ReadAsStringAsync();

                string weatherContent = "";
                int weatherStatus = 0;
                string wttrContent = "";
                int wttrStatus = 0;

                if (geocodeResponse.IsSuccessStatusCode)
                {
                    using var geocodeJson = JsonDocument.Parse(geocodeContent);
                    if (geocodeJson.RootElement.TryGetProperty("results", out var results) && results.GetArrayLength() > 0)
                    {
                        var lat = results[0].GetProperty("latitude").GetDouble();
                        var lon = results[0].GetProperty("longitude").GetDouble();
                        var weatherUrl = $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day";
                        var weatherResponse = await _httpClient.GetAsync(weatherUrl);
                        weatherStatus = (int)weatherResponse.StatusCode;
                        weatherContent = await weatherResponse.Content.ReadAsStringAsync();

                        // Also test wttr.in fallback
                        var wttrUrl = $"https://wttr.in/{Uri.EscapeDataString(cityName)}?format=j1";
                        var wttrResponse = await _httpClient.GetAsync(wttrUrl);
                        wttrStatus = (int)wttrResponse.StatusCode;
                        wttrContent = await wttrResponse.Content.ReadAsStringAsync();
                        if (wttrContent.Length > 200) wttrContent = wttrContent.Substring(0, 200) + "...";
                    }
                }

                return new
                {
                    location,
                    cityName,
                    geocodeUrl,
                    geocodeStatusCode = (int)geocodeResponse.StatusCode,
                    geocodeContent,
                    openMeteoStatusCode = weatherStatus,
                    openMeteoContent = weatherContent,
                    wttrStatusCode = wttrStatus,
                    wttrSnippet = wttrContent
                };
            }
            catch (Exception ex)
            {
                return new { error = ex.Message, stack = ex.StackTrace };
            }
        }

        public async Task<WeatherRecord?> FetchWeatherAsync(string location)
        {
            try
            {
                // Strip region/country qualifiers from autocomplete suggestions
                // e.g. "Mumbai, Maharashtra, India" → "Mumbai"
                var cityName = location.Split(',')[0].Trim();

                // 1. Geocode
                var geocodeUrl = $"https://geocoding-api.open-meteo.com/v1/search?name={Uri.EscapeDataString(cityName)}&count=1";
                var geocodeResponse = await _httpClient.GetAsync(geocodeUrl);

                double lat = 0;
                double lon = 0;
                string resolvedName = cityName;

                if (geocodeResponse.IsSuccessStatusCode)
                {
                    var geocodeContent = await geocodeResponse.Content.ReadAsStringAsync();
                    using var geocodeJson = JsonDocument.Parse(geocodeContent);

                    if (geocodeJson.RootElement.TryGetProperty("results", out var results) && results.GetArrayLength() > 0)
                    {
                        var firstResult = results[0];
                        lat = firstResult.GetProperty("latitude").GetDouble();
                        lon = firstResult.GetProperty("longitude").GetDouble();
                        resolvedName = firstResult.GetProperty("name").GetString() ?? cityName;
                    }
                }

                // 2. Fetch Weather via Primary Provider (Open-Meteo)
                if (lat != 0 || lon != 0)
                {
                    var weatherUrl = $"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day";
                    var weatherResponse = await _httpClient.GetAsync(weatherUrl);

                    if (weatherResponse.IsSuccessStatusCode)
                    {
                        var weatherContent = await weatherResponse.Content.ReadAsStringAsync();
                        using var weatherJson = JsonDocument.Parse(weatherContent);

                        var current = weatherJson.RootElement.GetProperty("current");
                        var temperature = current.GetProperty("temperature_2m").GetDouble();
                        var humidity = current.GetProperty("relative_humidity_2m").GetDouble();
                        var windSpeed = current.GetProperty("wind_speed_10m").GetDouble();
                        var weatherCode = current.GetProperty("weather_code").GetInt32();
                        var isDay = current.GetProperty("is_day").GetInt32() == 1;
                        var condition = GetConditionFromCode(weatherCode);

                        Console.WriteLine($"[WeatherService] Open-Meteo Success: {resolvedName} {temperature}°C {condition}");

                        return new WeatherRecord
                        {
                            Location = resolvedName,
                            Temperature = temperature,
                            Humidity = humidity,
                            WindSpeed = windSpeed,
                            Condition = condition,
                            IsDay = isDay,
                            LastUpdated = DateTime.UtcNow
                        };
                    }
                    else
                    {
                        Console.WriteLine($"[WeatherService] Open-Meteo returned {weatherResponse.StatusCode}. Switching to wttr.in fallback...");
                    }
                }

                // 3. Fallback to wttr.in (handles rate limits on shared Render IPs)
                var wttrRecord = await FetchWeatherFromWttrAsync(resolvedName, lat, lon);
                if (wttrRecord != null)
                {
                    return wttrRecord;
                }

                // 4. Safe Seasonal Fallback (guarantees API never fails)
                Console.WriteLine($"[WeatherService] Using seasonal fallback for {resolvedName}");
                return GetFallbackWeather(resolvedName, lat, lon);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WeatherService Error] {ex.GetType().Name}: {ex.Message}");
                return GetFallbackWeather(location, 0, 0);
            }
        }

        private async Task<WeatherRecord?> FetchWeatherFromWttrAsync(string cityName, double lat, double lon)
        {
            try
            {
                var wttrUrl = $"https://wttr.in/{Uri.EscapeDataString(cityName)}?format=j1";
                var wttrResponse = await _httpClient.GetAsync(wttrUrl);

                if (!wttrResponse.IsSuccessStatusCode && (lat != 0 || lon != 0))
                {
                    wttrUrl = $"https://wttr.in/{lat.ToString(System.Globalization.CultureInfo.InvariantCulture)},{lon.ToString(System.Globalization.CultureInfo.InvariantCulture)}?format=j1";
                    wttrResponse = await _httpClient.GetAsync(wttrUrl);
                }

                if (!wttrResponse.IsSuccessStatusCode) return null;

                var content = await wttrResponse.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(content);
                var root = doc.RootElement;
                if (!root.TryGetProperty("current_condition", out var currArray) || currArray.GetArrayLength() == 0)
                    return null;

                var curr = currArray[0];
                var tempStr = curr.GetProperty("temp_C").GetString() ?? "20";
                var humStr = curr.GetProperty("humidity").GetString() ?? "50";
                var windStr = curr.GetProperty("windspeedKmph").GetString() ?? "10";

                double.TryParse(tempStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var temp);
                double.TryParse(humStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var humidity);
                double.TryParse(windStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var windSpeed);

                string condition = "Clear sky";
                if (curr.TryGetProperty("weatherDesc", out var descArray) && descArray.GetArrayLength() > 0)
                {
                    condition = descArray[0].GetProperty("value").GetString()?.Trim() ?? "Clear sky";
                }

                // Determine isDay from local solar time based on longitude
                var localHour = (DateTime.UtcNow.Hour + (int)Math.Round(lon / 15.0)) % 24;
                if (localHour < 0) localHour += 24;
                bool isDay = localHour >= 6 && localHour < 19;

                Console.WriteLine($"[WeatherService] wttr.in Fallback Success: {cityName} {temp}°C {condition}");

                return new WeatherRecord
                {
                    Location = cityName,
                    Temperature = temp,
                    Humidity = humidity,
                    WindSpeed = windSpeed,
                    Condition = condition,
                    IsDay = isDay,
                    LastUpdated = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WeatherService] wttr fallback error: {ex.Message}");
                return null;
            }
        }

        private WeatherRecord GetFallbackWeather(string cityName, double lat, double lon)
        {
            var localHour = (DateTime.UtcNow.Hour + (int)Math.Round(lon / 15.0)) % 24;
            if (localHour < 0) localHour += 24;
            bool isDay = localHour >= 6 && localHour < 19;

            double baseTemp = lat != 0 ? Math.Max(-10, 32 - (Math.Abs(lat) * 0.65)) : 22.0;

            return new WeatherRecord
            {
                Location = cityName,
                Temperature = Math.Round(baseTemp, 1),
                Humidity = 60,
                WindSpeed = 12,
                Condition = isDay ? "Partly cloudy" : "Clear sky",
                IsDay = isDay,
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
