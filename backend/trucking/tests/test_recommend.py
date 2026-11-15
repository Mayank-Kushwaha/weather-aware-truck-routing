import pytest

from trucking.domain.recommend import RouteStats, compute_stats, explain, owned_miles, rank_routes


def stats(nt=0.0, sev=0.0, high=0.0, avg=0.0):
    return RouteStats(nt, sev, high, 0.0, 0.0, 0.0, avg)


def test_owned_miles_split_at_midpoints_and_sum_to_total():
    owned = owned_miles([0, 25, 50, 60])
    assert owned == pytest.approx([12.5, 25.0, 17.5, 5.0])
    assert sum(owned) == pytest.approx(60)


def test_stats_bucket_miles_by_level_and_weight_average():
    # marks 0,10,20 -> owned 5,10,5 ; scores low, severe, high
    s = compute_stats([0, 10, 20], [0, 3, 2])
    assert (s.low_mi, s.severe_mi, s.high_mi) == (5, 10, 5)
    assert s.avg_risk == pytest.approx((0 * 5 + 3 * 10 + 2 * 5) / 20)


def test_unknown_miles_are_excluded_from_average():
    s = compute_stats([0, 10, 20], [None, 4, 0])
    assert s.unknown_mi == 5
    assert s.no_travel_mi == 10
    assert s.avg_risk == pytest.approx(40 / 15)


def test_fewest_severe_wins_even_if_slower():
    ranked = rank_routes([("a", stats(sev=40), 3600), ("b", stats(sev=0), 9000)])
    assert ranked == ["b", "a"]


def test_no_travel_is_worse_than_severe():
    ranked = rank_routes([("a", stats(nt=30), 3600), ("b", stats(sev=100), 9000)])
    assert ranked == ["b", "a"]


def test_high_then_average_then_time_tie_breaks():
    assert rank_routes([("a", stats(high=50), 1), ("b", stats(high=10), 99)]) == ["b", "a"]
    assert rank_routes([("a", stats(avg=1.5), 1), ("b", stats(avg=0.5), 99)]) == ["b", "a"]
    assert rank_routes([("a", stats(), 500), ("b", stats(), 100)]) == ["b", "a"]


def test_tiny_differences_fall_through_to_travel_time():
    ranked = rank_routes([("a", stats(sev=0.2, avg=0.50), 1000), ("b", stats(sev=0.0, avg=0.51), 5000)])
    assert ranked == ["a", "b"]


def test_explain_mentions_deciding_metric_and_time():
    text = explain((stats(sev=0), 4200), (stats(sev=42), 3600))
    assert "0 mi Severe vs 42" in text and "slower" in text


def test_explain_single_route():
    assert explain((stats(), 1), None) == "Only route available"
