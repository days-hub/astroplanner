from datetime import date, datetime, timedelta, timezone
from typing import List, Literal, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from skyfield.api import load, wgs84, Star
from skyfield import almanac

from app.db.database import get_db
from app.models.location import Location
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter(prefix="/targets", tags=["targets"])

# ---- Skyfield globals (load once) ----
ts = load.timescale()
eph = load("de421.bsp")  # good enough for Sun/Moon/planets
earth = eph["earth"]
sun = eph["sun"]

PlanetName = Literal["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Moon"]

PLANETS = {
    "Mercury": eph["mercury"],
    "Venus": eph["venus"],
    "Mars": eph["mars"],
    "Jupiter": eph["jupiter barycenter"],
    "Saturn": eph["saturn barycenter"],
    "Uranus": eph["uranus barycenter"],
    "Neptune": eph["neptune barycenter"],
}

# Example fixed targets; expand as you like
FIXED_TARGETS = [
    # name, ra_hours, dec_degrees
    ("Orion Nebula (M42)", 5 + 35/60, -(5 + 23/60)),
    ("Andromeda Galaxy (M31)", 0 + 42/60, 41 + 16/60),
    ("Pleiades (M45)", 3 + 47/60, 24 + 7/60),
]

class VisibleTarget(BaseModel):
    name: str
    kind: Literal["planet", "moon", "dso", "star"]
    altitude_deg: float
    azimuth_deg: float
    sun_altitude_deg: float
    elongation_deg: Optional[float] = None
    visible: bool
    reason: Optional[str] = None
    score: float


class NightInfo(BaseModel):
    date: str
    timezone: str
    # All times UTC; None when the event doesn't occur (e.g. no full
    # astronomical darkness at high latitudes in summer)
    sunset: Optional[datetime] = None
    dark_start: Optional[datetime] = None
    dark_end: Optional[datetime] = None
    sunrise: Optional[datetime] = None
    moon_illumination: float

def _to_utc(dt: datetime) -> datetime:
    # If naive, assume it's UTC (your frontend sends ISO 'Z' anyway)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def _local_str_to_utc(when_local: str, tz_name: str) -> datetime:
    # when_local: "YYYY-MM-DDTHH:mm"
    try:
        dt_local_naive = datetime.fromisoformat(when_local)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid when_local format")

    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    dt_local = dt_local_naive.replace(tzinfo=tz)
    return dt_local.astimezone(timezone.utc)

def _score(alt: float, sun_alt: float, elong: Optional[float], kind: str) -> float:
    # Simple ranking: higher altitude + darker sky + (if applicable) better elongation
    s = 0.0
    s += max(0.0, min(alt, 90.0)) * 1.2
    s += max(0.0, min((-sun_alt), 18.0)) * 1.0  # darker is better
    if elong is not None:
        s += max(0.0, min(elong, 60.0)) * 0.3
    if kind in ("planet", "moon"):
        s += 5.0  # bump “popular” targets a bit
    return s

@router.get("/night", response_model=NightInfo)
def night_info(
    location_id: int,
    date_local: str,                 # "YYYY-MM-DD" in the location's timezone
    tz: Optional[str] = None,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Darkness window + moon illumination for one night (local noon to noon)."""
    loc = (
        db.query(Location)
        .filter(Location.id == location_id, Location.owner_id == current_user.id)
        .first()
    )
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    if loc.latitude is None or loc.longitude is None:
        raise HTTPException(
            status_code=400,
            detail="Location has no coordinates; set latitude/longitude first",
        )

    tz_name = tz or loc.timezone
    if not tz_name:
        raise HTTPException(status_code=400, detail="Timezone required")
    try:
        zone = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    return compute_night_info(loc.latitude, loc.longitude, date_local, tz_name, zone)


def compute_night_info(
    latitude: float,
    longitude: float,
    date_local: str,
    tz_name: str,
    zone: ZoneInfo,
) -> NightInfo:
    """Darkness window + moon illumination for one night (local noon to noon)."""
    try:
        day = date.fromisoformat(date_local)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date_local format (YYYY-MM-DD)")

    # Scan local noon -> next local noon so one call covers a whole night
    noon_local = datetime(day.year, day.month, day.day, 12, tzinfo=zone)
    start_utc = noon_local.astimezone(timezone.utc)
    t0 = ts.from_datetime(start_utc)
    t1 = ts.from_datetime(start_utc + timedelta(days=1))

    observer = wgs84.latlon(latitude, longitude)
    twilight = almanac.dark_twilight_day(eph, observer)
    times, events = almanac.find_discrete(t0, t1, twilight)

    # Event codes: 0 = dark night, 1-3 = twilight stages, 4 = day
    sunset = sunrise = dark_start = dark_end = None
    prev = int(twilight(t0))
    for t, event in zip(times, events):
        event = int(event)
        dt = t.utc_datetime()
        if prev == 4 and event < 4 and sunset is None:
            sunset = dt
        if event == 4 and prev < 4 and sunrise is None:
            sunrise = dt
        if event == 0 and dark_start is None:
            dark_start = dt
        if prev == 0 and event > 0 and dark_end is None:
            dark_end = dt
        prev = event

    midnight = ts.from_datetime(start_utc + timedelta(hours=12))
    moon_frac = float(almanac.fraction_illuminated(eph, "moon", midnight))

    return NightInfo(
        date=date_local,
        timezone=tz_name,
        sunset=sunset,
        dark_start=dark_start,
        dark_end=dark_end,
        sunrise=sunrise,
        moon_illumination=moon_frac,
    )


@router.get("/visible", response_model=List[VisibleTarget])
def visible_targets(
    location_id: int,
    when: Optional[datetime] = None,          # old client support
    when_local: Optional[str] = None,         # NEW (from frontend)
    tz: Optional[str] = None,                 # NEW (from frontend)
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loc = (
        db.query(Location)
        .filter(Location.id == location_id, Location.owner_id == current_user.id)
        .first()
    )
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")

    if loc.latitude is None or loc.longitude is None:
        raise HTTPException(
            status_code=400,
            detail="Location has no coordinates; set latitude/longitude first",
        )

    # Prefer local-string + tz (your frontend), fallback to old "when"
    if when_local is not None:
        tz_name = tz or loc.timezone
        if not tz_name:
            raise HTTPException(status_code=400, detail="Timezone required")
        when_utc = _local_str_to_utc(when_local, tz_name)
    elif when is not None:
        when_utc = _to_utc(when)
    else:
        raise HTTPException(status_code=400, detail="Provide when or when_local")

    return compute_visible_targets(loc.latitude, loc.longitude, when_utc)


def compute_visible_targets(
    latitude: float,
    longitude: float,
    when_utc: datetime,
) -> List[VisibleTarget]:
    t = ts.from_datetime(when_utc)

    observer = wgs84.latlon(latitude, longitude)
    topo = earth + observer

    # Sun altitude (darkness)
    sun_app = topo.at(t).observe(sun).apparent()
    sun_alt, sun_az, _ = sun_app.altaz()
    sun_alt_deg = float(sun_alt.degrees)

    out: List[VisibleTarget] = []

    # ---- Planets ----
    for name, body in PLANETS.items():
        app = topo.at(t).observe(body).apparent()
        alt, az, _ = app.altaz()
        alt_deg = float(alt.degrees)
        az_deg = float(az.degrees)

        # elongation from Sun (angular separation on sky)
        # compute separation between body & sun as seen by observer
        body_vec = topo.at(t).observe(body).apparent()
        sun_vec = topo.at(t).observe(sun).apparent()
        elong_deg = float(body_vec.separation_from(sun_vec).degrees)

        visible = True
        reason = None

        # basic visibility
        if alt_deg < 10:
            visible = False
            reason = "Too low (below 10° altitude)"
        # general night rule (you can loosen for bright planets)
        elif sun_alt_deg > -3:
            visible = False
            reason = "Sky too bright (Sun too high)"

        # glare rule for inner planets
        if visible and name in ("Mercury", "Venus"):
            if elong_deg < 12:
                visible = False
                reason = "Too close to the Sun (glare / low elongation)"

        score = _score(alt_deg, sun_alt_deg, elong_deg, "planet")
        out.append(
            VisibleTarget(
                name=name,
                kind="planet",
                altitude_deg=alt_deg,
                azimuth_deg=az_deg,
                sun_altitude_deg=sun_alt_deg,
                elongation_deg=elong_deg,
                visible=visible,
                reason=reason,
                score=score,
            )
        )

    # ---- Moon ----
    moon = eph["moon"]
    moon_app = topo.at(t).observe(moon).apparent()
    moon_alt, moon_az, _ = moon_app.altaz()
    moon_alt_deg = float(moon_alt.degrees)
    moon_az_deg = float(moon_az.degrees)

    visible = moon_alt_deg > 5 and sun_alt_deg < 0  # moon is bright; allow earlier
    reason = None
    if not visible:
        reason = "Not up (or sky still very bright)"

    out.append(
        VisibleTarget(
            name="Moon",
            kind="moon",
            altitude_deg=moon_alt_deg,
            azimuth_deg=moon_az_deg,
            sun_altitude_deg=sun_alt_deg,
            elongation_deg=None,
            visible=visible,
            reason=reason,
            score=_score(moon_alt_deg, sun_alt_deg, None, "moon"),
        )
    )

    # ---- Fixed DSOs (RA/Dec) ----
    for name, ra_h, dec_d in FIXED_TARGETS:
        star = Star(ra_hours=ra_h, dec_degrees=dec_d)
        app = topo.at(t).observe(star).apparent()
        alt, az, _ = app.altaz()
        alt_deg = float(alt.degrees)
        az_deg = float(az.degrees)

        visible = True
        reason = None
        if alt_deg < 15:
            visible = False
            reason = "Too low (below 15° altitude)"
        elif sun_alt_deg > -6:
            visible = False
            reason = "Sky too bright (needs darker than civil twilight)"

        out.append(
            VisibleTarget(
                name=name,
                kind="dso",
                altitude_deg=alt_deg,
                azimuth_deg=az_deg,
                sun_altitude_deg=sun_alt_deg,
                elongation_deg=None,
                visible=visible,
                reason=reason,
                score=_score(alt_deg, sun_alt_deg, None, "dso"),
            )
        )

    # return visible first, sorted by score
    out.sort(key=lambda x: (not x.visible, -x.score))
    return out
