"""Orchestrates one analysis: routes -> checkpoints -> weather at ETA -> risk -> ranking."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from ..domain.geometry import METERS_PER_MILE, Coord, checkpoint_miles, simplify
from ..domain.recommend import compute_stats, explain, sort_key
from ..domain.risk import LEVEL_NAMES, assess
from ..domain.weather import HOUR_S, WeatherSeries
from . import mapbox, openmeteo

HEATMAP_HOURS = 48
MAX_TOTAL_CHECKPOINTS = 600  # protects the free weather quota (decisions.md D8)
FORECAST_LAST_DAY_OFFSET = 15  # Open-Meteo serves 16 days: today .. today+15
GEOMETRY_EPS_DEG = 0.0004


class InputTooLarge(Exception):
    """Interval and trip length would need too many weather points."""


@dataclass(frozen=True)
class Request:
    origin: Coord
    destination: Coord
    departure: datetime  # timezone-aware, UTC
    load_lb: float
    interval_mi: int


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def _window(dep: datetime, max_eta: datetime, today: date) -> tuple[date, date]:
    end = max(dep + timedelta(hours=HEATMAP_HOURS), max_eta).date()
    return dep.date(), min(end, today + timedelta(days=FORECAST_LAST_DAY_OFFSET))


def analyze(req: Request, now: datetime | None = None) -> dict:
    now = now or datetime.now(UTC)
    options = mapbox.get_route_options(req.origin, req.destination)

    plans = []
    total_points = 0
    for opt in options:
        marks = checkpoint_miles(opt.line.total_mi, req.interval_mi)
        total_points += len(marks)
        plans.append(marks)
    if total_points > MAX_TOTAL_CHECKPOINTS:
        raise InputTooLarge(
            f"This trip needs {total_points} weather checkpoints at {req.interval_mi} mi. Choose a larger interval."
        )

    located = []  # per route: list of (mile, coord, eta)
    cells: set[openmeteo.Cell] = set()
    max_eta = req.departure
    for opt, marks in zip(options, plans):
        pts = []
        for mile in marks:
            coord, secs = opt.line.locate(mile * METERS_PER_MILE)
            eta = req.departure + timedelta(seconds=secs)
            max_eta = max(max_eta, eta)
            cells.add(openmeteo.to_cell(coord))
            pts.append((mile, coord, eta))
        located.append(pts)

    start, end = _window(req.departure, max_eta, now.date())
    series = openmeteo.fetch_series(cells, start, end)

    dep_epoch = req.departure.timestamp()
    routes = []
    warnings: list[str] = []
    for idx, (opt, pts) in enumerate(zip(options, located), start=1):
        checkpoints = []
        scores: list[int | None] = []
        for mile, coord, eta in pts:
            s: WeatherSeries = series[openmeteo.to_cell(coord)]
            w = s.at(eta.timestamp())
            risk = assess(w, req.load_lb) if w else None
            scores.append(risk.score if risk else None)
            hourly = []
            for h in range(HEATMAP_HOURS + 1):
                wh = s.at(dep_epoch + h * HOUR_S)
                hourly.append(assess(wh, req.load_lb).score if wh else None)
            checkpoints.append(
                {
                    "mile": round(mile, 1),
                    "lat": round(coord[1], 5),
                    "lng": round(coord[0], 5),
                    "eta": _iso(eta),
                    "level": LEVEL_NAMES[risk.score] if risk else "unknown",
                    "score": risk.score if risk else None,
                    "driver": risk.driver if risk else None,
                    "weather": {
                        "wind_mph": round(w.wind_mph, 1),
                        "rain_in_hr": round(w.rain_in_hr, 3),
                        "snow_in_hr": round(w.snow_in_hr, 3),
                    }
                    if w
                    else None,
                    "scores_by_hour": hourly,
                }
            )
        stats = compute_stats([c["mile"] for c in checkpoints], scores)
        routes.append(
            {
                "id": f"r{idx}",
                "summary": opt.summary,
                "is_detour": opt.is_detour,
                "distance_mi": round(opt.line.total_mi, 1),
                "duration_s": round(opt.duration_s),
                "eta": _iso(req.departure + timedelta(seconds=opt.duration_s)),
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[round(x, 5), round(y, 5)] for x, y in simplify(opt.line.coords, GEOMETRY_EPS_DEG)],
                },
                "stats": {
                    "no_travel_mi": round(stats.no_travel_mi, 1),
                    "severe_mi": round(stats.severe_mi, 1),
                    "high_mi": round(stats.high_mi, 1),
                    "moderate_mi": round(stats.moderate_mi, 1),
                    "low_mi": round(stats.low_mi, 1),
                    "unknown_mi": round(stats.unknown_mi, 1),
                    "avg_risk": round(stats.avg_risk, 2),
                },
                "_stats": stats,
                "checkpoints": checkpoints,
            }
        )
        if opt.line.time_is_estimated:
            warnings.append(f"Route {idx}: segment timing unavailable, ETAs are proportional to distance.")

    routes.sort(key=lambda r: sort_key(r["_stats"], r["duration_s"]))
    for rank, r in enumerate(routes, start=1):
        r["rank"] = rank
        r["reason"] = ""
    runner_up = routes[1] if len(routes) > 1 else None
    routes[0]["reason"] = explain(
        (routes[0]["_stats"], routes[0]["duration_s"]),
        (runner_up["_stats"], runner_up["duration_s"]) if runner_up else None,
    )
    for r in routes:
        r["no_travel"] = r["_stats"].no_travel_mi > 0
        del r["_stats"]

    if len(routes) < 3:
        warnings.append(f"Only {len(routes)} distinct route(s) could be found for this trip.")
    if any(r["stats"]["unknown_mi"] > 0 for r in routes):
        warnings.append("Forecast data does not cover part of the trip; those miles are excluded from risk totals.")
    if all(r["no_travel"] for r in routes):
        warnings.append("Every route has No Travel conditions at the forecast time. Consider delaying departure.")

    return {
        "recommended_id": routes[0]["id"],
        "departure": _iso(req.departure),
        "interval_mi": req.interval_mi,
        "load_lb": req.load_lb,
        "heatmap_hours": HEATMAP_HOURS,
        "warnings": warnings,
        "routes": routes,
    }
