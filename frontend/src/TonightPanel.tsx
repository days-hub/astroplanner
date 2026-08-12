// src/TonightPanel.tsx
//
// The page's centrepiece: for the selected location and night, answer
// "is it worth going out, when, and at what?" before any technical detail.
// Hierarchy is deliberate — verdict and observing window first, altitudes
// and bearings second. Location and date come from the page context bar.
import type React from "react";
import { useEffect, useState } from "react";
import api from "./api";
import AdvisorPanel from "./AdvisorPanel";
import CloudTimeline, { type CloudPoint } from "./CloudTimeline";
import NightTrack from "./NightTrack";
import {
  MoonIcon,
  PlanetIcon,
  SparklesIcon,
  StarIcon,
} from "./icons";
import {
  btnPrimarySm,
  cardFeature,
  fontSize,
  inset,
  line,
  text,
  verdictStyles,
} from "./theme";

type Suitability = "good" | "fair" | "poor" | "very_poor";

type RatedTarget = {
  name: string;
  kind: "planet" | "moon" | "dso" | "star";
  altitude_deg: number;
  azimuth_deg: number;
  visible: boolean;
  reason?: string | null;
  suitability?: Suitability | null;
  suitability_reason?: string | null;
};

type NightInfo = {
  date: string;
  timezone: string;
  sunset?: string | null;
  dark_start?: string | null;
  dark_end?: string | null;
  sunrise?: string | null;
  moon_illumination: number;
  moon_up_fraction?: number | null;
  conditions?: "good" | "fair" | "poor" | null;
  conditions_summary?: string | null;
  cloud_cover_percent?: number | null;
};

type Recommendation = {
  headline: string;
  detail: string;
  next_better_date?: string | null;
  next_better_weekday?: string | null;
};

type TonightSummary = {
  night: NightInfo;
  sample_time_local: string;
  targets: RatedTarget[];
  hourly_cloud: CloudPoint[];
  clear_from_local?: string | null;
  clear_to_local?: string | null;
  clear_hours: number;
  moonset_local?: string | null;
  focus?: string | null;
  cloud_trend?: string | null;
  recommendation?: Recommendation | null;
};

interface Props {
  locationId: number;
  locationName?: string;
  tz: string;
  dateStr: string;
  onPlan: (targetName: string, whenLocal: string) => void;
  /** Jump the page to the suggested better night */
  onPickDate?: (date: string) => void;
}

const KIND_ICONS: Record<RatedTarget["kind"], React.ReactNode> = {
  planet: <PlanetIcon />,
  moon: <MoonIcon frac={0.35} />,
  dso: <SparklesIcon />,
  star: <StarIcon />,
};

// Wording is deliberately blunt: a target being above the horizon is not a
// recommendation, and the label should say so without needing the caveat.
const SUITABILITY_LABELS: Record<Suitability, { label: string; color: string }> = {
  good: { label: "Good", color: "#6ee7b7" },
  fair: { label: "Fair", color: "#fcd34d" },
  poor: { label: "Poor", color: "#fca5a5" },
  very_poor: { label: "Very poor", color: "#f87171" },
};

function parseApiDate(s: string) {
  const hasTz = /([zZ]|[+-]\d\d:\d\d)$/.test(s);
  return new Date(hasTz ? s : `${s}Z`);
}

function fmtTime(iso: string | null | undefined, tz: string) {
  if (!iso) return "—";
  const d = parseApiDate(iso);
  try {
    return d.toLocaleTimeString(undefined, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleTimeString();
  }
}

function fmtLocalInput(s: string) {
  const [h, m] = s.slice(11).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// "Tonight at X" is wrong the moment you look at another night — and the
// card is the page's headline, so it's the fastest way to lose track of
// which night you're actually reading. Name the night instead.
function nightLabel(dateStr: string, tz: string): string {
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    today = new Intl.DateTimeFormat("en-CA").format(new Date());
  }

  const asUTC = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  const days = Math.round((asUTC(dateStr) - asUTC(today)) / 86_400_000);

  if (days === 0) return "Tonight";
  if (days === 1) return "Tomorrow night";
  if (days === -1) return "Last night";

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Within the coming week a weekday is the most natural reference
  if (days > 1 && days < 7) {
    return `${date.toLocaleDateString(undefined, { weekday: "long" })} night`;
  }
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function degToCompass(deg: number) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

// Recessed, not outlined. These sit on the feature card, so the tint plus
// the gap between them is enough containment.
const targetCardStyle: React.CSSProperties = {
  ...inset,
  padding: "0.7rem 0.8rem",
  display: "grid",
  gap: "0.3rem",
};

export default function TonightPanel({
  locationId,
  locationName,
  tz,
  dateStr,
  onPlan,
  onPickDate,
}: Props) {
  const [data, setData] = useState<TonightSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<TonightSummary>("/targets/tonight", {
          params: { location_id: locationId, date_local: dateStr, tz },
        });
        if (!cancelled) setData(res.data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Couldn't load the sky for this location and night.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId, dateStr, tz]);

  const night = data?.night ?? null;
  const visible = (data?.targets ?? []).filter((t) => t.visible);
  const hiddenCount = (data?.targets.length ?? 0) - visible.length;
  const verdict = night?.conditions ? verdictStyles[night.conditions] : null;

  // If nothing is even fair, say so above the list rather than letting the
  // heading imply these are recommendations.
  const bestSuitability = visible.reduce<Suitability | null>((best, t) => {
    const order: Suitability[] = ["very_poor", "poor", "fair", "good"];
    if (!t.suitability) return best;
    if (!best) return t.suitability;
    return order.indexOf(t.suitability) > order.indexOf(best) ? t.suitability : best;
  }, null);
  const allPoor = bestSuitability === "poor" || bestSuitability === "very_poor";

  const windowText = night?.dark_start
    ? `${fmtTime(night.dark_start, tz)} – ${fmtTime(night.dark_end, tz)}`
    : night
      ? "No full darkness that night"
      : "—";

  return (
    <section style={cardFeature}>
      <h2
        style={{
          // An identifier, not a headline: it says which night you're looking
          // at, and then gets out of the way of the verdict below it.
          fontSize: fontSize.section,
          fontWeight: 600,
          color: text.secondary,
          margin: 0,
          letterSpacing: "0.01em",
        }}
      >
        {nightLabel(dateStr, tz)} at {locationName ?? "your location"}
      </h2>

      {/* The bottom line, before any of the supporting detail. Everything
          below is evidence; this is the conclusion. */}
      {data?.recommendation && (
        // No tinted container. A ~150px reddish block made "conditions are
        // bad" the loudest thing on the page — louder than the night you're
        // looking at, and louder than the alternative you actually want the
        // reader to move toward. The coloured headline says it in one line.
        // Good news keeps its tint (see the outlook's best-night callout):
        // bad news should be quiet and brief, good alternatives promoted.
        <div style={{ marginTop: "0.9rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              fontSize: fontSize.lead,
              fontWeight: 700,
              color: verdict ? verdict.color : text.primary,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            {verdict && (
              <span
                aria-hidden
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 9999,
                  background: "currentColor",
                  flexShrink: 0,
                }}
              />
            )}
            {data.recommendation.headline}
          </div>
          <div
            style={{
              fontSize: fontSize.body,
              color: text.secondary,
              marginTop: "0.3rem",
              paddingLeft: verdict ? "1.45rem" : 0,
              // No narrow measure here: the page is already capped at 1100px,
              // and clamping further wrapped one short sentence mid-clause
              // into a column with half the card empty beside it.
              maxWidth: "90ch",
            }}
          >
            {data.recommendation.detail}
          </div>
          {data.recommendation.next_better_date && onPickDate && (
            <button
              type="button"
              onClick={() => onPickDate(data.recommendation!.next_better_date!)}
              // The primary action on the whole screen. Having just concluded
              // "not worth setting up", the useful next move is planning the
              // night that is — so this gets the filled treatment while the
              // per-target buttons below stay secondary to it.
              style={{
                ...btnPrimarySm,
                marginTop: "0.7rem",
                marginLeft: verdict ? "1.45rem" : 0,
              }}
            >
              Plan {data.recommendation.next_better_weekday} instead
            </button>
          )}

          {/* Question the verdict right where you read it */}
          <AdvisorPanel
            locationId={locationId}
            tz={tz}
            dateStr={dateStr}
            compact
            // Lets the one-tap questions match the night: gaps and
            // cancellations under cloud, targets and timing when it's clear.
            context={{
              cloudPercent: night?.cloud_cover_percent ?? null,
              clearHours: data?.clear_hours ?? 0,
              moonIllumination: night?.moon_illumination ?? null,
              moonUpFraction: night?.moon_up_fraction ?? null,
            }}
          />
        </div>
      )}

      {/* Headline column beside the forecast chart — the chart fills space
          that was previously empty and answers "when does it clear?", which
          the nightly average can't. */}
      <div
        className="col-2"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
          gap: "1.5rem",
          alignItems: "start",
          // The conclusion above is separated from the evidence below by a
          // rule and space, now that a tinted box no longer does that job.
          marginTop: "1.15rem",
          paddingTop: "1.15rem",
          borderTop: line.hairline,
        }}
      >
        <div>
          {night?.conditions_summary && (
            <div
              style={{
                fontSize: fontSize.body,
                color: text.secondary,
                marginTop: "0.45rem",
              }}
            >
              {night.conditions_summary}.
            </div>
          )}

          {night && (
            <div style={{ marginTop: "0.9rem" }}>
              {/* On a washout the darkest hours are still the darkest hours,
                  but calling them "best" reads as a recommendation the data
                  doesn't support — so the label softens with the verdict. */}
              <div style={{ fontSize: fontSize.small, color: text.muted }}>
                {night.conditions === "poor"
                  ? "Best of a poor night"
                  : "Best observing window"}
              </div>
              <div
                style={{
                  fontSize: fontSize.title,
                  fontWeight: 700,
                  color: night.dark_start ? text.primary : text.secondary,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.25,
                }}
              >
                {windowText}
              </div>
            </div>
          )}

          {/* The window stated above, drawn: twilight shading into full
              darkness, the clear gap on the same axis, moonset at its real
              time. It sits under the window text because that's the sentence
              it illustrates — and it replaces the three separate Sunset /
              Sunrise / Moon chips that made the reader assemble this
              picture themselves. */}
          {night && (
            <NightTrack
              sunset={night.sunset}
              darkStart={night.dark_start}
              darkEnd={night.dark_end}
              sunrise={night.sunrise}
              clearFrom={data?.clear_from_local}
              clearTo={data?.clear_to_local}
              moonsetLocal={data?.moonset_local}
              moonIllumination={night.moon_illumination}
              moonUpFraction={night.moon_up_fraction}
              tz={tz}
            />
          )}
        </div>

        {data && data.hourly_cloud.length > 0 && (
          <CloudTimeline
            points={data.hourly_cloud}
            meanPercent={night?.cloud_cover_percent ?? null}
            trend={data.cloud_trend}
            clearFrom={data.clear_from_local}
            clearTo={data.clear_to_local}
          />
        )}
      </div>

      {/* Mirrors the real layout: verdict line, then the two columns. The
          page doesn't jump when the data lands. */}
      {loading && (
        <div style={{ marginTop: "1rem" }} aria-hidden>
          <div className="skeleton" style={{ height: 26, width: "58%", borderRadius: 8 }} />
          <div
            className="skeleton"
            style={{ height: 15, width: "76%", borderRadius: 8, marginTop: "0.6rem" }}
          />
          <div
            className="col-2"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.15fr) minmax(0, 1fr)",
              gap: "1.5rem",
              marginTop: "1.3rem",
            }}
          >
            <div className="skeleton" style={{ height: 150, borderRadius: 12 }} />
            <div className="skeleton" style={{ height: 150, borderRadius: 12 }} />
          </div>
        </div>
      )}
      {loading && (
        <span
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0 0 0 0)",
          }}
        >
          Reading the sky
        </span>
      )}
      {error && (
        <div style={{ color: "#fca5a5", fontSize: fontSize.body, marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <div style={{ marginTop: "1.2rem" }}>
          {/* "Visible" not "Top" — these are what's above the horizon, and
              the rating on each says whether it's worth pointing at. */}
          <div
            style={{
              fontSize: fontSize.section,
              fontWeight: 600,
              marginBottom: "0.15rem",
            }}
          >
            Visible targets
          </div>
          <div
            style={{
              fontSize: fontSize.small,
              color: text.muted,
              marginBottom: "0.6rem",
            }}
          >
            Above the horizon at {fmtLocalInput(data.sample_time_local)}
            {night?.dark_start ? ", an hour into full darkness" : ""}
            {allPoor ? ". Poor viewing expected." : ""}
          </div>

          {visible.length === 0 ? (
            <div style={{ fontSize: fontSize.body, color: text.secondary }}>
              Nothing on the preset list is above the horizon at that time. Try
              another night.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
                gap: "0.55rem",
              }}
            >
              {visible.map((t) => {
                const rating = t.suitability
                  ? SUITABILITY_LABELS[t.suitability]
                  : null;
                return (
                  <div key={t.name} style={targetCardStyle}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
                      {/* No colour override: each glyph carries its own hue,
                          which is the whole point of the duotone set. */}
                      <span aria-hidden style={{ marginTop: "0.1rem" }}>
                        {KIND_ICONS[t.kind]}
                      </span>
                      <strong style={{ fontSize: fontSize.body, lineHeight: 1.3 }}>
                        {t.name}
                      </strong>
                    </div>

                    {rating && (
                      <div
                        style={{
                          fontSize: fontSize.small,
                          fontWeight: 700,
                          color: rating.color,
                        }}
                      >
                        {rating.label}
                        {t.suitability_reason ? (
                          <span
                            style={{ fontWeight: 400, color: text.muted }}
                          >{` · ${t.suitability_reason}`}</span>
                        ) : null}
                      </div>
                    )}

                    <div style={{ fontSize: fontSize.small, color: text.secondary }}>
                      {Math.round(t.altitude_deg)}° high · {degToCompass(t.azimuth_deg)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onPlan(t.name, data.sample_time_local)}
                      style={{ ...btnPrimarySm, marginTop: "0.15rem", justifySelf: "start" }}
                    >
                      Plan session
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {hiddenCount > 0 && (
            <div style={{ fontSize: fontSize.small, color: text.muted, marginTop: "0.7rem" }}>
              {hiddenCount} other target{hiddenCount === 1 ? " is" : "s are"} below the
              horizon or washed out at that time.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
