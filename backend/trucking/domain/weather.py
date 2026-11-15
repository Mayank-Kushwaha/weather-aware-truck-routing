"""Hourly weather series with linear interpolation at an arbitrary instant."""

from __future__ import annotations

import math
from dataclasses import dataclass

from .risk import Weather

HOUR_S = 3600


@dataclass(frozen=True)
class WeatherSeries:
    start_epoch: int  # UTC seconds of first hourly value
    wind: tuple[float | None, ...]  # mph
    rain: tuple[float | None, ...]  # in/hr (sum of preceding hour)
    snow: tuple[float | None, ...]  # in/hr (sum of preceding hour)

    def at(self, epoch: float) -> Weather | None:
        """Interpolate between the two surrounding hours. None if outside range or missing data."""
        pos = (epoch - self.start_epoch) / HOUR_S
        n = len(self.wind)
        if n == 0 or pos < 0 or pos > n - 1:
            return None
        i = min(int(math.floor(pos)), n - 2) if n > 1 else 0
        f = pos - i if n > 1 else 0.0
        vals = []
        for arr in (self.wind, self.rain, self.snow):
            a, b = arr[i], arr[min(i + 1, n - 1)]
            if a is None or b is None:
                return None
            vals.append(a + f * (b - a))
        return Weather(*vals)
