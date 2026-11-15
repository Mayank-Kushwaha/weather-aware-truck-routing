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

Tests and checks:

```bash
cd backend  && python -m pytest && ruff check .
cd frontend && npm test && npm run build              # build runs tsc in strict mode
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

## Measured

- Chicago to Denver (about 1,000 mi), 10 mi interval, about 320 checkpoints, cold cache: about 6 s. Repeat search with warm caches: about 0.3 s.
- Response about 100 KB at 25 mi and 166 KB at 10 mi (route geometry is simplified, gzip is on).
- Dragging the slider: 0 network requests (checked with a Playwright run against the built app).

## Limits

- Mapbox has no truck profile. Truck restrictions (height, weight bans) and truck speeds are not modelled. ETAs are driving time only, with no breaks or hours-of-service.
- Forecast resolution is about 9-11 km (global models), so checkpoints closer than that share similar values.
- Weather uses sustained 10 m wind, not gusts.
- The heatmap shows the forecast at the slider hour at each checkpoint location (departure + hour), along the routes only, not a lateral band.
- Open-Meteo's free tier is for non-commercial use.

## Data attribution

Weather: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Map data: OpenStreetMap contributors via OpenFreeMap. Routing and geocoding: Mapbox.
