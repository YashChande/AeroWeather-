import {
  Component, Input, Output, EventEmitter,
  OnInit, OnDestroy, OnChanges, SimpleChanges,
  ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WeatherRecord } from '../weather.service';
import * as L from 'leaflet';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of, forkJoin, Subject } from 'rxjs';

export interface CityMapData {
  record: WeatherRecord;
  lat: number;
  lon: number;
  marker?: L.Marker;
}

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-view.component.html',
  styleUrl: './map-view.component.css'
})
export class MapViewComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input() cities: WeatherRecord[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() removeCity = new EventEmitter<string>();
  @Output() addCity = new EventEmitter<string>();

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private map!: L.Map;
  cityMapData: CityMapData[] = [];
  loadingMap = true;
  newCityInput = '';

  // Panel Autocomplete
  panelSuggestions: string[] = [];
  showPanelSuggestions: boolean = false;
  private searchSubject = new Subject<string>();

  constructor(private http: HttpClient) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.trim().length < 2) return of([]);
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        return this.http.get<any>(url).pipe(catchError(() => of({ results: [] })));
      })
    ).subscribe((res: any) => {
      this.panelSuggestions = (res?.results || []).map((r: any) =>
        [r.name, r.admin1, r.country].filter(Boolean).join(', ')
      );
      this.showPanelSuggestions = this.panelSuggestions.length > 0;
    });
  }

  ngOnInit() {}

  ngAfterViewInit() {
    this.initMap();
    this.loadCities();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['cities'] && !changes['cities'].firstChange && this.map) {
      this.loadCities();
    }
  }

  ngOnDestroy() {
    if (this.map) this.map.remove();
  }

  onPanelInputChange() {
    this.searchSubject.next(this.newCityInput);
  }

  selectPanelSuggestion(suggestion: string) {
    this.addCity.emit(suggestion);
    this.newCityInput = '';
    this.showPanelSuggestions = false;
    this.panelSuggestions = [];
  }

  hidePanelSuggestions() {
    setTimeout(() => { this.showPanelSuggestions = false; }, 150);
  }

  handleAddCity() {
    if (!this.newCityInput.trim()) return;
    this.addCity.emit(this.newCityInput.trim());
    this.newCityInput = '';
    this.showPanelSuggestions = false;
  }

  private initMap() {
    const southWest = L.latLng(-85, -180);
    const northEast = L.latLng(85, 180);
    const bounds = L.latLngBounds(southWest, northEast);

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      attributionControl: false,
      maxBounds: bounds,
      maxBoundsViscosity: 1.0,
      worldCopyJump: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
      minZoom: 2,
      subdomains: 'abcd',
      noWrap: true,
      bounds: bounds,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 350);
  }

  private loadCities() {
    if (!this.cities.length) { 
      this.loadingMap = false; 
      setTimeout(() => this.map?.invalidateSize(), 100);
      return; 
    }

    this.cityMapData.forEach(c => { if (c.marker) this.map.removeLayer(c.marker); });
    this.cityMapData = [];
    this.loadingMap = true;

    const geocodeRequests = this.cities.map(city => {
      const cityName = city.location.split(',')[0].trim();
      return this.http.get<any>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
      ).pipe(catchError(() => of(null)));
    });

    forkJoin(geocodeRequests).subscribe(results => {
      results.forEach((res, i) => {
        const city = this.cities[i];
        if (!res?.results?.length) return;
        const { latitude: lat, longitude: lon } = res.results[0];
        const data: CityMapData = { record: city, lat, lon };
        data.marker = this.createMarker(data);
        this.cityMapData.push(data);
      });

      this.loadingMap = false;

      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          if (this.cityMapData.length > 0) {
            const bounds = L.latLngBounds(this.cityMapData.map(c => [c.lat, c.lon] as L.LatLngTuple));
            this.map.fitBounds(bounds, { padding: [80, 80], maxZoom: 6 });
          }
        }
      }, 200);
    });
  }

  private createMarker(data: CityMapData): L.Marker {
    const { record, lat, lon } = data;
    const icon = this.getWeatherIcon(record.condition, record.isDay);
    const colorClass = this.getThemeClass(record.condition, record.isDay);
    const temp = Math.round(record.temperature);

    const html = `
      <div class="custom-marker ${colorClass}">
        <div class="marker-pulse"></div>
        <div class="marker-icon animated-weather-icon">${icon}</div>
        <div class="marker-details">
          <span class="marker-city">${record.location}</span>
          <span class="marker-temp">${temp}°C</span>
        </div>
      </div>`;

    const leafletIcon = L.divIcon({
      html,
      className: 'custom-div-icon',
      iconSize: [110, 56],
      iconAnchor: [55, 28],
      popupAnchor: [0, -32]
    });

    const marker = L.marker([lat, lon], { icon: leafletIcon }).addTo(this.map);

    marker.bindPopup(`
      <div class="map-popup">
        <div class="popup-city">${record.location}</div>
        <div class="popup-temp">${icon} ${temp}°C</div>
        <div class="popup-condition">${record.condition}</div>
        <div class="popup-details">
          💧 ${record.humidity}% &nbsp; 💨 ${Math.round(record.windSpeed)} km/h
        </div>
      </div>`, { className: 'custom-popup' });

    return marker;
  }

  deleteCityFromMap(location: string) {
    const idx = this.cityMapData.findIndex(c => c.record.location === location);
    if (idx !== -1) {
      if (this.cityMapData[idx].marker) this.map.removeLayer(this.cityMapData[idx].marker!);
      this.cityMapData.splice(idx, 1);
    }
    this.removeCity.emit(location);
  }

  flyToCity(data: CityMapData) {
    this.map.flyTo([data.lat, data.lon], 6, { duration: 1.5 });
    data.marker?.openPopup();
  }

  getWeatherIcon(condition: string, isDay: boolean): string {
    const c = condition.toLowerCase();
    if (c.includes('clear')) return isDay ? '☀️' : '🌙';
    if (c.includes('cloud')) return isDay ? '⛅' : '☁️';
    if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
    if (c.includes('snow')) return '❄️';
    if (c.includes('thunder')) return '⛈️';
    if (c.includes('fog')) return '🌫️';
    return '🌡️';
  }

  getThemeClass(condition: string, isDay: boolean): string {
    const c = condition.toLowerCase();
    if (c.includes('clear')) return isDay ? 'marker-sunny' : 'marker-night';
    if (c.includes('cloud') || c.includes('fog')) return 'marker-cloudy';
    if (c.includes('rain') || c.includes('drizzle')) return 'marker-rainy';
    if (c.includes('snow')) return 'marker-snowy';
    if (c.includes('thunder')) return 'marker-stormy';
    return 'marker-default';
  }
}
