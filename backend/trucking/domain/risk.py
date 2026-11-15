"""Weather risk classification. Single source of truth for thresholds (rules.md #5).

Boundary handling (decisions.md D11): lower bounds are inclusive. Wind No Travel is
``>= 55``. Rain and snow No Travel is strictly greater than the Severe upper limit
(1.00 in/hr, 3.0 in/hr), so exactly 1.00 / 3.0 stays Severe.
"""

from __future__ import annotations

from dataclasses import dataclass

LOW, MODERATE, HIGH, SEVERE, NO_TRAVEL = 0, 1, 2, 3, 4
LEVEL_NAMES = ("low", "moderate", "high", "severe", "no_travel")

# (moderate_from, high_from, severe_from, no_travel_limit)
WIND_BOUNDS = (25.0, 35.0, 45.0, 55.0)  # mph, no travel when >= last
RAIN_BOUNDS = (0.10, 0.25, 0.50, 1.00)  # in/hr, no travel when > last
SNOW_BOUNDS = (0.5, 1.0, 2.0, 3.0)  # in/hr, no travel when > last

# Load rules (pounds, strict ">" as written in the assessment).
HEAVY_WIND_LOAD_LB = 30_000  # wind 45-54 mph above this load -> No Travel
MEDIUM_WIND_LOAD_LB = 40_000  # wind 35-44 mph above this load -> Severe


@dataclass(frozen=True)
class Weather:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float


@dataclass(frozen=True)
class Risk:
    score: int
    driver: str  # wind | rain | snow | wind+load

    @property
    def name(self) -> str:
        return LEVEL_NAMES[self.score]


def _classify(value: float, bounds: tuple[float, float, float, float], nt_inclusive: bool) -> int:
    moderate, high, severe, no_travel = bounds
    if value >= no_travel if nt_inclusive else value > no_travel:
        return NO_TRAVEL
    if value >= severe:
        return SEVERE
    if value >= high:
        return HIGH
    if value >= moderate:
        return MODERATE
    return LOW


def classify_wind(mph: float) -> int:
    return _classify(mph, WIND_BOUNDS, nt_inclusive=True)


def classify_rain(in_hr: float) -> int:
    return _classify(in_hr, RAIN_BOUNDS, nt_inclusive=False)


def classify_snow(in_hr: float) -> int:
    return _classify(in_hr, SNOW_BOUNDS, nt_inclusive=False)


def assess(weather: Weather, load_lb: float) -> Risk:
    """Checkpoint risk: worst single condition, then load rules may only raise it."""
    candidates = (
        (classify_wind(weather.wind_mph), "wind"),
        (classify_rain(weather.rain_in_hr), "rain"),
        (classify_snow(weather.snow_in_hr), "snow"),
    )
    score, driver = candidates[0]
    for s, d in candidates[1:]:
        if s > score:
            score, driver = s, d

    wind = weather.wind_mph
    if wind < WIND_BOUNDS[3]:
        if wind >= WIND_BOUNDS[2] and load_lb > HEAVY_WIND_LOAD_LB and score < NO_TRAVEL:
            return Risk(NO_TRAVEL, "wind+load")
        if wind >= WIND_BOUNDS[1] and load_lb > MEDIUM_WIND_LOAD_LB and score < SEVERE:
            return Risk(SEVERE, "wind+load")
    return Risk(score, driver)
