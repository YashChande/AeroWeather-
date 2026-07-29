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
    return this.http.get<WeatherRecord>(`${this.apiUrl}/${encodeURIComponent(location)}`);
  }
}
