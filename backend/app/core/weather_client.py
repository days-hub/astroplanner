from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx


class WeatherError(Exception):
    pass

def _as_utc_aware(dt: datetime) -> datetime:
    # DB stores naive UTC; treat naive as UTC
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

async def get_weather_for_time(
    latitude: float,
    longitude: float,
    when: datetime,
) -> Dict[str, Any]:
    """
    Get forecast near the given datetime for the given location using Open-Meteo.
    Returns the hour CLOSEST to `when` (in UTC).
    """
    when_utc = _as_utc_aware(when)
    date_str = when_utc.date().isoformat()

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": ",".join(
            [
                "temperature_2m",
                "cloud_cover",
                "wind_speed_10m",
                "wind_direction_10m",
                "is_day",
                "weather_code",  
            ]
        ),
        "start_date": date_str,
        "end_date": date_str,
        "timezone": "UTC",  # IMPORTANT: keep times aligned with `when_utc`
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)

    if resp.status_code != 200:
        raise WeatherError(f"Weather API error: {resp.status_code} {resp.text}")

    data = resp.json()
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    if not times:
        raise WeatherError("No hourly data returned")

    # Find the hour closest to `when_utc`
    best_idx = 0
    best_diff: Optional[float] = None

    for i, t in enumerate(times):
        # Open-Meteo returns ISO8601; in timezone=UTC these are UTC wall times (no offset)
        t_dt = datetime.fromisoformat(t)
        if t_dt.tzinfo is None:
            t_dt = t_dt.replace(tzinfo=timezone.utc)

        diff = abs((t_dt - when_utc).total_seconds())
        if best_diff is None or diff < best_diff:
            best_diff = diff
            best_idx = i

    def pick(field: str):
        arr = hourly.get(field) or []
        return arr[best_idx] if len(arr) > best_idx else None

    is_day_val = pick("is_day")
    weather_code = pick("weather_code")

    return {
        "description": "forecast",
        "temperature": pick("temperature_2m"),
        "cloud_cover": pick("cloud_cover"),
        "wind_speed": pick("wind_speed_10m"),
        "wind_direction": pick("wind_direction_10m"),
        "is_day": bool(is_day_val) if is_day_val is not None else None,
        "weather_code": int(weather_code) if weather_code is not None else None,  # ✅ NEW
    }
