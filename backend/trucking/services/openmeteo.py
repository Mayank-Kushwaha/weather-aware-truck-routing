"""Open-Meteo hourly forecast with grid-cell cache and batching (decisions.md D2, D3).

Verified by live call: multi-location requests return a JSON list; a single location
returns an object. Units requested: mph and inch; times in GMT.
"""

from __future__ import annotations

import logging
import time
from calendar import timegm
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime

import requests
from django.core.cache import cache

from ..domain.geometry import Coord
from ..domain.weather import WeatherSeries
from . import http

log = logging.getLogger(__name__)

URL = "https://api.open-meteo.com/v1/forecast"
BATCH = 50
TIMEOUT_S = 15
CACHE_TTL_S = 30 * 60
GRID_DEG = 0.1
WORKERS = 8

Cell = tuple[float, float]  # (lat, lng) rounded to the grid


class WeatherUnavailable(Exception):
    """Open-Meteo failed or refused the request."""


def _key(cell: Cell, start: date, end: date) -> str:
    return f"wx:{cell[0]}:{cell[1]}:{start.isoformat()}:{end.isoformat()}"


def to_cell(coord: Coord) -> Cell:
    """Snap (lng, lat) to the 0.1 degree grid; returns (lat, lng)."""
    return (round(round(coord[1] / GRID_DEG) * GRID_DEG, 1), round(round(coord[0] / GRID_DEG) * GRID_DEG, 1))


def _series(block: dict) -> WeatherSeries:
    h = block["hourly"]
    first = datetime.strptime(h["time"][0], "%Y-%m-%dT%H:%M")
    return WeatherSeries(
        start_epoch=timegm(first.timetuple()),
        wind=tuple(h["wind_speed_10m"]),
        rain=tuple(h["rain"]),
        snow=tuple(h["snowfall"]),
    )


def _request(cells: list[Cell], start: date, end: date) -> list[dict]:
    params = {
        "latitude": ",".join(str(c[0]) for c in cells),
        "longitude": ",".join(str(c[1]) for c in cells),
        "hourly": "wind_speed_10m,rain,snowfall",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
    }
    last: Exception | None = None
    for attempt in range(2):
        try:
            r = http.get(URL, params=params, timeout=TIMEOUT_S)
            if r.status_code == 429 or r.status_code >= 500:
                last = WeatherUnavailable(f"Weather service returned {r.status_code}")
                time.sleep(0.8 * (attempt + 1))
                continue
            if r.status_code != 200:
                reason = (
                    r.json().get("reason", "")
                    if r.headers.get("content-type", "").startswith("application/json")
                    else ""
                )
                raise WeatherUnavailable(f"Weather service rejected the request: {reason}".strip())
            data = r.json()
            return data if isinstance(data, list) else [data]
        except requests.RequestException as exc:
            last = WeatherUnavailable("Weather service is unreachable")
            last.__cause__ = exc
            time.sleep(0.8 * (attempt + 1))
    raise last or WeatherUnavailable("Weather service error")


def fetch_series(cells: set[Cell], start: date, end: date) -> dict[Cell, WeatherSeries]:
    """Hourly series per grid cell for [start, end] inclusive, cached 30 min per cell."""
    out: dict[Cell, WeatherSeries] = {}
    missing: list[Cell] = []
    for c in cells:
        hit = cache.get(_key(c, start, end))
        if hit is not None:
            out[c] = hit
        else:
            missing.append(c)

    chunks = [missing[i : i + BATCH] for i in range(0, len(missing), BATCH)]
    if chunks:
        with ThreadPoolExecutor(max_workers=min(WORKERS, len(chunks))) as pool:
            results = list(pool.map(lambda ch: _request(ch, start, end), chunks))
        for chunk, blocks in zip(chunks, results):
            if len(blocks) != len(chunk):
                raise WeatherUnavailable("Weather service returned an unexpected response")
            for cell, block in zip(chunk, blocks):
                s = _series(block)
                out[cell] = s
                cache.set(_key(cell, start, end), s, CACHE_TTL_S)
    return out
