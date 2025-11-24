from typing import Optional

from pydantic import BaseModel


class LocationBase(BaseModel):
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    notes: Optional[str] = None


class LocationRead(LocationBase):
    id: int

    class Config:
        from_attributes = True
