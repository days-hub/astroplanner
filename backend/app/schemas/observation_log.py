from typing import Optional
from pydantic import BaseModel


class ObservationLogBase(BaseModel):
    notes: str
    seeing: Optional[str] = None
    transparency: Optional[str] = None
    rating: Optional[int] = None


class ObservationLogCreate(ObservationLogBase):
    session_id: int


class ObservationLogUpdate(BaseModel):
    notes: Optional[str] = None
    seeing: Optional[str] = None
    transparency: Optional[str] = None
    rating: Optional[int] = None


class ObservationLogRead(ObservationLogBase):
    id: int

    class Config:
        orm_mode = True
