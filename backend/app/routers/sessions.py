from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.location import Location
from app.models.observation_session import ObservationSession
from app.models.user import User
from app.schemas.session import (
    SessionCreate,
    SessionUpdate,
    SessionRead,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])
def to_utc_aware(dt):
    if dt is None:
        return None
    # If DB stored naive, treat it as UTC
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def as_read_model(s: ObservationSession) -> SessionRead:
    return SessionRead(
        id=s.id,
        target_name=s.target_name,
        scheduled_start=to_utc_aware(s.scheduled_start),
        location_id=s.location_id,
        status=s.status,
    )

def _get_user_session(db: Session, session_id: int, user_id: int) -> ObservationSession | None:
    return (
        db.query(ObservationSession)
        .filter(
            ObservationSession.id == session_id,
            ObservationSession.owner_id == user_id,
        )
        .first()
    )

def local_str_to_utc(when_local: str, tz_name: str) -> datetime:
    # when_local: "YYYY-MM-DDTHH:mm"
    try:
        dt_local_naive = datetime.fromisoformat(when_local)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scheduled_start_local format")

    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    dt_local = dt_local_naive.replace(tzinfo=tz)
    # Store timezone-aware UTC: correct on Postgres (timestamptz), and on
    # SQLite it degrades to naive UTC, which to_utc_aware() compensates for.
    return dt_local.astimezone(timezone.utc)

@router.post("/", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = (
        db.query(Location)
        .filter(
            Location.id == session_in.location_id,
            Location.owner_id == current_user.id,
        )
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    # Prefer location timezone, fall back to incoming tz
    tz_name = location.timezone or session_in.tz

    if session_in.scheduled_start is not None:
        scheduled = session_in.scheduled_start
        if scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=timezone.utc)
        scheduled_start = scheduled.astimezone(timezone.utc)

    elif session_in.scheduled_start_local is not None:
        if not tz_name:
            raise HTTPException(status_code=400, detail="Timezone required for scheduled_start_local")
        scheduled_start = local_str_to_utc(session_in.scheduled_start_local, tz_name)

    else:
        raise HTTPException(status_code=400, detail="Must provide scheduled_start or scheduled_start_local")

    session = ObservationSession(
        target_name=session_in.target_name,
        scheduled_start=scheduled_start,
        status=session_in.status or "planned",
        owner_id=current_user.id,
        location_id=session_in.location_id,
    )

    db.add(session)
    db.commit()
    db.refresh(session)
    return as_read_model(session)




@router.get("/", response_model=List[SessionRead])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(ObservationSession)
        .filter(ObservationSession.owner_id == current_user.id)
        .order_by(ObservationSession.scheduled_start.desc())
        .all()
    )
    return [as_read_model(s) for s in sessions]


@router.get("/{session_id}", response_model=SessionRead)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return as_read_model(session)



@router.patch("/{session_id}", response_model=SessionRead)
def update_session(
    session_id: int,
    session_in: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    data = session_in.model_dump(exclude_unset=True)

    # If changing location, ensure it belongs to user
    location: Location | None = None
    new_location_id = data.get("location_id")
    if new_location_id is not None:
        location = (
            db.query(Location)
            .filter(
                Location.id == new_location_id,
                Location.owner_id == current_user.id,
            )
            .first()
        )
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")

    # If scheduled_start_local is provided but location wasn't changed,
    # load the existing session location so we can prefer its timezone.
    if "scheduled_start_local" in data and location is None:
        location = (
            db.query(Location)
            .filter(
                Location.id == session.location_id,
                Location.owner_id == current_user.id,
            )
            .first()
        )

    # Convert scheduled_start_local -> scheduled_start (UTC) if provided
    if "scheduled_start_local" in data:
        tz_name = (location.timezone if location else None) or data.get("tz")
        if not tz_name:
            raise HTTPException(status_code=400, detail="Timezone required for scheduled_start_local")
        data["scheduled_start"] = local_str_to_utc(data["scheduled_start_local"], tz_name)

    # Normalize scheduled_start if provided as datetime
    if "scheduled_start" in data and data["scheduled_start"] is not None:
        scheduled = data["scheduled_start"]
        if scheduled.tzinfo is None:
            scheduled = scheduled.replace(tzinfo=timezone.utc)
        data["scheduled_start"] = scheduled.astimezone(timezone.utc)

    # Remove non-model fields so setattr doesn't fail
    data.pop("scheduled_start_local", None)
    data.pop("tz", None)

    for field, value in data.items():
        setattr(session, field, value)

    db.commit()
    db.refresh(session)
    return as_read_model(session)




@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(ObservationSession)
        .filter(
            ObservationSession.id == session_id,
            ObservationSession.owner_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)  
    db.commit()
    return None
