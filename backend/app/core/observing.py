# app/core/observing.py
#
# Pure observing-quality logic: no database, no network, no ephemeris.
# Everything here is a function of numbers already computed elsewhere, which
# keeps the thresholds in one testable place and lets the dashboard, a
# session's forecast, and the multi-night outlook agree with each other.
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Literal, Optional, Sequence


def cloud_band(cloud_cover_percent: int) -> Literal["clear", "partly", "cloudy"]:
    """One place for the cloud thresholds, shared by the night verdict, the
    per-target rating, and a session's point forecast — so the dashboard and
    a session detail can't disagree about what 60% cloud means."""
    if cloud_cover_percent > 60:
        return "cloudy"
    if cloud_cover_percent > 25:
        return "partly"
    return "clear"


# Worst-wins ordering for target suitability
_SUITABILITY_RANK = {"good": 0, "fair": 1, "poor": 2, "very_poor": 3}


def rate_target(
    kind: str,
    altitude_deg: float,
    cloud_cover_percent: Optional[int],
    moon_illumination: float,
    moon_up_fraction: float,
) -> tuple[Optional[str], Optional[str]]:
    """How worthwhile a geometrically-visible target actually is tonight.

    Being above the horizon is not a recommendation: a faint galaxy at 29°
    under a full Moon and thick cloud is technically visible and practically
    hopeless. Each factor proposes a rating and the worst one wins, so the
    reason shown is the thing most limiting that target.
    """
    if cloud_cover_percent is None:
        return None, None

    candidates: list[tuple[str, str]] = []

    band = cloud_band(cloud_cover_percent)
    if cloud_cover_percent >= 80:
        candidates.append(("very_poor", "heavy cloud forecast"))
    elif band == "cloudy":
        candidates.append(("poor", "cloudy skies forecast"))
    elif band == "partly":
        candidates.append(("fair", "some cloud forecast"))
    else:
        candidates.append(("good", "clear skies"))

    if altitude_deg < 20:
        candidates.append(("poor", "low on the horizon"))
    elif altitude_deg < 35:
        candidates.append(("fair", "fairly low in the sky"))
    else:
        candidates.append(("good", "well placed"))

    # Moonlight drowns faint extended objects; planets and the Moon itself
    # shrug it off, so only deep-sky targets take this penalty.
    if kind == "dso":
        moon_load = moon_illumination * moon_up_fraction
        if moon_load >= 0.5:
            candidates.append(("very_poor" if altitude_deg < 25 else "poor",
                               "washed out by moonlight"))
        elif moon_load >= 0.25:
            candidates.append(("fair", "some moonlight"))

    level, reason = max(candidates, key=lambda c: _SUITABILITY_RANK[c[0]])
    return level, reason


def summarize_conditions(
    has_darkness: bool,
    cloud_cover_percent: Optional[int],
    moon_illumination: float,
    moon_up_fraction: float,
) -> tuple[Optional[str], Optional[str]]:
    """Reduce the night to a verdict plus a one-line reason.

    Cloud is the dominant term — a clear sky under a full Moon still shows
    planets and doubles, an overcast sky shows nothing. Returns
    (verdict, summary); (None, None) when there's no forecast to judge.
    """
    if cloud_cover_percent is None:
        return None, None

    # Moon matters in proportion to how bright it is *and* how long it's up
    moon_load = moon_illumination * moon_up_fraction
    heavy_moon = moon_load >= 0.45
    some_moon = moon_load >= 0.2

    if cloud_cover_percent > 60:
        sky = "Mostly cloudy"
        verdict = "poor"
    elif cloud_cover_percent > 25:
        sky = "Partly cloudy"
        verdict = "fair"
    else:
        sky = "Clear skies"
        verdict = "good"

    if verdict == "good" and heavy_moon:
        verdict = "fair"

    if not has_darkness:
        # Twilight all night: usable for the Moon and planets, not deep sky
        verdict = "poor" if verdict == "poor" else "fair"
        return verdict, f"{sky}, but no full astronomical darkness that night"

    if heavy_moon:
        moon_note = "a bright Moon up for most of the dark window"
    elif some_moon:
        moon_note = "some moonlight during the dark window"
    else:
        moon_note = "little moonlight"

    return verdict, f"{sky}, {moon_note}"

# ---------------------------------------------------------------------------
# Multi-night outlook
# ---------------------------------------------------------------------------

# A night is "usable" below this much cloud. Deliberately looser than the
# `clear` band: 40% broken cloud still gives real gaps to observe through,
# which is the difference between "worth setting up" and "stay home".
CLEAR_ENOUGH_PERCENT = 40


def find_clear_window(
    rows: Sequence[dict],
    window_start: datetime,
    window_end: datetime,
    max_cloud: int = CLEAR_ENOUGH_PERCENT,
) -> Optional[tuple[datetime, datetime]]:
    """Longest run of clear-enough hours inside the dark window.

    The nightly mean hides the shape of a night: 40% average cloud is a
    washout if it's even, and a fine night if it's one thick block plus four
    clear hours. Returns the run clipped to the darkness window, or None if
    no hour qualifies.

    Hourly resolution — the forecast itself is hourly, so reporting minutes
    would imply precision the data doesn't have.
    """
    hours: list[tuple[datetime, int]] = []
    for r in rows:
        cloud = r.get("cloud_cover")
        if cloud is None:
            continue
        t = datetime.fromisoformat(r["time"])
        if window_start - timedelta(hours=1) <= t <= window_end:
            hours.append((t, round(cloud)))
    if not hours:
        return None
    hours.sort(key=lambda h: h[0])

    best: Optional[tuple[datetime, datetime]] = None
    best_len = timedelta(0)
    run_start: Optional[datetime] = None
    prev: Optional[datetime] = None

    def close_run(end_at: datetime) -> None:
        nonlocal best, best_len
        if run_start is None:
            return
        start = max(run_start, window_start)
        end = min(end_at, window_end)
        if end > start and (end - start) > best_len:
            best_len = end - start
            best = (start, end)

    for t, cloud in hours:
        contiguous = prev is None or (t - prev) <= timedelta(hours=1, minutes=5)
        if cloud <= max_cloud and contiguous:
            if run_start is None:
                run_start = t
        elif cloud <= max_cloud:
            close_run(prev + timedelta(hours=1) if prev else t)
            run_start = t
        else:
            close_run(t)
            run_start = None
        prev = t

    close_run(prev + timedelta(hours=1) if prev else window_end)
    return best


def observing_focus(
    cloud_cover_percent: Optional[int],
    moon_illumination: float,
    moon_up_fraction: float,
    has_darkness: bool,
) -> tuple[Optional[str], Optional[str]]:
    """What kind of observing the night actually suits.

    Faint extended objects need genuine darkness; planets and the Moon are
    bright enough to punch through moonlight and even thin cloud. Saying
    which is which is more useful than a single score, because a "poor"
    deep-sky night can still be a good planetary one.
    """
    if cloud_cover_percent is None:
        return None, None

    if cloud_cover_percent > 70:
        return "none", "Too cloudy for useful observing"

    moon_load = moon_illumination * moon_up_fraction

    if cloud_cover_percent > 40:
        return "planetary", "Breaks in the cloud. Planets and the Moon only."

    if not has_darkness:
        return "planetary", "No full darkness. Planets and the Moon."

    if moon_load >= 0.45:
        return "planetary", "Bright Moon. Good for planets, doubles and lunar detail."

    if moon_load >= 0.2:
        return "mixed", "Some moonlight. Brighter deep-sky objects and planets."

    return "deep-sky", "Dark and clear. Good for faint deep-sky targets."


# Verdict → sortable quality, so "best upcoming night" is a real ordering
_VERDICT_SCORE = {"good": 2, "fair": 1, "poor": 0}


def night_rank_key(
    conditions: Optional[str],
    clear_hours: float,
    cloud_cover_percent: Optional[int],
    moon_illumination: float = 0.0,
    moon_up_fraction: float = 0.0,
    wind_kmh: Optional[float] = None,
) -> float:
    """Sort key for picking the best night — the same scorer used to rank
    observing sites, so the outlook and the location comparison can't
    disagree about what "best" means.

    This was a lexicographic (verdict, hours, cloud) tuple, which had two
    faults. Cloud never actually competed: any longer window won outright
    and the cloud figure only broke exact ties in hours, so the outlook
    could crown the cloudiest night of the week and print the contradicting
    number beside the badge. And wind and moonlight were ignored entirely
    despite both being displayed on the card.
    """
    return sky_score(
        conditions,
        clear_hours,
        cloud_cover_percent,
        moon_illumination=moon_illumination,
        moon_up_fraction=moon_up_fraction,
        wind_kmh=wind_kmh,
    )


# ---------------------------------------------------------------------------
# Comparing locations
# ---------------------------------------------------------------------------

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points.

    Straight-line, NOT driving distance — turning this into travel time needs
    a routing service, and guessing would be worse than saying "85 km away".
    """
    from math import asin, cos, radians, sin, sqrt

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def sky_score(
    conditions: Optional[str],
    clear_hours: float,
    cloud_cover_percent: Optional[int],
    moon_illumination: float = 0.0,
    moon_up_fraction: float = 0.0,
    wind_kmh: Optional[float] = None,
) -> float:
    """How good this site's sky is tonight, judged on its own.

    Deliberately knows nothing about where the observer is standing. An
    earlier version folded a distance penalty in here, which made the
    ranking depend on the reference site: whichever site you were currently
    at got a free head start and could beat a genuinely clearer one. The
    sky is the same sky no matter where you ask from, so scoring it has to
    be stable — distance belongs in the switching decision instead, where a
    long drive can be weighed against how much sky it actually buys.
    """
    score = _VERDICT_SCORE.get(conditions or "poor", 0) * 100.0
    score += min(clear_hours, 10.0) * 8.0
    if cloud_cover_percent is not None:
        score += (100 - cloud_cover_percent) * 0.3
    # Moonlight only costs you while the Moon is actually up during the dark
    # window — a full Moon that sets before it starts is worth nothing.
    score -= moon_illumination * moon_up_fraction * 20.0
    # Wind ruins seeing and shakes the mount well before it feels strong
    if wind_kmh is not None:
        score -= max(0.0, min(wind_kmh, 60.0) - 15.0) * 0.6
    return round(score, 2)


# A drive has to buy a materially better sky, not a rounding error. The bar
# rises with distance: a few km for a small gain is fine, 300 km is not.
SWITCH_MARGIN_BASE = 6.0
SWITCH_MARGIN_PER_100KM = 18.0


def switch_margin(distance_km: Optional[float]) -> float:
    """Score improvement a site must beat before it's worth relocating to."""
    if distance_km is None:
        return SWITCH_MARGIN_BASE
    return round(
        SWITCH_MARGIN_BASE + (min(distance_km, 400.0) / 100.0) * SWITCH_MARGIN_PER_100KM,
        2,
    )


def choose_location(sites: list[dict], current_id: Optional[int]) -> dict:
    """Decide what to tell the user about their saved sites tonight.

    Four answers, because "stay put" has two very different meanings and
    collapsing them produces a headline that contradicts its own evidence:

      stay_best   - the current site genuinely has the best sky
      stay_nearby - somewhere is clearer, but not by enough to justify the
                    trip; the alternative is named rather than hidden
      switch      - a site is better by more than its distance costs
      none_usable - nothing has a clear window at all

    Every candidate is weighed, not just the top-scoring one. Judging only
    the best sky means a nearer, genuinely-worth-it site gets skipped
    whenever some distant site happens to outrank it.

    `sites` are dicts with id/name/score/clear_hours/cloud_cover_percent/
    distance_km, sorted best-sky-first.
    """
    if not sites:
        return {"status": "none_usable", "location_id": None, "reason": ""}

    usable = [s for s in sites if s.get("clear_hours", 0) > 0]
    current = next((s for s in sites if s["id"] == current_id), None)

    def clouds(s: dict) -> str:
        c = s.get("cloud_cover_percent")
        return f"{c}% cloud" if c is not None else "cloud unknown"

    def window(s: dict) -> str:
        h = s.get("clear_hours") or 0
        return f"{h:g}-hour clear window" if h else "no clear window"

    def away(s: dict) -> str:
        d = s.get("distance_km")
        return f"{round(d)} km away" if d else "nearby"

    def all_sites_tail() -> str:
        return f", the best of your {len(sites)} saved sites." if len(sites) > 1 else "."

    if not usable:
        return {
            "status": "none_usable",
            "location_id": None,
            "reason": "Every saved site is forecast cloudy through its dark window.",
        }

    best = usable[0]

    if current is None or best["id"] == current["id"]:
        return {
            "status": "stay_best",
            "location_id": best["id"],
            "reason": f"{clouds(best)} and a {window(best)}{all_sites_tail()}",
        }

    # How much each better site beats the current one by, over and above what
    # its distance costs. Positive means the trip pays for itself.
    def net(s: dict) -> float:
        return (s["score"] - current["score"]) - switch_margin(s.get("distance_km"))

    better = [s for s in usable if s["score"] > current["score"]]
    if not better:
        return {
            "status": "stay_best",
            "location_id": current["id"],
            "reason": f"{clouds(current)} and a {window(current)}{all_sites_tail()}",
        }

    worth_it = [s for s in better if net(s) >= 0]
    if worth_it:
        # Best value, not best sky: a site that clears its bar comfortably
        # beats one that barely clears it from twice the distance.
        pick = max(worth_it, key=net)
        return {
            "status": "switch",
            "location_id": pick["id"],
            "reason": (
                f"{clouds(pick)} vs {clouds(current)} at {current['name']}, and a "
                f"{window(pick)} vs {window(current)}. {away(pick)}."
            ),
        }

    # Nothing earns the trip. Name the closest call so the advice is checkable
    # instead of looking like the alternatives were never considered.
    runner_up = max(better, key=net)
    return {
        "status": "stay_nearby",
        "location_id": current["id"],
        "reason": (
            f"{clouds(current)} and a {window(current)}. "
            f"{runner_up['name']} is clearer ({clouds(runner_up)}) but it's "
            f"{away(runner_up)}, which isn't enough gain for the drive."
        ),
    }


# ---------------------------------------------------------------------------
# Plain-language takeaways
# ---------------------------------------------------------------------------

def describe_cloud_trend(
    points: Sequence[tuple[str, int]],
    clear_max: int = CLEAR_ENOUGH_PERCENT,
) -> str:
    """One line describing the shape of the night's cloud.

    A chart shows the shape but still asks the reader to interpret it; this
    states the conclusion. Takes (local "HH:MM", cloud %) pairs in order.
    """
    if not points:
        return "No cloud forecast available"

    values = [c for _, c in points]
    worst, best = max(values), min(values)
    best_time = points[values.index(best)][0]
    clear_count = sum(1 for v in values if v <= clear_max)

    if best > 80:
        return "Overcast all night"
    if worst <= 15:
        return "Clear all night"
    if clear_count == 0:
        return f"Cloudy throughout, thinnest around {best_time}"

    if clear_count == len(values):
        return "Mostly clear all night"

    # Is the clear stretch at the start, the end, or the middle?
    first_clear = next(i for i, v in enumerate(values) if v <= clear_max)
    last_clear = len(values) - 1 - next(
        i for i, v in enumerate(reversed(values)) if v <= clear_max
    )
    if last_clear >= len(values) - 2 and first_clear > 0:
        return f"Clearing later, best after {points[first_clear][0]}"
    if first_clear == 0 and last_clear < len(values) - 2:
        return f"Clear early, clouding over after {points[last_clear][0]}"
    return f"Broken cloud, best around {best_time}"


def recommend_night(
    conditions: Optional[str],
    clear_hours: float,
    focus: Optional[str],
    has_darkness: bool,
    next_better_weekday: Optional[str] = None,
    next_better_is_tomorrow: bool = False,
) -> tuple[str, str]:
    """The bottom line: should you bother tonight?

    Everything else on the dashboard is information the reader has to weigh
    up. This states a conclusion — which is the difference between an
    information display and a planner.
    """
    if conditions is None:
        return (
            "No forecast available",
            "Sky positions are computed, but there's no weather data for this night.",
        )

    when_instead = ""
    if next_better_weekday:
        when_instead = (
            " Try tomorrow instead."
            if next_better_is_tomorrow
            else f" {next_better_weekday} looks like your next clear night."
        )

    if conditions == "poor":
        if focus == "none" or clear_hours == 0:
            return (
                "Probably not worth setting up",
                f"No usable gap in the cloud that night.{when_instead}",
            )
        return (
            "Marginal, only if the cloud breaks",
            f"About {clear_hours:g}h of thinner cloud, but don't count on it."
            f"{when_instead}",
        )

    if conditions == "fair":
        if focus == "planetary":
            return (
                "Worth it for the Moon and planets",
                "Too much moonlight or cloud for faint deep-sky targets, but "
                "bright objects will hold up.",
            )
        if not has_darkness:
            return (
                "Worth a look, but no real darkness",
                "Twilight all night. Fine for the Moon and planets, not deep sky.",
            )
        return (
            "Worth setting up",
            f"Around {clear_hours:g}h of usable sky, with some compromises.",
        )

    # good
    if focus == "deep-sky":
        return (
            "A good night, worth setting up",
            f"Dark and clear for about {clear_hours:g}h. The best conditions "
            "you'll get for faint targets.",
        )
    return (
        "Worth setting up",
        f"Clear skies for about {clear_hours:g}h.",
    )
