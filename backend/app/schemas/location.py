from typing import Optional
from pydantic import BaseModel, Field


class LocationBase(BaseModel):
    name: str
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    timezone: Optional[str] = None
    notes: Optional[str] = None


class LocationCreate(LocationBase):
    # Coordinates are required at creation; the planner and weather
    # endpoints can't do anything useful without them.
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    timezone: Optional[str] = None
    notes: Optional[str] = None


class LocationRead(LocationBase):
    id: int

    class Config:
        from_attributes = True
