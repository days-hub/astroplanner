from fastapi import FastAPI

from app.db.database import Base, engine
from app.models import user, location, observation_session, observation_log  # noqa
from app.routers import auth, locations, sessions, observation_logs

app = FastAPI(title="AstroPlanner API")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


app.include_router(auth.router)
app.include_router(locations.router)
app.include_router(sessions.router)
app.include_router(observation_logs.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
