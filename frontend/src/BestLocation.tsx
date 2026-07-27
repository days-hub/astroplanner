// src/BestLocation.tsx
//
// The app already knows how every saved site looks tonight, so it shouldn't
// make the user press a button to find out. This evaluates them whenever the
// night or the selected site changes and states the answer; the full table
// stays available behind a disclosure for people who want the detail.
import { useEffect, useState } from "react";
import api from "./api";
import { btnSecondarySm, card, fontSize, text, verdictStyles } from "./theme";

type Verdict = "good" | "fair" | "poor";

type LocationComparison = {
  location_id: number;
  name: string;
  distance_km?: number | null;
  conditions?: Verdict | null;
  cloud_cover_percent?: number | null;
  clear_from_local?: string | null;
  clear_to_local?: string | null;
  clear_hours: number;
  score: number;
};

type Recommendation = {
  status: "stay" | "switch" | "none_usable";
  location_id?: number | null;
  reason: string;
};

type CompareResponse = {
  date: string;
  timezone: string;
  recommendation?: Recommendation | null;
  locations: LocationComparison[];
};

interface Props {
  dateStr: string;
  tz: string;
  selectedLocationId: number;
  /** Cached results are lifted so the location dropdown can show cloud % */
  onResults?: (rows: LocationComparison[]) => void;
  onPickLocation: (id: number) => void;
}

function to12h(hhmm?: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const VERDICT_WORD: Record<Verdict, string> = {
  good: "Excellent",
  fair: "Fair",
  poor: "Poor",
};

const cellStyle: React.CSSProperties = {
  padding: "0.5rem 0.6rem",
  fontSize: fontSize.small,
  color: text.secondary,
  borderTop: "1px solid rgba(148,163,184,0.14)",
};

const headStyle: React.CSSProperties = {
  padding: "0 0.6rem 0.35rem",
  fontSize: "0.7rem",
  textTransform: "uppercase",
  letterSpacing: "0.07em",
  color: text.muted,
  textAlign: "left",
  fontWeight: 600,
};

export default function BestLocation({
  dateStr,
  tz,
  selectedLocationId,
  onResults,
  onPickLocation,
}: Props) {
  const [rows, setRows] = useState<LocationComparison[] | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get<CompareResponse>("/targets/compare", {
          params: {
            date_local: dateStr,
            reference_location_id: selectedLocationId,
            tz,
          },
        });
        if (cancelled) return;
        setRows(res.data.locations);
        setRec(res.data.recommendation ?? null);
        onResults?.(res.data.locations);
      } catch {
        if (!cancelled) {
          setRows(null);
          setRec(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onResults is intentionally excluded — it's a callback identity, not data
  }, [dateStr, tz, selectedLocationId]);

  if (loading && !rows) {
    return (
      <section style={card}>
        <div style={{ fontSize: fontSize.body, color: text.secondary }}>
          Checking your saved locations…
        </div>
      </section>
    );
  }
  if (!rows || rows.length < 2) return null;

  // The backend decides what to recommend and why — it has the scores and
  // the distance threshold. This only renders the answer.
  const best = rows[0]; // already ranked by sky quality alone
  const recommended =
    rows.find((r) => r.location_id === rec?.location_id) ?? best;
  const alreadyBest = rec?.status !== "switch";
  const v = recommended.conditions ? verdictStyles[recommended.conditions] : null;

  const headline =
    rec?.status === "none_usable"
      ? "No saved site offers good conditions"
      : rec?.status === "switch"
        ? `A better saved site is available: ${recommended.name}`
        : `${recommended.name} is your best site tonight`;

  const detail = rec?.reason ?? "";

  return (
    <section style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.07em", color: text.muted }}>
            {rec?.status === "switch" ? "Consider moving" : "Saved locations"}
          </div>
          <div
            style={{
              fontSize: fontSize.section,
              fontWeight: 700,
              color: rec?.status === "none_usable" ? text.primary : v ? v.color : text.primary,
              marginTop: "0.15rem",
            }}
          >
            {headline}
          </div>
          <div style={{ fontSize: fontSize.body, color: text.secondary, marginTop: "0.2rem" }}>
            {detail}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {!alreadyBest && (
            <button
              type="button"
              onClick={() => onPickLocation(recommended.location_id)}
              style={btnSecondarySm}
            >
              Switch to {recommended.name}
            </button>
          )}
          <button type="button" onClick={() => setShowAll((s) => !s)} style={btnSecondarySm}>
            {showAll ? "Hide all locations" : "View all locations"}
          </button>
        </div>
      </div>

      {showAll && (
        <>
          <div style={{ overflowX: "auto", marginTop: "0.9rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr>
                  <th style={headStyle}>Location</th>
                  <th style={headStyle}>Distance</th>
                  <th style={headStyle}>Clear window</th>
                  <th style={headStyle}>Sky</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const lv = l.conditions ? verdictStyles[l.conditions] : null;
                  return (
                    <tr key={l.location_id}>
                      <td style={{ ...cellStyle, color: text.primary }}>
                        <button
                          type="button"
                          onClick={() => onPickLocation(l.location_id)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            color: text.primary,
                            font: "inherit",
                            fontWeight: 600,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          {l.name}
                        </button>
                        {l.location_id === selectedLocationId && (
                          <span style={{ color: text.muted, fontWeight: 400 }}> · current</span>
                        )}
                      </td>
                      <td style={cellStyle}>
                        {l.distance_km == null
                          ? "—"
                          : l.distance_km < 1
                            ? "here"
                            : `${Math.round(l.distance_km)} km`}
                      </td>
                      <td style={cellStyle}>
                        {l.clear_from_local
                          ? `${to12h(l.clear_from_local)} – ${to12h(l.clear_to_local)}`
                          : "None"}
                      </td>
                      <td style={cellStyle}>
                        <span style={{ color: lv ? lv.color : text.muted, fontWeight: 700 }}>
                          {l.conditions ? VERDICT_WORD[l.conditions] : "—"}
                        </span>
                        {l.cloud_cover_percent != null && (
                          <span style={{ color: text.muted }}>{` · ${l.cloud_cover_percent}% cloud`}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: "0.72rem", color: text.muted, marginTop: "0.6rem" }}>
            Distances are straight-line from your current location, not driving
            distance.
          </div>
        </>
      )}
    </section>
  );
}
