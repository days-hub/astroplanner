import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY environment variable is not set. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\" "
        "and put it in backend/.env or the environment."
    )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Comma-separated list of allowed browser origins for CORS
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]

# Rate limits for internet-abusable endpoints (per client IP for auth,
# per user for the advisor). Tune via env if needed.
RATE_LIMIT_LOGIN_PER_MIN = int(os.getenv("RATE_LIMIT_LOGIN_PER_MIN", "10"))
RATE_LIMIT_REGISTER_PER_HOUR = int(os.getenv("RATE_LIMIT_REGISTER_PER_HOUR", "10"))
RATE_LIMIT_ADVISOR_PER_MIN = int(os.getenv("RATE_LIMIT_ADVISOR_PER_MIN", "5"))
RATE_LIMIT_ADVISOR_PER_DAY = int(os.getenv("RATE_LIMIT_ADVISOR_PER_DAY", "25"))
# Demo accounts get a tighter daily advisor cap: each demo question costs a
# little Anthropic spend, and a throwaway visitor doesn't need a full day's
# allowance. The Console spend cap is the ultimate backstop.
RATE_LIMIT_DEMO_ADVISOR_PER_DAY = int(os.getenv("RATE_LIMIT_DEMO_ADVISOR_PER_DAY", "5"))

# Optional: enables the /advisor natural-language recommendation endpoint.
# When unset the endpoint reports itself disabled and the app runs normally.
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY") or None
ADVISOR_MODEL = os.getenv("ADVISOR_MODEL", "claude-opus-4-8")

# Any localhost port is also allowed by default: vite silently bumps to 5174+
# when its usual port is taken, which otherwise breaks CORS in a way the UI
# can't explain (server logs 200, browser blocks the response). Set to an
# empty string to disable, or your own regex.
CORS_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX", r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
) or None


def _env_bool(name: str, default: str) -> bool:
    return os.getenv(name, default).strip().lower() in ("1", "true", "yes", "on")


# --- Demo mode -------------------------------------------------------------
# DEMO_MODE exposes POST /demo/start, which creates a throwaway seeded
# account and returns a real (short-lived) JWT. ALLOW_REGISTRATION gates
# /auth/register so a public deployment can run demo-only: no stranger PII
# on the server, while the auth machinery stays live and ownership
# isolation is still enforced between demo users.
DEMO_MODE = _env_bool("DEMO_MODE", "false")
ALLOW_REGISTRATION = _env_bool("ALLOW_REGISTRATION", "true")

# Demo tokens are deliberately shorter-lived than normal logins.
DEMO_TOKEN_EXPIRE_MINUTES = int(os.getenv("DEMO_TOKEN_EXPIRE_MINUTES", "120"))

# Demo accounts (and all their seeded rows, via FK cascade) are purged
# once they are older than this.
DEMO_USER_TTL_HOURS = int(os.getenv("DEMO_USER_TTL_HOURS", "24"))

# Per-IP cap on demo-account creation. Deliberately generous: visitors
# behind CGNAT (mobile carriers, office/university networks) share one
# public IP, and turning away a real visitor costs far more than a few
# throwaway rows. Demo accounts are cheap — the spendy resource is the
# advisor, which is capped separately per user.
RATE_LIMIT_DEMO_PER_HOUR = int(os.getenv("RATE_LIMIT_DEMO_PER_HOUR", "30"))
