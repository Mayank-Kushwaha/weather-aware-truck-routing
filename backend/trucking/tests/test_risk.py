import pytest

from trucking.domain.risk import (
    HIGH,
    LOW,
    MODERATE,
    NO_TRAVEL,
    SEVERE,
    Weather,
    assess,
    classify_rain,
    classify_snow,
    classify_wind,
)


@pytest.mark.parametrize(
    "mph,level",
    [
        (0, LOW),
        (24.99, LOW),
        (25, MODERATE),
        (34.99, MODERATE),
        (35, HIGH),
        (44.99, HIGH),
        (45, SEVERE),
        (54.99, SEVERE),
        (55, NO_TRAVEL),
        (80, NO_TRAVEL),
    ],
)
def test_wind_levels(mph, level):
    assert classify_wind(mph) == level


@pytest.mark.parametrize(
    "rate,level",
    [
        (0, LOW),
        (0.099, LOW),
        (0.10, MODERATE),
        (0.249, MODERATE),
        (0.25, HIGH),
        (0.499, HIGH),
        (0.50, SEVERE),
        (1.00, SEVERE),
        (1.001, NO_TRAVEL),
        (3, NO_TRAVEL),
    ],
)
def test_rain_levels(rate, level):
    assert classify_rain(rate) == level


@pytest.mark.parametrize(
    "rate,level",
    [
        (0, LOW),
        (0.49, LOW),
        (0.5, MODERATE),
        (0.99, MODERATE),
        (1.0, HIGH),
        (1.99, HIGH),
        (2.0, SEVERE),
        (3.0, SEVERE),
        (3.01, NO_TRAVEL),
    ],
)
def test_snow_levels(rate, level):
    assert classify_snow(rate) == level


def test_checkpoint_takes_worst_condition_and_names_driver():
    r = assess(Weather(wind_mph=10, rain_in_hr=0.3, snow_in_hr=0.6), load_lb=0)
    assert (r.score, r.driver) == (HIGH, "rain")
    r = assess(Weather(wind_mph=26, rain_in_hr=0.0, snow_in_hr=2.5), load_lb=0)
    assert (r.score, r.driver) == (SEVERE, "snow")


def test_wind_55_is_no_travel_for_any_load():
    assert assess(Weather(55, 0, 0), 0).score == NO_TRAVEL
    assert assess(Weather(70, 0, 0), 1000).score == NO_TRAVEL


def test_heavy_load_in_45_to_54_wind_is_no_travel():
    assert assess(Weather(45, 0, 0), 30_000).score == SEVERE  # not strictly above 30,000
    r = assess(Weather(45, 0, 0), 30_001)
    assert (r.score, r.driver) == (NO_TRAVEL, "wind+load")
    assert assess(Weather(54.9, 0, 0), 60_000).score == NO_TRAVEL


def test_load_over_40000_in_35_to_44_wind_is_severe():
    assert assess(Weather(35, 0, 0), 40_000).score == HIGH  # not strictly above 40,000
    r = assess(Weather(35, 0, 0), 40_001)
    assert (r.score, r.driver) == (SEVERE, "wind+load")
    assert assess(Weather(44.9, 0, 0), 79_000).score == SEVERE


def test_load_rules_never_lower_a_level():
    # rain already No Travel; heavy load at 36 mph must not reduce it
    assert assess(Weather(36, 1.5, 0), 50_000).score == NO_TRAVEL
    # snow Severe stays Severe under the 35-44 mph load rule
    assert assess(Weather(40, 0, 2.5), 50_000).score == SEVERE


def test_load_rules_do_not_apply_below_35_mph():
    assert assess(Weather(34.9, 0, 0), 80_000).score == MODERATE
