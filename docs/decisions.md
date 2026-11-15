# Decisions

Status: **Verified** = checked against official docs or a source linked here. **Needs confirmation** = interpretation of the PDF, the user should confirm. **Spike** = must be proven with a real call early.

## A. Verified facts that drove decisions
| Fact | Source |
|---|---|
| OpenRouteService public API only allows `alternative_routes` for routes under 100 km. Long-haul trucking needs more. | [ORS forum](https://ask.openrouteservice.org/t/alternative-routes-limitation-issues/6688) |
| OSRM public demo server: non-commercial, max 1 req/s, no uptime guarantee. | [OSRM wiki](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server) |
| Mapbox Directions returns up to 2 alternatives with the primary (3 routes). Free tier: 100,000 directions and 100,000 temporary geocoding requests per month. Profiles are driving, driving-traffic, walking, cycling (no truck profile). | [Mapbox CLI ref](https://docs.mapbox.com/cli/reference/directions/), [pricing summary](https://storerocket.io/learn/mapbox-pricing), [glossary](https://docs.mapbox.com/help/ja/glossary/directions-api/) |
| Mapbox documents using Directions and Search with MapLibre GL JS. | [Mapbox in MapLibre](https://docs.mapbox.com/help/dive-deeper/mapbox-in-maplibre/) |
| Open-Meteo: `wind_speed_10m` is instantaneous; `rain` and `snowfall` are sums of the preceding hour; units selectable (mph, inch). | [Open-Meteo docs](https://open-meteo.com/en/docs) |
| Open-Meteo free tier: non-commercial, 600/min, 5,000/h, 10,000/day, 300,000/month. Each location in a multi-location request counts as one call. Forecast up to 16 days. Data is CC BY 4.0. | [pricing](https://open-meteo.com/en/pricing), [issue #438](https://github.com/open-meteo/open-meteo/issues/438), [multi-location post](https://openmeteo.substack.com/p/weather-data-for-multiple-locations) |
| OpenFreeMap: free vector tiles, no key, commercial use allowed. | [openfreemap.org](https://openfreemap.org/) |

## B. Decisions

### D1. Routing + geocoding provider: Mapbox Directions and Geocoding. (Verified, Spike)
- Why: only option found that returns alternatives on long routes, has a free tier, and is documented for MapLibre use. ORS fails the 100 km limit. OSRM demo is non-commercial and 1 req/s. GraphHopper alternatives are +1 credit, but I did not verify free-plan limits or max distance.
- Use profile `mapbox/driving` (typical speeds, deterministic). `driving-traffic` is rejected because it reflects current traffic, not the departure time.
- Cost: one Directions call returns all 3 routes. The token is read from env on the Django server only.
- **Spike (hour 1):** confirm on real long pairs (e.g. Chicago to Denver) that 3 routes come back, that `annotations=duration,distance` works with `overview=full&geometries=geojson`, and the real coordinate limit.
- **Fallback if fewer than 3 routes:** request detour routes through one via-point offset perpendicular to the route midpoint, drop duplicates by shared-geometry ratio, and tell the user how many distinct routes exist. Never fabricate a route.
- Limitation to disclose in README: Mapbox has no truck profile, so truck-restricted roads and truck speeds are not modelled.

### D2. Weather provider: Open-Meteo forecast API. (Verified)
- Why: free, no key, hourly, supports mph and inch units, multi-location batching, 16-day range.
- Variables: `wind_speed_10m`, `rain`, `snowfall`. Params: `wind_speed_unit=mph`, `precipitation_unit=inch`, `timezone=GMT`.
- Mapping: `rain` (in per preceding hour) is in/hr. `snowfall` is reported as snow depth per hour, so in/hr. Wind uses sustained `wind_speed_10m`. Gusts are not used (see D12).
- Limit math: 3 routes x (miles / interval) points. A 1,000 mi trip at 10 mi is about 300 calls, so about 33 such searches per day on the free tier. Mitigations in D3.
- Non-commercial free tier is acceptable for an assessment. Attribution shown in the UI footer.

### D3. Weather fetch and cache design. (Verified math)
- One fetch per point returns the full hourly series covering departure to departure + trip + 48 h. The same data feeds both checkpoint risk (at ETA) and the 0-48 h heatmap. No second fetch.
- Round coordinates to 0.1 degrees (about 11 km, similar to the 9-11 km global model resolution) and de-duplicate. Routes that share road segments share fetches.
- Cache key: `(lat_r, lng_r, start_date, end_date)`; TTL 30 minutes (forecast refresh cadence is hours). Django `LocMemCache`, no Redis. Trade-off: cache is per process and lost on restart. Acceptable for a single instance.
- Batch up to 100 coordinates per request (URL length), run batches in parallel with a thread pool, 10 s timeout, 1 retry with backoff on 429/5xx.

### D4. Basemap and map library: MapLibre GL JS with OpenFreeMap tiles, via `react-map-gl/maplibre`. (Verified for tiles; Spike for wrapper version)
- Why: WebGL rendering and a native `heatmap` layer give a smooth slider (40% of grade). Leaflet heatmap plugins draw on canvas and are slower with many points.
- OpenFreeMap needs no key. Attribution to OpenStreetMap and OpenFreeMap shown.

### D5. Backend: Django + Django REST Framework, no database models, no Celery.
- The app is stateless: one analyze call, one geocode proxy. Skipping models, migrations and queues removes failure modes.
- Endpoints: `GET /api/geocode?q=`, `POST /api/analyze`, `GET /api/health`.
- Geocode goes through Django so the token stays server-side and results can be cached.
- Layers: `domain/` (pure: risk, geometry, recommend) , `services/` (Mapbox, Open-Meteo), `api/` (serializers, views). Orchestrator in `services/analyze.py`.
- HTTP client: `requests` with a thread pool. Async Django is not worth the complexity here.

### D6. Frontend: Vite + React + TypeScript (strict). TanStack Query for the two calls. Plain CSS modules.
- No Redux/Zustand: state is the form, the analysis result, selected route and slider hour. React state is enough.
- Slider hour is kept in a ref plus one MapLibre expression update (rule 20). Panel text updates are throttled.

### D7. Hosting: single Django service serving the built React app through WhiteNoise. (Needs confirmation of platform)
- One deploy, same origin, no CORS, one URL to submit.
- Candidate: Render free web service. Cold start after idle is expected; I did not verify Render's current free-tier terms. Confirm before relying on it. A keep-warm note will be put in the README. Alternatives if rejected: Fly.io, Railway.

### D8. Checkpoint spacing: user selects 10, 25 or 50 mi; default 25. (Needs confirmation)
- PDF says "Sample weather every 10 / 25 / 50 miles". Readings: (a) user chooses one, (b) tiers by trip length, (c) three parallel layers. I chose (a): simplest and gives a visible control. Checkpoints always include mile 0 and the destination.
- Guard: if points x 3 routes exceed 600, the API returns 400 suggesting a larger interval (protects the 10,000/day quota).

### D9. ETA computation. (Spike on annotations)
- Departure converted to UTC. ETA at mile m = departure + time at which the route reaches m.
- Time at m comes from Mapbox per-segment `duration` and `distance` annotations (cumulative, linear inside a segment). If annotations are missing, fall back to proportional distance x total duration, and flag it in the response.
- No traffic, no breaks, no hours-of-service. A 1,500 mi trip is treated as continuous driving. Disclosed in README.

### D10. Weather at ETA: linear interpolation between the two surrounding hourly values. (Needs confirmation as a modelling choice)
- Applies to wind, rain and snow. Nearest-hour rounding would add up to 30 minutes of error for no benefit. If ETA is outside the fetched range, the checkpoint is marked `unknown`, excluded from risk stats, and a warning is returned.
- Validation: departure between now minus 1 h and now plus 14 days, so the ETA and 48 h heatmap window stay inside the 16-day forecast.

### D11. Risk classification. (Needs confirmation of boundary handling)
The PDF table has shared edges (0.25, 0.50, 1.00, 35, 45, 55). Chosen:
| Level | Wind mph | Rain in/hr | Snow in/hr |
|---|---|---|---|
| Low | <25 | <0.10 | <0.5 |
| Moderate | 25 to <35 | 0.10 to <0.25 | 0.5 to <1.0 |
| High | 35 to <45 | 0.25 to <0.50 | 1.0 to <2.0 |
| Severe | 45 to <55 | 0.50 to 1.00 inclusive | 2.0 to 3.0 inclusive |
| No Travel | >=55 | >1.00 | >3.0 |
- Wind NT uses `>=55` as the PDF states. Rain/snow NT uses `>` as the PDF states, so exactly 1.00 and 3.0 are Severe.
- Checkpoint level = max of the three condition levels, then load rules raise it (never lower): wind >=55 gives NT for any load; wind 45-54 with load >30,000 lb gives NT; wind 35-44 with load >40,000 lb gives at least Severe. Load thresholds are strict `>` as written. Load rules apply to wind only.
- Scores: Low 0, Moderate 1, High 2, Severe 3, No Travel 4.
- The result also records which condition drove the level (for UI tooltips).

### D12. Wind metric: sustained 10 m wind, not gusts. (Needs confirmation)
- PDF says "Wind" with sustained-wind style thresholds. Gusts would inflate risk everywhere. Gust value can be shown as extra info later only if requested.

### D13. Converting checkpoints to "miles". 
- PDF ranks by "Severe miles" and "High miles", but data is per point. Each checkpoint owns the route stretch from the midpoint to its previous checkpoint to the midpoint to the next (first starts at mile 0, last ends at the destination). Miles per level are sums of owned stretches. Average risk is the distance-weighted mean score.

### D14. Recommendation ordering. (Needs confirmation)
- Compare lexicographically: (1) No Travel miles, (2) Severe miles, (3) High miles, (4) average risk, (5) duration.
- Step 1 is an addition. A No Travel stretch is worse than Severe and must not be hidden by it. A route with No Travel miles is flagged "Not drivable as planned". If all routes have it, the UI says so and still ranks them.
- Noise tolerance: miles within 1.0 mi and average risk within 0.05 are treated as equal, so the order does not flip on meaningless differences and "balancing time" (PDF) has effect. Values live in config. Strict mode is one constant change. This tolerance is my addition.
- Response includes a plain-language reason built from the deltas against the runner-up, for example "0 Severe mi vs 42; 18 min slower".

### D15. Heatmap. (Needs confirmation on "corridor")
- Backend returns, for every checkpoint, an array `scores_by_hour` for hours 0..48 after departure, computed with the same risk function and the user's load. Frontend sets MapLibre heatmap weight with an expression indexing that array by slider hour. No network call on drag; GPU updates the paint.
- Corridor = points along the three routes (not a lateral band), because a band needs extra weather fetches and quota. Radius scales with zoom.
- Layers also show checkpoint circles colored by level for the exact-ETA view.

### D16. Testing and quality gates.
- Backend: pytest. Table-driven tests for every boundary in D11, load rules, geometry (interpolation, cumulative miles), miles ownership, ranking with tolerances. Services tested with recorded fixtures or mocks. No live network in tests.
- Frontend: Vitest for formatting utilities and the expression builder; one Playwright-free smoke test is optional.
- Lint: ruff (Python), ESLint + tsc strict (TS). Pre-commit not required.

### D17. Repo layout and git.
```
backend/  frontend/  docs/  scripts/  input/  README.md  .env.example
```
- Monorepo, one GitHub repo. `input/` contains the email and the assessment PDF; it will be git-ignored unless the user wants it published.
- Pushing needs the user's GitHub remote and auth. A script in `scripts/` will do commit and push once the remote URL is given.

## C. Amendments made during the build (these override the text above)

| Ref | Change | Evidence |
|---|---|---|
| D1 | Mapbox `alternatives=true` returned 2 routes on all 3 test pairs. `alternatives=3` and `max_alternatives` return 422. The detour route is therefore the normal source of the third route, not a rare fallback. Detours try 3 positions along the route x 2 sides in parallel, keep the fastest that is distinct (overlap below 0.75 with each route) and under 1.6x the fastest. Route results are cached 10 min. | live calls, `scripts/spike*.py` |
| D1 | `annotations=duration,distance` works with `overview=full&geometries=geojson` and gives one value per segment. Verified. | spike |
| D2 | Open-Meteo multi-location returns a JSON list, single location an object. Units come back as `mp/h` and `inch`. Verified. | spike |
| D1 | Mapbox geocoding v6 has no `poi` type. The `types` filter was dropped. | live 422 |
| D4 | maplibre-gl 6 ships an ES-module worker and no default export. The app imports `maplibre-gl/dist/maplibre-gl-worker.mjs?url` and calls `setWorkerUrl`. | build + browser test |
| D6 | No TanStack Query (two calls, plain state was enough). Plain CSS files, not CSS modules. | rules.md #19 |
| D7 | Hosting is split as requested: Django on Render, React on Vercel, joined by `VITE_API_URL` and `CORS_ALLOWED_ORIGINS`. The WhiteNoise-served SPA is still available locally. | user choice |
| D15 | MapLibre stringifies array properties in GeoJSON sources, so each checkpoint carries `h0..h48` numeric properties and the slider swaps the `heatmap-weight` expression. Low (score 0) adds no heat; the checkpoint circles show ETA-time risk. Verified with injected synthetic risk in Chrome. | `scripts/ui_heat.mjs` |
| D16 | No ESLint. `tsc` strict plus ruff plus tests are the quality gates. | time box |
| D5 | One gunicorn worker with 8 threads on Render so the in-memory cache is shared. | `render.yaml` |
| D17 | `scripts/` and `input/` are git-ignored. | `.gitignore` |

User confirmations (message of 15 Nov): interpretations D8, D10, D11, D12, D14, D15 are accepted as proposed ("do what is best per the PDF"). Render for backend, Vercel for frontend. GitHub via the signed-in `gh` CLI.

## D. Open items needing the user
1. Mapbox access token (free account). Required for routing and geocoding.
2. GitHub repo name and remote URL, plus whether to make it public.
3. Hosting platform choice (D7). Render suggested.
4. Confirm interpretations D8, D10, D11, D12, D14, D15.
5. Loom recording is done by the user; I will prepare the script in `docs/walkthrough.md`.
