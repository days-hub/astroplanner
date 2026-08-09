// src/AddLocationDrawer.tsx
//
// Search-first location entry. Typing coordinates by hand is a data-entry
// chore that has nothing to do with astronomy, so the normal path is: search
// a place, pick the match, confirm. The app guesses — ranked toward wherever
// you're currently planning, so "Torrance" finds the Ontario dark-sky
// preserve before the California city — but it never silently commits the
// guess: the confirm step always shows what will be saved.
import { useEffect, useRef, useState } from "react";
import api, { apiErrorMessage } from "./api";
import Drawer from "./Drawer";
import { MapPinIcon } from "./icons";
import { btnPrimary, btnSecondarySm, field, fontSize, text } from "./theme";

type PlaceMatch = {
  name: string;
  region?: string | null;
  latitude: number;
  longitude: number;
  timezone?: string | null;
  /** Set when the backend had to search for fewer words than were typed */
  matched_query?: string | null;
};

export type NewLocation = {
  name: string;
  // The geocoder's "Ontario, Canada" line, kept so the Locations page can
  // say where a site is without making anyone read coordinates.
  region: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  notes: string | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
  /** Bias search results toward where the user is currently planning */
  nearLat?: number | null;
  nearLon?: number | null;
  onCreate: (loc: NewLocation, useForPlanning: boolean) => Promise<void>;
}

const resultRowStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "rgba(2,6,23,0.35)",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 12,
  padding: "0.55rem 0.7rem",
  cursor: "pointer",
  color: text.primary,
  font: "inherit",
};

export default function AddLocationDrawer({
  open,
  onClose,
  nearLat,
  nearLon,
  onCreate,
}: Props) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PlaceMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<PlaceMatch | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [useForPlanning, setUseForPlanning] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setMatches([]);
      setChosen(null);
      setName("");
      setNotes("");
      setError(null);
    }
  }, [open]);

  // Debounced so a fast typist doesn't fire a request per keystroke
  useEffect(() => {
    if (chosen) return;
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get<PlaceMatch[]>("/geocode/search", {
          params: {
            q,
            near_lat: nearLat ?? undefined,
            near_lon: nearLon ?? undefined,
          },
        });
        if (id === reqId.current) setMatches(res.data);
      } catch {
        if (id === reqId.current) setMatches([]);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query, chosen, nearLat, nearLon]);

  function choose(m: PlaceMatch) {
    setChosen(m);
    setName(m.name);
    setError(null);
  }

  async function save() {
    if (!chosen) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate(
        {
          name: name.trim() || chosen.name,
          region: chosen.region ?? null,
          latitude: chosen.latitude,
          longitude: chosen.longitude,
          timezone: chosen.timezone ?? null,
          notes: notes.trim() || null,
        },
        useForPlanning,
      );
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't save that location."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} title="Add observing location" onClose={onClose}>
      {!chosen ? (
        <>
          <label style={{ display: "block", fontSize: fontSize.small, color: text.secondary }}>
            Search for a place
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Algonquin Provincial Park, Manitoulin, Sydney"
              style={{ ...field, marginTop: "0.25rem" }}
            />
          </label>

          <div style={{ marginTop: "0.9rem", display: "grid", gap: "0.4rem" }}>
            {searching && (
              <div style={{ fontSize: fontSize.small, color: text.muted }}>Searching…</div>
            )}
            {!searching && query.trim().length >= 2 && matches.length === 0 && (
              <div style={{ fontSize: fontSize.small, color: text.muted }}>
                No matches. Search by place name alone — the lookup doesn't
                recognise a trailing country or province.
              </div>
            )}
            {matches.length > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  color: text.muted,
                }}
              >
                {/* Say so when we answered a narrower question than the one
                    asked, rather than passing the results off as exact. */}
                {matches[0].matched_query
                  ? `No exact match — showing results for “${matches[0].matched_query}”`
                  : "Suggested matches"}
              </div>
            )}
            {matches.map((m, i) => (
              <button
                key={`${m.name}-${m.latitude}-${i}`}
                type="button"
                onClick={() => choose(m)}
                style={resultRowStyle}
              >
                <div style={{ fontWeight: 600, fontSize: fontSize.body }}><MapPinIcon style={{ marginRight: "0.35rem", color: "#8fa0b5" }} />{m.name}</div>
                {m.region && (
                  <div style={{ fontSize: fontSize.small, color: text.secondary }}>
                    {m.region}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Confirm what will actually be saved — the guess is shown, not
              silently applied. */}
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(2,6,23,0.35)",
              padding: "0.7rem 0.8rem",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: fontSize.body }}>{chosen.name}</div>
            {chosen.region && (
              <div style={{ fontSize: fontSize.small, color: text.secondary }}>
                {chosen.region}
              </div>
            )}
            <div style={{ fontSize: fontSize.small, color: text.muted, marginTop: "0.3rem" }}>
              {chosen.latitude.toFixed(2)}, {chosen.longitude.toFixed(2)}
              {chosen.timezone ? ` · ${chosen.timezone}` : ""}
            </div>
            <button
              type="button"
              onClick={() => setChosen(null)}
              style={{ ...btnSecondarySm, marginTop: "0.6rem" }}
            >
              Search again
            </button>
          </div>

          <label
            style={{
              display: "block",
              marginTop: "0.9rem",
              fontSize: fontSize.small,
              color: text.secondary,
            }}
          >
            Location name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ ...field, marginTop: "0.25rem" }}
            />
          </label>

          <label
            style={{
              display: "block",
              marginTop: "0.7rem",
              fontSize: fontSize.small,
              color: text.secondary,
            }}
          >
            Notes
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. worth the drive for faint targets"
              style={{ ...field, marginTop: "0.25rem" }}
            />
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.9rem",
              fontSize: fontSize.body,
              color: text.primary,
            }}
          >
            <input
              type="checkbox"
              checked={useForPlanning}
              onChange={(e) => setUseForPlanning(e.target.checked)}
            />
            Use this as my current planning location
          </label>

          {error && (
            <div style={{ color: "#fca5a5", fontSize: fontSize.small, marginTop: "0.6rem" }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{ ...btnPrimary, width: "100%", marginTop: "1rem" }}
          >
            {saving ? "Adding…" : "Add location"}
          </button>
        </>
      )}
    </Drawer>
  );
}
