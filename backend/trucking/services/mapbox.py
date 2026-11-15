"""Mapbox geocoding and directions (decisions.md D1).

Verified by live calls: ``alternatives=true`` returns at most 2 routes (any other value is a 422),
so a third route is built from a detour through an offset via-point.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import requests
from django.conf import settings
from django.core.cache import cache

from ..domain.geometry import (
    Coord,
    RouteLine,
    bearing_deg,
    build_route_line,
    destination_point,
    overlap_ratio,
)

log = logging.getLogger(__name__)

DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving/"
GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward"
TIMEOUT_S = 12
ROUTE_CACHE_TTL_S = 10 * 60

# Detour acceptance (decisions.md D1): distinct enough, and not absurdly longer than the fastest.
MAX_OVERLAP = 0.75
MAX_DETOUR_FACTOR = 1.6
DETOUR_FRACTIONS = (0.5, 0.35, 0.65)
DETOUR_OFFSET_FRACTION = 0.12  # of route length
DETOUR_OFFSET_MIN_M, DETOUR_OFFSET_MAX_M = 20_000.0, 120_000.0


class UpstreamError(Exception):
    """Mapbox failed or refused the request."""


class NoRouteError(Exception):
    """No drivable route between the two points."""


@dataclass
class RouteOption:
    line: RouteLine
    distance_m: float
    duration_s: float
    summary: str
    is_detour: bool = False


def _get(url: str, params: dict) -> dict:
    try:
        r = requests.get(url, params={**params, "access_token": settings.MAPBOX_TOKEN}, timeout=TIMEOUT_S)
    except requests.RequestException as exc:
        raise UpstreamError("Routing service is unreachable") from exc
    if r.status_code == 401 or r.status_code == 403:
        raise UpstreamError("Routing service rejected the access token")
    if r.status_code == 429:
        raise UpstreamError("Routing service rate limit reached, try again shortly")
    try:
        data = r.json()
    except ValueError as exc:
        raise UpstreamError("Routing service returned an invalid response") from exc
    if r.status_code >= 500:
        raise UpstreamError("Routing service error")
    return data


def geocode(query: str, limit: int = 5) -> list[dict]:
    data = _get(GEOCODE_URL, {"q": query, "limit": limit, "autocomplete": "true"})
    if data.get("message"):
        raise UpstreamError("Location search is unavailable")
    out = []
    for f in data.get("features", []):
        p = f.get("properties", {})
        lng, lat = f["geometry"]["coordinates"]
        out.append({"label": p.get("full_address") or p.get("name_preferred") or p.get("name"), "lng": lng, "lat": lat})
    return out


def _parse_route(route: dict, is_detour: bool = False) -> RouteOption:
    coords = [(c[0], c[1]) for c in route["geometry"]["coordinates"]]
    seg_m: list[float] = []
    seg_s: list[float] = []
    summaries: list[str] = []
    for leg in route["legs"]:
        ann = leg.get("annotation") or {}
        seg_m += ann.get("distance", [])
        seg_s += ann.get("duration", [])
        if leg.get("summary"):
            summaries.append(leg["summary"])
    line = build_route_line(coords, seg_m, seg_s, route["distance"], route["duration"])
    tokens = [t.strip() for s in summaries for t in s.split(",") if t.strip()]
    summary = ", ".join(dict.fromkeys(tokens)) or "Route"
    return RouteOption(line, line.total_m, line.total_s, summary, is_detour)


def _directions(points: list[Coord], alternatives: bool) -> list[dict]:
    path = ";".join(f"{x:.6f},{y:.6f}" for x, y in points)
    data = _get(
        DIRECTIONS_URL + path,
        {
            "alternatives": "true" if alternatives else "false",
            "geometries": "geojson",
            "overview": "full",
            "annotations": "duration,distance",
            "steps": "false",
        },
    )
    code = data.get("code")
    if code == "NoRoute" or (code == "Ok" and not data.get("routes")):
        raise NoRouteError("No drivable route found between these locations")
    if code != "Ok":
        raise UpstreamError(data.get("message") or "Routing service error")
    return data["routes"]


def _via_candidates(base: RouteOption, origin: Coord, dest: Coord) -> list[list[Coord]]:
    line = base.line
    offset = min(max(line.total_m * DETOUR_OFFSET_FRACTION, DETOUR_OFFSET_MIN_M), DETOUR_OFFSET_MAX_M)
    cands = []
    for frac in DETOUR_FRACTIONS:
        mid, _ = line.locate(line.total_m * frac)
        brg = bearing_deg(origin, dest)
        for side in (90, -90):
            via = destination_point(mid, (brg + side) % 360, offset)
            cands.append([origin, via, dest])
    return cands


def get_route_options(origin: Coord, dest: Coord, want: int = 3) -> list[RouteOption]:
    """Cached wrapper (10 min): the road network changes slowly and each search costs up to 7 calls."""
    key = f"route:{origin[0]:.4f},{origin[1]:.4f}:{dest[0]:.4f},{dest[1]:.4f}:{want}"
    hit = cache.get(key)
    if hit is None:
        hit = _compute_route_options(origin, dest, want)
        cache.set(key, hit, ROUTE_CACHE_TTL_S)
    return hit


def _compute_route_options(origin: Coord, dest: Coord, want: int) -> list[RouteOption]:
    """Up to ``want`` distinct routes, fastest first. Fewer are returned if none exist."""
    options = [_parse_route(r) for r in _directions([origin, dest], alternatives=True)]
    options.sort(key=lambda o: o.duration_s)
    if len(options) >= want:
        return options[:want]

    fastest = options[0]
    cands = _via_candidates(fastest, origin, dest)

    def attempt(points: list[Coord]) -> RouteOption | None:
        try:
            routes = _directions(points, alternatives=False)
        except (UpstreamError, NoRouteError) as exc:
            log.info("detour attempt failed: %s", exc)
            return None
        return _parse_route(routes[0], is_detour=True)

    with ThreadPoolExecutor(max_workers=3) as pool:
        found = [r for r in pool.map(attempt, cands) if r is not None]

    found.sort(key=lambda o: o.duration_s)
    for cand in found:
        if len(options) >= want:
            break
        if cand.duration_s > fastest.duration_s * MAX_DETOUR_FACTOR:
            continue
        if cand.distance_m > fastest.distance_m * MAX_DETOUR_FACTOR:
            continue
        if all(
            overlap_ratio(cand.line.coords, o.line.coords) < MAX_OVERLAP
            and overlap_ratio(o.line.coords, cand.line.coords) < MAX_OVERLAP
            for o in options
        ):
            options.append(cand)
    options.sort(key=lambda o: o.duration_s)
    return options
