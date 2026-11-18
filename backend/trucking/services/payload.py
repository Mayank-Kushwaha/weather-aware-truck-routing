"""JSON shaping for the analysis response. No business rules live here, only serialisation."""

from __future__ import annotations

from datetime import UTC, datetime

from ..domain.geometry import simplify
from ..domain.recommend import RouteStats
from ..domain.risk import LEVEL_NAMES, Risk, Weather

GEOMETRY_EPS_DEG = 0.0004  # about 40 m: invisible on screen, cuts the payload by ~15x


def iso(dt: datetime) -> str:
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def stats_payload(s: RouteStats) -> dict:
    return {
        "no_travel_mi": round(s.no_travel_mi, 1),
        "severe_mi": round(s.severe_mi, 1),
        "high_mi": round(s.high_mi, 1),
        "moderate_mi": round(s.moderate_mi, 1),
        "low_mi": round(s.low_mi, 1),
        "unknown_mi": round(s.unknown_mi, 1),
        "avg_risk": round(s.avg_risk, 2),
    }


def checkpoint_payload(
    mile: float,
    lng: float,
    lat: float,
    eta: datetime,
    risk: Risk | None,
    weather: Weather | None,
    hourly: list[int | None],
) -> dict:
    return {
        "mile": round(mile, 1),
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "eta": iso(eta),
        "level": LEVEL_NAMES[risk.score] if risk else "unknown",
        "score": risk.score if risk else None,
        "driver": risk.driver if risk else None,
        "weather": (
            {
                "wind_mph": round(weather.wind_mph, 1),
                "rain_in_hr": round(weather.rain_in_hr, 3),
                "snow_in_hr": round(weather.snow_in_hr, 3),
            }
            if weather
            else None
        ),
        "scores_by_hour": hourly,
    }


def geometry_payload(coords: list[tuple[float, float]]) -> dict:
    return {
        "type": "LineString",
        "coordinates": [[round(x, 5), round(y, 5)] for x, y in simplify(coords, GEOMETRY_EPS_DEG)],
    }
