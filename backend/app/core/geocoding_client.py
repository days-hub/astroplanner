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


def _query_variants(raw: str) -> list[tuple[str, list[str]]]:
    """Progressively shorter forms of a search string, each paired with the
    words it dropped.

    Open-Meteo matches on the place name *alone*, so the way people naturally
    type a location breaks it: "Sydney Australia" and "Port Perry, Ontario"
    both return zero results even though "Sydney" and "Port Perry" return
    plenty. Trimming trailing words recovers the lookup, and the trimmed
    words are worth keeping — they're the user telling us which Sydney.

    Capped at three forms so one keystroke can't fan out into a request per
    word: the full string, one word shorter, and the leading word alone.
    """
    cleaned = " ".join(raw.replace(",", " ").split())
    if not cleaned:
        return []
    words = cleaned.split(" ")

    forms: list[tuple[str, list[str]]] = []
    for cut in (len(words), len(words) - 1, 1):
        if cut < 1:
            continue
        query = " ".join(words[:cut])
        if any(query == q for q, _ in forms):
            continue
        forms.append((query, words[cut:]))
    return forms


async def search_places(
    name: str,
    limit: int = 6,
    near_lat: float | None = None,
    near_lon: float | None = None,
) -> list[dict]:
    """Autocomplete-style place search returning several candidates.

    Ranked by proximity to `near_lat`/`near_lon` when supplied, so someone
    planning in Ontario typing "Torrance" sees the nearest Torrance before
    Torrance, California. Open-Meteo returns its own relevance order, which
    we only re-rank — never invent entries for.

    When the full string finds nothing, falls back to shorter forms of it
    (see `_query_variants`) and reports which one actually matched via
    `matched_query`, so the UI can say what it searched for instead of
    silently answering a different question.
    """
    name = name.strip()
    if len(name) < 2:
        return []

    url = "https://geocoding-api.open-meteo.com/v1/search"

    results: list[dict] = []
    used_query = name
    dropped: list[str] = []

    async with httpx.AsyncClient(timeout=10.0) as client:
        for query, tail in _query_variants(name):
            resp = await client.get(
                url,
                params={
                    "name": query,
                    # Over-fetch so re-ranking has something to work with
                    "count": max(limit * 2, 10),
                    "language": "en",
                    "format": "json",
                },
            )
            if resp.status_code != 200:
                raise GeocodingError(f"Geocoding API error: {resp.status_code}")
            found = resp.json().get("results") or []
            if found:
                results, used_query, dropped = found, query, tail
                break

    def region(r: dict) -> str | None:
        parts = [r.get("admin1"), r.get("country")]
        joined = ", ".join(p for p in parts if p)
        return joined or None

    places = [
        {
            "name": r.get("name") or used_query,
            "region": region(r),
            "latitude": r["latitude"],
            "longitude": r["longitude"],
            "country": r.get("country"),
            "admin1": r.get("admin1"),
            "timezone": r.get("timezone"),
            "population": r.get("population"),
            # Set only when we had to search for less than what was typed
            "matched_query": used_query if used_query != name else None,
        }
        for r in results
        if r.get("latitude") is not None and r.get("longitude") is not None
    ]

    if near_lat is not None and near_lon is not None:
        from app.core.observing import haversine_km

        places.sort(key=lambda p: haversine_km(near_lat, near_lon, p["latitude"], p["longitude"]))

    # Words the user typed that we had to drop are a deliberate qualifier —
    # "Sydney Australia" means the Australian one, whatever is nearest. An
    # explicit country beats a proximity guess, so it sorts last and wins.
    if dropped:
        wanted = {w.casefold() for w in dropped}

        def qualified(p: dict) -> bool:
            fields = (p.get("country") or "", p.get("admin1") or "")
            return any(w in f.casefold() for f in fields for w in wanted)

        places.sort(key=lambda p: not qualified(p))

    return places[:limit]
