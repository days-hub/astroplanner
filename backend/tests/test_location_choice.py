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

    def test_capped_so_a_flight_is_not_infinite(self):
        assert switch_margin(400) == switch_margin(5000)


class TestChooseLocation:
    def test_stays_put_when_current_site_is_best(self):
        rows = [site(1, "Manitoulin", 160.5, 4.0, 5, 0), site(2, "Toronto", 132.0, 3.1, 26, 322)]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay"
        assert c["location_id"] == 1
        assert "5% cloud" in c["reason"]

    def test_does_not_send_you_300km_for_a_marginal_gain(self):
        # The screenshot bug, from the other side: a slightly better distant
        # site must not trigger a "switch" recommendation.
        rows = [site(2, "Port Perry", 168.8, 5.0, 4, 320), site(1, "Manitoulin", 160.5, 4.0, 5, 0)]
        c = choose_location(rows, current_id=1)
        assert c["status"] == "stay"
        assert c["location_id"] == 1
        # ...and it says why, rather than pretending it saw nothing
        assert "Port Perry" in c["reason"] and "not enough gain" in c["reason"]

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
        assert c["status"] == "stay"
        assert "best of your" not in c["reason"]

    def test_no_sites_at_all(self):
        assert choose_location([], current_id=None)["status"] == "none_usable"
