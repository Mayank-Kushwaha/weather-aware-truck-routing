# Goals

Source of truth: `input/fs-assessment-spotter.pdf` and the Spotter email (`input/Gmail - ...pdf`).

## Product goal
A React + Django web app that helps a truck driver pick the safest route from weather, load weight and travel time.

## Inputs (user enters)
- Origin and destination
- Departure date/time
- Load weight (lb)

## Required behaviour (each item is an acceptance criterion)
| # | Requirement | Done when |
|---|---|---|
| G1 | 3 route options from a routing API | Response contains 3 distinct routes for a long-haul pair, or an explicit reason when fewer exist |
| G2 | Weather sampled every 10 / 25 / 50 mi at the truck's ETA for that checkpoint | User picks the interval; each checkpoint is evaluated with the forecast hour matching its own ETA |
| G3 | Risk from the provided thresholds and load rules | Unit tests cover every threshold boundary and all 3 load rules |
| G4 | Recommend the best route | Order: fewest Severe mi, fewest High mi, lowest average risk, shortest time. UI states why |
| G5 | Show all routes, checkpoints, risk levels, ETAs and route summaries on a map | Map + side panel show all of these |
| G6 | Weather heatmap along the trip corridor with a 0-48 h slider | Slider changes the heatmap with no network call and no visible lag |

## Deliverables (email + PDF)
1. GitHub repository (link submitted in the Spotter form)
2. Hosted application (link submitted in the form)
3. Loom walkthrough, 5-10 min (link submitted in the form)

## Constraints (email)
- Maximum 4 days and 16 work hours.
- Third-party APIs for routing, geocoding and weather are allowed. No routing engine.

## Evaluation weights and what they imply
| Weight | Area | Implication |
|---|---|---|
| 40% | Routes, weather, risk, recommendation logic | Correctness first. Pure, tested domain code |
| 40% | UI, map, heatmap smoothness and performance | GPU rendering (MapLibre), slider with zero network calls, fast API |
| 15% | Code quality | Clear layering, types, tests, linting |
| 5% | Docs and walkthrough | Short README, architecture notes, Loom script |

PDF closing line: "Prioritize correctness and clarity over extra features."

## Non-goals
- A routing engine, user accounts, saved trips, truck-specific restrictions (height/weight bans), hours-of-service breaks, live traffic, mobile app, i18n.
