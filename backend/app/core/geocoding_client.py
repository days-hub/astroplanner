# app/core/geocoding_client.py
import httpx


class GeocodingError(Exception):
    pass


async def geocode_place(name: str) -> dict:
    """
    Look up a place name using Open-Meteo's geocoding API.
    Returns a small dict with name/lat/lon/country/timezone.
    """
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {
        "name": name,
        "count": 1,
        "language": "en",
        "format": "json",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)

    if resp.status_code != 200:
        raise GeocodingError(f"Geocoding API error: {resp.status_code} {resp.text}")

    data = resp.json()
    results = data.get("results") or []
    if not results:
        raise GeocodingError("No results found for this place name")

    r = results[0]
    return {
        "name": r.get("name") or name,
        "latitude": r["latitude"],
        "longitude": r["longitude"],
        "country": r.get("country"),
        "timezone": r.get("timezone"),
    }
