# Weather-Aware Truck Routing

A React + Django app that compares three driving routes for a truck by weather risk at the truck's own arrival time, load weight and travel time, and recommends one.

- Live app: _set after deploy_
- Walkthrough (Loom): _set after recording_

## What it does

1. You enter origin, destination, departure time, load (lb) and a checkpoint spacing (10, 25 or 50 mi).
2. The API gets up to 3 routes, places a checkpoint every N miles, and works out the ETA of each checkpoint from per-segment travel times.
3. It reads the hourly forecast for each checkpoint, interpolated to that checkpoint's ETA, and classifies risk with the assessment's thresholds and load rules.
4. Routes are ranked by: fewest No Travel miles, fewest Severe miles, fewest High miles, lowest average risk, shortest time. The UI says why the winner won.
5. The map shows all routes, checkpoints (colored by risk, with ETA and weather in a popup), and a weather heatmap with a 0-48 h slider.

### Recommendation logic

1. **Miles, not points.** Each checkpoint owns the road from the midpoint before it to the midpoint after it, so weather becomes miles per level.
2. **Order:** No Travel miles (added: worse than Severe), Severe miles, High miles, average risk, travel time. Differences under 1 mi (0.05 avg risk) are ties, so time decides when weather is equal.
3. **Decision funnel** (`domain/decision.py`): the criteria are applied one by one and the response records who is eliminated at each step. The UI shows it as "How the winner was chosen", so the choice is auditable.
4. **Departure advisor** (`domain/advisor.py`): re-ranks all routes for each departure delay from 1 to 12 h using the same forecast (no extra API calls) and reports the earliest materially safer window. It also checks stability: whether the winner still wins if you leave 1 or 2 h late. A one-click button re-runs the trip at the better time.

### Demo helpers

- **Quick presets** (`GET /api/presets`): 16 corridors (India, Nepal, Bhutan, Bangladesh, Pakistan, USA; one end is in India for every non-US preset). The server scans the next 13 days of forecast along each corridor's straight line and picks the departure that is harshest (harsh presets) or calmest (calm presets). Clicking a preset fills the form and runs the analysis. The chip shows the real forecast peak, so a "harsh" corridor can honestly read calm in its off-season.
- **Trace route**: the button under the checkpoint table animates a truck along the selected route with play/pause, previous/next checkpoint, jump to start/end, scrubber, 1x/2x/4x speed and a follow-camera toggle.

## Architecture

```
React + Vite + TypeScript + MapLibre GL  --POST /api/analyze-->  Django + DRF (stateless, no DB)
                                                                   api/       validation, error mapping
                                                                   services/  mapbox.py  openmeteo.py  analyze.py
                                                                   domain/    risk  geometry  weather  recommend  (pure, unit-tested)
        Mapbox: geocoding + Directions            Open-Meteo: hourly wind / rain / snowfall
        OpenFreeMap: vector basemap tiles
```

Key choices (full reasoning in `docs/decisions.md`):

- **Risk logic lives only in the backend** (`backend/trucking/domain/risk.py`). The frontend renders what it receives.
- **Heatmap slider makes no network calls.** One weather fetch per point covers the checkpoint ETAs and 49 forecast hours. The API returns a risk score per checkpoint per hour. The slider changes a MapLibre paint expression, so the GPU does the work.
- **Mapbox returns at most 2 alternatives** (verified: any other value is a 422). The third route is a detour through an offset via-point, accepted only if it is distinct (shares under 75% of its path with each other route) and at most 1.6x the fastest. If none qualifies the UI says fewer routes exist.
- **Weather quota** (Open-Meteo free: 10,000 calls/day, each location counts): points are snapped to a 0.1 degree grid, de-duplicated across routes, batched 100 per request, cached 30 minutes, and a search over 600 total checkpoints is refused with a hint to widen the interval.

## Risk rules as implemented

| Level | Wind mph | Rain in/hr | Snow in/hr |
|---|---|---|---|
| Low | <25 | <0.10 | <0.5 |
| Moderate | 25 to <35 | 0.10 to <0.25 | 0.5 to <1.0 |
| High | 35 to <45 | 0.25 to <0.50 | 1.0 to <2.0 |
| Severe | 45 to <55 | 0.50 to 1.00 | 2.0 to 3.0 |
| No Travel | >=55 | >1.00 | >3.0 |

Checkpoint level is the worst of the three. Load rules can only raise it: wind >=55 is No Travel for any load; wind 45-54 with load >30,000 lb is No Travel; wind 35-44 with load >40,000 lb is at least Severe. Each checkpoint owns the stretch from the midpoint before it to the midpoint after it, and these stretches give the "miles" per level.

## Run locally

Needs Python 3.11+ and Node 20+. A free Mapbox public token is required.

```bash
# backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # Windows; use source .venv/bin/activate elsewhere
pip install -r requirements-dev.txt
cp .env.example .env                                  # set MAPBOX_TOKEN
python manage.py runserver 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev                                           # http://localhost:5173, proxies /api to :8000
```

Tests and checks (all green at the last commit: 91 backend tests, 12 frontend tests):

```bash
cd backend  && python -m pytest && ruff check .
cd frontend && npm test && npm run check && npm run build   # Biome lint+format, then strict tsc + production build
```

## Project structure

```
backend/trucking/
  domain/     pure logic, no I/O: risk, geometry, weather (interpolation), recommend, decision (funnel), advisor
  services/   mapbox, openmeteo, presets, analyze (orchestrator), payload (serialisation), http (pooled session)
  tests/      table-driven boundary tests, mocked upstreams
frontend/src/
  components/ form/ results/ map/ modals/ layout/      feature folders
  hooks/      useAnalysis, useTrace, useBackendStatus
  lib/        pure helpers (format, mapData, trace) with tests
  styles/     base, form, results, map, modal, animations (imported from styles/index.css)
```

## Deploy

- **Backend (Render):** `render.yaml` defines the service. Set `MAPBOX_TOKEN` and `CORS_ALLOWED_ORIGINS` (the Vercel URL, no trailing slash). The service runs one gunicorn worker with threads so the in-memory cache is shared.
- **Frontend (Vercel):** project root `frontend`, env var `VITE_API_URL` = the Render URL.
- Render's free tier sleeps when idle, so the first request after a pause is slow. Open `/api/health` once before a demo.

## API

- `GET /api/geocode?q=` returns `{results: [{label, lat, lng}]}`
- `POST /api/analyze` with `{origin:{lat,lng,label}, destination:{...}, departure (ISO 8601), load_lb (0-80000), interval_mi (10|25|50)}`
- `GET /api/health`

Errors are JSON `{error: "..."}`: 400/422 for bad input or no route, 502 when Mapbox or Open-Meteo fail.

## Performance

Measured on the built app (Playwright + Chrome), Chicago to Denver, about 1,000 mi:

| What | Result |
|---|---|
| Cold analysis, 25 mi (about 130 checkpoints) | 2.2 s total (3 runs: 2.15 to 2.4 s): routing 1.5 s, weather 0.55 s, compute 0.1 s. Was 4.2 s before the staged detour search |
| Cold analysis, 10 mi (about 320 checkpoints) | 2.7 to 3.0 s total |
| Repeat search (caches warm) | 0.1 to 0.2 s |
| Response size | about 100 KB at 25 mi, 167 KB at 10 mi |
| Heatmap slider | 0 network requests. Median frame 18 ms while dragging on a real GPU, equal to an idle page (software rendering is about 117 ms, which is a CPU rasterizer, not the app) |
| First JS | 79 KB gzip app shell; the 310 KB gzip map chunk loads in parallel, not after |

What makes it fast:

- **Overlap:** the weather download starts as soon as the first Directions response arrives, while the slower detour search is still running. Both share one forecast window so the later fetch only needs the cells a detour adds.
- **Detour search is staged:** two calls first (middle of the route, both sides); more positions only if those fail.
- **Network:** pooled keep-alive session, parallel weather batches of 50, 0.1 degree grid de-duplication, 30 minute cache, 10 minute route cache.
- **Client:** map and guide are code-split. `index.html` carries `preconnect` (tile host, API host) and `preload` (map style, tile index). The map chunk is requested at boot, the backend is pinged at boot to wake it, and the slider drives one MapLibre paint expression per frame, outside React.

## Limits

- Mapbox has no truck profile. Truck restrictions (height, weight bans) and truck speeds are not modelled. ETAs are driving time only, with no breaks or hours-of-service.
- Forecast resolution is about 9-11 km (global models), so checkpoints closer than that share similar values.
- Weather uses sustained 10 m wind, not gusts.
- The heatmap shows the forecast at the slider hour at each checkpoint location (departure + hour), along the routes only, not a lateral band.
- Open-Meteo's free tier is for non-commercial use.

## Data attribution

Weather: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Map data: OpenStreetMap contributors via OpenFreeMap. Routing and geocoding: Mapbox.
