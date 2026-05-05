# Git Upload Schedule (7-Day Plan)

This document tracks the day-by-day upload plan for the Weather Application to ensure a steady streak of GitHub activity over a full week.

## How to use
When you are ready to make the next push, simply tell me: **"Execute the next step of the Git upload plan"** and I will read this file, commit the corresponding files, push them to your repository, and mark the step as complete!

---

### [x] Day 1: Backend Project Setup
**Goal:** Initialize Git and commit the bare .NET Web API structure.
**Commands to run:**
- `git init`
- `git add WeatherApp.Api/WeatherApp.Api.csproj WeatherApp.Api/Program.cs WeatherApp.Api/appsettings.json`
- `git commit -m "chore: Initialize .NET Web API project"`
- `git branch -M main`
- `git remote add origin <YOUR_GITHUB_URL>`
- `git push -u origin main`

### [x] Day 2: Database Configuration
**Goal:** Commit the Entity Framework Core models and DbContext.
**Commands to run:**
- `git add WeatherApp.Api/Models/ WeatherApp.Api/Data/`
- `git commit -m "feat: Add SQLite database context and WeatherRecord model"`
- `git push`

### [x] Day 3: API Integration & Controller
**Goal:** Commit the Open-Meteo service and the API controller logic.
**Commands to run:**
- `git add WeatherApp.Api/Services/ WeatherApp.Api/Controllers/`
- `git commit -m "feat: Implement Open-Meteo API integration and weather controller"`
- `git push`

### [x] Day 4: Frontend Project Setup
**Goal:** Commit the base Angular application structure.
**Commands to run:**
- `git add WeatherApp.Client/package.json WeatherApp.Client/angular.json WeatherApp.Client/tsconfig.*`
- `git commit -m "chore: Initialize Angular workspace"`
- `git push`

### [x] Day 5: Frontend API Service
**Goal:** Commit the Angular service responsible for communicating with the backend.
**Commands to run:**
- `git add WeatherApp.Client/src/app/weather.service.ts WeatherApp.Client/src/app/app.config.ts`
- `git commit -m "feat: Add Angular HTTP client and weather service"`
- `git push`

### [x] Day 6: UI Component Logic & Layout
**Goal:** Commit the TypeScript logic and HTML structure for the weather dashboard.
**Commands to run:**
- `git add WeatherApp.Client/src/app/app.component.ts WeatherApp.Client/src/app/app.component.html WeatherApp.Client/src/main.ts WeatherApp.Client/src/index.html`
- `git commit -m "feat: Build responsive weather dashboard UI structure"`
- `git push`

### [ ] Day 7: Final Aesthetics & Animations
**Goal:** Commit the CSS styling, glassmorphism, and mouse-tracking effects.
**Commands to run:**
- `git add .` *(Adds all remaining CSS files and any missed assets)*
- `git commit -m "design: Add glassmorphism effects and interactive CSS animations"`
- `git push`
