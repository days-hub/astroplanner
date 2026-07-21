# app/routers/demo.py
#
# Demo mode: POST /demo/start creates a throwaway account seeded with
# example data and returns a real, short-lived JWT issued through the
# normal auth path. Nothing about auth is bypassed — demo users pass the
# same token verification and ownership checks as everyone else, so the
# demo doubles as a live demonstration of the security model.
#
# Demo accounts are flagged (User.is_demo) and purged after
# DEMO_USER_TTL_HOURS by purge_expired_demo_users(), which app.main runs
# at startup and on an hourly background task. FK cascades take the
# seeded locations/sessions/logs with them.
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import config
from app.core.ratelimit import limit_demo
from app.core.security import create_access_token, get_password_hash
from app.db.database import get_db
from app.models.location import Location
from app.models.observation_log import ObservationLog
from app.models.observation_session import ObservationSession
from app.models.user import User
from app.schemas.user import Token

router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("/status")
def demo_status():
    """Lets the frontend decide which entry points to show."""
    return {
        "enabled": config.DEMO_MODE,
        "registration_enabled": config.ALLOW_REGISTRATION,
    }


def _require_demo_mode() -> None:
    if not config.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo mode is not enabled on this deployment.",
        )


def _seed_demo_data(db: Session, user: User) -> None:
    """Give the visitor a populated app: two locations with contrast
    (city vs dark-sky), an upcoming planned session, and completed
    sessions with observation logs so every page renders with data."""
    now = datetime.now(timezone.utc)

    toronto = Location(
        name="Toronto, Canada",
        latitude=43.71,
        longitude=-79.40,
        timezone="America/Toronto",
        notes="Demo city location — decent for the Moon and planets.",
        owner=user,
    )
    barrens = Location(
        name="Torrance Barrens Dark-Sky Preserve",
        latitude=44.93,
        longitude=-79.50,
        timezone="America/Toronto",
        notes="Demo dark-sky site — Bortle 3-ish, worth the drive for faint targets.",
        owner=user,
    )
    db.add_all([toronto, barrens])

    upcoming = ObservationSession(
        target_name="Saturn",
        status="planned",
        scheduled_start=(now + timedelta(days=3)).replace(minute=0, second=0, microsecond=0),
        owner=user,
        location=toronto,
    )
    m31 = ObservationSession(
        target_name="Andromeda Galaxy (M31)",
        status="completed",
        scheduled_start=now - timedelta(days=9),
        owner=user,
        location=barrens,
    )
    jupiter = ObservationSession(
        target_name="Jupiter",
        status="completed",
        scheduled_start=now - timedelta(days=23),
        owner=user,
        location=toronto,
    )
    db.add_all([upcoming, m31, jupiter])

    db.add_all(
        [
            ObservationLog(
                session=m31,
                notes=(
                    "Core easily visible in the 8SE at 49x; dust lane suspected "
                    "with averted vision. Dark skies make all the difference."
                ),
                seeing="average",
                transparency="good",
                rating=4,
            ),
            ObservationLog(
                session=jupiter,
                notes=(
                    "All four Galilean moons lined up; NEB and SEB obvious. "
                    "Seeing steadied after midnight."
                ),
                seeing="good",
                transparency="average",
                rating=5,
            ),
        ]
    )


@router.post("/start", response_model=Token, dependencies=[Depends(limit_demo)])
def start_demo(db: Session = Depends(get_db)):
    """Create an ephemeral, seeded demo account and log straight into it."""
    _require_demo_mode()

    email = f"demo-{secrets.token_hex(4)}@demo.example.com"
    user = User(
        email=email,
        # Random password, never disclosed: the returned JWT is the only
        # way into this account, and it expires on its own.
        hashed_password=get_password_hash(secrets.token_urlsafe(24)),
        is_demo=True,
    )
    db.add(user)
    db.flush()  # assign user.id before seeding rows that reference it

    _seed_demo_data(db, user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=config.DEMO_TOKEN_EXPIRE_MINUTES),
    )
    return Token(access_token=access_token, token_type="bearer")


def purge_expired_demo_users(db: Session) -> int:
    """Delete demo users older than DEMO_USER_TTL_HOURS. Their locations,
    sessions, and logs go with them via FK cascade. Returns count removed."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=config.DEMO_USER_TTL_HOURS)
    expired = (
        db.query(User)
        .filter(User.is_demo.is_(True), User.created_at < cutoff)
        .all()
    )
    for u in expired:
        db.delete(u)  # ORM-level delete so relationship cascades apply on SQLite too
    if expired:
        db.commit()
    return len(expired)
