# app/schemas/geocode.py
from pydantic import BaseModel
from typing import Optional


class GeocodeResult(BaseModel):
    name: str
    latitude: float
    longitude: float
    country: Optional[str] = None
    timezone: Optional[str] = None


class PlaceMatch(BaseModel):
    """One autocomplete candidate. `region` is the human-readable
    "Ontario, Canada" line shown under the place name."""
    name: str
    region: Optional[str] = None
    latitude: float
    longitude: float
    country: Optional[str] = None
    admin1: Optional[str] = None
    timezone: Optional[str] = None
    population: Optional[int] = None
    # Set when the search had to fall back to fewer words than were typed,
    # so the UI can say what it actually searched for.
    matched_query: Optional[str] = None
