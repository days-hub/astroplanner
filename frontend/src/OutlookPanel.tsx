// src/OutlookPanel.tsx
//
// Seven-night outlook. The planner could already answer "what's up on this
// date", but finding a *good* night meant clicking through dates one at a
// time — this answers "which night should I go out?" directly, and clicking
// a night moves the whole page's context onto it.
import { useEffect, useState } from "react";
import api from "./api";
import { card, fontSize, line, pillShape, surface, text, verdictStyles } from "./theme";

type Verdict = "good" | "fair" | "poor";

type NightOutlook = {
  date: string;
  weekday: string;
  conditions?: Verdict | null;
  conditions_summary?: string | null;
  cloud_cover_percent?: number | null;
  dark_start_local?: string | null;
  dark_end_local?: string | null;
  clear_from_local?: string | null;
  clear_to_local?: string | null;
  clear_hours: number;
  moon_illumination: number;
  moonset_local?: string | null;
  temperature_c?: number | null;
  wind_kmh?: number | null;
  focus?: string | null;
  focus_summary?: string | null;
  best_targets: string[];
};

type OutlookResponse = {
  timezone: string;
  nights: NightOutlook[];
  best_date?: string | null;
};

interface Props {
  locationId: number;
  tz: string;
  /** Currently selected night, so it can be marked in the list */
  selectedDate: string;
  onPickDate: (date: string) => void;
}

const FOCUS_LABELS: Record<string, string> = {
  "deep-sky": "Deep-sky",
  mixed: "Mixed",
  planetary: "Planetary",
  none: "Not worth it",
};

function to12h(hhmm?: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function shortDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function OutlookPanel({
  locationId,
  tz,
  selectedDate,
  onPickDate,
}: Props) {
  const [data, setData] = useState<OutlookResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get<OutlookResponse>("/targets/outlook", {
          params: { location_id: locationId, nights: 7, tz },
        });
        if (!cancelled) setData(res.data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Couldn't load the outlook for this location.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [locationId, tz]);

  const best = data?.nights.find((n) => n.date === data.best_date) ?? null;

  return (
    <section style={card}>
      <h3 style={{ fontSize: fontSize.section, fontWeight: 600, margin: 0 }}>
        Next 7 nights
      </h3>
      <div
        style={{
          fontSize: fontSize.small,
          color: text.secondary,
          marginTop: "0.2rem",
        }}
      >
        Forecast during each night's dark window. Pick a night to plan it.
      </div>

      {/* A skeleton rather than a line of text: this fetch is the slowest on
          the page, and a first-time visitor's very first load is always cold.
          Showing the shape of what's coming reads as loading; a sentence in
          the middle of an empty card reads as broken. */}
      {loading && (
        <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.9rem" }} aria-hidden>
          <div className="skeleton" style={{ height: 86, borderRadius: 14 }} />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 38, borderRadius: 12 }} />
          ))}
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
          Checking the week ahead
        </span>
      )}
      {error && (
        <div style={{ color: "#fca5a5", fontSize: fontSize.body, marginTop: "0.9rem" }}>
          {error}
        </div>
      )}

      {/* The headline answer: which night to go out, stated up front */}
      {best && (
        <div
          style={{
            marginTop: "0.9rem",
            padding: "0.85rem 1rem",
            borderRadius: 14,
            background: verdictStyles[best.conditions ?? "fair"].background,
          }}
        >
          <div
            style={{
              fontSize: fontSize.body,
              fontWeight: 700,
              color: verdictStyles[best.conditions ?? "fair"].color,
            }}
          >
            Best upcoming night: {best.weekday}
          </div>
          <div style={{ fontSize: fontSize.body, color: text.primary, marginTop: "0.3rem" }}>
            {best.clear_from_local
              ? `Clear ${to12h(best.clear_from_local)} – ${to12h(best.clear_to_local)}`
              : `Dark ${to12h(best.dark_start_local)} – ${to12h(best.dark_end_local)}`}
            {best.cloud_cover_percent != null && ` · ${best.cloud_cover_percent}% cloud`}
            {best.wind_kmh != null && ` · ${Math.round(best.wind_kmh)} km/h wind`}
          </div>
          <div style={{ fontSize: fontSize.small, color: text.secondary, marginTop: "0.25rem" }}>
            Moon {Math.round(best.moon_illumination * 100)}%
            {best.moonset_local ? `, sets ${to12h(best.moonset_local)}` : ", up all night"}
            {best.focus_summary ? ` · ${best.focus_summary}` : ""}
          </div>
          {best.best_targets.length > 0 && (
            <div style={{ fontSize: fontSize.small, color: text.secondary, marginTop: "0.25rem" }}>
              Best for: {best.best_targets.join(", ")}
            </div>
          )}
        </div>
      )}

      {data && !data.best_date && !loading && (
        <div
          style={{
            marginTop: "0.9rem",
            fontSize: fontSize.body,
            color: text.secondary,
          }}
        >
          No night in the next week looks worth setting up for. Every night
          is forecast cloudy.
        </div>
      )}

      {data && (
        <div style={{ display: "grid", gap: "0.4rem", marginTop: "0.9rem" }}>
          {data.nights.map((n) => {
            const isSelected = n.date === selectedDate;
            const isBest = n.date === data.best_date;
            const v = n.conditions ? verdictStyles[n.conditions] : null;
            return (
              <button
                key={n.date}
                type="button"
                onClick={() => onPickDate(n.date)}
                aria-current={isSelected ? "true" : undefined}
                style={{
                  display: "grid",
                  // Fixed columns so the eye can scan one column down the
                  // week; the cloud figure is right-aligned tabular so 4%
                  // and 100% end at the same edge instead of wobbling.
                  gridTemplateColumns: "minmax(0, 7.5rem) 6.2rem minmax(0, 1fr)",
                  alignItems: "center",
                  gap: "0.75rem",
                  textAlign: "left",
                  padding: "0.55rem 0.7rem",
                  borderRadius: 12,
                  cursor: "pointer",
                  color: text.primary,
                  // Borderless by default: the recessed tint and the gap
                  // contain the row. An outline here means "selected", and
                  // only that — the transparent border keeps the geometry
                  // identical so rows don't shift by a pixel on selection.
                  border: isSelected ? line.focus : "1px solid transparent",
                  background: isSelected
                    ? "rgba(59,130,246,0.14)"
                    : surface.inset,
                }}
              >
                <span style={{ fontSize: fontSize.body, fontWeight: 600 }}>
                  {n.weekday.slice(0, 3)} {shortDate(n.date)}
                  {isBest && (
                    <span
                      style={{
                        marginLeft: "0.35rem",
                        ...pillShape,
                        fontSize: fontSize.small,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#6ee7b7",
                      }}
                    >
                      Best
                    </span>
                  )}
                </span>

                <span
                  style={{
                    fontSize: fontSize.small,
                    fontWeight: 700,
                    color: v ? v.color : text.muted,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {n.cloud_cover_percent != null
                    ? `${n.cloud_cover_percent}% cloud`
                    : "no forecast"}
                </span>

                <span
                  style={{
                    fontSize: fontSize.small,
                    color: text.secondary,
                    minWidth: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {n.clear_from_local
                    ? `Clear ${to12h(n.clear_from_local)} – ${to12h(n.clear_to_local)}`
                    : "No clear window"}
                  {n.focus && n.focus !== "none"
                    ? ` · ${FOCUS_LABELS[n.focus] ?? n.focus}`
                    : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
