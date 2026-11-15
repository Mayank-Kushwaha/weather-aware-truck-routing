"""Pure geometry helpers: distances, checkpoints, interpolation, overlap, simplification."""

from __future__ import annotations

import math
from bisect import bisect_right
from dataclasses import dataclass

EARTH_RADIUS_M = 6_371_008.8
METERS_PER_MILE = 1609.344

Coord = tuple[float, float]  # (lng, lat), GeoJSON order


def haversine_m(a: Coord, b: Coord) -> float:
    lng1, lat1, lng2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def bearing_deg(a: Coord, b: Coord) -> float:
    lng1, lat1, lng2, lat2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lng2 - lng1) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(lng2 - lng1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def destination_point(a: Coord, bearing: float, dist_m: float) -> Coord:
    lng1, lat1, brg = math.radians(a[0]), math.radians(a[1]), math.radians(bearing)
    d = dist_m / EARTH_RADIUS_M
    lat2 = math.asin(math.sin(lat1) * math.cos(d) + math.cos(lat1) * math.sin(d) * math.cos(brg))
    lng2 = lng1 + math.atan2(
        math.sin(brg) * math.sin(d) * math.cos(lat1), math.cos(d) - math.sin(lat1) * math.sin(lat2)
    )
    return (math.degrees(lng2), math.degrees(lat2))


@dataclass
class RouteLine:
    """A drivable line with cumulative distance (m) and time (s) at every vertex."""

    coords: list[Coord]
    cum_m: list[float]
    cum_s: list[float]
    time_is_estimated: bool = False

    def __post_init__(self) -> None:
        if not (len(self.coords) == len(self.cum_m) == len(self.cum_s)) or len(self.coords) < 2:
            raise ValueError("coords, cum_m and cum_s must have equal length >= 2")

    @property
    def total_m(self) -> float:
        return self.cum_m[-1]

    @property
    def total_s(self) -> float:
        return self.cum_s[-1]

    @property
    def total_mi(self) -> float:
        return self.total_m / METERS_PER_MILE

    def locate(self, meters: float) -> tuple[Coord, float]:
        """Return (coordinate, seconds from departure) at ``meters`` along the route."""
        m = min(max(meters, 0.0), self.total_m)
        i = min(max(bisect_right(self.cum_m, m) - 1, 0), len(self.coords) - 2)
        span = self.cum_m[i + 1] - self.cum_m[i]
        f = 0.0 if span <= 0 else (m - self.cum_m[i]) / span
        (x1, y1), (x2, y2) = self.coords[i], self.coords[i + 1]
        t = self.cum_s[i] + f * (self.cum_s[i + 1] - self.cum_s[i])
        return (x1 + f * (x2 - x1), y1 + f * (y2 - y1)), t


def build_route_line(
    coords: list[Coord], seg_m: list[float] | None, seg_s: list[float] | None, total_m: float, total_s: float
) -> RouteLine:
    """Build a RouteLine from per-segment annotations, else proportional to haversine length."""
    n = len(coords) - 1
    if seg_m and seg_s and len(seg_m) == n and len(seg_s) == n:
        cum_m, cum_s = [0.0], [0.0]
        for d, t in zip(seg_m, seg_s):
            cum_m.append(cum_m[-1] + d)
            cum_s.append(cum_s[-1] + t)
        return RouteLine(coords, cum_m, cum_s)
    hav = [0.0]
    for i in range(n):
        hav.append(hav[-1] + haversine_m(coords[i], coords[i + 1]))
    scale = total_m / hav[-1] if hav[-1] else 1.0
    cum_m = [h * scale for h in hav]
    cum_s = [total_s * (m / total_m) if total_m else 0.0 for m in cum_m]
    return RouteLine(coords, cum_m, cum_s, time_is_estimated=True)


def checkpoint_miles(total_mi: float, interval_mi: float) -> list[float]:
    """Miles 0, N, 2N ... always ending exactly at the destination."""
    if interval_mi <= 0:
        raise ValueError("interval must be positive")
    out = [0.0]
    k = 1
    while k * interval_mi < total_mi - 1e-6:
        out.append(k * interval_mi)
        k += 1
    out.append(total_mi)
    return out if total_mi > 1e-6 else [0.0]


def _cells(coords: list[Coord], step_m: float, cell_deg: float) -> set[tuple[int, int]]:
    cells: set[tuple[int, int]] = set()
    acc = step_m
    prev = coords[0]
    cells.add((int(prev[0] // cell_deg), int(prev[1] // cell_deg)))
    for c in coords[1:]:
        acc += haversine_m(prev, c)
        prev = c
        if acc >= step_m:
            acc = 0.0
            cells.add((int(c[0] // cell_deg), int(c[1] // cell_deg)))
    return cells


def overlap_ratio(a: list[Coord], b: list[Coord], cell_deg: float = 0.02) -> float:
    """Share of ``a`` (sampled about every 1 km) lying within ~1 grid cell of ``b``."""
    b_cells = _cells(b, 1000.0, cell_deg)
    a_cells = _cells(a, 1000.0, cell_deg)
    if not a_cells:
        return 0.0
    near = 0
    for cx, cy in a_cells:
        if any((cx + dx, cy + dy) in b_cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            near += 1
    return near / len(a_cells)


def simplify(coords: list[Coord], eps_deg: float) -> list[Coord]:
    """Ramer-Douglas-Peucker (iterative) in plain degree space; fine for display."""
    n = len(coords)
    if n < 3:
        return list(coords)
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        s, e = stack.pop()
        (x1, y1), (x2, y2) = coords[s], coords[e]
        dx, dy = x2 - x1, y2 - y1
        norm = math.hypot(dx, dy)
        best, idx = -1.0, -1
        for i in range(s + 1, e):
            x, y = coords[i]
            d = math.hypot(x - x1, y - y1) if norm == 0 else abs(dy * (x - x1) - dx * (y - y1)) / norm
            if d > best:
                best, idx = d, i
        if best > eps_deg:
            keep[idx] = True
            stack.append((s, idx))
            stack.append((idx, e))
    return [c for c, k in zip(coords, keep) if k]
