import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface WeatherRecord {
  id: number;
  location: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  lastUpdated: string;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiUrl = 'http://localhost:5147/api/weather'; // Changed to HTTP port to avoid certificate issues in browser

  constructor(private http: HttpClient) { }

  getWeather(location: string): Observable<WeatherRecord> {
    return this.http.get<WeatherRecord>(`${this.apiUrl}/${encodeURIComponent(location)}`);
  }
}
