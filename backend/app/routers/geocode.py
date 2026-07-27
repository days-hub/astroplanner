# app/routers/geocode.py
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_current_user
from app.core.geocoding_client import geocode_place, search_places, GeocodingError
from app.schemas.geocode import GeocodeResult, PlaceMatch
from app.models.user import User

router = APIRouter(
    prefix="/geocode",
    tags=["geocoding"],
)


@router.get("/", response_model=GeocodeResult)
async def geocode(
    q: str = Query(..., description="Place name, city, or address"),
    current_user: User = Depends(get_current_user),
):
    try:
        result = await geocode_place(q)
    except GeocodingError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    return GeocodeResult(**result)


@router.get("/search", response_model=list[PlaceMatch])
async def search(
    q: str = Query(..., min_length=2, description="Partial place name"),
    near_lat: float | None = Query(default=None),
    near_lon: float | None = Query(default=None),
    limit: int = Query(default=6, ge=1, le=10),
    current_user: User = Depends(get_current_user),
):
    """Autocomplete for adding a location.

    Results are ranked toward the coordinates the user is currently planning
    from, which is what makes "Torrance" resolve to the Ontario dark-sky
    preserve rather than the California city.
    """
    try:
        places = await search_places(q, limit=limit, near_lat=near_lat, near_lon=near_lon)
    except GeocodingError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )
    return [PlaceMatch(**p) for p in places]
