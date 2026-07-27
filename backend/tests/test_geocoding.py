"""Place search. Open-Meteo matches on the place name alone, so the way
people actually type a location — "Sydney Australia", "Port Perry, Ontario"
— finds nothing unless we trim it down and retry."""
import asyncio

import httpx

from app.core import geocoding_client
from app.core.geocoding_client import _query_variants, search_places


class TestQueryVariants:
    def test_single_word_tries_once(self):
        assert _query_variants("Sydney") == [("Sydney", [])]

    def test_trailing_country_is_trimmed(self):
        assert _query_variants("Sydney Australia") == [
            ("Sydney Australia", []),
            ("Sydney", ["Australia"]),
        ]

    def test_commas_are_not_special(self):
        assert _query_variants("Port Perry, Ontario") == [
            ("Port Perry Ontario", []),
            ("Port Perry", ["Ontario"]),
            ("Port", ["Perry", "Ontario"]),
        ]

    def test_capped_at_three_requests(self):
        # A long name must not fan out into one request per word
        assert len(_query_variants("Torrance Barrens Dark Sky Preserve")) == 3

    def test_blank_query_asks_nothing(self):
        assert _query_variants("   ") == []


def _fake_client(monkeypatch, responses: dict[str, list[dict]]):
    """Serve canned results per query string, recording what was asked."""
    asked: list[str] = []

    class FakeResponse:
        status_code = 200

        def __init__(self, payload):
            self._payload = payload

        def json(self):
            return self._payload

    class FakeClient:
        def __init__(self, *a, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, url, params=None):
            asked.append(params["name"])
            return FakeResponse({"results": responses.get(params["name"], [])})

    monkeypatch.setattr(geocoding_client.httpx, "AsyncClient", FakeClient)
    return asked


def _place(name, lat, lon, country, admin1=None):
    return {
        "name": name,
        "latitude": lat,
        "longitude": lon,
        "country": country,
        "admin1": admin1,
        "timezone": "UTC",
    }


class TestSearchPlaces:
    def test_exact_match_makes_one_request(self, monkeypatch):
        asked = _fake_client(
            monkeypatch, {"Port Perry": [_place("Port Perry", 44.1, -78.9, "Canada")]}
        )
        results = asyncio.run(search_places("Port Perry"))

        assert asked == ["Port Perry"]
        assert results[0]["name"] == "Port Perry"
        # Nothing was dropped, so there's nothing to disclose
        assert results[0]["matched_query"] is None

    def test_falls_back_when_full_string_finds_nothing(self, monkeypatch):
        asked = _fake_client(
            monkeypatch,
            {
                "Sydney Australia": [],
                "Sydney": [
                    _place("Sidney", 48.6, -123.4, "Canada"),
                    _place("Sydney", -33.9, 151.2, "Australia"),
                ],
            },
        )
        results = asyncio.run(search_places("Sydney Australia"))

        assert asked == ["Sydney Australia", "Sydney"]
        # The dropped word is a qualifier, so the Australian one wins even
        # though Open-Meteo returned it second
        assert results[0]["name"] == "Sydney"
        assert results[0]["country"] == "Australia"
        # ...and we say we searched for less than was typed
        assert results[0]["matched_query"] == "Sydney"

    def test_explicit_country_beats_proximity(self, monkeypatch):
        _fake_client(
            monkeypatch,
            {
                "Sydney Australia": [],
                "Sydney": [
                    _place("Sydney", -33.9, 151.2, "Australia"),
                    _place("Sydney", 46.1, -60.2, "Canada"),
                ],
            },
        )
        # Planning from Ontario: Sydney NS is far nearer, but the user said
        # Australia, and saying so should outrank the proximity guess.
        results = asyncio.run(
            search_places("Sydney Australia", near_lat=43.7, near_lon=-79.4)
        )
        assert results[0]["country"] == "Australia"

    def test_proximity_ranks_when_nothing_was_dropped(self, monkeypatch):
        _fake_client(
            monkeypatch,
            {
                "Sydney": [
                    _place("Sydney", -33.9, 151.2, "Australia"),
                    _place("Sydney", 46.1, -60.2, "Canada"),
                ]
            },
        )
        results = asyncio.run(search_places("Sydney", near_lat=43.7, near_lon=-79.4))
        assert results[0]["country"] == "Canada"

    def test_no_results_anywhere_returns_empty(self, monkeypatch):
        asked = _fake_client(monkeypatch, {})
        assert asyncio.run(search_places("Qqqq Wwww")) == []
        assert asked == ["Qqqq Wwww", "Qqqq"]

    def test_short_query_never_hits_the_api(self, monkeypatch):
        asked = _fake_client(monkeypatch, {})
        assert asyncio.run(search_places("S")) == []
        assert asked == []
