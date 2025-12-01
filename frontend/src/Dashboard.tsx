import type React from "react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import api from "./api";
import BackgroundVideo from "./BackgroundVideo";
import WeatherIcon from "./WeatherIcon";

interface Props {
  onLogout: () => void;
}

interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string | null; 
  notes?: string | null;
}


interface Session {
  id: number;
  target_name: string;
  scheduled_start: string;
  location_id: number;
  status: string;
}
interface ObservationLog {
  id: number;
  notes: string;
  seeing?: string | null;
  transparency?: string | null;
  rating?: number | null;
}

interface WeatherInfo {
  description?: string | null;
  temperature?: number | null;
  wind_speed?: number | null;
  wind_direction?: number | null;
  is_day?: boolean | null;
  cloud_cover?: number | null;
  weather_code?: number | null;
}

const locationLeftColStyle: React.CSSProperties = {
  flex: 1,
  display: "grid",
  gap: "0.75rem",
  alignContent: "start",
};

const locationPanelStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(2,6,23,0.28)",
  padding: "0.85rem 0.9rem",
};

const panelTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  marginBottom: "0.5rem",
};

const tinyBtnStyle: React.CSSProperties = {
  borderRadius: 9999,
  border: "1px solid rgba(148,163,184,0.6)",
  padding: "0.25rem 0.7rem",
  background: "transparent",
  color: "#e5e7eb",
  fontSize: "0.78rem",
  cursor: "pointer",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  borderRadius: 10,
  border: "1px solid #374151",
  backgroundColor: "#020617",
  color: "#e5e7eb",
  fontSize: "0.85rem",
};

const hintBoxStyle: React.CSSProperties = {
  borderRadius: 14,
  border: "1px dashed rgba(148,163,184,0.35)",
  background: "rgba(15,23,42,0.35)",
  padding: "1rem",
  color: "#cbd5e1",
};


const appShellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 0% 0%, #1d283a 0, #020617 45%, #000 85%)",
  color: "#e5e7eb",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const appInnerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: "0 auto",
  padding: "2.5rem 1.5rem 3rem",
  display: "grid",
  gap: "1.5rem",
};
const metaLineStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#9ca3af",
  marginTop: "0.15rem",
};
const headerRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const pillStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "#a855f7",
};
const statusPillBase: React.CSSProperties = {
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  padding: "0.18rem 0.55rem",
  borderRadius: 9999,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(148,163,184,0.08)",
  color: "#cbd5e1",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
};

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  padding: "1rem 1.25rem",
  border: "1px solid rgba(148,163,184,0.35)",
  background: "rgba(15,23,42,0.92)",
  boxShadow: "0 18px 35px rgba(0,0,0,0.55)",
};
const weatherSubtitleStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#9ca3af",
  marginTop: "0.15rem",
};

const statGridStyle: React.CSSProperties = {
  marginTop: "0.75rem",
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "0.5rem",
};

const statChipStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(2,6,23,0.35)",
  padding: "0.45rem 0.6rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "0.75rem",
};
const panelHeaderRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  marginBottom: "0.6rem",
};

const chipGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "0.5rem",
  alignItems: "start",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#9ca3af",
};

const statValueStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  color: "#e5e7eb",
  fontWeight: 600,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  marginBottom: "0.75rem",
};
type VisibleTarget = {
  name: string;
  kind: "planet" | "moon" | "dso" | "star";
  altitude_deg: number;
  azimuth_deg: number;
  sun_altitude_deg: number;
  elongation_deg?: number | null;
  visible: boolean;
  reason?: string | null;
  score: number;
};
const iconDangerButtonSm: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  borderRadius: 9,
  border: "1px solid rgba(248,113,113,0.22)",
  background: "rgba(248,113,113,0.06)",
  color: "#fecaca",
  cursor: "pointer",
  padding: 0,
  fontSize: "0.95rem",
  lineHeight: 1,
};




const PRESET_TARGETS = [
  "Saturn",
  "Jupiter",
  "Mars",
  "Venus",
  "Moon",
  "Orion Nebula (M42)",
  "Andromeda Galaxy (M31)",
  "Pleiades (M45)",
  "Custom",
];
const SESSION_STATUSES = ["planned", "completed", "cancelled"] as const;
export default function Dashboard({ onLogout }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<ObservationLog[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [visibleTargets, setVisibleTargets] = useState<VisibleTarget[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState("");
  const [editCustomTarget, setEditCustomTarget] = useState("");
  const [editStart, setEditStart] = useState(""); // datetime-local string
  const [editStatus, setEditStatus] = useState("planned");
  const [editVisibleTargets, setEditVisibleTargets] = useState<VisibleTarget[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null,
  );
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    null,
  );
  const [hoveredLocationId, setHoveredLocationId] = useState<number | null>(null);
  const [hoveredSessionId, setHoveredSessionId] = useState<number | null>(null);
  const [editingLoc, setEditingLoc] = useState(false);
  const [locTzDraft, setLocTzDraft] = useState("");
  const [locNotesDraft, setLocNotesDraft] = useState("");
  const [locSaving, setLocSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New location form state
  const [newLocName, setNewLocName] = useState("");
  const [newLat, setNewLat] = useState("44.0");
  const [newLon, setNewLon] = useState("-79.0");
  const [newLocNotes, setNewLocNotes] = useState("");
  const [showAddLog, setShowAddLog] = useState(false);
  const [geocodeQuery, setGeocodeQuery] = useState("");
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [newTimezone, setNewTimezone] = useState<string>(""); // NEW

  // New session form state
  const [newTarget, setNewTarget] = useState("Saturn");
  const [customTarget, setCustomTarget] = useState("");
  const [newStart, setNewStart] = useState("");

    // New log form
  const [newLogNotes, setNewLogNotes] = useState("");
  const [newLogSeeing, setNewLogSeeing] = useState("");
  const [newLogTransparency, setNewLogTransparency] = useState("");
  const [newLogRating, setNewLogRating] = useState<number | "">("");

  // Edit-log state
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editSeeing, setEditSeeing] = useState("");
  const [editTransparency, setEditTransparency] = useState("");
  const [editRating, setEditRating] = useState<number | "">("");

  function statusPillStyle(status?: string): React.CSSProperties {
    const s = (status ?? "").toLowerCase();
    if (s === "planned") {
      return {
        ...statusPillBase,
        border: "1px solid rgba(59,130,246,0.35)",
        background: "rgba(59,130,246,0.15)",
        color: "#93c5fd",
      };
    }
    if (s === "completed") {
      return {
        ...statusPillBase,
        border: "1px solid rgba(34,197,94,0.35)",
        background: "rgba(34,197,94,0.14)",
        color: "#86efac",
      };
    }
    if (s === "cancelled") {
      return {
        ...statusPillBase,
        border: "1px solid rgba(248,113,113,0.35)",
        background: "rgba(248,113,113,0.12)",
        color: "#fca5a5",
      };
    }
    return statusPillBase;
  }
  function formatSessionTime(iso: string, tz: string) {
  const d = parseApiDate(iso);

  try {
    return d.toLocaleString(undefined, {
      timeZone: tz,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    // fallback if tz is invalid for any reason
    return d.toLocaleString();
  }
}
  function degToCompass(deg?: number | null) {
    if (deg == null || Number.isNaN(deg)) return null;
    const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    const idx = Math.round(((deg % 360) / 22.5)) % 16;
    return dirs[idx];
  }

  function weatherLabel(weather: WeatherInfo | null) {
    if (!weather) return "—";
    if (weather.description && weather.description.trim()) return weather.description;
    if (weather.weather_code != null) return `Code ${weather.weather_code}`;
    return "—";
  }
  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null;
  useEffect(() => {
    setEditingLoc(false);
    setLocTzDraft(selectedLocation?.timezone ?? "");
    setLocNotesDraft(selectedLocation?.notes ?? "");
  }, [selectedLocationId, selectedLocation?.timezone, selectedLocation?.notes]);


  async function handleUpdateSelectedLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLocation) return;

    setError(null);
    setLocSaving(true);
    try {
      const payload = {
        name: selectedLocation.name,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        timezone: locTzDraft.trim() ? locTzDraft.trim() : null,
        notes: locNotesDraft.trim() ? locNotesDraft.trim() : null,
      };

      const res = await api.put<Location>(
        `/locations/${selectedLocation.id}`,
        payload,
      );

      setLocations((prev) => prev.map((l) => (l.id === res.data.id ? res.data : l)));
      setEditingLoc(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update location.");
    } finally {
      setLocSaving(false);
    }
  }
  // Load locations + sessions
  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      setError(null);
      try {
        const [locRes, sessRes] = await Promise.all([
          api.get<Location[]>("/locations/"),
          api.get<Session[]>("/sessions/"),
        ]);
        setLocations(locRes.data);
        setSessions(sessRes.data);
        if (locRes.data.length > 0) {
          setSelectedLocationId(locRes.data[0].id);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load locations/sessions.");
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);


const tz =
  (selectedLocation?.timezone ?? "").trim() ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  "UTC";
const hasTime = Boolean(newStart);
const visibleNowCount = visibleTargets.filter((t) => t.visible).length;
useEffect(() => {
  async function loadTargets() {
    if (!selectedLocationId || !newStart) {
      setVisibleTargets([]);
      return;
    }

    try {
      const res = await api.get<VisibleTarget[]>("/targets/visible", {
        params: { location_id: selectedLocationId, when_local: newStart, tz },
      });
      setVisibleTargets(res.data);
    } catch (e: any) {
      console.error(e);
      const detail =
        e?.response?.data?.detail ??
        e?.response?.data ??
        e?.message ??
        "Unknown error";
      setError(`Failed to load targets: ${String(detail)}`); // ✅ show it
      setVisibleTargets([]);
    }
  }
  loadTargets();
}, [selectedLocationId, newStart, tz]);
  useEffect(() => {
  const visible = visibleTargets.filter((t) => t.visible).map((t) => t.name);

  // ✅ If nothing is visible at that time, force the user into Custom
  if (visible.length === 0) {
    if (newTarget !== "Custom") {
      setNewTarget("Custom");
      // optional: setCustomTarget("");
    }
    return;
  }

  // ✅ If current selection is no longer valid, pick the first visible
  if (newTarget !== "Custom" && !visible.includes(newTarget)) {
    setNewTarget(visible[0]);
  }
}, [visibleTargets, newTarget]);


  useEffect(() => {
  async function loadEditTargets() {
    if (!editingSessionId || !selectedLocationId || !editStart) {
      setEditVisibleTargets([]);
      return;
    }

    try {
      const res = await api.get<VisibleTarget[]>("/targets/visible", {
        params: {
          location_id: selectedLocationId,
          when_local: editStart,
          tz,
        },
      });
      setEditVisibleTargets(res.data);
    } catch (e) {
      console.error(e);
      setEditVisibleTargets([]);
    }
  }
  loadEditTargets();
}, [editingSessionId, selectedLocationId, editStart, tz]);

  
  function parseApiDate(s: string) {
    // If server did not include timezone, assume UTC
    const hasTz = /([zZ]|[+-]\d\d:\d\d)$/.test(s);
    return new Date(hasTz ? s : `${s}Z`);
  }

const selectedSession = useMemo(
  () => (selectedSessionId != null ? sessions.find(s => s.id === selectedSessionId) ?? null : null),
  [selectedSessionId, sessions]
);

useEffect(() => {
  if (!selectedSessionId || !selectedSession) {
    setLogs([]);
    setWeather(null);
    return;
  }

  let cancelled = false;

  (async () => {
    setError(null);
    try {
      const [logsRes, weatherRes] = await Promise.all([
        api.get<ObservationLog[]>(`/sessions/${selectedSessionId}/logs/`),
        api.get<WeatherInfo>(`/sessions/${selectedSessionId}/weather/`, { params: { tz } }),
      ]);

      if (cancelled) return;
      setLogs(logsRes.data);
      setWeather(weatherRes.data);
    } catch (err) {
      console.error(err);
      if (!cancelled) setError("Failed to load logs/weather for this session.");
    }
  })();

  return () => {
    cancelled = true;
  };
}, [selectedSessionId, selectedSession?.scheduled_start, tz]);


  const filteredSessions =
    selectedLocationId == null ? [] : sessions.filter((s) => s.location_id === selectedLocationId);

 

  const plannedCount = filteredSessions.filter((s) => s.status === "planned").length;
  const completedCount = filteredSessions.filter((s) => s.status === "completed").length;
  const cancelledCount = filteredSessions.filter((s) => s.status === "cancelled").length;

  

  const editingTargetName =
    editingSessionId != null
      ? (editTarget === "Custom"
          ? (editCustomTarget.trim() || "Custom")
          : editTarget)
      : null;


  const newTargetName =
    newTarget === "Custom" ? (customTarget.trim() || "Custom") : newTarget;

  const backgroundTargetName =
  selectedSession?.target_name ?? editingTargetName ?? newTargetName ?? "global";
  // ---------- Location handlers ----------

  async function handleCreateLocation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post<Location>("/locations/", {
        name: newLocName || "New Location",
        latitude: parseFloat(newLat),
        longitude: parseFloat(newLon),
        timezone: newTimezone || null, // NEW ✅
        notes: newLocNotes || null,
      });
      setLocations((prev) => [...prev, res.data]);
      setSelectedLocationId(res.data.id);
      setNewLocName("");
      setNewLocNotes("");
      setNewTimezone("");
    } catch (err) {
      console.error(err);
      setError("Failed to create location.");
    }
  }

  async function handleGeocode() {
    if (!geocodeQuery.trim()) return;
    setError(null);
    setGeocodeLoading(true);
    try {
      const res = await api.get("/geocode/", {
        params: { q: geocodeQuery.trim() },
      });

      const data = res.data as {
        name: string;
        latitude: number;
        longitude: number;
        country?: string | null;
        timezone?: string | null; // NEW
      };

      setNewLat(String(data.latitude));
      setNewLon(String(data.longitude));
      setNewTimezone(data.timezone ?? "");
      setNewLocName(data.country ? `${data.name}, ${data.country}` : data.name);
    } catch (err) {
      console.error(err);
      setError("Could not find coordinates for that place.");
    } finally {
      setGeocodeLoading(false);
    }
  }
  async function handleExportIcs() {
  setError(null);
  try {
    const res = await api.get("/planner/ics", {
      params: {
        location_id: selectedLocationId ?? undefined,
        status: "planned",
      },
      responseType: "blob",
    });

    const blob = new Blob([res.data], { type: "text/calendar;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "astroplanner.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (e) {
    console.error(e);
    setError("Failed to export ICS.");
  }
}

  // ---------- Session handlers ----------
  async function handleUpdateSession(e: FormEvent<HTMLFormElement>) {
    if (!editStart) {
      setError("Pick a start time.");
      return;
    }
    e.preventDefault();
    if (!editingSessionId) return;

    setError(null);
    try {
      const targetName =
        editTarget === "Custom" && editCustomTarget.trim()
          ? editCustomTarget.trim()
          : editTarget;

      const payload = {
        target_name: targetName,
        scheduled_start_local: editStart,
        tz,
        status: editStatus,
      };


      const res = await api.patch<Session>(`/sessions/${editingSessionId}`, payload);

      setSessions((prev) =>
        prev.map((s) => (s.id === editingSessionId ? res.data : s)),
      );
    if (selectedSessionId === editingSessionId) {
        // force re-fetch by briefly clearing then restoring
        setSelectedSessionId(null);
        setTimeout(() => setSelectedSessionId(editingSessionId), 0);
    }

      setEditingSessionId(null);
    } catch (err) {
      console.error(err);
      setError("Failed to update session.");
    }
}

  async function handleCreateSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLocationId) {
      setError("Select a location first.");
      return;
    }
    setError(null);
    const visibleNow = visibleTargets.filter((t) => t.visible).map((t) => t.name);

    if (newTarget !== "Custom" && !visibleNow.includes(newTarget)) {
      setError("No preset targets are visible at that time. Pick a different time or use Custom.");
      return;
    }

    if (newTarget === "Custom" && !customTarget.trim()) {
      setError("Enter a custom target name.");
      return;
    }

    try {
      
      const targetName =
        newTarget === "Custom" && customTarget.trim()
          ? customTarget.trim()
          : newTarget;

      const res = await api.post<Session>("/sessions/", {
        target_name: targetName,
        scheduled_start_local: newStart, // "YYYY-MM-DDTHH:mm"
        tz,                              // "America/Toronto"
        location_id: selectedLocationId,
        status: "planned",
      });
      setSessions((prev) => [...prev, res.data]);
      setSelectedSessionId(res.data.id);
      // optional: clear start time
      // setNewStart("");
    } catch (err) {
      console.error(err);
      setError("Failed to create session.");
    }
  }

  // ---------- Log handlers ----------

  async function handleCreateLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSessionId) {
      setError("Select a session first.");
      return;
    }

    setError(null);
    try {
      const payload = {
        session_id: selectedSessionId, 
        notes: newLogNotes,
        seeing: newLogSeeing || null,
        transparency: newLogTransparency || null,
        rating:
          newLogRating === "" ? null : Number(newLogRating),
      };

      const res = await api.post<ObservationLog>(
        `/sessions/${selectedSessionId}/logs/`,
        payload,
      );

      setLogs((prev) => [res.data, ...prev]);
      setNewLogNotes("");
      setNewLogSeeing("");
      setNewLogTransparency("");
      setNewLogRating("");
    } catch (err) {
      console.error(err);
      setError("Failed to create log.");
    }
  }
  async function handleDeleteLocation(id: number) {
  if (!window.confirm("Delete this location and its sessions?")) return;

setError(null);
  try {
    await api.delete(`/locations/${id}`);

    setLocations(prev => prev.filter(loc => loc.id !== id));
    // Remove any sessions tied to that location
    setSessions(prev => prev.filter(s => s.location_id !== id));

    if (selectedLocationId === id) {
      setSelectedLocationId(null);
      setSelectedSessionId(null);
      setLogs([]);
      setWeather(null);
    }
  } catch (err) {
    console.error(err);
    setError("Failed to delete location.");
  }
}

async function handleDeleteSession(id: number) {
  if (!window.confirm("Delete this session (and its logs)?")) return;

  setError(null);
  try {
    await api.delete(`/sessions/${id}`);

    setSessions(prev => prev.filter(s => s.id !== id));

    if (selectedSessionId === id) {
      setSelectedSessionId(null);
      setLogs([]);
      setWeather(null);
    }
  } catch (err) {
    console.error(err);
    setError("Failed to delete session.");
  }
}

  async function handleUpdateLog(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedSessionId || !editingLogId) return;
    setError(null);

    try {
      const payload: any = {
        notes: editNotes,
        seeing: editSeeing || null,
        transparency: editTransparency || null,
        rating: editRating === "" ? null : Number(editRating),
      };

      const res = await api.patch<ObservationLog>(
        `/sessions/${selectedSessionId}/logs/${editingLogId}`,
        payload,
      );

      setLogs((prev) =>
        prev.map((log) =>
          log.id === editingLogId ? res.data : log,
        ),
      );
      setEditingLogId(null);
    } catch (err) {
      console.error(err);
      setError("Failed to update log.");
    }
  }

  // ---------- Render ----------


  return (
    <div style={{ ...appShellStyle, position: "relative" }}>
      <BackgroundVideo targetName={backgroundTargetName} />
      <div style={{ ...appInnerStyle, position: "relative", zIndex: 1 }}>
        <div style={headerRowStyle}>
          <div>
            <div style={pillStyle}>Observation Planner</div>
            <h2
              style={{
                fontSize: "1.8rem",
                fontWeight: 700,
                marginTop: "0.25rem",
              }}
            >
              AstroPlanner
            </h2>
          </div>
          <button
            onClick={onLogout}
            style={{
              borderRadius: 9999,
              border: "1px solid rgba(148,163,184,0.5)",
              background: "rgba(15,23,42,0.9)",
              color: "#e5e7eb",
              padding: "0.4rem 0.9rem",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Logout
          </button>
        </div>

        {loading && <div>Loading…</div>}
        {error && <div style={{ color: "#fca5a5" }}>{error}</div>}

        {/* Locations */}
        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>Locations</h3>
          <div style={{ fontSize: "0.85rem", color: "#9ca3af", marginBottom: "0.6rem" }}>
            Active timezone: <span style={{ color: "#e5e7eb" }}>{tz}</span>
          </div>
          <div style={{ display: "flex", gap: "1rem" }}>
            <div style={locationLeftColStyle}>
              {/* Location list */}
              <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
              {locations.map((loc) => (
              <li key={loc.id} style={{ marginBottom: "0.35rem" }}>
                <div
                  onMouseEnter={() => setHoveredLocationId(loc.id)}
                  onMouseLeave={() => setHoveredLocationId(null)}
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: "0.5rem",
                    borderRadius: 12,
                    padding: "0.25rem",
                    border: "1px solid rgba(148,163,184,0.18)",
                    background:
                      loc.id === selectedLocationId
                        ? "rgba(59,130,246,0.12)"
                        : "rgba(2,6,23,0.12)",
                  }}
                >
                  <button
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      textAlign: "left",
                      padding: "0.35rem 0.5rem",
                      cursor: "pointer",
                      borderRadius: 10,
                      color: "#e5e7eb",
                    }}
                    onClick={() => setSelectedLocationId(loc.id)}
                  >
                    <strong>{loc.name}</strong>
                    <div style={{ display: "grid", gap: "0.1rem" }}>
                      <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                        ({loc.latitude}, {loc.longitude})
                      </span>
                      <span style={metaLineStyle}>TZ: {loc.timezone ?? "not set"}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteLocation(loc.id)}
                    title="Delete location"
                    aria-label={`Delete location ${loc.name}`}
                    style={{
                      ...iconDangerButtonSm,
                      opacity: hoveredLocationId === loc.id ? 1 : 0,
                      pointerEvents: hoveredLocationId === loc.id ? "auto" : "none",
                      transition: "opacity 140ms ease",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))} 
            </ul>
            {/* Empty-state hint (0 locations) */}
            {locations.length === 0 && (
              <div style={hintBoxStyle}>
                <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
                  No locations yet
                </div>
                <div style={{ fontSize: "0.9rem", color: "#9ca3af" }}>
                  Add a location to start planning sessions. Tip: use “Autofill coordinates”.
                </div>
              </div>
            )}

            {/* Selected location panel (1+ locations) */}
            {locations.length > 0 && (
              <div style={locationPanelStyle}>
                <div style={panelTitleRowStyle}>
                  <div>
                    <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>Selected location</div>
                    <div style={metaLineStyle}>
                      {selectedLocation?.name ?? "—"} · ({selectedLocation?.latitude}, {selectedLocation?.longitude})
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditingLoc((v) => !v)}
                    style={tinyBtnStyle}
                  >
                    {editingLoc ? "Close" : "Edit"}
                  </button>
                </div>

                {!editingLoc ? (
                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <div style={metaLineStyle}>
                      Timezone: <span style={{ color: "#e5e7eb" }}>{selectedLocation?.timezone ?? "not set"}</span>
                    </div>
                     <div style={metaLineStyle}>
                      Sessions:{" "}
                      <span style={{ color: "#e5e7eb" }}>
                        {plannedCount} planned · {completedCount} completed · {cancelledCount} cancelled
                      </span>
                    </div>
                    <div style={metaLineStyle}>
                      Notes: <span style={{ color: "#e5e7eb" }}>{selectedLocation?.notes ?? "—"}</span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateSelectedLocation} style={{ display: "grid", gap: "0.5rem" }}>
                    <label style={{ fontSize: "0.8rem" }}>
                      Timezone
                      <input
                        value={locTzDraft}
                        onChange={(e) => setLocTzDraft(e.target.value)}
                        placeholder="e.g. America/Toronto"
                        style={{ ...fieldStyle, marginTop: "0.2rem" }}
                      />
                    </label>

                    <label style={{ fontSize: "0.8rem" }}>
                      Notes
                      <input
                        value={locNotesDraft}
                        onChange={(e) => setLocNotesDraft(e.target.value)}
                        placeholder="e.g. backyard, low light pollution"
                        style={{ ...fieldStyle, marginTop: "0.2rem" }}
                      />
                    </label>

                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <button
                        type="submit"
                        disabled={locSaving}
                        style={{
                          ...tinyBtnStyle,
                          border: "none",
                          background: "linear-gradient(135deg,#38bdf8,#6366f1)",
                        }}
                      >
                        {locSaving ? "Saving..." : "Save"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setLocTzDraft(selectedLocation?.timezone ?? "");
                          setLocNotesDraft(selectedLocation?.notes ?? "");
                          setEditingLoc(false);
                        }}
                        style={tinyBtnStyle}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
            <form onSubmit={handleCreateLocation} style={{ minWidth: 260 }}>
              <h4 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                New Location
              </h4>

              <div style={{ marginBottom: "0.5rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  Search place
                  <input
                    placeholder="e.g. Toronto, Ontario"
                    value={geocodeQuery}
                    onChange={(e) => setGeocodeQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.5rem 0.6rem",
                      borderRadius: 9999,
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      marginTop: "0.25rem",
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleGeocode}
                  disabled={geocodeLoading}
                  style={{
                    marginTop: "0.25rem",
                    padding: "0.35rem 0.7rem",
                    borderRadius: 9999,
                    border: "none",
                    background:
                      "linear-gradient(135deg,#38bdf8,#6366f1,#a855f7)",
                    color: "white",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  {geocodeLoading ? "Looking up..." : "Autofill coordinates"}
                </button>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  Name
                  <input
                    value={newLocName}
                    onChange={(e) => setNewLocName(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: 10,
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      marginTop: "0.2rem",
                    }}
                  />
                </label>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  Latitude
                  <input
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: 10,
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      marginTop: "0.2rem",
                    }}
                  />
                </label>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  Longitude
                  <input
                    value={newLon}
                    onChange={(e) => setNewLon(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: 10,
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      marginTop: "0.2rem",
                    }}
                  />
                </label>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
                  Timezone
                  <input
                    value={newTimezone}
                    onChange={(e) => setNewTimezone(e.target.value)}
                    placeholder="e.g. America/Toronto"
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: 10,
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      marginTop: "0.2rem",
                    }}
                  />
                </label>
                <div style={metaLineStyle}>
                  Tip: use “Autofill coordinates” to fill this automatically.
                </div>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  Notes
                  <input
                    value={newLocNotes}
                    onChange={(e) => setNewLocNotes(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: 10,
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      marginTop: "0.2rem",
                    }}
                  />
                </label>
              </div>
              <button
                type="submit"
                style={{
                  marginTop: "0.6rem",
                  padding: "0.5rem 0.9rem",
                  borderRadius: 9999,
                  border: "none",
                  background:
                    "linear-gradient(135deg,#22c55e,#4ade80,#a3e635)",
                  color: "#052e16",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Add Location
              </button>
            </form>
          </div>
        </section>

        {/* Sessions */}
        <section style={cardStyle}>
          <h3 style={sectionTitleStyle}>Sessions</h3>
          <button
            type="button"
            onClick={handleExportIcs}
            disabled={!selectedLocationId || filteredSessions.length === 0}
            style={{
              borderRadius: 9999,
              border: "1px solid rgba(148,163,184,0.6)",
              padding: "0.35rem 0.8rem",
              background: "rgba(15,23,42,0.6)",
              color: "#e5e7eb",
              fontSize: "0.85rem",
              cursor: (!selectedLocationId || filteredSessions.length === 0) ? "not-allowed" : "pointer",
              opacity: (!selectedLocationId || filteredSessions.length === 0) ? 0.5 : 1,
            }}
            title={
              !selectedLocationId
                ? "Select a location to export"
                : filteredSessions.length === 0
                ? "No sessions to export"
                : "Export planned sessions as .ics"
            }
          >
            Export .ics
          </button>
          <div
            style={{
              display: "flex",
              gap: "1rem",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <ul style={{
                  listStyle: "none",
                  paddingLeft: 0,
                  margin: 0,
                  flex: "1 1 420px",    
                  minWidth: 320,        
                }}>
              {filteredSessions.map((s) => (
                <li
                  key={s.id}
                  onMouseEnter={() => setHoveredSessionId(s.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                  style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                >
                  {editingSessionId === s.id ? (
                    /* edit form */
                    <form onSubmit={handleUpdateSession} style={{ flex: 1, display: "grid", gap: "0.35rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <label style={{ flex: 1, fontSize: "0.8rem" }}>
                          Target
                          <select
                            value={editTarget}
                            onChange={(e) => setEditTarget(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "0.35rem 0.5rem",
                              borderRadius: 10,
                              border: "1px solid #374151",
                              backgroundColor: "#020617",
                              color: "#e5e7eb",
                              fontSize: "0.85rem",
                              marginTop: "0.2rem",
                            }}
                          >
                            {editVisibleTargets
                              .filter((t) => t.visible)
                              .map((t) => (
                                <option key={t.name} value={t.name}>
                                  {t.name} (alt {Math.round(t.altitude_deg)}°)
                                </option>
                              ))}
                            <option value="Custom">Custom</option>
                          </select>
                          {editVisibleTargets.some(t => !t.visible) && (
                            <div style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.4rem" }}>
                              Not visible now:{" "}
                              {editVisibleTargets.filter(t => !t.visible).slice(0, 3).map(t => `${t.name} (${t.reason})`).join(", ")}
                            </div>
                          )}
                        </label>

                        <label style={{ width: 140, fontSize: "0.8rem" }}>
                          Status
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            style={{
                              width: "100%",
                              padding: "0.35rem 0.5rem",
                              borderRadius: 10,
                              border: "1px solid #374151",
                              backgroundColor: "#020617",
                              color: "#e5e7eb",
                              fontSize: "0.85rem",
                              marginTop: "0.2rem",
                            }}
                          >
                            {SESSION_STATUSES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {editTarget === "Custom" && (
                        <label style={{ fontSize: "0.8rem" }}>
                          Custom target
                          <input
                            value={editCustomTarget}
                            onChange={(e) => setEditCustomTarget(e.target.value)}
                            style={{
                              width: "100%",
                              marginTop: "0.2rem",
                              padding: "0.35rem 0.5rem",
                              borderRadius: 10,
                              border: "1px solid #374151",
                              backgroundColor: "#020617",
                              color: "#e5e7eb",
                              fontSize: "0.85rem",
                            }}
                          />
                        </label>
                      )}

                      <label style={{ fontSize: "0.8rem" }}>
                        Start time
                        <input
                          type="datetime-local"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          onPointerDown={(e) =>
                            (e.currentTarget as HTMLInputElement).showPicker?.()
                          }
                          style={{
                            width: "100%",
                            marginTop: "0.2rem",
                            padding: "0.35rem 0.5rem",
                            borderRadius: 10,
                            border: "1px solid #374151",
                            backgroundColor: "#020617",
                            color: "#e5e7eb",
                            fontSize: "0.85rem",
                          }}
                        />
                      </label>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          type="submit"
                          style={{
                            borderRadius: 9999,
                            border: "none",
                            padding: "0.3rem 0.75rem",
                            background: "linear-gradient(135deg,#38bdf8,#6366f1)",
                            color: "white",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSessionId(null)}
                          style={{
                            borderRadius: 9999,
                            border: "1px solid rgba(148,163,184,0.6)",
                            padding: "0.3rem 0.75rem",
                            background: "transparent",
                            color: "#e5e7eb",
                            fontSize: "0.8rem",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                  <>
                     <button
                      style={{
                        background: s.id === selectedSessionId ? "rgba(52,211,153,0.15)" : "transparent",
                        border: "none",
                        textAlign: "left",
                        padding: "0.45rem 0.5rem",
                        cursor: "pointer",
                        flex: 1,
                        borderRadius: 10,
                        color: "#e5e7eb",
                      }}
                      onClick={() => setSelectedSessionId(s.id)}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                        <div style={{ minWidth: 0, display: "grid", gap: "0.15rem" }}>
                          <div
                            style={{
                              fontWeight: 700,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.target_name}
                          </div>

                          <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
                            {formatSessionTime(s.scheduled_start, tz)}
                          </div>
                        </div>

                        <span style={statusPillStyle(s.status)}>{s.status}</span>
                      </div>
                    </button>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSessionId(s.id);
                            setEditStatus(s.status || "planned");

                            const isPreset = PRESET_TARGETS.includes(s.target_name);
                            setEditTarget(isPreset ? s.target_name : "Custom");
                            setEditCustomTarget(isPreset ? "" : s.target_name);

                            const d = parseApiDate(s.scheduled_start);
                            const pad = (n: number) => String(n).padStart(2, "0");
                            const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
                              d.getHours(),
                            )}:${pad(d.getMinutes())}`;
                            setEditStart(local);
                          }}
                          style={{
                            fontSize: "0.75rem",
                            borderRadius: 9999,
                            border: "1px solid rgba(148,163,184,0.6)",
                            padding: "0.1rem 0.55rem",
                            background: "transparent",
                            color: "#e5e7eb",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSession(s.id)}
                          title="Delete session"
                          aria-label={`Delete session ${s.target_name}`}
                          style={{
                            ...iconDangerButtonSm,
                            opacity: hoveredSessionId === s.id ? 1 : 0,
                            pointerEvents: hoveredSessionId === s.id ? "auto" : "none",
                            transition: "opacity 140ms ease",
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {filteredSessions.length === 0 && (
                <li>No sessions for this location yet.</li>
              )}
            </ul>

            <form onSubmit={handleCreateSession} 
                style={{
                    flex: "0 1 420px",    
                    minWidth: 280,
                    width: "100%",
                    maxWidth: 520,       
                  }}>
              <h4 style={{ fontSize: "0.95rem", marginBottom: "0.5rem" }}>
                New Session
              </h4>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  Start time
                  <input
                    type="datetime-local"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: 10,
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      marginTop: "0.2rem",
                    }}
                  />
                </label>
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    marginBottom: "0.2rem",
                  }}
                >
                  Target
                  <select
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    disabled={!hasTime}
                    style={{
                      width: "100%",
                      padding: "0.45rem 0.6rem",
                      borderRadius: 10,
                      border: "1px solid #374151",
                      backgroundColor: "#020617",
                      color: "#e5e7eb",
                      fontSize: "0.85rem",
                      marginTop: "0.2rem",
                      opacity: !hasTime ? 0.6 : 1,
                      cursor: !hasTime ? "not-allowed" : "pointer",
                    }}
                  >
                    {visibleTargets.filter((t) => t.visible).length === 0 && (
                    <option value="Custom" disabled>
                      No visible preset targets at this time
                    </option>
                  )}

                  {visibleTargets
                    .filter((t) => t.visible)
                    .map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} (alt {Math.round(t.altitude_deg)}°)
                      </option>
                    ))}

                  <option value="Custom">Custom</option>
                </select>
                  {!hasTime && <div style={metaLineStyle}>Pick a start time to load visible targets.</div>}
                  {hasTime && visibleNowCount === 0 && (
                    <div style={metaLineStyle}>No preset targets are visible at that time — choose Custom or change the time.</div>
                  )}
                  {visibleTargets.some(t => !t.visible) && (
                      <div style={{
                          ...metaLineStyle,
                          marginTop: "0.4rem",
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                        }}
                      >
                        Not visible now:{" "}
                        {visibleTargets.filter(t => !t.visible).slice(0, 3).map(t => `${t.name} (${t.reason})`).join(", ")}
                      </div>
                    )}
                </label>
              </div>

              {newTarget === "Custom" && (
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      marginBottom: "0.2rem",
                    }}
                  >
                    Custom target
                    <input
                      value={customTarget}
                      onChange={(e) => setCustomTarget(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "0.45rem 0.6rem",
                        borderRadius: 10,
                        border: "1px solid #374151",
                        backgroundColor: "#020617",
                        color: "#e5e7eb",
                        fontSize: "0.85rem",
                        marginTop: "0.2rem",
                      }}
                    />
                  </label>
                </div>
              )}

              
              <button
                type="submit"
                style={{
                  marginTop: "0.6rem",
                  padding: "0.5rem 0.9rem",
                  borderRadius: 9999,
                  border: "none",
                  background:
                    "linear-gradient(135deg,#38bdf8,#6366f1,#a855f7)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Add Session
              </button>
            </form>
          </div>
        </section>

        {/* Session details: weather + logs */}
        {selectedSessionId && (
          <section style={cardStyle}>
            <h3 style={sectionTitleStyle}>
              Session Details (#{selectedSessionId})
            </h3>
            <div
              style={{
                display: "flex",
                gap: "2rem",
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              {/* Weather */}
              <div
                style={{
                  flex: "1.2 1 360px", // ✅ grows a bit more than logs
                  minWidth: 360,       // ✅ makes it visibly wider
                  padding: "0.85rem 1rem",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                  backgroundColor: "rgba(15,23,42,0.65)",
                }}
              >
                <h4 style={{ fontSize: "0.95rem", marginBottom: "0.35rem" }}>
                  Weather at planned time
                </h4>

                <div style={weatherSubtitleStyle}>
                  {selectedSession
                    ? `Forecast for ${parseApiDate(selectedSession.scheduled_start).toLocaleString(undefined, {
                        timeZone: tz,
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZoneName: "short",
                      })}`
                    : "Forecast time unavailable"}
                </div>

                {weather ? (
                  <>
                    {/* Headline row */}
                    <div style={{ display: "flex", gap: "0.9rem", alignItems: "center", marginTop: "0.7rem" }}>
                      <WeatherIcon
                        weatherCode={weather.weather_code}
                        isDay={weather.is_day}
                        title="Forecast"
                        size={88}
                      />

                      <div style={{ display: "grid", gap: "0.25rem" }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                          <div style={{ fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
                            {weather.temperature == null ? "—" : `${Math.round(weather.temperature)}°C`}
                          </div>
                          <div style={{ fontSize: "0.95rem", color: "#cbd5e1", fontWeight: 600 }}>
                            {weatherLabel(weather)}
                          </div>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                          {weather.is_day == null ? "—" : weather.is_day ? "Day" : "Night"}
                          {weather.weather_code != null ? ` · Code ${weather.weather_code}` : ""}
                        </div>
                      </div>
                    </div>

                    {/* Stats chips */}
                    <div style={statGridStyle}>
                      <div style={statChipStyle}>
                        <span style={statLabelStyle}>Wind</span>
                        <span style={statValueStyle}>
                          {weather.wind_speed == null ? "—" : `${Math.round(weather.wind_speed)} km/h`}
                          {degToCompass(weather.wind_direction) ? ` ${degToCompass(weather.wind_direction)}` : ""}
                        </span>
                      </div>

                      <div style={statChipStyle}>
                        <span style={statLabelStyle}>Cloud cover</span>
                        <span style={statValueStyle}>
                          {weather.cloud_cover == null ? "—" : `${Math.round(weather.cloud_cover)}%`}
                        </span>
                      </div>

                      <div style={statChipStyle}>
                        <span style={statLabelStyle}>Temp (raw)</span>
                        <span style={statValueStyle}>
                          {weather.temperature == null ? "—" : `${weather.temperature.toFixed(1)}°C`}
                        </span>
                      </div>

                      <div style={statChipStyle}>
                        <span style={statLabelStyle}>Day/Night</span>
                        <span style={statValueStyle}>
                          {weather.is_day == null ? "—" : weather.is_day ? "Day" : "Night"}
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ marginTop: "0.6rem" }}>No weather data.</p>
                )}

              </div>

              {/* Logs + Add/Edit */}
              <div
                style={{
                  flex: "1 1 440px",
                  minWidth: 440,
                  padding: "0.85rem 1rem",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                  backgroundColor: "rgba(15,23,42,0.65)",
                }}
              >
                <div style={panelHeaderRow}>
                  <h4 style={{ fontSize: "0.95rem", margin: 0 }}>Observation Logs</h4>

                  <button
                    type="button"
                    onClick={() => setShowAddLog(v => !v)}
                    style={{
                      borderRadius: 9999,
                      border: "1px solid rgba(148,163,184,0.6)",
                      padding: "0.3rem 0.75rem",
                      background: showAddLog ? "rgba(59,130,246,0.15)" : "transparent",
                      color: "#e5e7eb",
                      fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >
                    {showAddLog ? "Close" : "+ Add log"}
                  </button>
                </div>

                {showAddLog && (
                  <form
                    onSubmit={handleCreateLog}
                    style={{
                      marginBottom: "0.75rem",
                      padding: "0.6rem",
                      border: "1px solid rgba(148,163,184,0.22)",
                      borderRadius: 12,
                      backgroundColor: "rgba(2,6,23,0.35)",
                    }}
                  >
                    <label style={{ display: "block", fontSize: "0.8rem" }}>
                      Notes
                      <textarea
                        value={newLogNotes}
                        onChange={(e) => setNewLogNotes(e.target.value)}
                        rows={3}
                        style={{ ...fieldStyle, marginTop: "0.25rem", resize: "vertical" }}
                      />
                    </label>

                    <div style={{ ...chipGrid, marginTop: "0.5rem" }}>
                      <label style={{ fontSize: "0.8rem" }}>
                        Seeing
                        <input
                          value={newLogSeeing}
                          onChange={(e) => setNewLogSeeing(e.target.value)}
                          placeholder="e.g. 3/5"
                          style={{ ...fieldStyle, marginTop: "0.25rem" }}
                        />
                      </label>

                      <label style={{ fontSize: "0.8rem" }}>
                        Transparency
                        <input
                          value={newLogTransparency}
                          onChange={(e) => setNewLogTransparency(e.target.value)}
                          placeholder="e.g. average"
                          style={{ ...fieldStyle, marginTop: "0.25rem" }}
                        />
                      </label>

                      <label style={{ fontSize: "0.8rem" }}>
                        Rating
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={newLogRating}
                          onChange={(e) => setNewLogRating(e.target.value === "" ? "" : Number(e.target.value))}
                          style={{ ...fieldStyle, marginTop: "0.25rem" }}
                        />
                      </label>
                    </div>

                    <button
                      type="submit"
                      style={{
                        marginTop: "0.6rem",
                        padding: "0.4rem 0.85rem",
                        borderRadius: 9999,
                        border: "none",
                        background: "linear-gradient(135deg,#22c55e,#4ade80,#a3e635)",
                        color: "#052e16",
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                      }}
                    >
                      Add Log
                    </button>
                  </form>
                )}
                {/* Existing logs */}
                {logs.length === 0 ? (
                  <div
                    style={{
                      fontSize: "0.85rem",
                      color: "#9ca3af",
                      padding: "0.6rem 0.2rem 0.2rem",
                    }}
                  >
                    No logs yet. Click <strong style={{ color: "#e5e7eb" }}>+ Add log</strong> to record what you saw.
                  </div>
                ) : (
                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: 0,
                      display: "grid",
                      gap: "0.5rem",
                    }}
                  >
                    {logs.map((log) => (
                      <li
                        key={log.id}
                        style={{
                          borderRadius: 12,
                          border: "1px solid rgba(148,163,184,0.22)",
                          background: "rgba(2,6,23,0.35)",
                          padding: "0.6rem 0.7rem",
                        }}
                      >
                        {editingLogId === log.id ? (
                          // --- EDIT MODE ---
                          <form onSubmit={handleUpdateLog} style={{ display: "grid", gap: "0.5rem" }}>
                            <label style={{ fontSize: "0.8rem" }}>
                              Notes
                              <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                rows={3}
                                style={{ ...fieldStyle, marginTop: "0.25rem", resize: "vertical" }}
                              />
                            </label>

                            <div style={chipGrid}>
                              <label style={{ fontSize: "0.8rem" }}>
                                Seeing
                                <input
                                  value={editSeeing}
                                  onChange={(e) => setEditSeeing(e.target.value)}
                                  style={{ ...fieldStyle, marginTop: "0.25rem" }}
                                />
                              </label>

                              <label style={{ fontSize: "0.8rem" }}>
                                Transparency
                                <input
                                  value={editTransparency}
                                  onChange={(e) => setEditTransparency(e.target.value)}
                                  style={{ ...fieldStyle, marginTop: "0.25rem" }}
                                />
                              </label>

                              <label style={{ fontSize: "0.8rem" }}>
                                Rating
                                <input
                                  type="number"
                                  min={1}
                                  max={5}
                                  value={editRating}
                                  onChange={(e) =>
                                    setEditRating(e.target.value === "" ? "" : Number(e.target.value))
                                  }
                                  style={{ ...fieldStyle, marginTop: "0.25rem" }}
                                />
                              </label>
                            </div>

                            <div style={{ display: "flex", gap: "0.5rem" }}>
                              <button
                                type="submit"
                                style={{
                                  borderRadius: 9999,
                                  border: "none",
                                  padding: "0.35rem 0.85rem",
                                  background: "linear-gradient(135deg,#38bdf8,#6366f1)",
                                  color: "white",
                                  fontSize: "0.8rem",
                                  cursor: "pointer",
                                }}
                              >
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingLogId(null)}
                                style={{
                                  borderRadius: 9999,
                                  border: "1px solid rgba(148,163,184,0.6)",
                                  padding: "0.35rem 0.85rem",
                                  background: "transparent",
                                  color: "#e5e7eb",
                                  fontSize: "0.8rem",
                                  cursor: "pointer",
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          // --- VIEW MODE ---
                          <>
                            <div style={{ fontWeight: 700, marginBottom: "0.35rem" }}>
                              {log.notes}
                            </div>

                            <div style={statGridStyle}>
                              <div style={statChipStyle}>
                                <span style={statLabelStyle}>Seeing</span>
                                <span style={statValueStyle}>{log.seeing ?? "—"}</span>
                              </div>
                              <div style={statChipStyle}>
                                <span style={statLabelStyle}>Transparency</span>
                                <span style={statValueStyle}>{log.transparency ?? "—"}</span>
                              </div>
                              <div style={statChipStyle}>
                                <span style={statLabelStyle}>Rating</span>
                                <span style={statValueStyle}>{log.rating ?? "—"}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingLogId(log.id);
                                setEditNotes(log.notes);
                                setEditSeeing(log.seeing ?? "");
                                setEditTransparency(log.transparency ?? "");
                                setEditRating(log.rating ?? "");
                              }}
                              style={{
                                marginTop: "0.6rem",
                                borderRadius: 9999,
                                border: "1px solid rgba(148,163,184,0.6)",
                                padding: "0.3rem 0.75rem",
                                background: "transparent",
                                color: "#e5e7eb",
                                fontSize: "0.8rem",
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
