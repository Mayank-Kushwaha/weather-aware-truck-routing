from django.core.cache import cache

from trucking.domain.geometry import METERS_PER_MILE
from trucking.services import mapbox


def fake_route(lat: float, miles: float = 100.0, hours: float = 2.0) -> dict:
    n = int(miles)
    coords = [[-90 + i * 0.0182, lat] for i in range(n + 1)]
    seg_m = [miles * METERS_PER_MILE / n] * n
    seg_s = [hours * 3600 / n] * n
    return {
        "geometry": {"coordinates": coords},
        "distance": miles * METERS_PER_MILE,
        "duration": hours * 3600,
        "legs": [{"summary": "I 1", "annotation": {"distance": seg_m, "duration": seg_s}}],
    }


def run(monkeypatch, detour_lat):
    """Base route at lat 40. ``detour_lat(via)`` decides which road a detour call returns."""
    cache.clear()
    calls = {"detours": 0}

    def fake_directions(points, alternatives):
        if alternatives:
            return [fake_route(40.0)]
        calls["detours"] += 1
        return [fake_route(detour_lat(points[1][1]), miles=110, hours=2.2)]

    monkeypatch.setattr(mapbox, "_directions", fake_directions)
    options = mapbox.get_route_options((-90.0, 40.0), (-88.2, 40.0))
    return options, calls["detours"]


def test_first_stage_is_enough_when_both_sides_give_distinct_routes(monkeypatch):
    options, detour_calls = run(monkeypatch, lambda via_lat: via_lat)  # a road through the via-point itself
    assert len(options) == 3
    assert detour_calls == 2  # only the middle position, both sides


def test_second_stage_runs_only_when_the_first_finds_nothing_distinct(monkeypatch):
    options, detour_calls = run(monkeypatch, lambda via_lat: 40.0)  # every detour collapses onto the main road
    assert len(options) == 1
    assert detour_calls == 2 + 4  # stage 1, then stage 2 (two positions, both sides)


def test_detours_much_slower_than_the_fastest_are_rejected(monkeypatch):
    cache.clear()

    def fake_directions(points, alternatives):
        if alternatives:
            return [fake_route(40.0)]
        return [fake_route(points[1][1], miles=300, hours=6.0)]  # 3x longer

    monkeypatch.setattr(mapbox, "_directions", fake_directions)
    assert len(mapbox.get_route_options((-90.0, 40.0), (-88.2, 40.0))) == 1


def test_primary_callback_fires_before_the_detour_search(monkeypatch):
    order = []

    def fake_directions(points, alternatives):
        order.append("detour" if not alternatives else "primary")
        return [fake_route(40.0 if alternatives else points[1][1])]

    cache.clear()
    monkeypatch.setattr(mapbox, "_directions", fake_directions)
    mapbox.get_route_options((-90.0, 40.0), (-88.2, 40.0), on_primary=lambda opts: order.append("callback"))
    assert order[:2] == ["primary", "callback"]
