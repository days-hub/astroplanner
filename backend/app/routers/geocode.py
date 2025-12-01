# app/routers/geocode.py
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_current_user
from app.core.geocoding_client import geocode_place, GeocodingError
from app.schemas.geocode import GeocodeResult
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
