from trucking.domain.advisor import Option, advise
from trucking.domain.decision import Contender, ladder
from trucking.domain.recommend import RouteStats


def stats(nt=0.0, sev=0.0, high=0.0, avg=0.0, unknown=0.0):
    return RouteStats(nt, sev, high, 0.0, 0.0, unknown, avg)


# ---------- decision funnel ----------


def test_ladder_eliminates_in_assessment_order():
    steps = ladder(
        [
            Contender("a", stats(sev=40), 3600),
            Contender("b", stats(sev=0, high=30), 4200),
            Contender("c", stats(sev=0, high=5), 5000),
        ]
    )
    by = {s["criterion"]: s for s in steps}
    assert by["no_travel"]["survivors"] == ["a", "b", "c"] and not by["no_travel"]["decisive"]
    assert by["severe"]["survivors"] == ["b", "c"] and by["severe"]["eliminated"] == ["a"]
    assert by["high"]["survivors"] == ["c"] and by["high"]["decisive"]
    assert by["time"]["survivors"] == ["c"]  # nothing left to eliminate
    assert [s["criterion"] for s in steps] == ["no_travel", "severe", "high", "avg_risk", "time"]


def test_ladder_falls_through_to_time_when_weather_ties():
    steps = ladder([Contender("a", stats(), 7000), Contender("b", stats(), 6000)])
    decisive = [s["criterion"] for s in steps if s["decisive"]]
    assert decisive == ["time"]
    assert steps[-1]["survivors"] == ["b"]


def test_ladder_treats_differences_inside_tolerance_as_equal():
    steps = ladder([Contender("a", stats(sev=0.2), 9000), Contender("b", stats(sev=0.0), 5000)])
    assert not next(s for s in steps if s["criterion"] == "severe")["decisive"]
    assert steps[-1]["survivors"] == ["b"]


# ---------- departure advisor ----------


def opt(rid, sev=0.0, high=0.0, dur=3600, unknown=0.0):
    return Option(rid, stats(sev=sev, high=high, unknown=unknown), dur)


def test_recommends_the_earliest_best_delay():
    by_shift = {
        0: [opt("r1", sev=50, high=25), opt("r2", sev=60)],
        1: [opt("r1", sev=50), opt("r2", sev=60)],
        2: [opt("r1", sev=25), opt("r2", sev=60)],
        3: [opt("r1"), opt("r2", sev=30)],
        4: [opt("r1"), opt("r2")],
    }
    out = advise(by_shift)
    assert out["status"] == "delay"
    assert out["delay_h"] == 3  # earliest of the equally best (zero-risk) windows
    assert out["route_id"] == "r1"
    assert out["before"]["severe_mi"] == 50 and out["after"]["severe_mi"] == 0
    assert "3 hours later" in out["headline"]


def test_keeps_departure_when_no_later_window_is_better():
    by_shift = {0: [opt("r1", high=10)], 1: [opt("r1", high=30)], 2: [opt("r1", high=40)]}
    out = advise(by_shift)
    assert out["status"] == "keep"
    assert "already the best" in out["headline"]


def test_calm_trip_says_so():
    out = advise({0: [opt("r1")], 1: [opt("r1")]})
    assert out["status"] == "keep"
    assert "No weather risk" in out["headline"]


def test_ignores_windows_that_only_look_better_because_forecast_ends():
    by_shift = {0: [opt("r1", sev=50)], 5: [opt("r1", sev=0, unknown=120)]}
    assert advise(by_shift)["status"] == "keep"


def test_flags_when_the_winner_flips_with_a_late_start():
    by_shift = {
        0: [opt("r1", sev=0), opt("r2", sev=30)],
        1: [opt("r1", sev=0), opt("r2", sev=30)],
        2: [opt("r1", sev=80), opt("r2", sev=0)],
    }
    out = advise(by_shift)
    assert out["stable"] is False
    assert out["flip"] == {"delay_h": 2, "route_id": "r2"}


def test_stable_when_winner_holds():
    by_shift = {h: [opt("r1"), opt("r2", sev=30)] for h in range(3)}
    out = advise(by_shift)
    assert out["stable"] is True and out["flip"] is None


def test_missing_baseline_is_unknown():
    assert advise({})["status"] == "unknown"
