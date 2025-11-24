from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class ObservationLog(Base):
    __tablename__ = "observation_logs"

    id = Column(Integer, primary_key=True, index=True)

    notes = Column(Text, nullable=True)
    seeing = Column(String, nullable=True)        # e.g. "good", "average", "poor"
    transparency = Column(String, nullable=True)  # similar scale
    rating = Column(Integer, nullable=True)       # 1–5, etc.

    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ObservationSession", back_populates="logs")
