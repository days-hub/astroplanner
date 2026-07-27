"""Multi-night outlook logic: clear windows, observing focus, ranking.

All pure functions — the endpoint that uses them needs a live forecast, but
these are where the judgement lives.
"""
from datetime import datetime, timedelta, timezone

from app.core.observing import (
    describe_cloud_trend,
    find_clear_window,
    night_rank_key,
    observing_focus,
    recommend_night,
)

BASE = datetime(2026, 8, 1, 22, 0, tzinfo=timezone.utc)


def rows(*clouds: int, start: datetime = BASE):
    """Hourly forecast rows with the given cloud percentages."""
    return [
        {"time": (start + timedelta(hours=i)).isoformat(), "cloud_cover": c}
        for i, c in enumerate(clouds)
    ]


class TestClearWindow:
    def test_finds_the_longest_clear_run(self):
        # clear, clear, socked in, clear, clear, clear
        r = rows(10, 5, 95, 0, 10, 5)
        window = find_clear_window(r, BASE, BASE + timedelta(hours=6))
        assert window is not None
        start, end = window
        assert start == BASE + timedelta(hours=3)  # the three-hour run wins
        assert end == BASE + timedelta(hours=6)

    def test_returns_none_when_nothing_is_clear(self):
        r = rows(95, 100, 90, 88)
        assert find_clear_window(r, BASE, BASE + timedelta(hours=4)) is None

    def test_clipped_to_the_darkness_window(self):
        """A clear evening that starts before astronomical darkness should
        report the window from when it actually gets dark."""
        r = rows(0, 0, 0, 0)
        dark_start = BASE + timedelta(hours=1)
        window = find_clear_window(r, dark_start, BASE + timedelta(hours=3))
        assert window == (dark_start, BASE + timedelta(hours=3))

    def test_broken_cloud_still_counts_as_usable(self):
        """40% broken cloud is a real observing opportunity, unlike 90%."""
        assert find_clear_window(rows(35, 35), BASE, BASE + timedelta(hours=2))
        assert find_clear_window(rows(85, 85), BASE, BASE + timedelta(hours=2)) is None

    def test_no_forecast_rows_yields_no_window(self):
        assert find_clear_window([], BASE, BASE + timedelta(hours=4)) is None


class TestObservingFocus:
    def test_dark_and_clear_is_deep_sky(self):
        focus, _ = observing_focus(5, moon_illumination=0.05,
                                   moon_up_fraction=0.2, has_darkness=True)
        assert focus == "deep-sky"

    def test_bright_moon_makes_it_a_planetary_night(self):
        """A clear night under a full Moon isn't wasted — it's just not a
        deep-sky night."""
        focus, summary = observing_focus(5, moon_illumination=0.98,
                                         moon_up_fraction=1.0, has_darkness=True)
        assert focus == "planetary"
        assert "Moon" in summary

    def test_partly_cloudy_drops_to_planetary(self):
        focus, _ = observing_focus(55, moon_illumination=0.0,
                                   moon_up_fraction=0.0, has_darkness=True)
        assert focus == "planetary"

    def test_overcast_is_no_observing(self):
        focus, summary = observing_focus(90, moon_illumination=0.0,
                                         moon_up_fraction=0.0, has_darkness=True)
        assert focus == "none"
        assert "cloudy" in summary.lower()

    def test_no_darkness_is_planetary_at_best(self):
        focus, _ = observing_focus(5, moon_illumination=0.0,
                                   moon_up_fraction=0.0, has_darkness=False)
        assert focus == "planetary"

    def test_no_forecast_means_no_call(self):
        assert observing_focus(None, 0.5, 0.5, True) == (None, None)


class TestNightRanking:
    def test_better_verdict_wins(self):
        assert night_rank_key("good", 2.0, 10) > night_rank_key("fair", 6.0, 30)

    def test_more_clear_hours_breaks_a_verdict_tie(self):
        assert night_rank_key("fair", 5.0, 40) > night_rank_key("fair", 1.0, 40)

    def test_less_cloud_breaks_a_clear_hours_tie(self):
        assert night_rank_key("good", 4.0, 5) > night_rank_key("good", 4.0, 20)

    def test_cloud_can_outweigh_a_slightly_longer_window(self):
        """The old lexicographic key made this impossible: any longer window
        won outright and cloud only broke exact ties, so the outlook could
        crown the cloudiest night of the week."""
        long_and_murky = night_rank_key("fair", 4.0, 60)
        short_and_clear = night_rank_key("fair", 3.5, 5)
        assert short_and_clear > long_and_murky

    def test_wind_counts(self):
        """The card prints the wind speed, so it had better be using it."""
        calm = night_rank_key("fair", 4.0, 30, wind_kmh=5)
        gale = night_rank_key("fair", 4.0, 30, wind_kmh=45)
        assert calm > gale

    def test_moonlight_counts(self):
        dark = night_rank_key("fair", 4.0, 30, moon_illumination=0.0, moon_up_fraction=0.0)
        washed = night_rank_key("fair", 4.0, 30, moon_illumination=1.0, moon_up_fraction=1.0)
        assert dark > washed

    def test_outlook_and_location_ranking_agree(self):
        """Both surfaces answer "which sky is better?" and must not use
        different rules to do it."""
        from app.core.observing import sky_score

        args = ("fair", 3.7, 22)
        kwargs = dict(moon_illumination=0.9, moon_up_fraction=0.8, wind_kmh=18.0)
        assert night_rank_key(*args, **kwargs) == sky_score(*args, **kwargs)

    def test_the_windy_long_window_case(self):
        """Straight from the outlook screenshot: Tuesday had the longest
        window but the most cloud and by far the most wind; Thursday was
        calmer and clearer. Thursday is the better night."""
        tuesday = night_rank_key(
            "fair", 4.0, 37, moon_illumination=1.0, moon_up_fraction=1.0, wind_kmh=20.9
        )
        thursday = night_rank_key(
            "fair", 3.1, 26, moon_illumination=0.98, moon_up_fraction=1.0, wind_kmh=6.2
        )
        assert thursday > tuesday

    def test_ranking_picks_the_best_of_a_week(self):
        week = [
            ("Mon", "poor", 0.0, 95),
            ("Tue", "good", 4.5, 12),
            ("Wed", "fair", 3.0, 35),
            ("Thu", "good", 2.0, 15),
        ]
        best = max(week, key=lambda n: night_rank_key(n[1], n[2], n[3]))
        assert best[0] == "Tue"


class TestCloudTrendDescription:
    """The chart shows the shape; this states it."""

    def d(self, *pairs):
        return describe_cloud_trend(list(pairs))

    def test_overcast_all_night(self):
        assert self.d(("22:00", 95), ("23:00", 100), ("00:00", 92)) == "Overcast all night"

    def test_clear_all_night(self):
        assert self.d(("22:00", 5), ("23:00", 0), ("00:00", 10)) == "Clear all night"

    def test_clearing_later_names_the_turn(self):
        out = self.d(("22:00", 90), ("23:00", 80), ("00:00", 20), ("01:00", 10))
        assert "Clearing later" in out and "00:00" in out

    def test_clouding_over_names_the_turn(self):
        out = self.d(("22:00", 10), ("23:00", 15), ("00:00", 85), ("01:00", 95))
        assert "clouding over" in out and "23:00" in out

    def test_cloudy_throughout_points_at_the_thinnest_hour(self):
        out = self.d(("22:00", 75), ("23:00", 55), ("00:00", 70))
        assert "thinnest around 23:00" in out

    def test_no_points_says_so(self):
        assert describe_cloud_trend([]) == "No cloud forecast available"


class TestRecommendation:
    """The bottom line — an information display becomes a planner here."""

    def test_poor_night_says_dont_bother_and_when_to_try(self):
        head, detail = recommend_night(
            conditions="poor", clear_hours=0.0, focus="none",
            has_darkness=True, next_better_weekday="Wednesday",
        )
        assert "not worth" in head.lower()
        assert "Wednesday" in detail

    def test_tomorrow_is_phrased_as_tomorrow(self):
        _, detail = recommend_night(
            conditions="poor", clear_hours=0.0, focus="none", has_darkness=True,
            next_better_weekday="Tuesday", next_better_is_tomorrow=True,
        )
        assert "tomorrow" in detail.lower()
        assert "Tuesday" not in detail

    def test_poor_with_a_gap_is_marginal_not_hopeless(self):
        head, _ = recommend_night(
            conditions="poor", clear_hours=1.5, focus="planetary", has_darkness=True,
        )
        assert "Marginal" in head

    def test_clear_but_moonlit_recommends_the_moon_and_planets(self):
        head, detail = recommend_night(
            conditions="fair", clear_hours=5.0, focus="planetary", has_darkness=True,
        )
        assert "Moon and planets" in head
        assert "deep-sky" in detail

    def test_good_deep_sky_night_is_endorsed(self):
        head, _ = recommend_night(
            conditions="good", clear_hours=4.5, focus="deep-sky", has_darkness=True,
        )
        assert "Worth setting up" in head

    def test_no_forecast_does_not_pretend_to_advise(self):
        head, _ = recommend_night(
            conditions=None, clear_hours=0.0, focus=None, has_darkness=True,
        )
        assert "No forecast" in head

    def test_no_alternative_night_omits_the_suggestion(self):
        _, detail = recommend_night(
            conditions="poor", clear_hours=0.0, focus="none",
            has_darkness=True, next_better_weekday=None,
        )
        assert "next clear night" not in detail
        assert "tomorrow" not in detail.lower()
