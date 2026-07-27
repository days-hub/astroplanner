# app/schemas/weather.py
from typing import Optional

from pydantic import BaseModel


class WeatherInfo(BaseModel):
    description: Optional[str] = None
    temperature: Optional[float] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[float] = None
    is_day: Optional[bool] = None
    cloud_cover: Optional[float] = None
    weather_code: Optional[int] = None  # ✅ NEW
    # Plain-language read on the forecast, so a session detail states the
    # conclusion instead of leaving the user to interpret a cloud percentage.
    verdict: Optional[str] = None  # "good" | "fair" | "poor"
    verdict_reason: Optional[str] = None

