from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session as DbSession

from app.core.deps import get_current_user, get_db
from app.models.observation_session import ObservationSession
from app.models.location import Location
from app.models.user import User

router = APIRouter(prefix="/planner", tags=["planner"])


def _ics_escape(s: str) -> str:
    # Minimal escaping for ICS fields
    return (
        s.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\n")
        .replace("\n", "\\n")
    )


def _ics_dt_utc(dt: datetime) -> str:
    # Format as UTC "YYYYMMDDTHHMMSSZ"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y%m%dT%H%M%SZ")


@router.get("/ics")
def export_ics(
    location_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default="planned"),  # set None to export all
    start_from: Optional[datetime] = Query(default=None),
    start_to: Optional[datetime] = Query(default=None),
    duration_minutes: int = Query(default=90, ge=15, le=12 * 60),
    db: DbSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(ObservationSession).filter(
        ObservationSession.owner_id == user.id
    )

    if location_id is not None:
        q = q.filter(ObservationSession.location_id == location_id)

    if status is not None:
        q = q.filter(ObservationSession.status == status)

    if start_from is not None:
        q = q.filter(ObservationSession.scheduled_start >= start_from)

    if start_to is not None:
        q = q.filter(ObservationSession.scheduled_start <= start_to)

    sessions = q.order_by(ObservationSession.scheduled_start.asc()).all()

    # Fetch location names for nicer ICS LOCATION fields
    loc_ids = {s.location_id for s in sessions if s.location_id is not None}
    loc_map = {}
    if loc_ids:
        locs = db.query(Location).filter(Location.id.in_(loc_ids)).all()
        loc_map = {l.id: l for l in locs}

    now = datetime.now(timezone.utc)
    dur = timedelta(minutes=duration_minutes)

    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AstroPlanner//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:AstroPlanner Sessions",
    ]

    for s in sessions:
        # SQLAlchemy model should give datetime; if it’s a string in your model,
        # convert here with datetime.fromisoformat(...)
        dt_start = s.scheduled_start
        if isinstance(dt_start, str):
            dt_start = datetime.fromisoformat(dt_start)

        dt_end = dt_start + dur

        loc = loc_map.get(s.location_id)
        loc_name = loc.name if loc else ""
        loc_coords = ""
        if loc and loc.latitude is not None and loc.longitude is not None:
            loc_coords = f"{loc.latitude},{loc.longitude}"

        summary = f"Observe: {s.target_name}"
        description = f"Status: {s.status}"
        if loc_coords:
            description += f"\\nCoords: {loc_coords}"

        uid = f"session-{s.id}@astroplanner"

        lines += [
            "BEGIN:VEVENT",
            f"UID:{_ics_escape(uid)}",
            f"DTSTAMP:{_ics_dt_utc(now)}",
            f"DTSTART:{_ics_dt_utc(dt_start)}",
            f"DTEND:{_ics_dt_utc(dt_end)}",
            f"SUMMARY:{_ics_escape(summary)}",
            f"DESCRIPTION:{_ics_escape(description)}",
        ]

        if loc_name:
            lines.append(f"LOCATION:{_ics_escape(loc_name)}")

        # Optional: reflect status in iCal terms
        if s.status == "cancelled":
            lines.append("STATUS:CANCELLED")
        elif s.status == "completed":
            lines.append("STATUS:CONFIRMED")
        else:
            lines.append("STATUS:TENTATIVE")

        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    ics = "\r\n".join(lines) + "\r\n"
    filename = "astroplanner.ics"

    return Response(
        content=ics,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
