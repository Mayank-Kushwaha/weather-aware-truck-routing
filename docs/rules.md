# Rules (do not deviate from goals.md)

## Scope
1. The PDF is the spec. If code, a library, or an idea conflicts with it, the PDF wins.
2. No feature that is not in `goals.md`. Extra ideas go to a "Later" list in `plan.md`, not into code.
3. If the PDF is ambiguous, record the interpretation in `decisions.md` with status "needs confirmation" and ask the user. Do not silently pick.
4. Time box: 16 hours total. If a phase overruns by 25%, cut polish, never tests of the risk logic.

## Correctness
5. Risk thresholds and load rules live in one file (`backend/.../domain/risk.py`). The frontend never recomputes risk. It only renders what the API returns.
6. Domain code (risk, geometry, recommendation) is pure: no network, no Django imports, no clock reads. I/O sits in `services/`.
7. Every threshold boundary and load rule has a unit test before the feature is considered done.
8. Units are fixed at the API boundary: mph, inch/hr, miles, pounds, UTC ISO-8601. Convert once, at the edge.
9. Checkpoint weather uses the forecast for that checkpoint's own ETA, never the departure hour.

## Facts over assumptions
10. Before using any third-party API parameter, confirm it in official docs or with a real call. Record the source in `decisions.md`.
11. Do not hardcode dependency versions from memory. Install, then pin what actually resolved.
12. Anything unverified is labelled "unverified" in docs until a test or call proves it.

## Engineering
13. Secrets (Mapbox token) only in environment variables. `.env` is git-ignored. Provide `.env.example`.
14. Validate input at the API boundary (coordinates, interval in {10,25,50}, load 0-80,000 lb, departure window). Return clear 4xx errors.
15. Upstream failures (Mapbox, Open-Meteo) return a clear 502 with a message. No stack traces to the client.
16. Respect upstream limits: batch weather requests, cache by grid cell and hour, set timeouts, attribute Open-Meteo (CC BY 4.0).
17. Types on the frontend (TypeScript strict) and on backend domain functions (type hints). Lint and tests must pass before each commit.
18. Small commits, conventional messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
19. Do not add a dependency when about 20 lines of code does the job.

## Performance
20. Slider interaction must not trigger network calls or React re-render of the map component tree. Update a single MapLibre paint/expression value.
21. One `POST /api/analyze` per search. Target under 6 s on a cold cache for a 1,000 mi trip (measure, then record the real number).

## Working style
22. Helper scripts go in `scripts/`. Docs go in `docs/`. Do not spend effort cleaning them up.
23. Be token-efficient: read only what is needed, no repeated re-reads, no restating files in chat.
24. Stop and report once validation passes. No unrequested follow-ups.
