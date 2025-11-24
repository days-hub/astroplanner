from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

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


def _get_user_session(db: Session, session_id: int, user_id: int) -> ObservationSession | None:
    return (
        db.query(ObservationSession)
        .filter(
            ObservationSession.id == session_id,
            ObservationSession.owner_id == user_id,
        )
        .first()
    )


@router.post("/", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
def create_session(
    session_in: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ensure the location belongs to this user
    location = (
        db.query(Location)
        .filter(Location.id == session_in.location_id, Location.owner_id == current_user.id)
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    session = ObservationSession(
        target_name=session_in.target_name,
        scheduled_start=session_in.scheduled_start,
        status=session_in.status or "planned",
        owner_id=current_user.id,
        location_id=session_in.location_id,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


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
    return sessions


@router.get("/{session_id}", response_model=SessionRead)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.put("/{session_id}", response_model=SessionRead)
def update_session(
    session_id: int,
    session_in: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # If changing location, ensure it belongs to user
    data = session_in.model_dump(exclude_unset=True)
    new_location_id = data.get("location_id")
    if new_location_id is not None:
        location = (
            db.query(Location)
            .filter(Location.id == new_location_id, Location.owner_id == current_user.id)
            .first()
        )
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")

    for field, value in data.items():
        setattr(session, field, value)

    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return None
