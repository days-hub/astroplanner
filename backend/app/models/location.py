from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.db.database import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    timezone = Column(String, nullable=True)  # e.g. "America/Toronto", "Australia/Sydney"

    # "Ontario, Canada" — captured from the geocoder when a site is added, so
    # the Locations page can say where a place is without making the user
    # read coordinates. Null for anything created before search-first entry.
    region = Column(String, nullable=True)

    notes = Column(Text, nullable=True)

    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    owner = relationship("User", back_populates="locations")
    sessions = relationship(
        "ObservationSession",
        back_populates="location",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
