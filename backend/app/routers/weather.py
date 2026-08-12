# app/routers/weather.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.weather_client import get_weather_for_time, WeatherError
from app.db.database import get_db
from app.core.observing import cloud_band
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
    session = db.get(ObservationSession, session_id)
    if not session or session.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    location = session.location
    if not location or location.latitude is None or location.longitude is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session location has no coordinates",
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

    info = WeatherInfo(**payload)
    if info.cloud_cover is not None:
        info.verdict, info.verdict_reason = summarize_session_forecast(
            round(info.cloud_cover)
        )
    return info


def summarize_session_forecast(cloud_cover_percent: int) -> tuple[str, str]:
    """A one-line read on a single session's forecast.

    Uses the same cloud thresholds as the dashboard's night verdict so the
    two can't contradict each other for the same sky.
    """
    band = cloud_band(cloud_cover_percent)
    if band == "cloudy":
        return "poor", f"Not recommended · {cloud_cover_percent}% cloud cover"
    if band == "partly":
        return "fair", f"Marginal · {cloud_cover_percent}% cloud cover"
    return "good", f"Good forecast · {cloud_cover_percent}% cloud cover"
