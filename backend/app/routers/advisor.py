# app/routers/advisor.py
#
# Natural-language observing recommendations. Bundles what the app already
# computes for a night (darkness window, moon, ranked visible targets, hourly
# cloud forecast) into one JSON block and asks Claude to answer the user's
# question using only that data. Feature-flagged: without ANTHROPIC_API_KEY
# the endpoint reports itself disabled and the rest of the app is unaffected.
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import anthropic
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession

from app.core import config
from app.core.deps import get_current_user, get_db
from app.core.ratelimit import limit_advisor
from app.core.weather_client import WeatherError, get_hourly_forecast
from app.models.location import Location
from app.models.user import User
from app.routers.targets import (
    NightInfo,
    compute_night_info,
    compute_visible_targets,
)

router = APIRouter(prefix="/advisor", tags=["advisor"])

SYSTEM_PROMPT = """You are an observing guide for amateur astronomers.

Answer the user's question using ONLY the facts in the observing_data JSON \
provided with it. Every target, time, altitude, moon figure, and cloud figure \
you mention must appear in that data. If a target is not in the data, do not \
mention it. If conditions are poor — clouds, a bright moon, no full darkness — \
say so honestly rather than being encouraging.

All times in the data are already in the location's local timezone; quote them \
as-is. The data covers one specific night ("night_of"); if the question asks \
about a different date, point out which night the data describes. If the cloud \
forecast is marked unavailable, say you can't speak to the weather.

Keep the answer conversational and compact: a short paragraph or two, plain \
text, no markdown headings or bullet lists unless listing targets."""


class AdvisorStatus(BaseModel):
    enabled: bool
    model: Optional[str] = None


class AdvisorRequest(BaseModel):
    location_id: int
    date_local: str  # "YYYY-MM-DD" in the location's timezone
    question: str = Field(min_length=1, max_length=500)
    tz: Optional[str] = None


class AdvisorResponse(BaseModel):
    answer: str
    model: str
    data: Dict[str, Any]


def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)


def _fmt_local(dt: Optional[datetime], zone: ZoneInfo) -> Optional[str]:
    if dt is None:
        return None
    return dt.astimezone(zone).strftime("%Y-%m-%d %H:%M")


def _compass(deg: float) -> str:
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    return dirs[round((deg % 360) / 22.5) % 16]


def _sample_times(night: NightInfo, zone: ZoneInfo, date_local: str) -> List[datetime]:
    """Pick up to three UTC instants across the night to sample the sky at."""
    if night.dark_start:
        start = night.dark_start
        end = night.dark_end or start + timedelta(hours=4)
        mid = start + (end - start) / 2
        samples = [start + timedelta(hours=1), mid, end - timedelta(hours=1)]
    else:
        # No full darkness (high-latitude summer): sample the late evening
        day = datetime.fromisoformat(date_local)
        evening = day.replace(hour=22, minute=0, tzinfo=zone).astimezone(timezone.utc)
        samples = [evening, evening + timedelta(hours=2)]

    out: List[datetime] = []
    for s in samples:
        if not any(abs((s - o).total_seconds()) < 45 * 60 for o in out):
            out.append(s)
    return out


async def _build_observing_data(
    loc: Location, date_local: str, tz_name: str, zone: ZoneInfo
) -> Dict[str, Any]:
    night = compute_night_info(loc.latitude, loc.longitude, date_local, tz_name, zone)

    sky_samples = []
    for when_utc in _sample_times(night, zone, date_local):
        targets = compute_visible_targets(loc.latitude, loc.longitude, when_utc)
        sky_samples.append(
            {
                "time_local": _fmt_local(when_utc, zone),
                "targets": [
                    {
                        "name": t.name,
                        "kind": t.kind,
                        "altitude_deg": round(t.altitude_deg),
                        "direction": _compass(t.azimuth_deg),
                        "visible": t.visible,
                        **({"not_visible_because": t.reason} if t.reason else {}),
                    }
                    for t in targets
                ],
            }
        )

    # Cloud forecast between sunset and sunrise (or a generic evening window).
    # Forecast failures (network, date beyond Open-Meteo's ~16-day range) are
    # reported in the data instead of failing the whole request.
    day = datetime.fromisoformat(date_local)
    fc_start = night.sunset or day.replace(hour=18, minute=0, tzinfo=zone).astimezone(timezone.utc)
    fc_end = night.sunrise or fc_start + timedelta(hours=12)
    cloud_forecast: Optional[List[Dict[str, Any]]] = None
    forecast_note = None
    try:
        rows = await get_hourly_forecast(loc.latitude, loc.longitude, fc_start, fc_end)
        cloud_forecast = [
            {
                "time_local": _fmt_local(datetime.fromisoformat(r["time"]), zone),
                "cloud_cover_percent": r["cloud_cover"],
                "temperature_c": r["temperature"],
                "wind_speed_kmh": r["wind_speed"],
            }
            for r in rows
        ] or None
        if cloud_forecast is None:
            forecast_note = "unavailable (no forecast data for this date)"
    except Exception:  # degrade to "no forecast", don't fail the request
        forecast_note = "unavailable (forecast service error)"

    return {
        "location": {
            "name": loc.name,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "timezone": tz_name,
        },
        "night_of": date_local,
        "darkness": {
            "sunset_local": _fmt_local(night.sunset, zone),
            "astronomical_dark_start_local": _fmt_local(night.dark_start, zone),
            "astronomical_dark_end_local": _fmt_local(night.dark_end, zone),
            "sunrise_local": _fmt_local(night.sunrise, zone),
            "note": None if night.dark_start else "no full astronomical darkness this night",
        },
        "moon_illumination_percent": round(night.moon_illumination * 100),
        "sky_samples": sky_samples,
        "cloud_forecast_hourly": cloud_forecast,
        "cloud_forecast_note": forecast_note,
    }


@router.get("/status", response_model=AdvisorStatus)
def advisor_status(user: User = Depends(get_current_user)):
    enabled = config.ANTHROPIC_API_KEY is not None
    return AdvisorStatus(enabled=enabled, model=config.ADVISOR_MODEL if enabled else None)


@router.post(
    "/ask",
    response_model=AdvisorResponse,
    dependencies=[Depends(limit_advisor)],
)
async def ask_advisor(
    req: AdvisorRequest,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if config.ANTHROPIC_API_KEY is None:
        raise HTTPException(
            status_code=503,
            detail="Advisor is not enabled on this server (ANTHROPIC_API_KEY not set)",
        )

    loc = (
        db.query(Location)
        .filter(Location.id == req.location_id, Location.owner_id == user.id)
        .first()
    )
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    if loc.latitude is None or loc.longitude is None:
        raise HTTPException(
            status_code=400,
            detail="Location has no coordinates; set latitude/longitude first",
        )

    tz_name = req.tz or loc.timezone
    if not tz_name:
        raise HTTPException(status_code=400, detail="Timezone required")
    try:
        zone = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    data = await _build_observing_data(loc, req.date_local, tz_name, zone)

    user_message = (
        "observing_data:\n"
        + json.dumps(data, indent=1, sort_keys=True)
        + f"\n\nQuestion: {req.question}"
    )

    try:
        response = await _client().messages.create(
            model=config.ADVISOR_MODEL,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            output_config={"effort": "low"},
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.AuthenticationError:
        raise HTTPException(status_code=502, detail="Advisor misconfigured: invalid API key")
    except anthropic.RateLimitError:
        raise HTTPException(status_code=503, detail="Advisor is rate-limited; try again shortly")
    except anthropic.APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Advisor upstream error ({exc.status_code})")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=502, detail="Could not reach the advisor service")

    answer = "".join(b.text for b in response.content if b.type == "text").strip()
    if not answer:
        raise HTTPException(status_code=502, detail="Advisor returned no answer")

    return AdvisorResponse(answer=answer, model=response.model, data=data)
