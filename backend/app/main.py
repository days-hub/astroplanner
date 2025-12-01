from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import targets
from app.db.database import Base, engine
from app.models import user, location, observation_session, observation_log  # noqa
from app.routers import auth, locations, sessions, observation_logs, weather, geocode
from app.routers import planner

app = FastAPI(title="AstroPlanner API")

# Allow frontend dev origin
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


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
