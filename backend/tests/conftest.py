import os

# Must be set before app.core.config is imported; keeps tests independent
# of the developer's .env. load_dotenv() does not override existing vars.
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base, get_db
from app.main import app

# Single shared in-memory database for the whole test session
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client():
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def make_user(client):
    """Register + log in a user; returns auth headers."""
    counter = {"n": 0}

    def _make(email: str | None = None, password: str = "hunter22"):
        counter["n"] += 1
        email = email or f"user{counter['n']}@example.com"
        r = client.post("/auth/register", json={"email": email, "password": password})
        assert r.status_code == 201, r.text
        r = client.post("/auth/login", data={"username": email, "password": password})
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _make


@pytest.fixture()
def make_location(client):
    def _make(headers, **overrides):
        payload = {
            "name": "Backyard",
            "latitude": 44.0,
            "longitude": -79.0,
            "timezone": "America/Toronto",
            **overrides,
        }
        r = client.post("/locations/", json=payload, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    return _make


@pytest.fixture()
def make_session(client):
    def _make(headers, location_id, **overrides):
        payload = {
            "target_name": "Saturn",
            "location_id": location_id,
            "scheduled_start_local": "2026-08-01T23:00",
            "tz": "America/Toronto",
            **overrides,
        }
        r = client.post("/sessions/", json=payload, headers=headers)
        assert r.status_code == 201, r.text
        return r.json()

    return _make
