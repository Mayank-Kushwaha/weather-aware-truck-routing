from datetime import UTC, datetime, timedelta

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from trucking.domain.weather import WeatherSeries
from trucking.presets import PRESETS
from trucking.services import openmeteo, presets

NOW = datetime(2026, 11, 16, 17, 20, tzinfo=UTC)
START = datetime(2026, 11, 16, tzinfo=UTC)
HOURS = 16 * 24


def series_with_spike(spike_hour: int | None, wind=50.0):
    wind_vals = [5.0] * HOURS
    if spike_hour is not None:
        wind_vals[spike_hour] = wind
    zeros = (0.0,) * HOURS
    return WeatherSeries(int(START.timestamp()), tuple(wind_vals), zeros, zeros)


@pytest.fixture(autouse=True)
def _clear():
    cache.clear()


def fake_fetch(series):
    return lambda cells, start, end: {c: series for c in cells}


def test_harsh_preset_departs_so_the_truck_meets_the_spike(monkeypatch):
    spike = 24 * 5 + 10  # hour 10 on day 5
    monkeypatch.setattr(openmeteo, "fetch_series", fake_fetch(series_with_spike(spike)))
    preset = next(p for p in PRESETS if p.id == "cheyenne-casper")  # 45,000 lb: 50 mph is No Travel via load rule
    series = {openmeteo.to_cell(pt): series_with_spike(spike) for pt in presets._line(preset)}
    out = presets._pick(preset, series, NOW)
    peak_at = datetime.fromisoformat(out["peak"]["at"].replace("Z", "+00:00"))
    assert out["peak"]["level"] == "no_travel"
    assert out["peak"]["driver"] == "wind+load"
    assert peak_at == START + timedelta(hours=spike)
    assert datetime.fromisoformat(out["departure"].replace("Z", "+00:00")) <= peak_at


def test_calm_preset_picks_first_calm_departure_soon(monkeypatch):
    preset = next(p for p in PRESETS if p.kind == "calm")
    series = {openmeteo.to_cell(pt): series_with_spike(None) for pt in presets._line(preset)}
    out = presets._pick(preset, series, NOW)
    assert out["peak"]["level"] == "low"
    dep = datetime.fromisoformat(out["departure"].replace("Z", "+00:00"))
    assert dep == datetime(2026, 11, 16, 18, 0, tzinfo=UTC)  # next full hour after now+1h


def test_build_lists_harsh_first_and_worst_first(monkeypatch):
    monkeypatch.setattr(openmeteo, "fetch_series", fake_fetch(series_with_spike(24 * 3)))
    items = presets.build(now=NOW)
    kinds = [i["kind"] for i in items]
    assert kinds == sorted(kinds, key=lambda k: k != "harsh")
    levels = ["low", "moderate", "high", "severe", "no_travel"]
    harsh = [levels.index(i["peak"]["level"]) for i in items if i["kind"] == "harsh"]
    assert harsh == sorted(harsh, reverse=True)


def test_every_non_us_preset_has_one_end_in_india():
    for p in PRESETS:
        if p.region == "USA":
            continue
        assert "India" in p.origin.label or "India" in p.destination.label, p.id


def test_presets_endpoint(monkeypatch):
    monkeypatch.setattr(openmeteo, "fetch_series", fake_fetch(series_with_spike(None)))
    body = APIClient().get("/api/presets").json()
    assert len(body["presets"]) == len(PRESETS)
    first = body["presets"][0]
    assert {"id", "title", "kind", "origin", "destination", "load_lb", "departure", "peak"} <= first.keys()
