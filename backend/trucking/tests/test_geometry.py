import pytest

from trucking.domain.geometry import (
    METERS_PER_MILE,
    build_route_line,
    checkpoint_miles,
    destination_point,
    haversine_m,
    overlap_ratio,
    simplify,
)


def straight_line():
    # three segments along the equator: 1000 m / 2000 m / 1000 m taking 10 / 40 / 10 s
    coords = [(0.0, 0.0), (0.01, 0.0), (0.03, 0.0), (0.04, 0.0)]
    return build_route_line(coords, [1000, 2000, 1000], [10, 40, 10], 4000, 60)


def test_haversine_one_degree_of_latitude():
    assert haversine_m((0, 0), (0, 1)) == pytest.approx(111_195, rel=1e-3)


def test_destination_point_round_trip():
    a = (-87.6, 41.9)
    b = destination_point(a, 90, 50_000)
    assert haversine_m(a, b) == pytest.approx(50_000, rel=1e-3)


def test_locate_uses_segment_timing_not_proportional_distance():
    line = straight_line()
    _, t = line.locate(1500)  # halfway through the slow 2000 m segment
    assert t == pytest.approx(10 + 40 * 0.25)
    assert not line.time_is_estimated


def test_locate_clamps_to_ends():
    line = straight_line()
    assert line.locate(-5)[1] == 0
    assert line.locate(10**9)[1] == 60


def test_missing_annotations_fall_back_to_proportional_time():
    coords = [(0.0, 0.0), (0.01, 0.0), (0.02, 0.0)]
    line = build_route_line(coords, None, None, 2000, 100)
    assert line.time_is_estimated
    assert line.total_m == pytest.approx(2000)
    assert line.locate(1000)[1] == pytest.approx(50)


def test_checkpoint_miles_include_start_and_exact_end():
    assert checkpoint_miles(93.0, 25) == [0.0, 25, 50, 75, 93.0]
    assert checkpoint_miles(100.0, 25) == [0.0, 25, 50, 75, 100.0]
    assert checkpoint_miles(5.0, 25) == [0.0, 5.0]


def test_checkpoint_miles_rejects_bad_interval():
    with pytest.raises(ValueError):
        checkpoint_miles(10, 0)


def test_total_miles_conversion():
    line = build_route_line([(0, 0), (0.01, 0)], [METERS_PER_MILE * 2], [60], 1, 1)
    assert line.total_mi == pytest.approx(2.0)


def test_overlap_ratio_identical_and_distant():
    a = [(-90 + i * 0.01, 40.0) for i in range(100)]
    far = [(-90 + i * 0.01, 41.0) for i in range(100)]
    assert overlap_ratio(a, a) == pytest.approx(1.0)
    assert overlap_ratio(a, far) == 0.0


def test_simplify_keeps_corners_and_drops_collinear_points():
    pts = [(0, 0), (1, 0), (2, 0), (3, 0), (3, 3)]
    assert simplify(pts, 0.001) == [(0, 0), (3, 0), (3, 3)]
