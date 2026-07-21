import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core import config
from app.core.config import CORS_ORIGINS, CORS_ORIGIN_REGEX
from app.routers import targets
from app.db.database import Base, engine, SessionLocal
from app.models import user, location, observation_session, observation_log  # noqa
from app.routers import auth, locations, sessions, observation_logs, weather, geocode
from app.routers import planner
from app.routers import advisor
from app.routers import demo
from app.routers.demo import purge_expired_demo_users

logger = logging.getLogger("astroplanner")

# How often the background task revisits demo cleanup. The TTL itself
# (DEMO_USER_TTL_HOURS) decides how old an account must be to go.
DEMO_PURGE_INTERVAL_SECONDS = 3600


def _purge_demo_users() -> None:
    """Run one cleanup pass in its own session, swallowing errors so a
    transient DB hiccup never takes down startup or the purge loop."""
    db = SessionLocal()
    try:
        removed = purge_expired_demo_users(db)
        if removed:
            logger.info("Purged %d expired demo account(s)", removed)
    except Exception:  # pragma: no cover - defensive
        logger.exception("Demo cleanup pass failed")
    finally:
        db.close()


async def _demo_purge_loop() -> None:
    while True:
        await asyncio.sleep(DEMO_PURGE_INTERVAL_SECONDS)
        await asyncio.to_thread(_purge_demo_users)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    # Only bother with demo cleanup where demo accounts can exist. Sweep
    # once at startup (catches anything left by a previous run), then hourly.
    purge_task = None
    if config.DEMO_MODE:
        _purge_demo_users()
        purge_task = asyncio.create_task(_demo_purge_loop())
    try:
        yield
    finally:
        if purge_task:
            purge_task.cancel()


app = FastAPI(title="AstroPlanner API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router)
app.include_router(locations.router)
app.include_router(sessions.router)
app.include_router(observation_logs.router)
app.include_router(weather.router)
app.include_router(geocode.router)
app.include_router(targets.router)
app.include_router(planner.router)
app.include_router(advisor.router)
app.include_router(demo.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
