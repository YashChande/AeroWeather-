import { Component, HostListener } from '@angular/core';
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

  mouseX = window.innerWidth / 2;
  mouseY = window.innerHeight / 2;

  constructor(private weatherService: WeatherService) {}

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;
  }

  get backgroundStyle() {
    return {
      background: `radial-gradient(circle at ${this.mouseX}px ${this.mouseY}px, rgba(255, 255, 255, 0.12) 0%, rgba(0, 0, 0, 0.8) 50%, #050505 100%)`
    };
  }

  searchWeather() {
    if (!this.searchQuery.trim()) return;
    
    this.loading = true;
    this.error = null;
    this.weatherData = null;

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
      }
      this.loading = false;
    });
  }

  getWeatherIcon(condition: string): string {
    const cond = condition.toLowerCase();
    if (cond.includes('clear')) return '☀️';
    if (cond.includes('cloud')) return '☁️';
    if (cond.includes('rain') || cond.includes('drizzle')) return '🌧️';
    if (cond.includes('snow')) return '❄️';
    if (cond.includes('thunder')) return '⛈️';
    return '🌡️';
  }
}
