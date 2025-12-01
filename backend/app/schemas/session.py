from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class SessionBase(BaseModel):
    target_name: str
    scheduled_start: datetime
    location_id: int
    status: Optional[str] = "planned"

class SessionCreate(BaseModel):
    target_name: str
    location_id: int
    status: Optional[str] = "planned"

    # accept either
    scheduled_start: Optional[datetime] = None
    scheduled_start_local: Optional[str] = None  # "YYYY-MM-DDTHH:mm"
    tz: Optional[str] = None                     # "America/Toronto"

class SessionUpdate(BaseModel):
    target_name: Optional[str] = None
    location_id: Optional[int] = None
    status: Optional[str] = None

    # accept either
    scheduled_start: Optional[datetime] = None
    scheduled_start_local: Optional[str] = None
    tz: Optional[str] = None

class SessionRead(SessionBase):
    id: int
    class Config:
        from_attributes = True
