// src/ContextBar.tsx
//
// One observing context for the whole page: location · date · timezone.
// Tonight, the Sky advisor, and the session form all read from this, so the
// controls live here once instead of being repeated in each card.
import type React from "react";
import { field, fontSize, line, selectField, surface, text } from "./theme";

interface LocationOption {
  id: number;
  name: string;
  timezone?: string | null;
}

interface Props {
  locations: LocationOption[];
  selectedLocationId: number | null;
  onSelectLocation: (id: number) => void;
  dateStr: string;
  onDateChange: (date: string) => void;
  tz: string;
  /** Cloud cover per site for the selected night, so the comparison is
   *  visible at the moment the choice is being made. */
  forecasts?: { location_id: number; cloud_cover_percent?: number | null }[];
}

const barStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "1.1rem",
  flexWrap: "wrap",
  borderRadius: 14,
  border: line.edge,
  background: surface.raised,
  padding: "0.65rem 0.9rem",
  marginBottom: "1rem",
};

const labelStyle: React.CSSProperties = {
  fontSize: fontSize.small,
  color: text.muted,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const separator: React.CSSProperties = {
  color: "rgba(148,163,184,0.4)",
  fontSize: fontSize.body,
};

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function ContextBar({
  locations,
  selectedLocationId,
  onSelectLocation,
  dateStr,
  onDateChange,
  tz,
  forecasts = [],
}: Props) {
  const cloudFor = (id: number) =>
    forecasts.find((f) => f.location_id === id)?.cloud_cover_percent;

  return (
    <div style={barStyle}>
      {/* Two labelled groups rather than one run of controls: location leads,
          and the night carries its timezone so the zone reads as belonging to
          the date rather than floating at the end of the bar. */}
      <div style={{ display: "grid", gap: "0.15rem", minWidth: 0, flex: "1 1 11rem" }}>
        <span style={labelStyle}>Observing from</span>
        <select
          value={selectedLocationId ?? ""}
          onChange={(e) => e.target.value && onSelectLocation(Number(e.target.value))}
          aria-label="Observing location"
          style={{
            ...selectField,
            // width:auto made the control size itself to its longest option
            // ("Torrance Barrens Dark-Sky Preserve"), which on a phone was
            // wider than the screen — and because the container was sized by
            // the select in turn, a percentage max-width couldn't rein it in.
            // Filling a bounded parent breaks that circularity.
            width: "100%",
            fontWeight: 700,
            fontSize: "1rem",
            maxWidth: "24rem",
          }}
        >
          {locations.map((loc) => {
            const cloud = cloudFor(loc.id);
            return (
              <option key={loc.id} value={loc.id}>
                {loc.name}
                {cloud != null ? ` · ${cloud}% cloud` : ""}
              </option>
            );
          })}
        </select>
      </div>

      <span style={separator} aria-hidden>
        |
      </span>

      <div style={{ display: "grid", gap: "0.15rem", minWidth: 0 }}>
        <span style={labelStyle}>Night of</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            type="date"
            value={dateStr}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            aria-label="Night to plan"
            style={{ ...field, width: "auto", fontSize: fontSize.body }}
          />
          <span style={{ fontSize: fontSize.body, color: text.secondary }}>
            {prettyDate(dateStr)}
          </span>
          <span style={{ fontSize: "0.72rem", color: text.muted }}>({tz})</span>
        </div>
      </div>
    </div>
  );
}
