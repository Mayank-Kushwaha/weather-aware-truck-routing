from datetime import UTC, datetime, timedelta

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from trucking.domain.geometry import METERS_PER_MILE, build_route_line
from trucking.domain.weather import WeatherSeries
from trucking.services import mapbox, openmeteo


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()


def make_option(offset_lat=0.0, miles=100.0, hours=2.0, detour=False):
    # straight west-to-east line, 1 vertex per ~mile
    n = int(miles)
    coords = [(-90 + i * 0.0182, 40 + offset_lat) for i in range(n + 1)]
    seg_m = [miles * METERS_PER_MILE / n] * n
    seg_s = [hours * 3600 / n] * n
    line = build_route_line(coords, seg_m, seg_s, miles * METERS_PER_MILE, hours * 3600)
    return mapbox.RouteOption(line, line.total_m, line.total_s, f"I {int(offset_lat * 10)}", detour)


def payload(**over):
    body = {
        "origin": {"lat": 40.0, "lng": -90.0, "label": "A"},
        "destination": {"lat": 40.0, "lng": -88.0, "label": "B"},
        "departure": (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
        "load_lb": 45000,
        "interval_mi": 25,
    }
    body.update(over)
    return body


def fake_series(wind):
    def _fetch(cells, start, end):
        base = int(datetime.combine(start, datetime.min.time(), tzinfo=UTC).timestamp())
        hours = (end - start).days * 24 + 24
        out = {}
        for c in cells:
            w = wind(c) if callable(wind) else wind
            out[c] = WeatherSeries(base, (w,) * hours, (0.0,) * hours, (0.0,) * hours)
        return out

    return _fetch


@pytest.fixture
def client():
    return APIClient()


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


@pytest.mark.parametrize(
    "over",
    [
        {"load_lb": -1},
        {"load_lb": 90000},
        {"interval_mi": 30},
        {"departure": (datetime.now(UTC) - timedelta(days=2)).isoformat()},
        {"departure": (datetime.now(UTC) + timedelta(days=30)).isoformat()},
        {"destination": {"lat": 40.0, "lng": -90.0}},
        {"origin": {"lat": 120, "lng": 0}},
    ],
)
def test_validation_errors_are_400(client, over):
    r = client.post("/api/analyze", payload(**over), format="json")
    assert r.status_code == 400


def test_analyze_ranks_calmer_route_first_and_applies_load_rule(client, monkeypatch):
    opts = [make_option(0.0, 100, 2.0), make_option(0.3, 110, 2.2, detour=True)]
    monkeypatch.setattr(mapbox, "get_route_options", lambda o, d, want=3: opts)
    # 40 mph wind on the first route's latitude only; 45,000 lb load -> Severe via load rule
    monkeypatch.setattr(openmeteo, "fetch_series", fake_series(lambda c: 40.0 if c[0] < 40.2 else 5.0))

    r = client.post("/api/analyze", payload(), format="json")
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["recommended_id"] == "r2"
    first = next(x for x in body["routes"] if x["id"] == "r1")
    assert first["stats"]["severe_mi"] == pytest.approx(100, abs=0.1)
    cp = first["checkpoints"][0]
    assert (cp["level"], cp["driver"]) == ("severe", "wind+load")
    assert len(cp["scores_by_hour"]) == 49
    assert any("Only 2" in w for w in body["warnings"])
    assert body["routes"][0]["reason"]


def test_lighter_load_changes_level_per_rules(client, monkeypatch):
    monkeypatch.setattr(mapbox, "get_route_options", lambda o, d, want=3: [make_option()])
    monkeypatch.setattr(openmeteo, "fetch_series", fake_series(40.0))
    r = client.post("/api/analyze", payload(load_lb=30000), format="json").json()
    assert r["routes"][0]["checkpoints"][0]["level"] == "high"


def test_etas_increase_along_the_route(client, monkeypatch):
    monkeypatch.setattr(mapbox, "get_route_options", lambda o, d, want=3: [make_option(miles=100, hours=2)])
    monkeypatch.setattr(openmeteo, "fetch_series", fake_series(5.0))
    cps = client.post("/api/analyze", payload(), format="json").json()["routes"][0]["checkpoints"]
    assert [c["mile"] for c in cps] == [0, 25, 50, 75, 100]
    etas = [datetime.fromisoformat(c["eta"].replace("Z", "+00:00")) for c in cps]
    assert etas == sorted(etas)
    assert (etas[-1] - etas[0]).total_seconds() == pytest.approx(2 * 3600, abs=2)


def test_too_many_checkpoints_is_400(client, monkeypatch):
    monkeypatch.setattr(mapbox, "get_route_options", lambda o, d, want=3: [make_option(miles=3000, hours=50)] * 3)
    r = client.post("/api/analyze", payload(interval_mi=10), format="json")
    assert r.status_code == 400 and "larger interval" in r.json()["error"]


def test_upstream_failures_map_to_clean_errors(client, monkeypatch):
    def boom(*a, **k):
        raise mapbox.UpstreamError("Routing service is unreachable")

    monkeypatch.setattr(mapbox, "get_route_options", boom)
    r = client.post("/api/analyze", payload(), format="json")
    assert r.status_code == 502 and r.json() == {"error": "Routing service is unreachable"}

    def noroute(*a, **k):
        raise mapbox.NoRouteError("No drivable route found between these locations")

    monkeypatch.setattr(mapbox, "get_route_options", noroute)
    assert client.post("/api/analyze", payload(), format="json").status_code == 422


def test_geocode_short_query_returns_empty_and_results_are_cached(client, monkeypatch):
    assert client.get("/api/geocode?q=a").json() == {"results": []}
    calls = []
    monkeypatch.setattr(mapbox, "geocode", lambda q: calls.append(q) or [{"label": "X", "lng": 1, "lat": 2}])
    client.get("/api/geocode?q=Chicago")
    client.get("/api/geocode?q=chicago")
    assert len(calls) == 1
