"""Orchestrates one analysis.

Pipeline: routes -> checkpoints with ETAs -> hourly forecast -> risk at each ETA -> route statistics ->
ranking, decision funnel and departure advisor.

Latency design: the first Directions response is available well before the detour search ends, so the
weather fetch for those routes starts immediately in a background thread. Both use the same forecast
window, so the final fetch only requests the few grid cells the detour route adds.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from ..domain import advisor, decision
from ..domain.geometry import METERS_PER_MILE, Coord, checkpoint_miles
from ..domain.recommend import RouteStats, compute_stats, explain, sort_key
from ..domain.risk import Risk, assess
from ..domain.weather import HOUR_S, WeatherSeries
from . import mapbox, openmeteo, payload

log = logging.getLogger(__name__)

HEATMAP_HOURS = 48
MAX_TOTAL_CHECKPOINTS = 600  # protects the free weather quota (decisions.md D8)
FORECAST_LAST_DAY_OFFSET = 15  # Open-Meteo serves 16 days: today .. today+15
PREFETCH_JOIN_S = 25


class InputTooLarge(Exception):
    """Interval and trip length would need too many weather points."""


@dataclass(frozen=True)
class Request:
    origin: Coord
    destination: Coord
    departure: datetime  # timezone-aware
    load_lb: float
    interval_mi: int


@dataclass(frozen=True)
class Stop:
    mile: float
    coord: Coord
    cell: openmeteo.Cell
    eta: datetime


@dataclass(frozen=True)
class Plan:
    route_id: str
    option: mapbox.RouteOption
    stops: tuple[Stop, ...]


def _plan(route_id: str, option: mapbox.RouteOption, req: Request) -> Plan:
    stops = []
    for mile in checkpoint_miles(option.line.total_mi, req.interval_mi):
        coord, secs = option.line.locate(mile * METERS_PER_MILE)
        stops.append(Stop(mile, coord, openmeteo.to_cell(coord), req.departure + timedelta(seconds=secs)))
    return Plan(route_id, option, tuple(stops))


def _horizon_s(options: list[mapbox.RouteOption]) -> float:
    """Longest drive any final route can have: accepted detours are capped at MAX_DETOUR_FACTOR x fastest."""
    durations = [o.duration_s for o in options]
    return max(max(durations), mapbox.MAX_DETOUR_FACTOR * min(durations))


def _window(dep: datetime, horizon_s: float, today: date) -> tuple[date, date]:
    """Forecast dates to fetch: departure to (trip end or 48 h) plus the advisor's longest delay."""
    reach = timedelta(seconds=max(HEATMAP_HOURS * 3600, horizon_s)) + timedelta(hours=max(advisor.SHIFTS))
    return dep.date(), min((dep + reach).date(), today + timedelta(days=FORECAST_LAST_DAY_OFFSET))


class _Prefetch:
    """Starts the forecast download in the background; failures are ignored (the main fetch retries)."""

    def __init__(self) -> None:
        self.primary: list[mapbox.RouteOption] | None = None
        self._thread: threading.Thread | None = None

    def start(self, primary: list[mapbox.RouteOption], req: Request, today: date) -> None:
        self.primary = primary
        cells = {s.cell for i, o in enumerate(primary) for s in _plan(f"p{i}", o, req).stops}
        start, end = _window(req.departure, _horizon_s(primary), today)

        def run() -> None:
            try:
                openmeteo.fetch_series(cells, start, end)
            except Exception:  # noqa: BLE001 - best effort only
                log.info("weather prefetch failed; the main fetch will retry", exc_info=True)

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def join(self) -> None:
        if self._thread:
            self._thread.join(PREFETCH_JOIN_S)


def _risks(
    plan: Plan, series: dict[openmeteo.Cell, WeatherSeries], load_lb: float, delay_h: int = 0
) -> list[Risk | None]:
    """Risk at every checkpoint if the whole trip started ``delay_h`` hours later."""
    out: list[Risk | None] = []
    for stop in plan.stops:
        w = series[stop.cell].at(stop.eta.timestamp() + delay_h * HOUR_S)
        out.append(assess(w, load_lb) if w else None)
    return out


def _scores(risks: list[Risk | None]) -> list[int | None]:
    return [r.score if r else None for r in risks]


def _stats(plan: Plan, risks: list[Risk | None]) -> RouteStats:
    return compute_stats([s.mile for s in plan.stops], _scores(risks))


def _heat_scores(plan: Plan, series: dict, load_lb: float, dep_epoch: float) -> list[list[int | None]]:
    """Per checkpoint: risk score for each of the next 48 h at that location (drives the heatmap slider)."""
    rows = []
    for stop in plan.stops:
        s = series[stop.cell]
        row: list[int | None] = []
        for h in range(HEATMAP_HOURS + 1):
            w = s.at(dep_epoch + h * HOUR_S)
            row.append(assess(w, load_lb).score if w else None)
        rows.append(row)
    return rows


def analyze(req: Request, now: datetime | None = None) -> dict:
    now = now or datetime.now(UTC)
    t0 = time.perf_counter()

    prefetch = _Prefetch()
    options = mapbox.get_route_options(
        req.origin, req.destination, on_primary=lambda primary: prefetch.start(primary, req, now.date())
    )
    plans = [_plan(f"r{i}", o, req) for i, o in enumerate(options, start=1)]
    total_points = sum(len(p.stops) for p in plans)
    if total_points > MAX_TOTAL_CHECKPOINTS:
        raise InputTooLarge(
            f"This trip needs {total_points} weather checkpoints at {req.interval_mi} mi. Choose a larger interval."
        )
    t_routes = time.perf_counter()

    prefetch.join()
    start, end = _window(req.departure, _horizon_s(prefetch.primary or options), now.date())
    series = openmeteo.fetch_series({s.cell for p in plans for s in p.stops}, start, end)
    t_weather = time.perf_counter()

    dep_epoch = req.departure.timestamp()
    built = []
    for plan in plans:
        risks = _risks(plan, series, req.load_lb)
        built.append((plan, risks, _stats(plan, risks)))

    # Departure advisor input: every route's stats for each possible delay.
    by_shift: dict[int, list[advisor.Option]] = {
        0: [advisor.Option(p.route_id, st, p.option.duration_s) for p, _, st in built]
    }
    for h in advisor.SHIFTS[1:]:
        by_shift[h] = [
            advisor.Option(p.route_id, _stats(p, _risks(p, series, req.load_lb, h)), p.option.duration_s) for p in plans
        ]

    routes = []
    for plan, risks, stats in built:
        hourly = _heat_scores(plan, series, req.load_lb, dep_epoch)
        weather = [series[s.cell].at(s.eta.timestamp()) for s in plan.stops]
        o = plan.option
        routes.append(
            {
                "id": plan.route_id,
                "summary": o.summary,
                "is_detour": o.is_detour,
                "distance_mi": round(o.line.total_mi, 1),
                "duration_s": round(o.duration_s),
                "eta": payload.iso(req.departure + timedelta(seconds=o.duration_s)),
                "geometry": payload.geometry_payload(o.line.coords),
                "stats": payload.stats_payload(stats),
                "no_travel": stats.no_travel_mi > 0,
                "checkpoints": [
                    payload.checkpoint_payload(s.mile, s.coord[0], s.coord[1], s.eta, r, w, h)
                    for s, r, w, h in zip(plan.stops, risks, weather, hourly)
                ],
                "_key": (stats, o.duration_s),
                "_estimated": o.line.time_is_estimated,
            }
        )

    routes.sort(key=lambda r: sort_key(*r["_key"]))
    for rank, r in enumerate(routes, start=1):
        r["rank"] = rank
        r["reason"] = ""
    runner_up = routes[1]["_key"] if len(routes) > 1 else None
    routes[0]["reason"] = explain(routes[0]["_key"], runner_up)

    funnel = decision.ladder([decision.Contender(r["id"], r["_key"][0], r["_key"][1]) for r in routes])
    warnings = _warnings(routes)
    for r in routes:
        del r["_key"], r["_estimated"]

    t_end = time.perf_counter()
    return {
        "recommended_id": routes[0]["id"],
        "departure": payload.iso(req.departure),
        "interval_mi": req.interval_mi,
        "load_lb": req.load_lb,
        "heatmap_hours": HEATMAP_HOURS,
        "warnings": warnings,
        "decision": {"ladder": funnel},
        "advisor": advisor.advise(by_shift),
        "timings_ms": {
            "routing": round((t_routes - t0) * 1000),
            "weather": round((t_weather - t_routes) * 1000),
            "compute": round((t_end - t_weather) * 1000),
            "total": round((t_end - t0) * 1000),
        },
        "routes": routes,
    }


def _warnings(routes: list[dict]) -> list[str]:
    out = [
        f"Route {r['rank']}: segment timing unavailable, ETAs are proportional to distance."
        for r in routes
        if r["_estimated"]
    ]
    if len(routes) < 3:
        out.append(f"Only {len(routes)} distinct route(s) could be found for this trip.")
    if any(r["stats"]["unknown_mi"] > 0 for r in routes):
        out.append("Forecast data does not cover part of the trip; those miles are excluded from risk totals.")
    if all(r["no_travel"] for r in routes):
        out.append("Every route has No Travel conditions at the forecast time. Consider delaying departure.")
    return out
