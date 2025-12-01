# app/routers/weather.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.weather_client import get_weather_for_time, WeatherError
from app.db.database import get_db
from app.models.observation_session import ObservationSession  # <-- fix path
from app.models.user import User
from app.schemas.weather import WeatherInfo

router = APIRouter(prefix="/sessions", tags=["weather"])


@router.get("/{session_id}/weather/", response_model=WeatherInfo)
async def get_session_weather(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = db.query(ObservationSession).get(session_id)
    if not session or session.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    location = session.location
    if not location:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has no location",
        )

    try:
        payload = await get_weather_for_time(
            latitude=location.latitude,
            longitude=location.longitude,
            when=session.scheduled_start,
        )
    except WeatherError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return WeatherInfo(**payload)
