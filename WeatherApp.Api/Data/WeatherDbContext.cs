using Microsoft.EntityFrameworkCore;
using WeatherApp.Api.Models;

namespace WeatherApp.Api.Data
{
    public class WeatherDbContext : DbContext
    {
        public WeatherDbContext(DbContextOptions<WeatherDbContext> options) : base(options)
        {
        }

        public DbSet<WeatherRecord> WeatherRecords { get; set; }
    }
}
