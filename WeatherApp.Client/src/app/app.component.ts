import {
  Component, OnInit, ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { WeatherService, WeatherRecord } from './weather.service';
import { MapViewComponent } from './map-view/map-view.component';
import { CityGraphComponent } from './city-graph/city-graph.component';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of, Subject } from 'rxjs';
import gsap from 'gsap';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, MapViewComponent, CityGraphComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild('titleRef') titleRef!: ElementRef;
  @ViewChild('canvasRef') canvasRef!: ElementRef<HTMLCanvasElement>;

  searchQuery: string = '';
  weatherData: WeatherRecord | null = null;
  loading: boolean = false;
  error: string | null = null;
  weatherTheme: string = 'theme-default';

  // Autocomplete
  suggestions: string[] = [];
  showSuggestions: boolean = false;
  private searchSubject = new Subject<string>();

  // City tracking
  savedCities: WeatherRecord[] = [];
  showMap: boolean = false;
  cityAlreadySaved: boolean = false;

  get isInitialState(): boolean {
    return !this.weatherData && this.savedCities.length === 0;
  }

  private animationFrameId: number = 0;
  private particles: Particle[] = [];

  constructor(private weatherService: WeatherService, private http: HttpClient) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (query.trim().length < 2) return of([]);
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
        return this.http.get<any>(url).pipe(catchError(() => of({ results: [] })));
      })
    ).subscribe((res: any) => {
      this.suggestions = (res?.results || []).map((r: any) =>
        [r.name, r.admin1, r.country].filter(Boolean).join(', ')
      );
      this.showSuggestions = this.suggestions.length > 0;
    });
  }

  ngOnInit() {}

  ngAfterViewInit() {
    this.animateTitle();
    this.initParticleCanvas();
  }

  // ── GSAP Title Animation ─────────────────────────────────────
  private animateTitle() {
    const el = this.titleRef?.nativeElement;
    if (!el) return;

    // Parse child nodes to wrap characters while preserving aero-text vs highlight classes
    const aeroSpan = el.querySelector('.aero-text');
    const highlightSpan = el.querySelector('.highlight');

    if (aeroSpan && highlightSpan) {
      const aeroChars = [...aeroSpan.textContent].map(ch => `<span class="title-char aero-char">${ch}</span>`).join('');
      const highlightChars = [...highlightSpan.textContent].map(ch => `<span class="title-char highlight-char">${ch}</span>`).join('');
      el.innerHTML = `<span class="aero-text">${aeroChars}</span><span class="highlight">${highlightChars}</span>`;
    }

    const tl = gsap.timeline();

    // 1. Aura glow expansion
    tl.fromTo('.title-aura',
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 0.7, duration: 1.2, ease: 'power3.out' }
    );

    // 2. Sparkles floating entrance
    tl.fromTo('.title-sparkle',
      { scale: 0, rotation: -180, opacity: 0 },
      { scale: 1, rotation: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'back.out(2)' },
      '-=0.8'
    );

    // 3. 3D assembling letters with staggered elastic bounce
    tl.fromTo('.title-char',
      { y: -70, opacity: 0, rotateY: 180, scale: 0.3 },
      {
        y: 0,
        opacity: 1,
        rotateY: 0,
        scale: 1,
        duration: 1.0,
        stagger: { amount: 0.45, from: 'center' },
        ease: 'elastic.out(1, 0.4)'
      },
      '-=0.6'
    );

    // Continuous floating bobbing for characters
    gsap.to('.title-char', {
      y: -5,
      duration: 2.2,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      stagger: { each: 0.07, from: 'center' },
      delay: 1.6
    });

    // Continuous floating bobbing for sparkles
    gsap.to('.title-sparkle', {
      y: -8,
      rotation: 15,
      duration: 2.8,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      stagger: 0.3,
      delay: 1.8
    });
  }

  resetToHome() {
    this.weatherData = null;
    this.savedCities = [];
    this.weatherTheme = 'theme-default';
    this.searchQuery = '';
    this.error = null;
    this.showMap = false;
    
    // Re-trigger title animation for a nice home transition
    gsap.fromTo('.title-char',
      { scale: 1.2, filter: 'brightness(1.5)' },
      { scale: 1, filter: 'brightness(1)', duration: 0.5, stagger: 0.03, ease: 'power2.out' }
    );
  }

  // ── Particle Canvas Background ───────────────────────────────
  private initParticleCanvas() {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    this.particles = Array.from({ length: 80 }, () => new Particle(canvas));

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.particles.forEach(p => { p.update(); p.draw(ctx); });
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  // ── Autocomplete ─────────────────────────────────────────────
  onInputChange() {
    this.searchSubject.next(this.searchQuery);
  }

  selectSuggestion(suggestion: string) {
    this.searchQuery = suggestion;
    this.showSuggestions = false;
    this.suggestions = [];
    this.searchWeather();
  }

  hideSuggestions() {
    setTimeout(() => { this.showSuggestions = false; }, 150);
  }

  // ── Search ───────────────────────────────────────────────────
  searchWeather() {
    const rawQuery = this.searchQuery.trim();

    // 1. If search bar is empty when clicking Add City
    if (!rawQuery) {
      this.error = 'Please enter a place name first!';
      return;
    }

    // 2. Pre-check if place is already in tracked cities list (exact match)
    const queryLower = rawQuery.toLowerCase();
    const existing = this.savedCities.find(
      c => c.location.toLowerCase() === queryLower
    );
    if (existing) {
      this.error = `"${existing.location}" is already in your tracked cities list!`;
      this.searchQuery = '';
      return;
    }

    this.loading = true;
    this.error = null;
    this.weatherData = null;

    this.weatherService.getWeather(rawQuery).pipe(
      catchError(() => {
        this.error = 'Could not fetch weather data. Please check the location and try again.';
        this.loading = false;
        return of(null);
      })
    ).subscribe(data => {
      if (data) {
        // Exact match check on returned canonical location name
        const exists = this.savedCities.some(
          c => c.location.toLowerCase() === data.location.toLowerCase()
        );
        if (exists) {
          this.error = `"${data.location}" is already in your tracked cities list!`;
          this.searchQuery = '';
          this.loading = false;
          return;
        }

        this.weatherData = data;
        this.error = null;
        this.updateWeatherTheme(data);
        this.savedCities = [...this.savedCities, data];

        // Clear search bar once city is added
        this.searchQuery = '';

        // GSAP card entrance
        gsap.fromTo('.weather-card',
          { y: 30, opacity: 0, scale: 0.96 },
          { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }
        );
      }
      this.loading = false;
    });
  }

  addCityFromMapEvent(cityName: string) {
    this.weatherService.getWeather(cityName).pipe(
      catchError(() => of(null))
    ).subscribe(data => {
      if (data) {
        const exists = this.savedCities.some(
          c => c.location.toLowerCase() === data.location.toLowerCase()
        );
        if (!exists) {
          this.savedCities = [...this.savedCities, data];
        }
      }
    });
  }

  removeCityFromList(location: string) {
    this.savedCities = this.savedCities.filter(
      c => c.location.toLowerCase() !== location.toLowerCase()
    );
    if (this.weatherData?.location.toLowerCase() === location.toLowerCase()) {
      this.cityAlreadySaved = false;
    }
  }

  openMap() {
    this.showMap = true;
  }

  closeMap() {
    this.showMap = false;
  }

  // ── Weather Theme / Icon ─────────────────────────────────────
  updateWeatherTheme(data: WeatherRecord) {
    const cond = data.condition.toLowerCase();
    const temp = data.temperature;

    // ── Thunder / Storm variants ───────────────────────────────
    if (cond.includes('thunder') || cond.includes('storm') || cond.includes('squall')) {
      this.weatherTheme = 'theme-stormy';

    // ── Hail ─────────────────────────────────────────────────
    } else if (cond.includes('hail') || cond.includes('sleet') || cond.includes('pellet')) {
      this.weatherTheme = 'theme-hail';

    // ── Blizzard / Heavy Snow ─────────────────────────────────
    } else if (cond.includes('blizzard') || cond.includes('heavy snow') || cond.includes('snowstorm') || cond.includes('drifting snow') || cond.includes('blowing snow')) {
      this.weatherTheme = 'theme-blizzard';

    // ── Snow / Freezing ───────────────────────────────────────
    } else if (cond.includes('snow') || cond.includes('flurr') || cond.includes('freezing') || cond.includes('ice') || cond.includes('frost') || cond.includes('polar')) {
      this.weatherTheme = 'theme-snowy';

    // ── Heavy Rain ────────────────────────────────────────────
    } else if (cond.includes('heavy rain') || cond.includes('torrential') || cond.includes('downpour')) {
      this.weatherTheme = 'theme-heavy-rain';

    // ── Drizzle / Light Rain ──────────────────────────────────
    } else if (cond.includes('drizzle') || cond.includes('light rain') || cond.includes('sprinkle')) {
      this.weatherTheme = 'theme-drizzle';

    // ── Rain ──────────────────────────────────────────────────
    } else if (cond.includes('rain') || cond.includes('shower') || cond.includes('precip')) {
      this.weatherTheme = 'theme-rainy';

    // ── Fog / Mist / Haze ─────────────────────────────────────
    } else if (cond.includes('fog') || cond.includes('mist') || cond.includes('haze') || cond.includes('smoke') || cond.includes('sand') || cond.includes('dust')) {
      this.weatherTheme = 'theme-foggy';

    // ── Clear Night ───────────────────────────────────────────
    } else if (!data.isDay && (cond.includes('clear') || cond.includes('fair'))) {
      this.weatherTheme = 'theme-clear-night';

    // ── Scorching Heat (daytime, very hot) ────────────────────
    } else if (data.isDay && (cond.includes('clear') || cond.includes('sunny') || cond.includes('hot')) && temp >= 38) {
      this.weatherTheme = 'theme-scorching';

    // ── Sunny / Clear Day ─────────────────────────────────────
    } else if (data.isDay && (cond.includes('clear') || cond.includes('sunny') || cond.includes('fair') || cond.includes('fine'))) {
      this.weatherTheme = 'theme-sunny';

    // ── Overcast / Cloudy ─────────────────────────────────────
    } else if (cond.includes('cloud') || cond.includes('overcast') || cond.includes('partly')) {
      this.weatherTheme = data.isDay ? 'theme-cloudy-day' : 'theme-cloudy-night';

    // ── Temperature-based fallback (when condition is generic) ─
    } else if (temp <= -15) {
      this.weatherTheme = 'theme-blizzard';
    } else if (temp <= 0) {
      this.weatherTheme = 'theme-snowy';
    } else if (temp >= 40) {
      this.weatherTheme = 'theme-scorching';
    } else if (temp >= 35 && data.isDay) {
      this.weatherTheme = 'theme-sunny';
    } else {
      this.weatherTheme = 'theme-default';
    }
  }

  getWeatherIcon(condition: string, isDay: boolean): string {
    const c = condition.toLowerCase();
    if (c.includes('blizzard') || c.includes('heavy snow')) return '🌨️';
    if (c.includes('snow') || c.includes('flurr') || c.includes('freezing') || c.includes('frost')) return '❄️';
    if (c.includes('hail') || c.includes('sleet') || c.includes('pellet')) return '🌧️';
    if (c.includes('thunder') || c.includes('storm')) return '⛈️';
    if (c.includes('heavy rain') || c.includes('torrential') || c.includes('downpour')) return '🌧️';
    if (c.includes('rain') || c.includes('shower')) return '🌦️';
    if (c.includes('drizzle')) return '🌦️';
    if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '🌫️';
    if (c.includes('cloud') || c.includes('overcast')) return isDay ? '⛅' : '☁️';
    if (c.includes('clear') || c.includes('sunny') || c.includes('fair')) return isDay ? '☀️' : '🌙';
    return isDay ? '🌡️' : '🌙';
  }

  handleNodeHover(record: WeatherRecord | null) {
    if (record) {
      this.updateWeatherTheme(record);
    } else if (this.savedCities.length > 0) {
      // Revert to the latest searched city theme when hover ends
      this.updateWeatherTheme(this.savedCities[this.savedCities.length - 1]);
    } else {
      this.weatherTheme = 'theme-default';
    }
  }

  handleNodeClick(record: WeatherRecord) {
    this.updateWeatherTheme(record);
    gsap.fromTo('.weather-effects', { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.out' });
  }
}

// ── Particle Class ────────────────────────────────────────────
class Particle {
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  alpha: number;
  color: string;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.radius = Math.random() * 2 + 0.5;
    this.alpha = Math.random() * 0.4 + 0.05;
    const hues = [220, 250, 270, 200];
    this.color = `hsl(${hues[Math.floor(Math.random() * hues.length)]}, 70%, 70%)`;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0) this.x = this.canvas.width;
    if (this.x > this.canvas.width) this.x = 0;
    if (this.y < 0) this.y = this.canvas.height;
    if (this.y > this.canvas.height) this.y = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = this.alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
