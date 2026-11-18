"""Route statistics and ranking (decisions.md D13, D14)."""

from __future__ import annotations

from dataclasses import dataclass

from .risk import HIGH, LOW, MODERATE, NO_TRAVEL, SEVERE

# Differences below these are treated as equal so the order does not flip on noise
# and travel time can matter (the PDF asks to balance risk and time). Set both to 0 for strict mode.
MILES_TOLERANCE = 1.0
AVG_RISK_TOLERANCE = 0.05


@dataclass(frozen=True)
class RouteStats:
    no_travel_mi: float
    severe_mi: float
    high_mi: float
    moderate_mi: float
    low_mi: float
    unknown_mi: float
    avg_risk: float  # distance-weighted score 0-4 over known miles


def owned_miles(mile_marks: list[float]) -> list[float]:
    """Each checkpoint owns the stretch from the midpoint before it to the midpoint after it."""
    n = len(mile_marks)
    if n == 0:
        return []
    if n == 1:
        return [0.0]
    bounds = [mile_marks[0]]
    bounds += [(mile_marks[i - 1] + mile_marks[i]) / 2 for i in range(1, n)]
    bounds.append(mile_marks[-1])
    return [max(bounds[i + 1] - bounds[i], 0.0) for i in range(n)]


def compute_stats(mile_marks: list[float], scores: list[int | None]) -> RouteStats:
    buckets = {NO_TRAVEL: 0.0, SEVERE: 0.0, HIGH: 0.0, MODERATE: 0.0, LOW: 0.0}
    unknown = 0.0
    weighted = 0.0
    for miles, score in zip(owned_miles(mile_marks), scores):
        if score is None:
            unknown += miles
            continue
        buckets[score] += miles
        weighted += score * miles
    known = sum(buckets.values())
    return RouteStats(
        no_travel_mi=buckets[NO_TRAVEL],
        severe_mi=buckets[SEVERE],
        high_mi=buckets[HIGH],
        moderate_mi=buckets[MODERATE],
        low_mi=buckets[LOW],
        unknown_mi=unknown,
        avg_risk=weighted / known if known else 0.0,
    )


def _bucket(value: float, tol: float) -> float:
    return round(value / tol) if tol > 0 else value


def risk_key(stats: RouteStats) -> tuple:
    """Weather part of the ranking: No Travel, Severe, High miles, then average risk (tolerance buckets)."""
    return (
        _bucket(stats.no_travel_mi, MILES_TOLERANCE),
        _bucket(stats.severe_mi, MILES_TOLERANCE),
        _bucket(stats.high_mi, MILES_TOLERANCE),
        _bucket(stats.avg_risk, AVG_RISK_TOLERANCE),
    )


def sort_key(stats: RouteStats, duration_s: float) -> tuple:
    """Full ranking key. Lower is better; travel time is the last tie-break."""
    return (*risk_key(stats), duration_s)


def rank_routes(items: list[tuple[str, RouteStats, float]]) -> list[str]:
    """items: (route_id, stats, duration_s). Returns route ids best first."""
    return [rid for rid, s, d in sorted(items, key=lambda x: sort_key(x[1], x[2]))]


def explain(best: tuple[RouteStats, float], other: tuple[RouteStats, float] | None) -> str:
    """One plain sentence on why ``best`` wins against the runner-up."""
    b, bd = best
    if other is None:
        return "Only route available"
    o, od = other
    diff_min = round((bd - od) / 60)
    time_txt = f"{abs(diff_min)} min {'slower' if diff_min > 0 else 'faster'}" if diff_min else "same time"
    for label, bv, ov in (
        ("No Travel", b.no_travel_mi, o.no_travel_mi),
        ("Severe", b.severe_mi, o.severe_mi),
        ("High", b.high_mi, o.high_mi),
    ):
        if _bucket(bv, MILES_TOLERANCE) != _bucket(ov, MILES_TOLERANCE):
            return f"{bv:.0f} mi {label} vs {ov:.0f} mi on the next best route; {time_txt}"
    if _bucket(b.avg_risk, AVG_RISK_TOLERANCE) != _bucket(o.avg_risk, AVG_RISK_TOLERANCE):
        return f"Lowest average risk ({b.avg_risk:.2f} vs {o.avg_risk:.2f}); {time_txt}"
    return (
        f"Comparable weather risk; {time_txt} than the next best route"
        if diff_min
        else "Comparable weather risk and travel time"
    )
