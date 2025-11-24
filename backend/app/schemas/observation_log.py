from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ObservationLogBase(BaseModel):
    notes: Optional[str] = None
    seeing: Optional[str] = None        # "good", "average", "poor"
    transparency: Optional[str] = None  # similar
    rating: Optional[int] = None        # 1–5 or any scale you like


class ObservationLogCreate(ObservationLogBase):
    pass


class ObservationLogUpdate(BaseModel):
    notes: Optional[str] = None
    seeing: Optional[str] = None
    transparency: Optional[str] = None
    rating: Optional[int] = None


class ObservationLogRead(ObservationLogBase):
    id: int
    session_id: int
    created_at: datetime

    class Config:
        from_attributes = True
