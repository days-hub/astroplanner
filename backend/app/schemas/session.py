from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class SessionBase(BaseModel):
    target_name: str
    scheduled_start: datetime
    location_id: int
    status: Optional[str] = "planned"  # planned/completed/cancelled


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    target_name: Optional[str] = None
    scheduled_start: Optional[datetime] = None
    location_id: Optional[int] = None
    status: Optional[str] = None


class SessionRead(SessionBase):
    id: int

    class Config:
        from_attributes = True
