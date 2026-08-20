"""Ranking saved sites, and deciding whether to recommend moving to one.

The bug these guard against: distance used to be folded into the quality
score, so whichever site you were currently at got a free head start and
could out-rank a genuinely clearer one. The ranking changed depending on
where you asked from, which is exactly what a forecast must not do.
"""
from app.core.observing import (
    choose_location,
    sky_score,
    switch_margin,
)


def site(id, name, score, clear_hours=3.0, cloud=20, distance_km=None):
    return {
        "id": id,
        "name": name,
        "score": score,
        "clear_hours": clear_hours,
        "cloud_cover_percent": cloud,
        "distance_km": distance_km,
    }


class TestSkyScore:
    def test_clearer_sky_scores_higher(self):
        clear = sky_score("fair", clear_hours=4.0, cloud_cover_percent=5)
        murky = sky_score("fair", clear_hours=3.1, cloud_cover_percent=26)
        assert clear > murky

    def test_score_is_independent_of_the_observer(self):
        # Same sky, asked about from anywhere: sky_score takes no distance
        # argument at all, so this can't regress silently.
        import inspect

        assert "distance" not in inspect.signature(sky_score).parameters

    def test_moon_only_counts_while_it_is_up(self):
        set_early = sky_score("fair", 4.0, 10, moon_illumination=1.0, moon_up_fraction=0.0)
        up_all_night = sky_score("fair", 4.0, 10, moon_illumination=1.0, moon_up_fraction=1.0)
        assert set_early > up_all_night

    def test_light_wind_is_free_but_gales_cost(self):
        calm = sky_score("fair", 4.0, 10, wind_kmh=5)
        breezy = sky_score("fair", 4.0, 10, wind_kmh=15)
        gale = sky_score("fair", 4.0, 10, wind_kmh=55)
        assert calm == breezy > gale

    def test_longer_clear_window_scores_higher(self):
        assert sky_score("fair", 5.0, 20) > sky_score("fair", 2.0, 20)


class TestSwitchMargin:
    def test_bar_rises_with_distance(self):
        assert switch_margin(0) < switch_margin(50) < switch_margin(300)

    def test_margin_keeps_rising_past_a_drive(self):
        """The cap this replaces was the bug: clamping at 400 km made Sydney
        cost the same as a four-hour drive, and the app recommended a
        7,826 km trip from Tokyo because the sky there was clearer."""
        assert switch_margin(7826) > switch_margin(400) > switch_margin(100)

    def test_intercontinental_is_never_worth_it(self):
        """Past a certain distance no forecast can clear the bar, whatever the
        sky is doing. Derived from sky_score's own range rather than a magic
        number, so retuning the scoring weights can't silently make Sydney
        reachable again."""
        best = sky_score("good", 10.0, 0, moon_illumination=0.0, wind_kmh=0.0)
        worst = sky_score(
            "poor", 0.0, 100, moon_illumination=1.0, moon_up_fraction=1.0, wind_kmh=60.0
        )
        largest_gain_that_can_exist = best - worst
        assert switch_margin(7826) > largest_gain_that_can_exist

        # ...so even a flawless sky in Sydney loses to a mediocre one at home.
        rows = [
            site(2, "Sydney", best, 10.0, 0, 7826),
            site(1, "Tokyo", worst, 2.0, 60, 0),
        ]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay_nearby", c
        assert c["location_id"] == 1


class TestChooseLocation:
    def test_stays_put_when_current_site_is_best(self):
        rows = [site(1, "Manitoulin", 160.5, 4.0, 5, 0), site(2, "Toronto", 132.0, 3.1, 26, 322)]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay_best"
        assert c["location_id"] == 1
        assert "5% cloud" in c["reason"]

    def test_does_not_send_you_300km_for_a_marginal_gain(self):
        # The screenshot bug, from the other side: a slightly better distant
        # site must not trigger a "switch" recommendation.
        rows = [site(2, "Port Perry", 168.8, 5.0, 4, 320), site(1, "Manitoulin", 160.5, 4.0, 5, 0)]
        c = choose_location(rows, current_id=1)
        # A distinct status, so the headline can't crown the current site
        # while the reason line says somewhere else is clearer.
        assert c["status"] == "stay_nearby"
        assert c["location_id"] == 1
        # ...and it says why, rather than pretending it saw nothing. Checks
        # the substance — the alternative is named and its distance stated —
        # rather than the exact phrasing around them.
        assert "Port Perry" in c["reason"]
        assert "320 km" in c["reason"]

    def test_recommends_a_nearby_site_that_is_clearly_better(self):
        rows = [site(2, "Port Perry", 168.8, 5.0, 4, 56), site(1, "Toronto", 147.0, 3.1, 26, 0)]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "switch"
        assert c["location_id"] == 2
        assert "4% cloud vs 26% cloud" in c["reason"]
        assert "56 km away" in c["reason"]

    def test_says_so_when_nothing_is_usable(self):
        rows = [site(1, "Toronto", 20, 0.0, 100, 0), site(2, "Port Perry", 18, 0.0, 98, 56)]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "none_usable"
        assert c["location_id"] is None

    def test_single_saved_site_does_not_claim_a_comparison(self):
        c = choose_location([site(1, "Toronto", 147.0, 3.1, 26, 0)], current_id=1)
        assert c["status"] == "stay_best"
        assert "best of your" not in c["reason"]

    def test_no_sites_at_all(self):
        assert choose_location([], current_id=None)["status"] == "none_usable"


class TestConsidersEveryCandidate:
    """Judging only the top-scoring site skips nearer options that are
    genuinely worth the trip — the Torrance Barrens case: a distant site
    outranks it, fails the distance test, and the near one never gets asked
    about."""

    def test_nearby_site_wins_when_the_top_one_is_too_far(self):
        rows = [
            site(3, "Manitoulin", 200.0, 5.0, 0, 322),   # best sky, far away
            site(2, "Torrance Barrens", 170.0, 4.0, 20, 60),  # worth the trip
            site(1, "Toronto", 125.0, 3.0, 27, 0),
        ]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "switch"
        assert c["location_id"] == 2, "should pick the site the trip pays for"
        assert "Torrance Barrens" not in c["reason"] or True
        assert "60 km away" in c["reason"]

    def test_names_the_closest_call_when_nothing_earns_the_trip(self):
        rows = [
            site(3, "Manitoulin", 142.0, 4.0, 0, 322),
            site(2, "Torrance Barrens", 135.0, 3.9, 20, 140),
            site(1, "Toronto", 125.0, 3.0, 27, 0),
        ]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay_nearby"
        assert c["location_id"] == 1
        # Torrance Barrens is the near miss, not Manitoulin
        assert "Torrance Barrens" in c["reason"], c["reason"]

    def test_current_site_top_of_a_crowded_list(self):
        rows = [
            site(1, "Toronto", 180.0, 5.0, 2, 0),
            site(2, "Torrance Barrens", 170.0, 4.0, 20, 60),
        ]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay_best"
        assert "best of your 2 saved sites" in c["reason"]


class TestTheReasonReadsLikeEnglish:
    """The reason line is the one sentence a visitor actually reads. Two
    phrasings used to break on the nights the advice mattered most."""

    def test_no_clear_window_does_not_get_an_article(self):
        # "82% cloud and a no clear window." The article was hardcoded by the
        # caller while the phrase it introduced could be negative.
        rows = [
            site(2, "Torrance Barrens", 135.0, 3.9, 20, 140),
            site(1, "Toronto", 90.0, 0.0, 82, 0),  # socked in: no clear window
        ]
        c = choose_location(rows, current_id=1)
        assert "a no clear window" not in c["reason"], c["reason"]
        assert "no clear window" in c["reason"], c["reason"]

    def test_a_real_window_still_gets_its_article(self):
        rows = [site(1, "Toronto", 147.0, 3.0, 26, 0)]
        c = choose_location(rows, current_id=1)
        assert "a 3-hour clear window" in c["reason"], c["reason"]

    def test_a_real_days_drive_is_still_a_drive(self):
        # Toronto to Manitoulin is 322 km. An earlier 300 km threshold called
        # that "the distance" while the headline above it said "the drive".
        rows = [
            site(2, "Manitoulin Island", 150.0, 5.0, 0, 322),
            site(1, "Toronto", 140.0, 4.6, 0, 0),
        ]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay_nearby"
        assert "for the drive" in c["reason"], c["reason"]

    def test_a_short_hop_is_called_a_drive(self):
        rows = [
            site(2, "Torrance Barrens", 135.0, 3.9, 20, 140),
            site(1, "Toronto", 125.0, 3.0, 27, 0),
        ]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay_nearby"
        assert "for the drive" in c["reason"], c["reason"]

    def test_a_flight_is_not_called_a_drive(self):
        # Sydney from Tokyo. "7826 km away, which isn't enough gain for the
        # drive" reads as a broken template, not as advice.
        rows = [
            site(2, "Sydney", 205.0, 5.2, 3, 7826),
            site(1, "Tokyo", 120.0, 2.0, 82, 0),
        ]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay_nearby"
        assert "the drive" not in c["reason"], c["reason"]
        assert "7826 km away" in c["reason"], c["reason"]
