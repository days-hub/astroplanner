# app/core/ratelimit.py
#
# Small in-process sliding-window rate limiter for the endpoints that are
# abusable from the open internet: credential guessing on /auth/login,
# account spam on /auth/register, and Anthropic spend on /advisor/ask.
#
# In-memory on purpose: the app runs as a single uvicorn process, and a
# restart forgiving all counters is acceptable for these limits.
from __future__ import annotations

import ipaddress
import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import Depends, HTTPException, Request

from app.core import config
from app.core.deps import get_current_user
from app.models.user import User


class SlidingWindowLimiter:
    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def retry_after(self, key: str) -> float:
        """Record a hit for key. Returns 0 if allowed, else seconds to wait."""
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - self.window:
                hits.popleft()
            if len(hits) >= self.limit:
                return self.window - (now - hits[0])
            hits.append(now)
            return 0.0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


login_limiter = SlidingWindowLimiter(config.RATE_LIMIT_LOGIN_PER_MIN, 60)
register_limiter = SlidingWindowLimiter(config.RATE_LIMIT_REGISTER_PER_HOUR, 3600)
advisor_minute_limiter = SlidingWindowLimiter(config.RATE_LIMIT_ADVISOR_PER_MIN, 60)
advisor_day_limiter = SlidingWindowLimiter(config.RATE_LIMIT_ADVISOR_PER_DAY, 86400)
demo_advisor_day_limiter = SlidingWindowLimiter(config.RATE_LIMIT_DEMO_ADVISOR_PER_DAY, 86400)
demo_limiter = SlidingWindowLimiter(config.RATE_LIMIT_DEMO_PER_HOUR, 3600)


def reset_all() -> None:
    """Test hook: forget all recorded hits."""
    for limiter in (
        login_limiter,
        register_limiter,
        advisor_minute_limiter,
        advisor_day_limiter,
        demo_advisor_day_limiter,
        demo_limiter,
    ):
        limiter.reset()


def client_ip(request: Request) -> str:
    """
    Best-effort client IP behind our proxy chain (Caddy -> nginx -> backend).

    Both proxies append the address they saw to X-Forwarded-For, and Caddy
    drops any spoofed incoming value, so scanning right-to-left for the first
    public address finds the real client. Local/dev traffic is all private
    addresses — fall back to the socket peer, which is fine for dev.
    """
    xff = request.headers.get("x-forwarded-for", "")
    for part in reversed([p.strip() for p in xff.split(",") if p.strip()]):
        try:
            if ipaddress.ip_address(part).is_global:
                return part
        except ValueError:
            continue
    return request.client.host if request.client else "unknown"


def _check(
    limiter: SlidingWindowLimiter,
    key: str,
    what: str,
    message: str | None = None,
) -> None:
    wait = limiter.retry_after(key)
    if wait > 0:
        raise HTTPException(
            status_code=429,
            detail=message or f"Too many {what} — try again in a bit.",
            headers={"Retry-After": str(max(1, int(wait + 0.5)))},
        )


def limit_login(request: Request) -> None:
    _check(login_limiter, client_ip(request), "login attempts")


def limit_register(request: Request) -> None:
    _check(register_limiter, client_ip(request), "signup attempts")


def limit_advisor(user: User = Depends(get_current_user)) -> None:
    key = str(user.id)
    _check(advisor_minute_limiter, key, "advisor questions")
    # Demo visitors get a tighter daily ceiling than real accounts.
    day_limiter = demo_advisor_day_limiter if user.is_demo else advisor_day_limiter
    _check(day_limiter, key, "advisor questions today")


def limit_demo(request: Request) -> None:
    # This is the public front door — phrase it as a busy signal, not as
    # something the visitor did wrong.
    _check(
        demo_limiter,
        client_ip(request),
        "demo accounts",
        message="The demo is busy right now — please try again in a few minutes.",
    )
