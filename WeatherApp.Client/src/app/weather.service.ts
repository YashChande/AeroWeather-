import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';

export interface WeatherRecord {
  id: number;
  location: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  isDay: boolean;
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiUrl = 'https://aeroweather-aau4.onrender.com/api/weather';

  constructor(private http: HttpClient) { }

  getWeather(location: string): Observable<WeatherRecord> {
    const cityName = location.split(',')[0].trim();

    // 1. Fetch Geocode directly from Open-Meteo in the user's browser (clean user IP)
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;

    return this.http.get<any>(geocodeUrl).pipe(
      switchMap(geoRes => {
        const results = geoRes?.results;
        if (!results || results.length === 0) {
          // If geocoding finds nothing, try querying backend fallback
          return this.http.get<WeatherRecord>(`${this.apiUrl}/${encodeURIComponent(cityName)}`);
        }

        const first = results[0];
        const lat = first.latitude;
        const lon = first.longitude;
        const resolvedName = first.name || cityName;

        // 2. Fetch Forecast directly from Open-Meteo in the user's browser
        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day`;

        return this.http.get<any>(forecastUrl).pipe(
          map(weatherRes => {
            const current = weatherRes.current;
            const record: WeatherRecord = {
              id: Date.now(),
              location: resolvedName,
              temperature: Math.round(current.temperature_2m * 10) / 10,
              humidity: current.relative_humidity_2m,
              windSpeed: current.wind_speed_10m,
              condition: this.getConditionFromCode(current.weather_code),
              isDay: current.is_day === 1,
              lastUpdated: new Date().toISOString()
            };

            // 3. Background sync to .NET backend SQLite database (non-blocking)
            this.syncWithBackend(record);

            return record;
          }),
          catchError(() => {
            // If direct forecast call fails, fallback to backend proxy
            return this.http.get<WeatherRecord>(`${this.apiUrl}/${encodeURIComponent(cityName)}`);
          })
        );
      }),
      catchError(err => {
        // Fallback to backend proxy if direct calls fail
        return this.http.get<WeatherRecord>(`${this.apiUrl}/${encodeURIComponent(cityName)}`);
      })
    );
  }

  private syncWithBackend(record: WeatherRecord): void {
    this.http.post<WeatherRecord>(this.apiUrl, record).pipe(
      catchError(() => of(null))
    ).subscribe();
  }

  private getConditionFromCode(code: number): string {
    switch (code) {
      case 0: return 'Clear sky';
      case 1:
      case 2:
      case 3: return 'Partly cloudy';
      case 45:
      case 48: return 'Fog';
      case 51:
      case 53:
      case 55: return 'Drizzle';
      case 61:
      case 63:
      case 65: return 'Rain';
      case 71:
      case 73:
      case 75: return 'Snow';
      case 95:
      case 96:
      case 99: return 'Thunderstorm';
      default: return 'Clear sky';
    }
  }
}
