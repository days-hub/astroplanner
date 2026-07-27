"""The Good/Fair/Poor verdict shown on the Tonight card.

summarize_conditions is pure, so the thresholds are checked directly rather
than through the endpoint (which would need a live forecast).
"""
from app.core.observing import cloud_band, rate_target, summarize_conditions
from app.routers.weather import summarize_session_forecast


def verdict(cloud, illum=0.0, up=0.0, dark=True):
    return summarize_conditions(dark, cloud, illum, up)[0]


def summary(cloud, illum=0.0, up=0.0, dark=True):
    return summarize_conditions(dark, cloud, illum, up)[1]


class TestCloudDominates:
    def test_clear_dark_night_is_good(self):
        assert verdict(5) == "good"

    def test_partly_cloudy_is_fair(self):
        assert verdict(45) == "fair"

    def test_overcast_is_poor(self):
        assert verdict(90) == "poor"

    def test_overcast_stays_poor_regardless_of_moon(self):
        # A new Moon can't rescue a socked-in sky
        assert verdict(90, illum=0.0, up=0.0) == "poor"


class TestMoonInterference:
    def test_bright_moon_up_all_night_downgrades_clear_sky(self):
        assert verdict(5, illum=0.95, up=1.0) == "fair"

    def test_bright_moon_that_sets_early_does_not_downgrade(self):
        """Illumination alone shouldn't decide it — a full Moon that sets
        an hour in leaves most of the window dark."""
        assert verdict(5, illum=0.95, up=0.15) == "good"

    def test_dim_moon_up_all_night_does_not_downgrade(self):
        assert verdict(5, illum=0.2, up=1.0) == "good"

    def test_summary_mentions_moon_when_heavy(self):
        assert "bright Moon" in summary(5, illum=0.95, up=1.0)

    def test_summary_mentions_little_moonlight_when_absent(self):
        assert "little moonlight" in summary(5, illum=0.05, up=0.5)


class TestNoAstronomicalDarkness:
    def test_clear_but_no_darkness_is_capped_at_fair(self):
        v, s = summarize_conditions(False, 5, 0.0, 0.0)
        assert v == "fair"
        assert "no full astronomical darkness" in s

    def test_cloudy_and_no_darkness_stays_poor(self):
        assert summarize_conditions(False, 95, 0.0, 0.0)[0] == "poor"


class TestTargetSuitability:
    """Above the horizon is not the same as worth looking at."""

    def rate(self, **kw):
        base = dict(
            kind="dso", altitude_deg=60.0, cloud_cover_percent=0,
            moon_illumination=0.0, moon_up_fraction=0.0,
        )
        return rate_target(**{**base, **kw})[0]

    def test_high_dso_on_a_clear_moonless_night_is_good(self):
        assert self.rate() == "good"

    def test_the_screenshot_case_is_not_recommended(self):
        """Andromeda at 29° under a 98% Moon and 93% cloud was being listed
        as a 'top target' — it should read as very poor."""
        assert self.rate(
            altitude_deg=29.0, cloud_cover_percent=93,
            moon_illumination=0.98, moon_up_fraction=1.0,
        ) == "very_poor"

    def test_heavy_cloud_sinks_an_otherwise_perfect_target(self):
        assert self.rate(altitude_deg=80.0, cloud_cover_percent=95) == "very_poor"

    def test_low_altitude_downgrades(self):
        assert self.rate(altitude_deg=12.0) == "poor"

    def test_moonlight_downgrades_deep_sky_but_not_planets(self):
        moon = dict(moon_illumination=0.95, moon_up_fraction=1.0)
        assert self.rate(kind="dso", **moon) == "poor"
        assert self.rate(kind="planet", **moon) == "good"

    def test_worst_factor_supplies_the_reason(self):
        level, reason = rate_target(
            kind="dso", altitude_deg=70.0, cloud_cover_percent=90,
            moon_illumination=0.0, moon_up_fraction=0.0,
        )
        assert level == "very_poor"
        assert "cloud" in reason

    def test_no_forecast_means_no_rating(self):
        assert rate_target(
            kind="dso", altitude_deg=60.0, cloud_cover_percent=None,
            moon_illumination=0.0, moon_up_fraction=0.0,
        ) == (None, None)


class TestCloudBandsAreShared:
    """The dashboard verdict and a session's forecast must agree."""

    def test_bands(self):
        assert cloud_band(10) == "clear"
        assert cloud_band(40) == "partly"
        assert cloud_band(85) == "cloudy"

    def test_session_forecast_uses_the_same_bands(self):
        assert summarize_session_forecast(85)[0] == "poor"
        assert summarize_session_forecast(40)[0] == "fair"
        assert summarize_session_forecast(10)[0] == "good"

    def test_session_reason_states_the_conclusion(self):
        assert summarize_session_forecast(100)[1].startswith("Not recommended")


class TestMissingForecast:
    def test_no_cloud_data_yields_no_verdict(self):
        """A forecast outage should hide the badge, not guess."""
        assert summarize_conditions(True, None, 0.5, 0.5) == (None, None)
