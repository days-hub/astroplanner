from typing import Optional
from pydantic import BaseModel


class ObservationLogBase(BaseModel):
    notes: str
    seeing: Optional[str] = None
    transparency: Optional[str] = None
    rating: Optional[int] = None
    equipment: Optional[str] = None
    exposure: Optional[str] = None


class ObservationLogCreate(ObservationLogBase):
    # session_id comes from the URL path, not the body
    pass


class ObservationLogUpdate(BaseModel):
    notes: Optional[str] = None
    seeing: Optional[str] = None
    transparency: Optional[str] = None
    rating: Optional[int] = None
    equipment: Optional[str] = None
    exposure: Optional[str] = None


class ObservationLogRead(ObservationLogBase):
    id: int

    class Config:
        from_attributes = True
