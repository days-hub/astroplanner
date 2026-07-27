from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models.observation_session import ObservationSession
from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.location import Location
from app.models.user import User
from app.schemas.location import (
    LocationCreate,
    LocationUpdate,
    LocationRead,
)

router = APIRouter(prefix="/locations", tags=["locations"])


@router.post("/", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
def create_location(
    location_in: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = Location(
        name=location_in.name,
        # Comes from the geocoder when the site was added by search; the
        # Locations page shows it instead of coordinates.
        region=location_in.region,
        latitude=location_in.latitude,
        longitude=location_in.longitude,
        timezone=location_in.timezone,
        notes=location_in.notes,
        owner_id=current_user.id,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("/", response_model=List[LocationRead])
def list_locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Oldest first. The frontend defaults to the first site in this list, and
    # newest-first meant landing on whatever was added last — typically the
    # site with no history — instead of the home base you set up first.
    locations = (
        db.query(Location)
        .filter(Location.owner_id == current_user.id)
        .order_by(Location.id.asc())
        .all()
    )
    return locations


@router.get("/{location_id}", response_model=LocationRead)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = (
        db.query(Location)
        .filter(Location.id == location_id, Location.owner_id == current_user.id)
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.put("/{location_id}", response_model=LocationRead)
def update_location(
    location_id: int,
    location_in: LocationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    location = (
        db.query(Location)
        .filter(Location.id == location_id, Location.owner_id == current_user.id)
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    for field, value in location_in.model_dump(exclude_unset=True).items():
        setattr(location, field, value)

    db.commit()
    db.refresh(location)
    return location


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loc = (
        db.query(Location)
        .filter(
            Location.id == location_id,
            Location.owner_id == current_user.id,
        )
        .first()
    )
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    db.delete(loc)
    db.commit()
    return None
