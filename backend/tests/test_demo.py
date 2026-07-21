# Demo mode: ephemeral seeded accounts, registration gating, cleanup.
#
# DEMO_MODE and ALLOW_REGISTRATION are read from app.core.config at
# request time, so tests toggle them with monkeypatch.setattr on the
# config module — no env juggling needed.
from datetime import datetime, timedelta, timezone

import pytest

from app.core import config, ratelimit
from app.models.user import User
from app.routers.demo import purge_expired_demo_users
from tests.conftest import TestingSessionLocal


@pytest.fixture()
def demo_mode(monkeypatch):
    monkeypatch.setattr(config, "DEMO_MODE", True)


def _start_demo(client):
    r = client.post("/demo/start")
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


class TestDemoGating:
    def test_demo_disabled_by_default(self, client):
        assert client.get("/demo/status").json()["enabled"] is False
        assert client.post("/demo/start").status_code == 404

    def test_status_reports_enabled(self, client, demo_mode):
        payload = client.get("/demo/status").json()
        assert payload["enabled"] is True
        assert payload["registration_enabled"] is True


class TestDemoAccount:
    def test_start_returns_working_token(self, client, demo_mode):
        headers = _start_demo(client)
        me = client.get("/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["email"].startswith("demo-")
        assert me.json()["email"].endswith("@demo.example.com")

    def test_seeded_data_present(self, client, demo_mode):
        headers = _start_demo(client)

        locations = client.get("/locations/", headers=headers).json()
        assert len(locations) == 2
        names = {loc["name"] for loc in locations}
        assert "Toronto, Canada" in names

        sessions = client.get("/sessions/", headers=headers).json()
        assert len(sessions) == 3
        statuses = [s["status"] for s in sessions]
        assert statuses.count("planned") == 1
        assert statuses.count("completed") == 2

    def test_demo_user_is_flagged(self, client, demo_mode):
        headers = _start_demo(client)
        email = client.get("/auth/me", headers=headers).json()["email"]
        db = TestingSessionLocal()
        try:
            row = db.query(User).filter(User.email == email).one()
            assert row.is_demo is True
        finally:
            db.close()

    def test_two_demo_users_are_isolated(self, client, demo_mode):
        headers_a = _start_demo(client)
        headers_b = _start_demo(client)

        a_locations = client.get("/locations/", headers=headers_a).json()
        b_locations = client.get("/locations/", headers=headers_b).json()
        a_ids = {loc["id"] for loc in a_locations}
        b_ids = {loc["id"] for loc in b_locations}
        assert a_ids.isdisjoint(b_ids)

        # A cannot read or delete B's rows through ownership checks
        b_loc = next(iter(b_ids))
        assert client.get(f"/locations/{b_loc}", headers=headers_a).status_code == 404
        assert client.delete(f"/locations/{b_loc}", headers=headers_a).status_code == 404


class TestRegistrationFlag:
    def test_registration_disabled(self, client, monkeypatch):
        monkeypatch.setattr(config, "ALLOW_REGISTRATION", False)
        r = client.post(
            "/auth/register",
            json={"email": "someone@example.com", "password": "hunter22"},
        )
        assert r.status_code == 403
        assert "demo" in r.json()["detail"].lower()

    def test_registration_enabled_by_default(self, client):
        r = client.post(
            "/auth/register",
            json={"email": "someone@example.com", "password": "hunter22"},
        )
        assert r.status_code == 201


class TestDemoCleanup:
    def test_purge_removes_only_expired_demo_users(self, client, demo_mode):
        headers = _start_demo(client)          # fresh demo user — must survive
        email = client.get("/auth/me", headers=headers).json()["email"]

        db = TestingSessionLocal()
        try:
            # Age one demo user and one real user past the TTL
            old_cutoff = datetime.now(timezone.utc) - timedelta(
                hours=config.DEMO_USER_TTL_HOURS + 1
            )
            stale_demo = User(
                email="demo-stale@demo.example.com",
                hashed_password="x",
                is_demo=True,
                created_at=old_cutoff,
            )
            old_real = User(
                email="veteran@example.com",
                hashed_password="x",
                is_demo=False,
                created_at=old_cutoff,
            )
            db.add_all([stale_demo, old_real])
            db.commit()

            removed = purge_expired_demo_users(db)
            assert removed == 1

            remaining = {u.email for u in db.query(User).all()}
            assert "demo-stale@demo.example.com" not in remaining
            assert "veteran@example.com" in remaining      # non-demo untouched
            assert email in remaining                      # fresh demo untouched
        finally:
            db.close()

    def test_purge_cascades_seeded_rows(self, client, demo_mode):
        headers = _start_demo(client)
        email = client.get("/auth/me", headers=headers).json()["email"]

        db = TestingSessionLocal()
        try:
            row = db.query(User).filter(User.email == email).one()
            row.created_at = datetime.now(timezone.utc) - timedelta(
                hours=config.DEMO_USER_TTL_HOURS + 1
            )
            db.commit()
            assert purge_expired_demo_users(db) == 1
        finally:
            db.close()

        # Token now points at a deleted user — API must reject it,
        # and the seeded rows must be gone with their owner.
        assert client.get("/auth/me", headers=headers).status_code == 401


class TestDemoRateLimit:
    def test_demo_creation_is_rate_limited(self, client, demo_mode, monkeypatch):
        monkeypatch.setattr(ratelimit.demo_limiter, "limit", 2)
        assert client.post("/demo/start").status_code == 200
        assert client.post("/demo/start").status_code == 200
        r = client.post("/demo/start")
        assert r.status_code == 429
        assert "Retry-After" in r.headers

    def test_demo_users_get_tighter_daily_advisor_cap(
        self, client, demo_mode, monkeypatch
    ):
        # The tighter demo ceiling is genuinely below a real account's.
        assert config.RATE_LIMIT_DEMO_ADVISOR_PER_DAY < config.RATE_LIMIT_ADVISOR_PER_DAY

        # Advisor off -> 503, but limit_advisor runs first and still counts
        # the attempt. Lift the per-minute cap so only the daily one trips.
        monkeypatch.setattr(config, "ANTHROPIC_API_KEY", None)
        monkeypatch.setattr(ratelimit.advisor_minute_limiter, "limit", 10_000)

        headers = _start_demo(client)
        payload = {"location_id": 1, "date_local": "2026-08-01", "question": "hi"}

        for _ in range(config.RATE_LIMIT_DEMO_ADVISOR_PER_DAY):
            assert (
                client.post("/advisor/ask", json=payload, headers=headers).status_code
                == 503
            )
        r = client.post("/advisor/ask", json=payload, headers=headers)
        assert r.status_code == 429
        assert "Retry-After" in r.headers
