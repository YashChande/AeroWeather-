namespace WeatherApp.Api.Models
{
    public class WeatherRecord
    {
        public int Id { get; set; }
        public string Location { get; set; } = string.Empty;
        public double Temperature { get; set; }
        public double Humidity { get; set; }
        public double WindSpeed { get; set; }
        public string Condition { get; set; } = string.Empty;
        public bool IsDay { get; set; }
        public DateTime LastUpdated { get; set; }
    }
}
