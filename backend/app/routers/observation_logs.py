from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.observation_log import ObservationLog
from app.models.observation_session import ObservationSession
from app.models.user import User
from app.schemas.observation_log import (
    ObservationLogCreate,
    ObservationLogUpdate,
    ObservationLogRead,
)

router = APIRouter(prefix="/sessions/{session_id}/logs", tags=["observation_logs"])


def _get_user_session(
    db: Session,
    session_id: int,
    user_id: int,
) -> ObservationSession | None:
    return (
        db.query(ObservationSession)
        .filter(
            ObservationSession.id == session_id,
            ObservationSession.owner_id == user_id,
        )
        .first()
    )


@router.post("/", response_model=ObservationLogRead, status_code=status.HTTP_201_CREATED)
def create_log(
    session_id: int,
    log_in: ObservationLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    log = ObservationLog(
        session_id=session.id,
        notes=log_in.notes,
        seeing=log_in.seeing,
        transparency=log_in.transparency,
        rating=log_in.rating,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("/", response_model=List[ObservationLogRead])
def list_logs(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    logs = (
        db.query(ObservationLog)
        .filter(ObservationLog.session_id == session.id)
        .order_by(ObservationLog.created_at.desc())
        .all()
    )
    return logs


@router.put("/{log_id}", response_model=ObservationLogRead)
def update_log(
    session_id: int,
    log_id: int,
    log_in: ObservationLogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    log = (
        db.query(ObservationLog)
        .filter(
            ObservationLog.id == log_id,
            ObservationLog.session_id == session.id,
        )
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    for field, value in log_in.model_dump(exclude_unset=True).items():
        setattr(log, field, value)

    db.commit()
    db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(
    session_id: int,
    log_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _get_user_session(db, session_id, current_user.id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    log = (
        db.query(ObservationLog)
        .filter(
            ObservationLog.id == log_id,
            ObservationLog.session_id == session.id,
        )
        .first()
    )
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    db.delete(log)
    db.commit()
    return None
