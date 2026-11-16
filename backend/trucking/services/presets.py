"""Live preset builder: picks the departure from the real forecast (cached).

For each preset corridor, five points on the straight line between its ends are checked. For every
candidate departure hour in the next 13 days the truck is assumed to reach point k at
departure + (k/4) * drive_time, and the weather there at that instant is classified with the same
risk rules as the app. "harsh" presets take the worst departure, "calm" presets the first calmest one.
This is a screening heuristic on the straight line; the real analysis uses the road geometry.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from django.core.cache import cache

from ..domain.geometry import METERS_PER_MILE, haversine_m
from ..domain.risk import LEVEL_NAMES, Risk, Weather, assess
from ..domain.weather import WeatherSeries
from ..presets import PRESETS, Preset
from . import openmeteo

POINTS = 5
HORIZON_DAYS = 13
ROAD_FACTOR = 1.3  # road length vs straight line
SPEED_MPH = 45.0
CACHE_KEY = "presets:v1"
CACHE_TTL_S = 30 * 60
CALM_WINDOW_H = 48


@dataclass(frozen=True)
class _Hit:
    key: tuple
    depart: datetime
    risk: Risk
    weather: Weather
    at: datetime


def _line(p: Preset) -> list[tuple[float, float]]:
    a, b = p.origin, p.destination
    return [
        (a.lng + (b.lng - a.lng) * k / (POINTS - 1), a.lat + (b.lat - a.lat) * k / (POINTS - 1)) for k in range(POINTS)
    ]


def _severity(w: Weather) -> float:
    return max(w.wind_mph / 55.0, w.rain_in_hr / 1.0, w.snow_in_hr / 3.0)


def _evaluate(p: Preset, series: dict, depart: datetime, drive_h: float) -> _Hit | None:
    scores, sev = [], 0.0
    worst: tuple[int, float, Risk, Weather, datetime] | None = None
    for k, pt in enumerate(_line(p)):
        eta = depart + timedelta(hours=drive_h * k / (POINTS - 1))
        s: WeatherSeries = series[openmeteo.to_cell(pt)]
        w = s.at(eta.timestamp())
        if w is None:
            return None
        r = assess(w, p.load_lb)
        scores.append(r.score)
        sev += _severity(w)
        cand = (r.score, _severity(w), r, w, eta)
        if worst is None or cand[:2] > worst[:2]:
            worst = cand
    assert worst is not None
    return _Hit((max(scores), sum(scores), round(sev, 3)), depart, worst[2], worst[3], worst[4])


def _describe(hit: _Hit) -> dict:
    w, r = hit.weather, hit.risk
    driver = r.driver.split("+")[0]
    value, unit = {"wind": (w.wind_mph, "mph"), "rain": (w.rain_in_hr, "in/hr"), "snow": (w.snow_in_hr, "in/hr")}[
        driver
    ]
    # for a load-rule escalation the driver is wind, so the numbers above are the wind speed
    return {
        "level": LEVEL_NAMES[r.score],
        "driver": r.driver,
        "value": round(value, 2),
        "unit": unit,
        "at": hit.at.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _pick(p: Preset, series: dict, now: datetime) -> dict:
    a, b = p.origin, p.destination
    miles = haversine_m((a.lng, a.lat), (b.lng, b.lat)) / METERS_PER_MILE * ROAD_FACTOR
    drive_h = miles / SPEED_MPH
    first = (now + timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
    last = now + timedelta(days=HORIZON_DAYS)
    hits: list[_Hit] = []
    t = first
    while t <= last:
        h = _evaluate(p, series, t, drive_h)
        if h:
            hits.append(h)
        t += timedelta(hours=1)
    if not hits:
        raise LookupError("no forecast")
    if p.kind == "harsh":
        best = max(hits, key=lambda h: (h.key, -h.depart.timestamp()))
    else:
        window = [h for h in hits if h.depart <= first + timedelta(hours=CALM_WINDOW_H)] or hits
        best = min(window, key=lambda h: (h.key, h.depart.timestamp()))
    return {
        "id": p.id,
        "title": p.title,
        "kind": p.kind,
        "region": p.region,
        "origin": {"label": p.origin.label, "lat": p.origin.lat, "lng": p.origin.lng},
        "destination": {"label": p.destination.label, "lat": p.destination.lat, "lng": p.destination.lng},
        "load_lb": p.load_lb,
        "interval_mi": p.interval_mi,
        "departure": best.depart.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "peak": _describe(best),
    }


def build(now: datetime | None = None) -> list[dict]:
    use_cache = now is None
    if use_cache:
        cached = cache.get(CACHE_KEY)
        if cached is not None:
            return cached
    now = now or datetime.now(UTC)
    cells = {openmeteo.to_cell(pt) for p in PRESETS for pt in _line(p)}
    series = openmeteo.fetch_series(cells, now.date(), now.date() + timedelta(days=HORIZON_DAYS + 1))
    out = []
    for p in PRESETS:
        try:
            out.append(_pick(p, series, now))
        except LookupError:
            continue
    # Harsh first, worst real forecast first; calm presets after.
    out.sort(key=lambda d: (d["kind"] != "harsh", -LEVEL_NAMES.index(d["peak"]["level"])))
    if use_cache:
        cache.set(CACHE_KEY, out, CACHE_TTL_S)
    return out
