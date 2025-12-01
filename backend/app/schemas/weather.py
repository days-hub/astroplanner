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

