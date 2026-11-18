"""Decision funnel: shows exactly how the lexicographic ranking eliminates routes, step by step.

The assessment orders the criteria (Severe miles, High miles, average risk, travel time). We add No Travel
miles in front (decisions.md D14). Instead of only reporting the winner, each criterion is applied in order
and every route that is not the best on it (within tolerance) is dropped. The recorded steps let the UI
draw a funnel, so the choice is auditable rather than a black box.
"""

from __future__ import annotations

from dataclasses import dataclass

from .recommend import AVG_RISK_TOLERANCE, MILES_TOLERANCE, RouteStats, _bucket

CRITERIA: tuple[tuple[str, str, str], ...] = (
    ("no_travel", "No Travel miles", "mi"),
    ("severe", "Severe miles", "mi"),
    ("high", "High miles", "mi"),
    ("avg_risk", "Average risk", "/4"),
    ("time", "Travel time", "s"),
)


@dataclass(frozen=True)
class Contender:
    route_id: str
    stats: RouteStats
    duration_s: float


def _raw(c: Contender, criterion: str) -> float:
    return {
        "no_travel": c.stats.no_travel_mi,
        "severe": c.stats.severe_mi,
        "high": c.stats.high_mi,
        "avg_risk": c.stats.avg_risk,
        "time": c.duration_s,
    }[criterion]


def _compare_value(c: Contender, criterion: str) -> float:
    raw = _raw(c, criterion)
    if criterion == "avg_risk":
        return _bucket(raw, AVG_RISK_TOLERANCE)
    if criterion == "time":
        return raw
    return _bucket(raw, MILES_TOLERANCE)


def ladder(contenders: list[Contender]) -> list[dict]:
    """Apply the criteria in order. Each step lists every route's value and who survives."""
    alive = list(contenders)
    steps: list[dict] = []
    for criterion, label, unit in CRITERIA:
        best = min(_compare_value(c, criterion) for c in alive)
        survivors = [c for c in alive if _compare_value(c, criterion) == best]
        steps.append(
            {
                "criterion": criterion,
                "label": label,
                "unit": unit,
                "values": {c.route_id: round(_raw(c, criterion), 2) for c in contenders},
                "survivors": [c.route_id for c in survivors],
                "eliminated": [c.route_id for c in alive if c not in survivors],
                "decisive": len(survivors) < len(alive),
            }
        )
        alive = survivors
    return steps
