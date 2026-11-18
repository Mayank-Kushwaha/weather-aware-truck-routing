"""Departure advisor and slippage check, built on the same ranking as the recommendation.

Two questions a dispatcher actually asks after seeing the answer:
  1. "Would leaving a bit later be safer?"  -> best_window: the earliest delay (0-12 h) whose best route
     is materially better on the assessment's own criteria (No Travel, Severe, High miles, average risk).
  2. "Does the answer survive if I leave late?" -> stability: is the recommended route still the winner
     when departure slips by 1 h or 2 h?

Pure functions over precomputed stats; the orchestrator supplies stats per delay.
"""

from __future__ import annotations

from dataclasses import dataclass

from .recommend import RouteStats, risk_key, sort_key

SHIFTS: tuple[int, ...] = tuple(range(0, 13))  # delays to consider, in hours
SLIPPAGE_CHECK_H: tuple[int, ...] = (1, 2)


@dataclass(frozen=True)
class Option:
    route_id: str
    stats: RouteStats
    duration_s: float


def _best(options: list[Option]) -> Option:
    return min(options, key=lambda o: sort_key(o.stats, o.duration_s))


def _brief(s: RouteStats) -> dict:
    return {
        "no_travel_mi": round(s.no_travel_mi, 1),
        "severe_mi": round(s.severe_mi, 1),
        "high_mi": round(s.high_mi, 1),
        "avg_risk": round(s.avg_risk, 2),
    }


def _has_new_gaps(base: list[Option], later: list[Option]) -> bool:
    """A later window is not comparable if the forecast runs out and hides miles."""
    base_unknown = {o.route_id: o.stats.unknown_mi for o in base}
    return any(o.stats.unknown_mi > base_unknown.get(o.route_id, 0.0) + 0.5 for o in later)


def _headline(before: RouteStats, after: RouteStats, delay_h: int) -> str:
    parts = []
    for label, b, a in (
        ("No Travel", before.no_travel_mi, after.no_travel_mi),
        ("Severe", before.severe_mi, after.severe_mi),
        ("High", before.high_mi, after.high_mi),
    ):
        if round(b) != round(a):
            parts.append(f"{label} miles from {b:.0f} to {a:.0f}")
    if not parts:
        parts.append(f"average risk from {before.avg_risk:.2f} to {after.avg_risk:.2f}")
    hours = "1 hour" if delay_h == 1 else f"{delay_h} hours"
    return f"Leaving {hours} later cuts " + " and ".join(parts) + " on the best route."


def advise(by_shift: dict[int, list[Option]]) -> dict:
    """``by_shift[h]`` holds every route's stats if departure were delayed by ``h`` hours (0 is the request)."""
    base = by_shift.get(0)
    if not base:
        return {"status": "unknown", "stable": True, "flip": None}
    now_best = _best(base)

    # --- slippage: does the winner survive a late start? ---
    flip = None
    for h in SLIPPAGE_CHECK_H:
        later = by_shift.get(h)
        if not later or _has_new_gaps(base, later):
            continue
        winner = _best(later)
        original = next((o for o in later if o.route_id == now_best.route_id), None)
        # A flip only counts when the original winner is materially worse on weather, not a time tie-break.
        if original and winner.route_id != original.route_id and risk_key(original.stats) > risk_key(winner.stats):
            flip = {"delay_h": h, "route_id": winner.route_id}
            break

    # --- best window: earliest delay giving the lexicographically best weather outcome ---
    base_key = risk_key(now_best.stats)
    best: tuple[tuple, int, Option] | None = None
    for h in SHIFTS:
        if h == 0:
            continue
        options = by_shift.get(h)
        if not options or _has_new_gaps(base, options):
            continue
        cand = _best(options)
        key = risk_key(cand.stats)
        if key < base_key and (best is None or (key, h) < (best[0], best[1])):
            best = (key, h, cand)

    result: dict = {"status": "keep", "stable": flip is None, "flip": flip}
    if best:
        _, delay_h, cand = best
        result.update(
            status="delay",
            delay_h=delay_h,
            route_id=cand.route_id,
            before=_brief(now_best.stats),
            after=_brief(cand.stats),
            headline=_headline(now_best.stats, cand.stats, delay_h),
        )
    else:
        result["headline"] = (
            "Departing now is already the best weather window in the next 12 hours."
            if risk_key(now_best.stats) != (0, 0, 0, 0)
            else "No weather risk found for this trip in the next 12 hours."
        )
    return result
