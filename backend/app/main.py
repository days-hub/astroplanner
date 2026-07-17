from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import CORS_ORIGINS, CORS_ORIGIN_REGEX
from app.routers import targets
from app.db.database import Base, engine
from app.models import user, location, observation_session, observation_log  # noqa
from app.routers import auth, locations, sessions, observation_logs, weather, geocode
from app.routers import planner


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


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

@app.get("/health")
def health_check():
    return {"status": "ok"}
