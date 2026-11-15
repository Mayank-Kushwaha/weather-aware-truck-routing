# Plan

Budget: 16 hours, 4 days (email). Estimates below total 15.5 h. Decisions are in `decisions.md` (D#), guardrails in `rules.md`.

## Architecture
```
React (Vite, TS, MapLibre)  --POST /api/analyze-->  Django + DRF
   form, map, panel, slider                           api/       validate, serialize
   heatmap = GPU expression on                        services/  mapbox.py  openmeteo.py  analyze.py
   precomputed scores_by_hour                         domain/    risk.py  geometry.py  recommend.py  (pure)
                                                      cache: LocMem (weather by 0.1 deg cell)
Mapbox: geocode + directions (3 routes)      Open-Meteo: hourly wind/rain/snow, batched
```

### Analyze pipeline (one request)
1. Validate input (D8, D10, rule 14).
2. Mapbox Directions: up to 3 routes with geometry and per-segment duration/distance (D1). Fallback detours if fewer (D1).
3. Per route: cumulative miles, checkpoints every N mi plus start and end, ETA per checkpoint (D9).
4. Collect unique rounded coordinates across routes, fetch hourly weather in parallel batches, cached (D3).
5. Per checkpoint: interpolate weather at ETA (D10), classify risk and load rules (D11), compute `scores_by_hour[0..48]` (D15).
6. Per route: miles per level, average risk (D13). Rank routes (D14), build reason text.
7. Return JSON: routes[], checkpoints[], stats, recommended_id, warnings[].

### Response shape (draft)
```
{ recommended_id, warnings[],
  routes[{ id, summary, distance_mi, duration_s, geometry(GeoJSON), rank, reason,
           stats{no_travel_mi,severe_mi,high_mi,moderate_mi,low_mi,avg_risk},
           checkpoints[{mile,lat,lng,eta,level,score,driver,weather{wind_mph,rain_in_hr,snow_in_hr},scores_by_hour[49]}] }] }
```

## Phases
| # | Phase | Output | Hours |
|---|---|---|---|
| 0 | Scaffold | Repo, Django + DRF project, Vite app, `.env.example`, ruff/ESLint, README stub | 0.5 |
| 1 | Domain core (TDD) | `risk.py`, `geometry.py`, `recommend.py` with boundary tests | 2.5 |
| 2 | Routing + geocode | `mapbox.py`, spike on real long routes, detour fallback, `/api/geocode` | 1.5 |
| 3 | Weather | `openmeteo.py` batching, cache, retry, interpolation, fixtures | 2.0 |
| 4 | Orchestrator + API | `analyze.py`, serializers, errors, `/api/analyze`, perf measurement | 1.5 |
| 5 | Frontend form + map + panel | Autocomplete, 3 colored routes, checkpoint markers with popups, route cards with recommendation and reason | 3.0 |
| 6 | Heatmap + slider | Heatmap layer, slider 0-48 h, legend, no-network drag | 1.5 |
| 7 | Deploy | Build, WhiteNoise, env config, hosted URL, health check | 1.5 |
| 8 | Docs + handoff | README (setup, design, limits), walkthrough script, Loom checklist | 1.5 |

Dependencies: 0 then 1 (no external keys needed). 2 needs the Mapbox token. 3 is independent of 2. 4 needs 1, 2, 3. 5 can start with a mocked response once the shape is fixed. 6 after 5. 7 after 4+6. 8 last.

## Phase detail

### Phase 1: domain core
- `risk.py`: `classify_wind/rain/snow`, `checkpoint_level(weather, load_lb)`, `LEVEL_SCORE`. Constants in one table.
- `geometry.py`: haversine, cumulative miles, `point_at_mile`, `time_at_mile(segments)`, checkpoint mile list (0, N, 2N, ..., total).
- `recommend.py`: miles ownership (D13), stats, lexicographic compare with tolerances (D14), reason text.
- Tests: every row of D11 on both sides of each edge; three load rules with 30,000 / 40,000 equality; wind 55 for load 0; mixed conditions take the max; load rule never lowers a level.

### Phase 2: routing
- Spike script in `scripts/` calls Mapbox for 3 pairs (long, medium, short). Record: routes returned, annotation availability, coordinate limits. Update D1 with the findings before continuing.
- Duplicate detection for fallback: sample route points, treat as duplicate when most are within about 1 km.

### Phase 3: weather
- Request builder: `latitude=a,b,c&longitude=...&hourly=wind_speed_10m,rain,snowfall&wind_speed_unit=mph&precipitation_unit=inch&timezone=GMT&start_date&end_date`. Confirm `start_date`/`end_date` and multi-location response shape (list of objects) with a real call during the phase.
- Fixtures recorded once from a real response for tests.

### Phase 5-6: frontend
- Layout: left panel (form, route cards, selected-route checkpoint list), right map. Route colors fixed per route id; the recommended route has a badge. Selected route is highlighted, others dimmed.
- Checkpoint markers: circle layer colored by level; click shows ETA, mile, wind, rain, snow, driver of the risk.
- Heatmap: one GeoJSON source of all checkpoints with `scores_by_hour`; heatmap weight is `['/', ['at', hourExpr, ['get','scores']], 4]`; slider updates via `setPaintProperty`. Label shows absolute time = departure + hour.
- Performance: build GeoJSON once per analysis, no per-frame React state for the slider, debounce panel text, fit bounds once.
- States: empty, loading skeleton, error with retry, partial warnings banner.

### Phase 7: deploy
- Build React into Django static, WhiteNoise serves it, gunicorn start command, `ALLOWED_HOSTS`, `DEBUG=False`, secret key from env.
- Verify on the hosted URL: one real long-haul search and slider drag.

### Phase 8: docs
- README: what it does, architecture diagram, setup, env vars, API, risk rules table, assumptions and limits (no truck profile, no HOS, forecast resolution), attribution.
- `docs/walkthrough.md`: 7-minute Loom outline: problem (0:30), demo search (1:30), risk logic and tests (2:00), recommendation (1:00), heatmap and performance (1:00), design trade-offs (1:00).

## Verification checklist (before submitting)
- [ ] Unit tests green, ruff and tsc clean.
- [ ] Long-haul search returns 3 distinct routes (or a clear message).
- [ ] A hand-calculated checkpoint matches the API output (wind, level, load rule).
- [ ] Changing load weight alone changes levels only where the rules say.
- [ ] Slider drag causes zero network requests (DevTools) and stays smooth.
- [ ] Measured analyze latency recorded in README.
- [ ] Hosted URL works from a clean browser. GitHub link, hosted link and Loom link ready for the Spotter form.

## Risks
| Risk | Mitigation |
|---|---|
| Mapbox returns fewer than 3 routes | Detour fallback, honest message (D1) |
| Open-Meteo daily quota (10,000) | Interval guard, grid cache, shared fetch for heatmap (D3, D8) |
| Free host cold start | Health endpoint, README note, warm up before demo |
| Interpretation mismatch with reviewers | Items marked "needs confirmation" resolved before build |
| Time overrun | Cut polish first, keep tests on domain logic |

## Later (not built unless asked)
Gust display, lateral corridor band, truck restrictions, HOS breaks, saved trips, Redis cache.
