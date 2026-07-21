"""Tests for the /advisor natural-language recommendation endpoint.

The Anthropic call and the Open-Meteo forecast are mocked; the sky
computation (skyfield) runs for real.
"""
from types import SimpleNamespace

from app.core import config
from app.routers import advisor


class FakeMessages:
    def __init__(self, captured):
        self.captured = captured

    async def create(self, **kwargs):
        self.captured.update(kwargs)
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text="Saturn looks great tonight.")],
            model=config.ADVISOR_MODEL,
        )


class FakeClient:
    def __init__(self, captured):
        self.messages = FakeMessages(captured)


async def _fake_forecast(latitude, longitude, start_utc, end_utc):
    return [
        {
            "time": "2026-08-02T02:00:00+00:00",
            "cloud_cover": 20,
            "temperature": 15.5,
            "wind_speed": 6.0,
        }
    ]


class TestAdvisor:
    def test_requires_auth(self, client):
        assert client.get("/advisor/status").status_code == 401
        r = client.post(
            "/advisor/ask",
            json={"location_id": 1, "date_local": "2026-08-01", "question": "hi"},
        )
        assert r.status_code == 401

    def test_status_disabled_without_key(self, client, make_user, monkeypatch):
        monkeypatch.setattr(config, "ANTHROPIC_API_KEY", None)
        headers = make_user()
        r = client.get("/advisor/status", headers=headers)
        assert r.status_code == 200
        assert r.json() == {"enabled": False, "model": None}

    def test_ask_disabled_without_key(self, client, make_user, make_location, monkeypatch):
        monkeypatch.setattr(config, "ANTHROPIC_API_KEY", None)
        headers = make_user()
        loc = make_location(headers)
        r = client.post(
            "/advisor/ask",
            json={
                "location_id": loc["id"],
                "date_local": "2026-08-01",
                "question": "What should I look at?",
            },
            headers=headers,
        )
        assert r.status_code == 503

    def test_ask_returns_answer_and_grounding_data(
        self, client, make_user, make_location, monkeypatch
    ):
        captured = {}
        monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "sk-ant-test")
        monkeypatch.setattr(advisor, "_client", lambda: FakeClient(captured))
        monkeypatch.setattr(advisor, "get_hourly_forecast", _fake_forecast)

        headers = make_user()
        loc = make_location(headers)
        r = client.post(
            "/advisor/ask",
            json={
                "location_id": loc["id"],
                "date_local": "2026-08-01",
                "question": "What's worth looking at tonight?",
            },
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["answer"] == "Saturn looks great tonight."
        assert body["model"] == config.ADVISOR_MODEL

        # The grounding data the UI shows alongside the answer
        data = body["data"]
        assert data["night_of"] == "2026-08-01"
        assert data["location"]["timezone"] == "America/Toronto"
        assert 0 <= data["moon_illumination_percent"] <= 100
        assert len(data["sky_samples"]) >= 1
        sample = data["sky_samples"][0]
        names = {t["name"] for t in sample["targets"]}
        assert "Saturn" in names and "Moon" in names
        assert data["cloud_forecast_hourly"][0]["cloud_cover_percent"] == 20

        # The prompt sent to the model contains the data and the question
        assert "observing_data" in captured["messages"][0]["content"]
        assert "What's worth looking at tonight?" in captured["messages"][0]["content"]
        assert "ONLY" in captured["system"]

    def test_ask_scoped_to_owner(self, client, make_user, make_location, monkeypatch):
        monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "sk-ant-test")
        alice = make_user()
        bob = make_user()
        loc = make_location(alice)
        r = client.post(
            "/advisor/ask",
            json={
                "location_id": loc["id"],
                "date_local": "2026-08-01",
                "question": "hi",
            },
            headers=bob,
        )
        assert r.status_code == 404

    def test_question_length_capped(self, client, make_user, make_location, monkeypatch):
        monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "sk-ant-test")
        headers = make_user()
        loc = make_location(headers)
        r = client.post(
            "/advisor/ask",
            json={
                "location_id": loc["id"],
                "date_local": "2026-08-01",
                "question": "x" * 501,
            },
            headers=headers,
        )
        assert r.status_code == 422
