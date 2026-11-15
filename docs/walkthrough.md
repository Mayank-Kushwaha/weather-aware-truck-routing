# Loom walkthrough script (target 7-8 min)

Before recording: open the hosted app, open `/api/health` once to wake Render, pick a trip that is already searched (so caches are warm), have the repo open in the editor, DevTools Network tab ready.

| Time | Show | Say |
|---|---|---|
| 0:00-0:30 | App home | The problem: a driver needs the safest route, not only the fastest. Input is origin, destination, departure, load. Stack: React + MapLibre, Django REST, Mapbox for routing, Open-Meteo for weather. |
| 0:30-2:00 | Search Chicago to Denver, 25 mi, 45,000 lb | Three routes come back. The recommended route has a badge and a one-line reason. Each card shows distance, duration, arrival, a bar of miles by risk level, Severe and High miles, average risk. Click a route to select it. Click a checkpoint on the map or a table row: ETA, wind, rain, snow, and what drove the level. |
| 2:00-3:30 | `backend/trucking/domain/risk.py` and `tests/test_risk.py` | All thresholds are in one file. Checkpoint level is the worst of wind, rain and snow. Load rules only raise the level. Boundary choice: lower bound inclusive, rain and snow No Travel only above 1.00 and 3.0. Show the table-driven boundary tests. Change load from 30,000 to 45,000 in the app on a windy trip and show the level change. |
| 3:30-4:30 | `analyze.py` and `recommend.py` | ETA per checkpoint comes from Mapbox per-segment durations. Weather is interpolated to that ETA. Miles per level: each checkpoint owns the stretch to the midpoints. Ranking: No Travel, Severe, High, average risk, time, with 1 mile and 0.05 tolerances so time can matter. |
| 4:30-5:30 | Mapbox finding | Mapbox returns at most 2 routes (tested, 3 is rejected). The third is a detour through an offset via-point, kept only if distinct and not much slower. If none qualifies the app says so. |
| 5:30-6:45 | Heatmap and Network tab | Drag the 0-48 h slider: no requests. One weather fetch covers ETAs and 49 hours, the API returns a score per checkpoint per hour, and the slider swaps one MapLibre paint expression. Mention the 0.1 degree grid, cache, batching and the checkpoint cap because of the 10,000 calls/day free quota. |
| 6:45-7:30 | README limits section | No truck profile, no hours-of-service, sustained wind not gusts, heatmap along routes only. Next steps: lateral corridor, truck routing provider, Redis cache. |

Submit in the Spotter form: GitHub link, Loom link, hosted link.
