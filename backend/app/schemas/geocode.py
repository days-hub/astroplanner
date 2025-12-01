# app/schemas/geocode.py
from pydantic import BaseModel
from typing import Optional


class GeocodeResult(BaseModel):
    name: str
    latitude: float
    longitude: float
    country: Optional[str] = None
    timezone: Optional[str] = None
