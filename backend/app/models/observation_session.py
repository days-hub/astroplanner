from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class ObservationSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)

    target_name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="planned")  # planned / completed / cancelled

    scheduled_start = Column(DateTime(timezone=True), nullable=False)

    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id", ondelete="CASCADE"), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="sessions")
    location = relationship("Location", back_populates="sessions")
    logs = relationship("ObservationLog", back_populates="session", cascade="all, delete-orphan", passive_deletes=True)
