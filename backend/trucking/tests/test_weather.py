import pytest

from trucking.domain.weather import WeatherSeries

T0 = 1_800_000_000


def series():
    return WeatherSeries(T0, (10.0, 20.0, 60.0), (0.0, 0.2, 0.4), (0.0, 0.0, 1.0))


def test_exact_hour_returns_that_value():
    w = series().at(T0 + 3600)
    assert (w.wind_mph, w.rain_in_hr) == (20.0, 0.2)


def test_interpolates_linearly_between_hours():
    w = series().at(T0 + 1800)
    assert w.wind_mph == pytest.approx(15.0)
    assert w.rain_in_hr == pytest.approx(0.1)


def test_last_hour_is_inclusive_and_beyond_is_none():
    assert series().at(T0 + 7200).wind_mph == 60.0
    assert series().at(T0 + 7201) is None
    assert series().at(T0 - 1) is None


def test_missing_value_gives_none():
    s = WeatherSeries(T0, (10.0, None), (0.0, 0.0), (0.0, 0.0))
    assert s.at(T0 + 10) is None
