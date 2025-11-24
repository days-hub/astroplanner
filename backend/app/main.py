from fastapi import FastAPI

from app.db.database import Base, engine
from app.models import user, location, observation_session, observation_log  # noqa: F401 (imported for side-effects)

app = FastAPI(title="AstroPlanner API")


@app.on_event("startup")
def on_startup():
    # Create tables if they don't exist yet
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health_check():
    return {"status": "ok"}
