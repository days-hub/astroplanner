"""Caching the pure astronomy.

These functions are deterministic in position and time, so caching them is
safe — but two of them return mutable objects, and that is where a cache
quietly corrupts itself. add_conditions() writes the forecast verdict onto
whatever NightInfo it is handed; if that were the cached instance, the first
request's cloud cover would be served to every later request for the same
night. These tests pin the copy-on-return guard, which nothing else would
catch: the app would look fine and just report wrong weather.
"""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.routers import targets
from app.routers.targets import (
    _moon_up_fraction,
    _moonset_after,
    _target_sample_time,
    compute_night_info,
    compute_visible_targets,
    resolve_observing_context,
)

ZONE = ZoneInfo("America/Toronto")
LAT, LON = 43.71, -79.40
NIGHT = "2026-08-01"
START = datetime(2026, 8, 2, 2, 0, tzinfo=timezone.utc)
END = START + timedelta(hours=5)


def _night():
    return compute_night_info(LAT, LON, NIGHT, "America/Toronto", ZONE)


class TestResultsAreUnchanged:
    """Caching must not alter a single answer."""

    def test_night_info_matches_across_calls(self):
        a, b = _night(), _night()
        assert a.model_dump() == b.model_dump()

    def test_moon_up_fraction_matches(self):
        assert _moon_up_fraction(LAT, LON, START, END) == _moon_up_fraction(
            LAT, LON, START, END
        )

    def test_moonset_matches(self):
        assert _moonset_after(LAT, LON, START, END) == _moonset_after(
            LAT, LON, START, END
        )

    def test_visible_targets_match(self):
        a = [t.model_dump() for t in compute_visible_targets(LAT, LON, START)]
        b = [t.model_dump() for t in compute_visible_targets(LAT, LON, START)]
        assert a == b and a, "expected a stable, non-empty target list"

    def test_catalogue_has_a_real_seasonal_selection(self):
        targets = compute_visible_targets(LAT, LON, START)
        names = {t.name for t in targets}
        assert len(names) >= 40
        assert {
            "Hercules Cluster (M13)",
            "Ring Nebula (M57)",
            "Whirlpool Galaxy (M51)",
            "North America Nebula (NGC 7000)",
        } <= names
        assert {t.category for t in targets} >= {
            "planet", "moon", "galaxy", "nebula", "cluster"
        }

    def test_different_places_are_not_confused(self):
        toronto = compute_night_info(LAT, LON, NIGHT, "America/Toronto", ZONE)
        # Manitoulin: far enough west that darkness starts noticeably later
        manitoulin = compute_night_info(45.77, -82.26, NIGHT, "America/Toronto", ZONE)
        assert toronto.dark_start != manitoulin.dark_start

    def test_different_nights_are_not_confused(self):
        a = compute_night_info(LAT, LON, "2026-08-01", "America/Toronto", ZONE)
        b = compute_night_info(LAT, LON, "2026-12-01", "America/Toronto", ZONE)
        assert a.dark_start != b.dark_start
        assert a.moon_illumination != b.moon_illumination


class TestCacheCannotBePoisoned:
    def test_night_info_hands_back_a_fresh_object(self):
        a, b = _night(), _night()
        assert a is not b, "callers must never share one NightInfo instance"

    def test_mutating_a_night_info_does_not_leak(self):
        """The exact shape of the add_conditions() hazard."""
        first = _night()
        first.cloud_cover_percent = 99
        first.conditions = "poor"
        first.conditions_summary = "poisoned"

        second = _night()
        assert second.cloud_cover_percent is None
        assert second.conditions is None
        assert second.conditions_summary is None

    def test_visible_targets_hand_back_a_fresh_list(self):
        a = compute_visible_targets(LAT, LON, START)
        b = compute_visible_targets(LAT, LON, START)
        assert a is not b
        assert all(x is not y for x, y in zip(a, b))

    def test_sorting_or_trimming_targets_does_not_leak(self):
        original = compute_visible_targets(LAT, LON, START)
        count = len(original)
        original.sort(key=lambda t: t.name)
        original.pop()
        original[0].name = "clobbered"

        again = compute_visible_targets(LAT, LON, START)
        assert len(again) == count
        assert "clobbered" not in [t.name for t in again]


class TestObservingNightBoundary:
    def test_after_midnight_stays_on_previous_evening_until_darkness_ends(self):
        night = compute_night_info(
            LAT, LON, "2026-08-01", "America/Toronto", ZONE
        )
        assert night.dark_end is not None
        context = resolve_observing_context(
            LAT,
            LON,
            "America/Toronto",
            ZONE,
            night.dark_end - timedelta(minutes=30),
        )
        assert context.date_local == "2026-08-01"
        assert context.phase == "active"

        sample, is_now = _target_sample_time(
            night, ZONE, night.dark_end - timedelta(minutes=30)
        )
        assert is_now is True
        assert sample == (night.dark_end - timedelta(minutes=30)).replace(
            second=0, microsecond=0
        )

    def test_context_advances_to_coming_evening_after_darkness_ends(self):
        night = compute_night_info(
            LAT, LON, "2026-08-01", "America/Toronto", ZONE
        )
        assert night.dark_end is not None
        context = resolve_observing_context(
            LAT,
            LON,
            "America/Toronto",
            ZONE,
            night.dark_end + timedelta(minutes=1),
        )
        assert context.date_local == "2026-08-02"
        assert context.phase == "upcoming"

        _, is_now = _target_sample_time(
            night, ZONE, night.dark_end + timedelta(minutes=1)
        )
        assert is_now is False


class TestCacheIsBounded:
    def test_every_cache_has_a_maxsize(self):
        """Unbounded caches on a 2 GB box are a slow memory leak: dates walk
        forward forever and saved sites multiply the keys."""
        for fn in (
            targets._night_info_cached,
            targets._visible_targets_cached,
            targets._moon_up_fraction_cached,
            targets._moonset_after_cached,
        ):
            assert fn.cache_info().maxsize is not None, fn.__name__

    def test_repeated_work_actually_hits_the_cache(self):
        targets._night_info_cached.cache_clear()
        for _ in range(5):
            _night()
        info = targets._night_info_cached.cache_info()
        assert info.misses == 1, info
        assert info.hits == 4, info
