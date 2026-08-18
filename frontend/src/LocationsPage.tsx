// src/LocationsPage.tsx
//
// Saved observing sites, presented as places you'd choose between rather
// than database rows. Each card answers "where is it, how does it look
// tonight, and when is it next usable?" — coordinates and timezone move
// behind Edit, because nobody picks an observing site by reading decimals.
import type React from "react";
import { useEffect, useState } from "react";
import api from "./api";
import { ChevronRightIcon } from "./icons";
import {
  btnDangerIcon,
  btnPrimarySm,
  btnSecondarySm,
  card,
  field,
  fontSize,
  line,
  pillShape,
  surface,
  text,
  verdictStyles,
} from "./theme";

type Verdict = "good" | "fair" | "poor";

export interface SavedLocation {
  id: number;
  name: string;
  region?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string | null;
  notes?: string | null;
}

type Forecast = {
  location_id: number;
  conditions?: Verdict | null;
  cloud_cover_percent?: number | null;
  dark_start_local?: string | null;
  dark_end_local?: string | null;
  clear_from_local?: string | null;
  clear_to_local?: string | null;
  clear_hours: number;
  distance_km?: number | null;
  score?: number | null;
  next_clear_date?: string | null;
  next_clear_weekday?: string | null;
  next_clear_from_local?: string | null;
  next_clear_to_local?: string | null;
};

interface Props {
  locations: SavedLocation[];
  currentLocationId: number | null;
  sessionCounts: (locationId: number) => { planned: number; completed: number };
  dateStr: string;
  tz: string;
  onUseForPlanning: (id: number) => void;
  onAdd: () => void;
  onSave: (id: number, patch: Partial<SavedLocation>) => Promise<void>;
  onDelete: (id: number) => void;
}

type SortMode = "current" | "best" | "near" | "az";

const SORTS: { id: SortMode; label: string }[] = [
  { id: "current", label: "Current first" },
  { id: "best", label: "Best conditions" },
  { id: "near", label: "Nearest" },
  { id: "az", label: "A–Z" },
];

const VERDICT_WORD: Record<Verdict, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
};

function nightLabel(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function to12h(hhmm?: string | null) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Default order puts the site you're planning from first and everything else
// by how good its sky is — an alphabetical or insertion order buries the two
// entries that actually matter tonight.
function sortLocations(
  locations: SavedLocation[],
  forecasts: Record<number, Forecast>,
  currentId: number | null,
  mode: SortMode,
): SavedLocation[] {
  const score = (l: SavedLocation) => forecasts[l.id]?.score ?? -Infinity;
  const dist = (l: SavedLocation) => forecasts[l.id]?.distance_km ?? Infinity;
  const rows = [...locations];

  switch (mode) {
    case "best":
      return rows.sort((a, b) => score(b) - score(a));
    case "near":
      return rows.sort((a, b) => dist(a) - dist(b));
    case "az":
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return rows.sort((a, b) => {
        if (a.id === currentId) return -1;
        if (b.id === currentId) return 1;
        return score(b) - score(a);
      });
  }
}

// Both states are written out in full rather than spreading a base and
// overriding with `undefined`. React treats an undefined longhand as "clear
// this property", so `{...btnSecondarySm, borderColor: undefined}` wiped the
// border colour the shorthand had just set — which is why the unselected
// options rendered as dim, borderless text.
// Compact filters keep the capsule: they're a segmented choice, not an
// action, and the shape is what distinguishes them from the buttons below.
const sortButtonOff: React.CSSProperties = {
  ...btnSecondarySm,
  ...pillShape,
  border: "1px solid transparent",
  color: text.secondary,
  background: surface.inset,
};

const sortButtonOn: React.CSSProperties = {
  ...btnSecondarySm,
  ...pillShape,
  border: line.focus,
  color: "#dbeafe",
  background: "rgba(59,130,246,0.22)",
  fontWeight: 600,
};

// Outline reserved for the site you're planning from; everything else is
// contained by tint and spacing alone.

/** "HH:MM" as minutes past noon, so an evening and the small hours of the
 *  following morning sort in the order they actually happen. */
function nightMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const mins = h * 60 + m;
  return h < 12 ? mins + 24 * 60 : mins;
}

/** One site's night, drawn on an axis shared by every row.
 *
 * This is the thing a list of saved sites should be able to answer and
 * couldn't: not just "how cloudy is each one", but *when* each one is usable.
 * Reading four pairs of timestamps to work out that one site clears early and
 * another clears at 3am is exactly the arithmetic a picture removes. Because
 * every row is drawn against the same start and end, the bars line up and the
 * comparison is a vertical scan.
 */
function NightBar({
  forecast,
  axisStart,
  axisEnd,
}: {
  forecast?: Forecast;
  axisStart: number;
  axisEnd: number;
}) {
  const span = axisEnd - axisStart;
  if (!forecast?.dark_start_local || !forecast.dark_end_local || span <= 0) {
    return null;
  }

  const pct = (mins: number) =>
    Math.max(0, Math.min(100, ((mins - axisStart) / span) * 100));

  const darkFrom = pct(nightMinutes(forecast.dark_start_local));
  const darkTo = pct(nightMinutes(forecast.dark_end_local));

  let clear: { from: number; to: number } | null = null;
  if (forecast.clear_from_local && forecast.clear_to_local) {
    const a = pct(nightMinutes(forecast.clear_from_local));
    const b = pct(nightMinutes(forecast.clear_to_local));
    if (b > a) clear = { from: a, to: b };
  }

  return (
    <div
      aria-hidden
      title={
        `Dark ${forecast.dark_start_local} to ${forecast.dark_end_local}` +
        (forecast.clear_from_local
          ? `, clear ${forecast.clear_from_local} to ${forecast.clear_to_local}`
          : ", no clear window")
      }
      style={{ position: "relative", height: 4, marginTop: "0.4rem" }}
    >
      {/* The dark window this site actually gets */}
      <div
        style={{
          position: "absolute",
          left: `${darkFrom}%`,
          width: `${Math.max(0, darkTo - darkFrom)}%`,
          top: 0,
          height: 4,
          borderRadius: 2,
          background: "rgba(148,163,184,0.20)",
        }}
      />
      {/* The part of it that is forecast usable */}
      {clear && (
        <div
          className="grow-x"
          style={{
            position: "absolute",
            left: `${clear.from}%`,
            width: `${Math.max(1.5, clear.to - clear.from)}%`,
            top: 0,
            height: 4,
            borderRadius: 2,
            background: "#60a5fa",
          }}
        />
      )}
    </div>
  );
}

const rowStyle = (current: boolean): React.CSSProperties => ({
  borderRadius: 14,
  border: current ? line.focus : "1px solid transparent",
  background: current ? "rgba(59,130,246,0.1)" : surface.inset,
  padding: "0.6rem 0.9rem",
});

export default function LocationsPage({
  locations,
  currentLocationId,
  sessionCounts,
  dateStr,
  tz,
  onUseForPlanning,
  onAdd,
  onSave,
  onDelete,
}: Props) {
  const [forecasts, setForecasts] = useState<Record<number, Forecast>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [tzDraft, setTzDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [sort, setSort] = useState<SortMode>("current");

  // Every site's outlook for the selected night, including when a clouded-out
  // site is next usable — that's the question a saved location exists to
  // answer, and it shouldn't need a button.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ locations: Forecast[] }>("/targets/compare", {
          params: {
            date_local: dateStr,
            reference_location_id: currentLocationId ?? undefined,
            tz,
            include_next_clear: true,
          },
        });
        if (cancelled) return;
        const map: Record<number, Forecast> = {};
        for (const f of res.data.locations) map[f.location_id] = f;
        setForecasts(map);
      } catch {
        if (!cancelled) setForecasts({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateStr, tz, currentLocationId, locations.length]);

  function startEdit(loc: SavedLocation) {
    setEditingId(loc.id);
    setExpandedId(loc.id);
    setNameDraft(loc.name);
    setNotesDraft(loc.notes ?? "");
    setTzDraft(loc.timezone ?? "");
  }

  async function save(id: number) {
    setSaving(true);
    try {
      await onSave(id, {
        name: nameDraft.trim() || undefined,
        notes: notesDraft.trim() || null,
        timezone: tzDraft.trim() || null,
      });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  // One axis for every row, spanning the earliest darkness to the latest.
  // Per-row axes would each be full-width and the bars would tell you nothing
  // by comparison, which is the only reason to draw them.
  const bounds = Object.values(forecasts).flatMap((f) =>
    f.dark_start_local && f.dark_end_local
      ? [nightMinutes(f.dark_start_local), nightMinutes(f.dark_end_local)]
      : [],
  );
  const axisStart = bounds.length ? Math.min(...bounds) : 0;
  const axisEnd = bounds.length ? Math.max(...bounds) : 0;

  return (
    <section style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          marginBottom: "0.9rem",
        }}
      >
        <div>
          <h3 style={{ fontSize: fontSize.section, fontWeight: 600, margin: 0 }}>
            Observing Locations
          </h3>
          {/* These forecasts follow the Planner's date. Name the night, or
              nobody realises the numbers move when that date does. */}
          {/* Which night these forecasts describe is load-bearing, not a
              caption — it reads at body size. */}
          <div style={{ fontSize: fontSize.body, color: text.secondary, marginTop: "0.2rem" }}>
            Conditions for {nightLabel(dateStr)}
          </div>
        </div>
        <button type="button" onClick={onAdd} style={btnPrimarySm}>
          + Add location
        </button>
      </div>

      {locations.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            flexWrap: "wrap",
            marginBottom: "0.85rem",
          }}
        >
          <span style={{ fontSize: fontSize.small, color: text.secondary }}>Sort</span>
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={sort === s.id}
              onClick={() => setSort(s.id)}
              style={sort === s.id ? sortButtonOn : sortButtonOff}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {locations.length === 0 && (
        <div style={{ fontSize: fontSize.body, color: text.secondary }}>
          No saved sites yet. Add one to start planning.
        </div>
      )}

      <div style={{ display: "grid", gap: "0.6rem" }}>
        {sortLocations(locations, forecasts, currentLocationId, sort).map((loc) => {
          const f = forecasts[loc.id];
          const isCurrent = loc.id === currentLocationId;
          const counts = sessionCounts(loc.id);
          const v = f?.conditions ? verdictStyles[f.conditions] : null;
          const expanded = expandedId === loc.id;
          const editing = editingId === loc.id;

          return (
            <div key={loc.id} style={rowStyle(isCurrent)}>
              {/* Selecting a row expands it; it does NOT change where you're
                  planning from — that's the explicit action below. */}
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : loc.id)}
                aria-expanded={expanded}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: text.primary,
                  font: "inherit",
                }}
              >
                {/* Two rows, identity left and forecast right: comparing
                    sites becomes one vertical scan down the right edge, and
                    the card is half the height it was as five stacked lines. */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    columnGap: "1rem",
                    rowGap: "0.15rem",
                    alignItems: "baseline",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    {/* A visible affordance: without it the card reads as a
                        static row and nobody discovers the actions. */}
                    <span
                      aria-hidden
                      style={{
                        color: text.muted,
                        display: "inline-flex",
                        transform: expanded ? "rotate(90deg)" : "none",
                        transition: "transform 140ms ease",
                      }}
                    >
                      <ChevronRightIcon size={14} />
                    </span>
                    <strong style={{ fontSize: fontSize.body }}>{loc.name}</strong>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: fontSize.small,
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#93c5fd",
                          background: "rgba(147,197,253,0.14)",
                          ...pillShape,
                          padding: "0.1rem 0.45rem",
                        }}
                      >
                        Current
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: fontSize.body,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f ? (
                      <>
                        <span style={{ color: v ? v.color : text.muted, fontWeight: 700 }}>
                          {f.conditions ? VERDICT_WORD[f.conditions] : "No forecast"}
                        </span>
                        {f.cloud_cover_percent != null && (
                          <span style={{ color: text.secondary }}>
                            {` · ${f.cloud_cover_percent}% cloud`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: text.muted }}>Checking…</span>
                    )}
                  </div>

                  <div style={{ fontSize: fontSize.small, color: text.secondary, minWidth: 0 }}>
                    {[loc.region, `${counts.planned} planned · ${counts.completed} completed`]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>

                  {/* Tonight's window, or if it's a washout, when it's next on */}
                  <div
                    style={{
                      fontSize: fontSize.small,
                      color: text.secondary,
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f?.clear_from_local
                      ? `clear ${to12h(f.clear_from_local)} – ${to12h(f.clear_to_local)}`
                      : f
                        ? f.next_clear_weekday
                          ? `next: ${f.next_clear_weekday} ${to12h(f.next_clear_from_local)}`
                          : "no clear night this week"
                        : ""}
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <NightBar forecast={f} axisStart={axisStart} axisEnd={axisEnd} />
                  </div>
                </div>
              </button>

              {expanded && (
                <div style={{ marginTop: "0.75rem" }}>
                  {!editing ? (
                    <>
                      {loc.notes && (
                        <div style={{ fontSize: fontSize.small, color: text.secondary }}>
                          {loc.notes}
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                          marginTop: "0.7rem",
                          alignItems: "center",
                        }}
                      >
                        {/* The current site already plans from here, so its
                            primary action is to go look — not to re-select. */}
                        <button
                          type="button"
                          onClick={() => onUseForPlanning(loc.id)}
                          style={btnPrimarySm}
                        >
                          {isCurrent ? "View in Planner" : "Use in Planner"}
                        </button>
                        <button type="button" onClick={() => startEdit(loc)} style={btnSecondarySm}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(loc.id)}
                          aria-label={`Remove ${loc.name}`}
                          style={{ ...btnDangerIcon, marginLeft: "auto", width: "auto", padding: "0.3rem 0.7rem" }}
                        >
                          Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      <label style={{ fontSize: fontSize.small, color: text.secondary }}>
                        Name
                        <input
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          style={{ ...field, marginTop: "0.2rem" }}
                        />
                      </label>
                      <label style={{ fontSize: fontSize.small, color: text.secondary }}>
                        Notes
                        <input
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          style={{ ...field, marginTop: "0.2rem" }}
                        />
                      </label>

                      {/* Coordinates and timezone live here rather than on the
                          card: needed occasionally, never when choosing. */}
                      <details>
                        <summary
                          style={{
                            fontSize: fontSize.small,
                            color: text.muted,
                            cursor: "pointer",
                          }}
                        >
                          Advanced details
                        </summary>
                        <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.4rem" }}>
                          <div style={{ fontSize: fontSize.small, color: text.secondary }}>
                            Coordinates: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                          </div>
                          <label style={{ fontSize: fontSize.small, color: text.secondary }}>
                            Timezone
                            <input
                              value={tzDraft}
                              onChange={(e) => setTzDraft(e.target.value)}
                              placeholder="e.g. America/Toronto"
                              style={{ ...field, marginTop: "0.2rem" }}
                            />
                          </label>
                        </div>
                      </details>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="button"
                          onClick={() => save(loc.id)}
                          disabled={saving}
                          style={btnPrimarySm}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          style={btnSecondarySm}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
