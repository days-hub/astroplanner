import asyncio
from datetime import date, datetime, time, timedelta, timezone
from functools import lru_cache
from typing import List, Literal, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from skyfield.api import load, wgs84, Star
from skyfield import almanac

from app.core.observing import (
    cloud_band,
    describe_cloud_trend,
    recommend_night,
    haversine_km,
    choose_location,
    sky_score,
    find_clear_window,
    night_rank_key,
    observing_focus,
    rate_target,
    summarize_conditions,
)
from app.core.weather_client import get_hourly_forecast
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

# ---- Caching the pure astronomy ----
#
# Every function cached below is a deterministic function of position and
# time: the same arguments give the same answer forever, so a second request
# asking the same question is redoing arithmetic it already did. That is most
# of the cost of the slow endpoints — the outlook runs seven nights of almanac
# searches per load, and the Locations page fans the same work across every
# saved site, none of it cached.
#
# Two rules keep this safe:
#   * Only pure computation is cached. Anything touching the network or the
#     database stays out, so a cached value can never be stale.
#   * Anything returning a mutable object hands back a copy. add_conditions()
#     writes its verdict onto the NightInfo it is given, so serving the same
#     instance twice would leak one request's forecast into the next.
#
# Bounded so a user with many saved sites, or a long-running process walking
# forward through dates, can't grow these without limit.
_CACHE_SIZE = 1024


def _coord_key(latitude: float, longitude: float) -> tuple[float, float]:
    """Round to ~1 m so float noise can't miss an otherwise identical key."""
    return round(latitude, 5), round(longitude, 5)


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

# A practical northern-sky starter catalogue. Coordinates are J2000 and only
# need arc-minute precision for the altitude/azimuth guidance shown here.
# Keeping the catalogue local makes visibility deterministic and available
# offline; the former three-object list made most seasons look nearly empty.
FIXED_TARGETS = [
    # name, category, right ascension (hours), declination (degrees)
    ("Andromeda Galaxy (M31)", "galaxy", 0.712, 41.269),
    ("Triangulum Galaxy (M33)", "galaxy", 1.565, 30.660),
    ("Double Cluster (NGC 869/884)", "cluster", 2.333, 57.150),
    ("Pleiades (M45)", "cluster", 3.792, 24.117),
    ("Crab Nebula (M1)", "nebula", 5.575, 22.017),
    ("Orion Nebula (M42)", "nebula", 5.588, -5.392),
    ("M35 Open Cluster", "cluster", 6.148, 24.333),
    ("Beehive Cluster (M44)", "cluster", 8.668, 19.983),
    ("Bode's Galaxy (M81)", "galaxy", 9.927, 69.067),
    ("Cigar Galaxy (M82)", "galaxy", 9.932, 69.683),
    ("Owl Nebula (M97)", "nebula", 11.247, 55.017),
    ("Messier 106 Galaxy", "galaxy", 12.317, 47.300),
    ("Sombrero Galaxy (M104)", "galaxy", 12.667, -11.617),
    ("Black Eye Galaxy (M64)", "galaxy", 12.945, 21.683),
    ("Sunflower Galaxy (M63)", "galaxy", 13.263, 42.033),
    ("Whirlpool Galaxy (M51)", "galaxy", 13.498, 47.200),
    ("Messier 3 Cluster", "cluster", 13.703, 28.383),
    ("Pinwheel Galaxy (M101)", "galaxy", 14.053, 54.350),
    ("Messier 5 Cluster", "cluster", 15.310, 2.083),
    ("Hercules Cluster (M13)", "cluster", 16.695, 36.467),
    ("Messier 12 Cluster", "cluster", 16.787, -1.950),
    ("Messier 10 Cluster", "cluster", 16.952, -4.100),
    ("Messier 92 Cluster", "cluster", 17.285, 43.133),
    ("Trifid Nebula (M20)", "nebula", 18.038, -23.033),
    ("Lagoon Nebula (M8)", "nebula", 18.063, -24.383),
    ("Eagle Nebula (M16)", "nebula", 18.313, -13.783),
    ("Omega Nebula (M17)", "nebula", 18.347, -16.183),
    ("Messier 22 Cluster", "cluster", 18.607, -23.900),
    ("Wild Duck Cluster (M11)", "cluster", 18.852, -6.267),
    ("Ring Nebula (M57)", "nebula", 18.893, 33.033),
    ("Dumbbell Nebula (M27)", "nebula", 19.993, 22.717),
    ("Veil Nebula (NGC 6960)", "nebula", 20.762, 30.717),
    ("North America Nebula (NGC 7000)", "nebula", 20.980, 44.333),
    ("Messier 15 Cluster", "cluster", 21.500, 12.167),
    ("Messier 2 Cluster", "cluster", 21.558, -0.817),
    ("Blue Snowball Nebula (NGC 7662)", "nebula", 23.432, 42.533),
]

class VisibleTarget(BaseModel):
    name: str
    kind: Literal["planet", "moon", "dso", "star"]
    category: Literal["planet", "moon", "galaxy", "nebula", "cluster", "star"]
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
    # Headline verdict for the dashboard. Thresholds live here rather than in
    # the UI so they're testable and consistent across clients.
    conditions: Optional[Literal["good", "fair", "poor"]] = None
    conditions_summary: Optional[str] = None
    cloud_cover_percent: Optional[int] = None  # mean across the dark window
    moon_up_fraction: Optional[float] = None  # of the dark window, 0..1

class RatedTarget(VisibleTarget):
    """A visible target plus how worthwhile it actually is tonight."""
    suitability: Optional[Literal["good", "fair", "poor", "very_poor"]] = None
    suitability_reason: Optional[str] = None


class CloudPoint(BaseModel):
    time_local: str  # "HH:MM" in the location's timezone
    cloud_cover: int


class Recommendation(BaseModel):
    """The bottom line — should you go out tonight, and if not, when."""
    headline: str
    detail: str
    next_better_date: Optional[str] = None
    next_better_weekday: Optional[str] = None


class TonightSummary(BaseModel):
    """Everything the dashboard's Tonight card needs, in one round trip and
    one weather fetch — it previously stitched /night and /visible together
    and had no forecast to rate targets against."""
    night: NightInfo
    sample_time_local: str  # "YYYY-MM-DDTHH:mm", when targets were computed
    sample_is_now: bool = False
    targets: List[RatedTarget]
    hourly_cloud: List[CloudPoint]
    clear_from_local: Optional[str] = None
    clear_to_local: Optional[str] = None
    clear_hours: float = 0.0
    # When the Moon drops below the horizon inside the dark window. Lets the
    # night track place the Moon from a real time instead of inferring a
    # position from the up-fraction, which would be an invented fact.
    moonset_local: Optional[str] = None
    focus: Optional[str] = None
    cloud_trend: Optional[str] = None  # plain-language shape of the night
    recommendation: Optional[Recommendation] = None


class ObservingContext(BaseModel):
    """Which evening-date owns the user's current observing context."""
    date_local: str
    phase: Literal["active", "upcoming"]
    now_local: str
    rollover_local: Optional[str] = None


class NightOutlook(BaseModel):
    """One night in the multi-night outlook."""
    date: str  # "YYYY-MM-DD"
    weekday: str  # "Tuesday"
    conditions: Optional[Literal["good", "fair", "poor"]] = None
    conditions_summary: Optional[str] = None
    cloud_cover_percent: Optional[int] = None
    dark_start_local: Optional[str] = None  # "HH:MM"
    dark_end_local: Optional[str] = None
    clear_from_local: Optional[str] = None  # longest clear-enough run
    clear_to_local: Optional[str] = None
    clear_hours: float = 0.0
    moon_illumination: float
    moon_up_fraction: Optional[float] = None
    moonset_local: Optional[str] = None  # when it drops below the horizon
    temperature_c: Optional[float] = None  # mean across the dark window
    wind_kmh: Optional[float] = None
    focus: Optional[str] = None  # deep-sky | mixed | planetary | none
    focus_summary: Optional[str] = None
    best_targets: List[str] = []


class OutlookResponse(BaseModel):
    timezone: str
    nights: List[NightOutlook]
    best_date: Optional[str] = None  # the night worth driving out for


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

def _moon_up_fraction(latitude: float, longitude: float,
                      start_utc: datetime, end_utc: datetime) -> float:
    """Fraction of the window the Moon spends above the horizon.

    Illumination alone is a poor proxy for interference — a full Moon that
    sets an hour into darkness barely matters, while a half Moon up all
    night does. Sampled every 20 minutes, which is finer than the verdict
    thresholds need.
    """
    return _moon_up_fraction_cached(
        *_coord_key(latitude, longitude), start_utc, end_utc
    )


@lru_cache(maxsize=_CACHE_SIZE)
def _moon_up_fraction_cached(latitude: float, longitude: float,
                             start_utc: datetime, end_utc: datetime) -> float:
    # Returns a float, so the cached value can be handed out directly.
    total = (end_utc - start_utc).total_seconds()
    if total <= 0:
        return 0.0

    observer = wgs84.latlon(latitude, longitude)
    topo = earth + observer
    moon = eph["moon"]

    steps = max(2, int(total // 1200))
    up = 0
    for i in range(steps + 1):
        t = ts.from_datetime(start_utc + timedelta(seconds=total * i / steps))
        alt, _, _ = topo.at(t).observe(moon).apparent().altaz()
        if float(alt.degrees) > 0:
            up += 1
    return up / (steps + 1)


@router.get("/night", response_model=NightInfo)
async def night_info(
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

    night = compute_night_info(loc.latitude, loc.longitude, date_local, tz_name, zone)
    await add_conditions(night, loc.latitude, loc.longitude, zone)
    return night


def _night_window(night: NightInfo, zone: ZoneInfo) -> tuple[datetime, datetime]:
    """The stretch of the night worth forecasting: full darkness if there is
    any, else sunset→sunrise, else a generic evening."""
    day = datetime.fromisoformat(night.date)
    start = night.dark_start or night.sunset or day.replace(
        hour=21, minute=0, tzinfo=zone
    ).astimezone(timezone.utc)
    end = night.dark_end or night.sunrise or start + timedelta(hours=6)
    return start, end


def _target_sample_time(
    night: NightInfo,
    zone: ZoneInfo,
    now_utc: Optional[datetime] = None,
) -> tuple[datetime, bool]:
    """Choose now inside an active window, otherwise a representative time."""
    current = _to_utc(now_utc or datetime.now(timezone.utc)).replace(
        second=0, microsecond=0
    )
    window_start, window_end = _night_window(night, zone)
    if window_start <= current < window_end:
        return current, True

    if night.dark_start:
        start = night.dark_start
        end = night.dark_end or start + timedelta(hours=2)
        return min(start + timedelta(hours=1), start + (end - start) / 2), False

    fallback = datetime.fromisoformat(night.date).replace(
        hour=22, minute=0, tzinfo=zone
    ).astimezone(timezone.utc)
    return fallback, False


async def add_conditions(
    night: NightInfo, latitude: float, longitude: float, zone: ZoneInfo
) -> list[dict]:
    """Fill in the verdict fields on an already-computed NightInfo, and hand
    back the hourly rows so a caller can reuse them without a second fetch.

    Kept separate from compute_night_info so that stays pure astronomy with
    no network call — the advisor builds its own forecast and doesn't need
    this, and a forecast outage degrades the badge instead of the endpoint.
    """
    window_start, window_end = _night_window(night, zone)

    try:
        rows = await get_hourly_forecast(latitude, longitude, window_start, window_end)
    except Exception:  # noqa: BLE001 - a forecast outage shouldn't 500 the page
        return []

    clouds = [r["cloud_cover"] for r in rows if r.get("cloud_cover") is not None]
    if not clouds:
        return rows

    night.cloud_cover_percent = round(sum(clouds) / len(clouds))
    night.moon_up_fraction = round(
        _moon_up_fraction(latitude, longitude, window_start, window_end), 3
    )
    night.conditions, night.conditions_summary = summarize_conditions(
        has_darkness=night.dark_start is not None,
        cloud_cover_percent=night.cloud_cover_percent,
        moon_illumination=night.moon_illumination,
        moon_up_fraction=night.moon_up_fraction,
    )
    return rows


def compute_night_info(
    latitude: float,
    longitude: float,
    date_local: str,
    tz_name: str,
    zone: ZoneInfo,
) -> NightInfo:
    """Darkness window + moon illumination for one night (local noon to noon).

    Always returns a fresh instance: add_conditions() writes the forecast
    verdict onto whatever NightInfo it is handed, so sharing the cached one
    would let a request's cloud cover bleed into every later request for the
    same night. `zone` is ignored for caching — it is derived from tz_name,
    and deriving it inside means the two can't disagree.
    """
    return _night_info_cached(
        *_coord_key(latitude, longitude), date_local, tz_name
    ).model_copy()


@lru_cache(maxsize=_CACHE_SIZE)
def _night_info_cached(
    latitude: float,
    longitude: float,
    date_local: str,
    tz_name: str,
) -> NightInfo:
    # Every field is an immutable scalar, so a shallow copy at the call site
    # is enough to protect this from mutation.
    zone = ZoneInfo(tz_name)
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


def resolve_observing_context(
    latitude: float,
    longitude: float,
    tz_name: str,
    zone: ZoneInfo,
    now_utc: Optional[datetime] = None,
) -> ObservingContext:
    """Resolve the evening-date that owns *now* at an observing site.

    Calendar midnight is not an astronomical boundary. If it is after
    midnight but the previous evening's dark window is still open, that
    previous date remains "tonight". Once astronomical darkness ends, the
    context advances to the coming evening.
    """
    current = _to_utc(now_utc or datetime.now(timezone.utc))
    local_day = current.astimezone(zone).date()

    for candidate in (local_day - timedelta(days=1), local_day):
        night = compute_night_info(
            latitude, longitude, candidate.isoformat(), tz_name, zone
        )
        window_start, window_end = _night_window(night, zone)
        if window_start <= current < window_end:
            return ObservingContext(
                date_local=candidate.isoformat(),
                phase="active",
                now_local=current.astimezone(zone).strftime("%Y-%m-%dT%H:%M"),
                rollover_local=window_end.astimezone(zone).strftime("%Y-%m-%dT%H:%M"),
            )

    coming = compute_night_info(
        latitude, longitude, local_day.isoformat(), tz_name, zone
    )
    _, window_end = _night_window(coming, zone)
    return ObservingContext(
        date_local=local_day.isoformat(),
        phase="upcoming",
        now_local=current.astimezone(zone).strftime("%Y-%m-%dT%H:%M"),
        rollover_local=window_end.astimezone(zone).strftime("%Y-%m-%dT%H:%M"),
    )


@router.get("/observing-context", response_model=ObservingContext)
def observing_context(
    location_id: int,
    tz: Optional[str] = None,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current or upcoming observing night for a saved site."""
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

    return resolve_observing_context(
        loc.latitude, loc.longitude, tz_name, zone
    )


class LocationComparison(BaseModel):
    location_id: int
    name: str
    region: Optional[str] = None
    # When this night is a write-off, when the site is next usable. Only
    # computed when asked for — it costs a wider forecast per location.
    next_clear_date: Optional[str] = None
    next_clear_weekday: Optional[str] = None
    next_clear_from_local: Optional[str] = None
    next_clear_to_local: Optional[str] = None
    distance_km: Optional[float] = None  # straight-line, not driving
    conditions: Optional[Literal["good", "fair", "poor"]] = None
    conditions_summary: Optional[str] = None
    cloud_cover_percent: Optional[int] = None
    dark_start_local: Optional[str] = None
    dark_end_local: Optional[str] = None
    clear_from_local: Optional[str] = None
    clear_to_local: Optional[str] = None
    clear_hours: float = 0.0
    moon_illumination: float = 0.0
    wind_kmh: Optional[float] = None  # mean across the dark window
    focus: Optional[str] = None
    score: float = 0.0


class LocationRecommendation(BaseModel):
    """What to actually do about the saved sites tonight."""
    # "stay" | "switch" | "none_usable" — the UI headline follows from this,
    # so it never has to force a competing site into the sentence.
    status: Literal["stay_best", "stay_nearby", "switch", "none_usable"]
    location_id: Optional[int] = None
    # The numbers behind the call, so the user can check it
    reason: str = ""


class CompareResponse(BaseModel):
    date: str
    timezone: str
    reference_location_id: Optional[int] = None
    recommendation: Optional[LocationRecommendation] = None
    locations: List[LocationComparison]


@router.get("/compare", response_model=CompareResponse)
async def compare_locations(
    date_local: str,
    reference_location_id: Optional[int] = None,
    tz: Optional[str] = None,
    include_next_clear: bool = False,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rank the user's saved sites for one night.

    Answers "it's cloudy at home — is anywhere I know clearer tonight?".
    Distances are straight-line from the reference location; computing
    driving time would need a routing service, so it isn't claimed.
    """
    locs = (
        db.query(Location)
        .filter(Location.owner_id == current_user.id)
        .filter(Location.latitude.isnot(None), Location.longitude.isnot(None))
        .all()
    )
    if not locs:
        raise HTTPException(status_code=404, detail="No locations with coordinates")

    reference = next((l for l in locs if l.id == reference_location_id), None)

    tz_name = tz or (reference.timezone if reference else None) or locs[0].timezone
    if not tz_name:
        raise HTTPException(status_code=400, detail="Timezone required")
    try:
        zone = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=400, detail="Invalid timezone")

    async def summarize(loc: Location) -> LocationComparison:
        # Each site's night is computed in *its own* timezone. Using the
        # reference site's zone for everything meant that selecting Tokyo
        # scanned Toronto's night in Asia/Tokyo time, landing ~13 hours out
        # and mostly in the past, so every other row came back "No forecast".
        # "The night of the 12th" sensibly means the 12th where the site is.
        site_tz = loc.timezone or tz_name
        try:
            site_zone = ZoneInfo(site_tz)
        except ZoneInfoNotFoundError:
            site_tz, site_zone = tz_name, zone

        night = compute_night_info(
            loc.latitude, loc.longitude, date_local, site_tz, site_zone
        )
        entry = LocationComparison(
            location_id=loc.id,
            name=loc.name,
            region=loc.region,
            moon_illumination=round(night.moon_illumination, 3),
            dark_start_local=night.dark_start.astimezone(site_zone).strftime("%H:%M")
            if night.dark_start else None,
            dark_end_local=night.dark_end.astimezone(site_zone).strftime("%H:%M")
            if night.dark_end else None,
        )
        if reference:
            entry.distance_km = round(
                haversine_km(
                    reference.latitude, reference.longitude, loc.latitude, loc.longitude
                ),
                1,
            )

        rows = await add_conditions(night, loc.latitude, loc.longitude, site_zone)
        entry.conditions = night.conditions
        entry.conditions_summary = night.conditions_summary
        entry.cloud_cover_percent = night.cloud_cover_percent

        if rows:
            win_start, win_end = _night_window(night, site_zone)
            window = find_clear_window(rows, win_start, win_end)
            if window:
                entry.clear_from_local = window[0].astimezone(site_zone).strftime("%H:%M")
                entry.clear_to_local = window[1].astimezone(site_zone).strftime("%H:%M")
                entry.clear_hours = round(
                    (window[1] - window[0]).total_seconds() / 3600, 1
                )
            entry.focus, _ = observing_focus(
                cloud_cover_percent=night.cloud_cover_percent,
                moon_illumination=night.moon_illumination,
                moon_up_fraction=night.moon_up_fraction or 0.0,
                has_darkness=night.dark_start is not None,
            )

        # NightInfo carries no wind, so average it off the same hourly rows
        # the clear-window search already fetched rather than asking again.
        winds = [r["wind_speed"] for r in rows if r.get("wind_speed") is not None]
        entry.wind_kmh = round(sum(winds) / len(winds), 1) if winds else None

        entry.score = sky_score(
            entry.conditions,
            entry.clear_hours,
            entry.cloud_cover_percent,
            moon_illumination=night.moon_illumination,
            moon_up_fraction=night.moon_up_fraction or 0.0,
            wind_kmh=entry.wind_kmh,
        )

        # "Next clear window" only means anything when tonight has none
        if include_next_clear and entry.clear_hours == 0:
            found = await _next_clear_window(
                loc.latitude, loc.longitude, date_local, site_tz, site_zone
            )
            if found:
                day, start, end = found
                entry.next_clear_date = day.isoformat()
                entry.next_clear_weekday = day.strftime("%A")
                entry.next_clear_from_local = start.astimezone(site_zone).strftime("%H:%M")
                entry.next_clear_to_local = end.astimezone(site_zone).strftime("%H:%M")
        return entry

    # One forecast request per site, in parallel rather than in series
    results = await asyncio.gather(*(summarize(l) for l in locs))
    results = sorted(results, key=lambda r: r.score, reverse=True)

    choice = choose_location(
        [
            {
                "id": r.location_id,
                "name": r.name,
                "score": r.score,
                "clear_hours": r.clear_hours,
                "cloud_cover_percent": r.cloud_cover_percent,
                "distance_km": r.distance_km,
            }
            for r in results
        ],
        reference.id if reference else None,
    )

    return CompareResponse(
        date=date_local,
        timezone=tz_name,
        reference_location_id=reference.id if reference else None,
        recommendation=LocationRecommendation(**choice),
        locations=list(results),
    )


async def _next_clear_window(
    latitude: float,
    longitude: float,
    from_date: str,
    tz_name: str,
    zone: ZoneInfo,
    lookahead: int = 6,
) -> Optional[tuple[date, datetime, datetime]]:
    """First upcoming night at this site with a usable gap in the cloud.

    One forecast request covers the whole span; each night is then sliced
    out of it, so this costs one HTTP call per location rather than one per
    night. Returns (day, window start, window end) or None.
    """
    start_day = date.fromisoformat(from_date)
    span_start = datetime.combine(
        start_day + timedelta(days=1), time(12, 0), tzinfo=zone
    ).astimezone(timezone.utc)

    try:
        rows = await get_hourly_forecast(
            latitude, longitude, span_start, span_start + timedelta(days=lookahead + 1)
        )
    except Exception:  # noqa: BLE001 - no suggestion beats a wrong one
        return None
    if not rows:
        return None

    for offset in range(1, lookahead + 1):
        day = start_day + timedelta(days=offset)
        night = compute_night_info(latitude, longitude, day.isoformat(), tz_name, zone)
        win_start, win_end = _night_window(night, zone)
        window = find_clear_window(rows, win_start, win_end)
        if window:
            return day, window[0], window[1]
    return None


def _moonset_after(latitude: float, longitude: float,
                   start_utc: datetime, end_utc: datetime) -> Optional[datetime]:
    """When the Moon drops below the horizon within the window, if it does.

    "Moon sets at 11:08 PM" is far more actionable than "Moon 87%", because
    it tells you when the deep-sky half of the night actually begins.
    """
    return _moonset_after_cached(
        *_coord_key(latitude, longitude), start_utc, end_utc
    )


@lru_cache(maxsize=_CACHE_SIZE)
def _moonset_after_cached(latitude: float, longitude: float,
                          start_utc: datetime, end_utc: datetime) -> Optional[datetime]:
    # datetime is immutable, so the cached value can be handed out directly.
    observer = wgs84.latlon(latitude, longitude)
    topo = earth + observer
    moon = eph["moon"]

    def alt_at(dt: datetime) -> float:
        return float(topo.at(ts.from_datetime(dt)).observe(moon).apparent().altaz()[0].degrees)

    step = timedelta(minutes=15)
    t = start_utc
    prev_alt = alt_at(t)
    while t < end_utc:
        t = min(t + step, end_utc)
        alt = alt_at(t)
        if prev_alt > 0 >= alt:
            return t
        prev_alt = alt
    return None


@router.get("/outlook", response_model=OutlookResponse)
async def outlook(
    location_id: int,
    start_date: Optional[str] = None,
    nights: int = 7,
    tz: Optional[str] = None,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Multi-night outlook, so finding a good night doesn't mean clicking
    through dates one at a time.

    The whole span is fetched from the weather API in a single request and
    sliced per night, rather than one call per night.
    """
    nights = max(1, min(nights, 10))  # Open-Meteo's useful hourly range

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

    try:
        first_day = (
            date.fromisoformat(start_date)
            if start_date
            else datetime.now(zone).date()
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_date (YYYY-MM-DD)")

    # One forecast covering every night in the span
    span_start = datetime.combine(first_day, time(12, 0), tzinfo=zone).astimezone(timezone.utc)
    span_end = span_start + timedelta(days=nights + 1)
    try:
        rows = await get_hourly_forecast(loc.latitude, loc.longitude, span_start, span_end)
    except Exception:  # noqa: BLE001 - degrade to astronomy-only rather than 500
        rows = []

    out: List[NightOutlook] = []
    for offset in range(nights):
        day = first_day + timedelta(days=offset)
        night = compute_night_info(
            loc.latitude, loc.longitude, day.isoformat(), tz_name, zone
        )
        win_start, win_end = _night_window(night, zone)

        night_rows = [
            r for r in rows
            if win_start <= datetime.fromisoformat(r["time"]) <= win_end
        ]
        clouds = [r["cloud_cover"] for r in night_rows if r.get("cloud_cover") is not None]
        temps = [r["temperature"] for r in night_rows if r.get("temperature") is not None]
        winds = [r["wind_speed"] for r in night_rows if r.get("wind_speed") is not None]

        entry = NightOutlook(
            date=day.isoformat(),
            weekday=day.strftime("%A"),
            moon_illumination=round(night.moon_illumination, 3),
            dark_start_local=night.dark_start.astimezone(zone).strftime("%H:%M")
            if night.dark_start else None,
            dark_end_local=night.dark_end.astimezone(zone).strftime("%H:%M")
            if night.dark_end else None,
            temperature_c=round(sum(temps) / len(temps), 1) if temps else None,
            wind_kmh=round(sum(winds) / len(winds), 1) if winds else None,
        )

        if clouds:
            entry.cloud_cover_percent = round(sum(clouds) / len(clouds))
            up_fraction = _moon_up_fraction(loc.latitude, loc.longitude, win_start, win_end)
            entry.moon_up_fraction = round(up_fraction, 3)
            entry.conditions, entry.conditions_summary = summarize_conditions(
                has_darkness=night.dark_start is not None,
                cloud_cover_percent=entry.cloud_cover_percent,
                moon_illumination=night.moon_illumination,
                moon_up_fraction=up_fraction,
            )
            entry.focus, entry.focus_summary = observing_focus(
                cloud_cover_percent=entry.cloud_cover_percent,
                moon_illumination=night.moon_illumination,
                moon_up_fraction=up_fraction,
                has_darkness=night.dark_start is not None,
            )

            window = find_clear_window(night_rows, win_start, win_end)
            if window:
                entry.clear_from_local = window[0].astimezone(zone).strftime("%H:%M")
                entry.clear_to_local = window[1].astimezone(zone).strftime("%H:%M")
                entry.clear_hours = round(
                    (window[1] - window[0]).total_seconds() / 3600, 1
                )

            if up_fraction > 0:
                moonset = _moonset_after(loc.latitude, loc.longitude, win_start, win_end)
                if moonset:
                    entry.moonset_local = moonset.astimezone(zone).strftime("%H:%M")

        # Name the few targets actually worth the trip, not everything up
        sample = (
            night.dark_start + timedelta(hours=1)
            if night.dark_start
            else datetime.combine(day, time(22, 0), tzinfo=zone).astimezone(timezone.utc)
        )
        rated = []
        for t in compute_visible_targets(loc.latitude, loc.longitude, sample):
            if not t.visible:
                continue
            level, _ = rate_target(
                kind=t.kind,
                altitude_deg=t.altitude_deg,
                cloud_cover_percent=entry.cloud_cover_percent,
                moon_illumination=night.moon_illumination,
                moon_up_fraction=entry.moon_up_fraction or 0.0,
            )
            if level in ("good", "fair") or level is None:
                rated.append((t.score, t.name))
        entry.best_targets = [n for _, n in sorted(rated, reverse=True)[:3]]

        out.append(entry)

    rankable = [n for n in out if n.conditions is not None]
    best = max(
        rankable,
        key=lambda n: night_rank_key(
            n.conditions,
            n.clear_hours,
            n.cloud_cover_percent,
            moon_illumination=n.moon_illumination,
            moon_up_fraction=n.moon_up_fraction or 0.0,
            wind_kmh=n.wind_kmh,
        ),
        default=None,
    )
    # Only call something "best" if it's actually worth going out for
    best_date = best.date if best and best.conditions in ("good", "fair") else None

    return OutlookResponse(timezone=tz_name, nights=out, best_date=best_date)


@router.get("/tonight", response_model=TonightSummary)
async def tonight_summary(
    location_id: int,
    date_local: str,
    tz: Optional[str] = None,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One payload for the dashboard: darkness, verdict, rated targets, clouds."""
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

    night = compute_night_info(loc.latitude, loc.longitude, date_local, tz_name, zone)
    rows = await add_conditions(night, loc.latitude, loc.longitude, zone)

    # During the active observing window, answer the most useful question:
    # what is actually up right now? For a future or past night, retain the
    # representative one-hour-into-darkness snapshot.
    sample_utc, sample_is_now = _target_sample_time(night, zone)

    rated: List[RatedTarget] = []
    for t in compute_visible_targets(loc.latitude, loc.longitude, sample_utc):
        target = RatedTarget(**t.model_dump())
        if t.visible:
            target.suitability, target.suitability_reason = rate_target(
                kind=t.kind,
                altitude_deg=t.altitude_deg,
                cloud_cover_percent=night.cloud_cover_percent,
                moon_illumination=night.moon_illumination,
                moon_up_fraction=night.moon_up_fraction or 0.0,
            )
        rated.append(target)

    hourly = [
        CloudPoint(
            time_local=datetime.fromisoformat(r["time"])
            .astimezone(zone)
            .strftime("%H:%M"),
            cloud_cover=round(r["cloud_cover"]),
        )
        for r in rows
        if r.get("cloud_cover") is not None
    ]

    summary = TonightSummary(
        night=night,
        sample_time_local=sample_utc.astimezone(zone).strftime("%Y-%m-%dT%H:%M"),
        sample_is_now=sample_is_now,
        targets=rated,
        hourly_cloud=hourly,
    )

    win_start, win_end = _night_window(night, zone)
    window = find_clear_window(rows, win_start, win_end)
    if window:
        summary.clear_from_local = window[0].astimezone(zone).strftime("%H:%M")
        summary.clear_to_local = window[1].astimezone(zone).strftime("%H:%M")
        summary.clear_hours = round((window[1] - window[0]).total_seconds() / 3600, 1)

    if (night.moon_up_fraction or 0.0) > 0:
        moonset = _moonset_after(loc.latitude, loc.longitude, win_start, win_end)
        if moonset:
            summary.moonset_local = moonset.astimezone(zone).strftime("%H:%M")

    summary.focus, _ = observing_focus(
        cloud_cover_percent=night.cloud_cover_percent,
        moon_illumination=night.moon_illumination,
        moon_up_fraction=night.moon_up_fraction or 0.0,
        has_darkness=night.dark_start is not None,
    )
    summary.cloud_trend = describe_cloud_trend(
        [(p.time_local, p.cloud_cover) for p in hourly]
    )

    # If tonight is a write-off, say when to try instead — a recommendation
    # without an alternative just tells the user to give up.
    next_date, next_weekday = (None, None)
    if night.conditions in ("poor", "fair"):
        next_date, next_weekday = await _next_better_night(
            loc.latitude, loc.longitude, date_local, tz_name, zone,
            worse_than=night.conditions,
        )

    headline, detail = recommend_night(
        conditions=night.conditions,
        clear_hours=summary.clear_hours,
        focus=summary.focus,
        has_darkness=night.dark_start is not None,
        next_better_weekday=next_weekday,
        next_better_is_tomorrow=(
            next_date is not None
            and date.fromisoformat(next_date)
            == date.fromisoformat(date_local) + timedelta(days=1)
        ),
    )
    summary.recommendation = Recommendation(
        headline=headline,
        detail=detail,
        next_better_date=next_date,
        next_better_weekday=next_weekday,
    )
    return summary


async def _next_better_night(
    latitude: float,
    longitude: float,
    from_date: str,
    tz_name: str,
    zone: ZoneInfo,
    worse_than: str,
    lookahead: int = 6,
) -> tuple[Optional[str], Optional[str]]:
    """The soonest upcoming night with a better verdict than tonight's.

    Deliberately cheap: one forecast request for the span, cloud averages
    only — the caller just needs a date to point at, not a full outlook.
    """
    start_day = date.fromisoformat(from_date)
    span_start = datetime.combine(
        start_day + timedelta(days=1), time(12, 0), tzinfo=zone
    ).astimezone(timezone.utc)
    span_end = span_start + timedelta(days=lookahead + 1)

    try:
        rows = await get_hourly_forecast(latitude, longitude, span_start, span_end)
    except Exception:  # noqa: BLE001 - no suggestion is better than a wrong one
        return None, None
    if not rows:
        return None, None

    want = {"poor": ("good", "fair"), "fair": ("good",)}[worse_than]

    for offset in range(1, lookahead + 1):
        day = start_day + timedelta(days=offset)
        night = compute_night_info(latitude, longitude, day.isoformat(), tz_name, zone)
        win_start, win_end = _night_window(night, zone)
        clouds = [
            r["cloud_cover"] for r in rows
            if r.get("cloud_cover") is not None
            and win_start <= datetime.fromisoformat(r["time"]) <= win_end
        ]
        if not clouds:
            continue
        verdict, _ = summarize_conditions(
            has_darkness=night.dark_start is not None,
            cloud_cover_percent=round(sum(clouds) / len(clouds)),
            moon_illumination=night.moon_illumination,
            moon_up_fraction=_moon_up_fraction(latitude, longitude, win_start, win_end),
        )
        if verdict in want:
            return day.isoformat(), day.strftime("%A")
    return None, None


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
    """Positions and visibility for every known target at one instant.

    Hands back a new list of new models each call — callers are free to sort
    or filter the result, and none of that may reach the cached copy.
    """
    cached = _visible_targets_cached(*_coord_key(latitude, longitude), when_utc)
    return [t.model_copy() for t in cached]


@lru_cache(maxsize=_CACHE_SIZE)
def _visible_targets_cached(
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
                category="planet",
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
            category="moon",
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
    for name, category, ra_h, dec_d in FIXED_TARGETS:
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
                category=category,
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
