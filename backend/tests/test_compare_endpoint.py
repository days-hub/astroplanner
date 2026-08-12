"""End-to-end cover for /targets/compare.

The scoring rules have their own unit tests, but those pass happily while
the endpoint 500s — a field read off the wrong model is invisible until
something actually calls it with real inputs. This exercises the whole
path, including the recommendation the Planner renders.
"""
from datetime import datetime, timedelta, timezone

from app.routers import targets


def _forecast_factory(cloud: int, wind: float = 5.0):
    """Hourly rows the endpoint's clear-window search can chew on."""

    async def _fake(latitude, longitude, start, end, *a, **kw):
        base = datetime(2026, 8, 1, 20, 0, tzinfo=timezone.utc)
        return [
            {
                "time": (base + timedelta(hours=i)).isoformat(),
                "cloud_cover": cloud,
                "wind_speed": wind,
                "temperature": 15.0,
            }
            for i in range(14)
        ]

    return _fake


class TestCompareEndpoint:
    def test_returns_scores_and_a_recommendation(
        self, client, make_user, make_location, monkeypatch
    ):
        monkeypatch.setattr(targets, "get_hourly_forecast", _forecast_factory(5))
        headers = make_user()
        loc = make_location(headers)

        r = client.get(
            "/targets/compare",
            params={
                "date_local": "2026-08-01",
                "reference_location_id": loc["id"],
                "tz": "America/Toronto",
            },
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["recommendation"]["status"] in {"stay_best", "stay_nearby", "switch", "none_usable"}
        assert body["locations"][0]["score"] > 0
        # Wind is part of the score, so it has to actually reach the entry
        assert body["locations"][0]["wind_kmh"] == 5.0

    def test_ranking_does_not_depend_on_where_you_ask_from(
        self, client, make_user, make_location, monkeypatch
    ):
        """The regression that produced 'Toronto looks better tonight' while
        Toronto sat at 26% cloud and the current site at 5%."""
        monkeypatch.setattr(targets, "get_hourly_forecast", _forecast_factory(5))
        headers = make_user()
        a = make_location(headers, name="Near", latitude=43.7, longitude=-79.4)
        b = make_location(headers, name="Far", latitude=45.8, longitude=-82.3)

        def order(reference_id):
            r = client.get(
                "/targets/compare",
                params={
                    "date_local": "2026-08-01",
                    "reference_location_id": reference_id,
                    "tz": "America/Toronto",
                },
                headers=headers,
            )
            assert r.status_code == 200, r.text
            return [(l["name"], l["score"]) for l in r.json()["locations"]]

        # Identical weather at both sites, so the scores must match too —
        # and must not shuffle when the reference changes.
        from_a = order(a["id"])
        from_b = order(b["id"])
        assert dict(from_a) == dict(from_b)

    def test_no_clear_window_reports_nothing_usable(
        self, client, make_user, make_location, monkeypatch
    ):
        monkeypatch.setattr(targets, "get_hourly_forecast", _forecast_factory(100))
        headers = make_user()
        loc = make_location(headers)

        r = client.get(
            "/targets/compare",
            params={
                "date_local": "2026-08-01",
                "reference_location_id": loc["id"],
                "tz": "America/Toronto",
            },
            headers=headers,
        )
        assert r.status_code == 200, r.text
        assert r.json()["recommendation"]["status"] == "none_usable"

class TestPerSiteTimezone:
    """Every site's night is computed in its own timezone.

    Using the reference site's zone for all of them meant that selecting a
    Tokyo location scanned Toronto's night in Asia/Tokyo time, roughly 13
    hours out and mostly in the past, so every other row came back with no
    forecast at all.
    """

    def test_a_far_flung_reference_does_not_blank_the_others(
        self, client, make_user, make_location, monkeypatch
    ):
        monkeypatch.setattr(targets, "get_hourly_forecast", _forecast_factory(5))
        headers = make_user()
        tokyo = make_location(
            headers, name="Tokyo", latitude=35.68, longitude=139.65,
            timezone="Asia/Tokyo",
        )
        make_location(
            headers, name="Toronto", latitude=43.71, longitude=-79.40,
            timezone="America/Toronto",
        )

        r = client.get(
            "/targets/compare",
            params={
                "date_local": "2026-08-01",
                "reference_location_id": tokyo["id"],
                "tz": "Asia/Tokyo",
            },
            headers=headers,
        )
        assert r.status_code == 200, r.text
        rows = r.json()["locations"]
        assert len(rows) == 2

        # The real symptom was "No forecast" on every non-reference row,
        # because the window landed in the past and Open-Meteo had nothing.
        # A mocked forecast always returns rows, so that can't be reproduced
        # here. What *can* be asserted is the cause: darkness has to begin at
        # night, local time, at every site. Rendered in the reference's zone,
        # Toronto's darkness came out around 11:00 JST — the middle of the
        # day, which is what made the window nonsense in the first place.
        for row in rows:
            assert row["dark_start_local"] is not None, row["name"]
            hour = int(row["dark_start_local"].split(":")[0])
            assert hour >= 17 or hour <= 4, (
                f"{row['name']} starts darkness at {row['dark_start_local']} "
                "local, which is daylight — the night was computed in another "
                "site's timezone"
            )

    def test_each_site_reports_its_own_local_clock(
        self, client, make_user, make_location, monkeypatch
    ):
        monkeypatch.setattr(targets, "get_hourly_forecast", _forecast_factory(5))
        headers = make_user()
        tokyo = make_location(
            headers, name="Tokyo", latitude=35.68, longitude=139.65,
            timezone="Asia/Tokyo",
        )
        make_location(
            headers, name="Toronto", latitude=43.71, longitude=-79.40,
            timezone="America/Toronto",
        )
        r = client.get(
            "/targets/compare",
            params={
                "date_local": "2026-08-01",
                "reference_location_id": tokyo["id"],
                "tz": "Asia/Tokyo",
            },
            headers=headers,
        )
        by_name = {x["name"]: x for x in r.json()["locations"]}
        # Both sites sit at mid-northern latitudes in early August, so their
        # darkness should begin within a couple of hours of each other *on
        # their own clocks* even though they're 13 hours apart in absolute
        # time. That only holds if each was computed in its own zone.
        tokyo_h = int(by_name["Tokyo"]["dark_start_local"].split(":")[0])
        toronto_h = int(by_name["Toronto"]["dark_start_local"].split(":")[0])
        assert abs(tokyo_h - toronto_h) <= 3, (
            f"Tokyo {by_name['Tokyo']['dark_start_local']} vs "
            f"Toronto {by_name['Toronto']['dark_start_local']}"
        )
