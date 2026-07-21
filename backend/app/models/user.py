from sqlalchemy import Boolean, Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    # Throwaway accounts created by POST /demo/start; purged after
    # DEMO_USER_TTL_HOURS by the cleanup task in app.main.
    is_demo = Column(Boolean, nullable=False, default=False, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    locations = relationship("Location", back_populates="owner", cascade="all, delete-orphan")
    sessions = relationship("ObservationSession", back_populates="owner", cascade="all, delete-orphan")
