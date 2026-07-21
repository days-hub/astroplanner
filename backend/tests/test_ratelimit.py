"""Rate limiting on the internet-abusable endpoints."""
from app.core import config
from app.core.ratelimit import SlidingWindowLimiter


class TestSlidingWindowLimiter:
    def test_allows_up_to_limit_then_blocks(self):
        lim = SlidingWindowLimiter(limit=3, window_seconds=60)
        assert lim.retry_after("k") == 0
        assert lim.retry_after("k") == 0
        assert lim.retry_after("k") == 0
        assert lim.retry_after("k") > 0

    def test_keys_are_independent(self):
        lim = SlidingWindowLimiter(limit=1, window_seconds=60)
        assert lim.retry_after("a") == 0
        assert lim.retry_after("b") == 0
        assert lim.retry_after("a") > 0

    def test_window_expires(self, monkeypatch):
        import app.core.ratelimit as rl

        now = [1000.0]
        monkeypatch.setattr(rl.time, "monotonic", lambda: now[0])
        lim = SlidingWindowLimiter(limit=1, window_seconds=60)
        assert lim.retry_after("k") == 0
        assert lim.retry_after("k") == 60
        now[0] += 61
        assert lim.retry_after("k") == 0


class TestEndpointLimits:
    def test_login_rate_limited(self, client, make_user):
        make_user("victim@example.com")
        # The fixture used 1 login; hammer wrong passwords up to the cap
        for _ in range(config.RATE_LIMIT_LOGIN_PER_MIN - 1):
            r = client.post(
                "/auth/login",
                data={"username": "victim@example.com", "password": "wrong"},
            )
            assert r.status_code == 401
        r = client.post(
            "/auth/login",
            data={"username": "victim@example.com", "password": "wrong"},
        )
        assert r.status_code == 429
        assert "Retry-After" in r.headers

    def test_register_rate_limited(self, client):
        for i in range(config.RATE_LIMIT_REGISTER_PER_HOUR):
            r = client.post(
                "/auth/register",
                json={"email": f"spam{i}@example.com", "password": "hunter22"},
            )
            assert r.status_code == 201
        r = client.post(
            "/auth/register",
            json={"email": "spam-final@example.com", "password": "hunter22"},
        )
        assert r.status_code == 429

    def test_advisor_rate_limited_per_user(self, client, make_user, monkeypatch):
        # Advisor disabled (503) still counts attempts — the limiter runs
        # before the endpoint body, so no Anthropic mock is needed here.
        monkeypatch.setattr(config, "ANTHROPIC_API_KEY", None)
        headers = make_user()
        payload = {"location_id": 1, "date_local": "2026-08-01", "question": "hi"}
        for _ in range(config.RATE_LIMIT_ADVISOR_PER_MIN):
            r = client.post("/advisor/ask", json=payload, headers=headers)
            assert r.status_code == 503
        r = client.post("/advisor/ask", json=payload, headers=headers)
        assert r.status_code == 429

        # A different user is not affected by the first user's cap
        other = make_user()
        r = client.post("/advisor/ask", json=payload, headers=other)
        assert r.status_code == 503
