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

# Any localhost port is also allowed by default: vite silently bumps to 5174+
# when its usual port is taken, which otherwise breaks CORS in a way the UI
# can't explain (server logs 200, browser blocks the response). Set to an
# empty string to disable, or your own regex.
CORS_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX", r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
) or None
