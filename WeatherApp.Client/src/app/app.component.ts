import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WeatherService, WeatherRecord } from './weather.service';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  searchQuery: string = '';
  weatherData: WeatherRecord | null = null;
  loading: boolean = false;
  error: string | null = null;
  weatherTheme: string = 'theme-default';

  constructor(private weatherService: WeatherService) {}

  searchWeather() {
    if (!this.searchQuery.trim()) return;
    
    this.loading = true;
    this.error = null;
    this.weatherData = null;
    this.weatherTheme = 'theme-default';

    this.weatherService.getWeather(this.searchQuery).pipe(
      catchError(err => {
        this.error = "Could not fetch weather data. Please check the location and try again.";
        this.loading = false;
        return of(null);
      })
    ).subscribe(data => {
      if (data) {
        this.weatherData = data;
        this.error = null;
        this.updateWeatherTheme(data);
      }
      this.loading = false;
    });
  }

  updateWeatherTheme(data: WeatherRecord) {
    const cond = data.condition.toLowerCase();
    
    if (cond.includes('clear')) {
      this.weatherTheme = data.isDay ? 'theme-sunny' : 'theme-clear-night';
    } else if (cond.includes('cloud') || cond.includes('fog')) {
      this.weatherTheme = data.isDay ? 'theme-cloudy-day' : 'theme-cloudy-night';
    } else if (cond.includes('rain') || cond.includes('drizzle')) {
      this.weatherTheme = 'theme-rainy';
    } else if (cond.includes('snow')) {
      this.weatherTheme = 'theme-snowy';
    } else if (cond.includes('thunder')) {
      this.weatherTheme = 'theme-stormy';
    } else {
      this.weatherTheme = 'theme-default';
    }
  }

  getWeatherIcon(condition: string, isDay: boolean): string {
    const cond = condition.toLowerCase();
    if (cond.includes('clear')) return isDay ? '☀️' : '🌙';
    if (cond.includes('cloud')) return isDay ? '⛅' : '☁️';
    if (cond.includes('rain') || cond.includes('drizzle')) return '🌧️';
    if (cond.includes('snow')) return '❄️';
    if (cond.includes('thunder')) return '⛈️';
    return '🌡️';
  }
}
