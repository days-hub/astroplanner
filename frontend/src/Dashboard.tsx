import type React from "react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import api from "./api";
import TabNav from "./TabNav";
import { TrashIcon } from "./icons";
import Drawer from "./Drawer";
import AddLocationDrawer, { type NewLocation } from "./AddLocationDrawer";
import { SegmentedControl, StarRating } from "./controls";
import {
  btnDangerIcon as iconDangerButtonSm,
  btnPrimary,
  btnPrimarySm,
  btnSecondarySm,
  card as cardStyle,
  field as fieldStyle,
  inset,
  line,
  surface,
  pillShape,
  selectField as selectFieldStyle,
  headerRow as panelHeaderRow,
  metaLine as metaLineStyle,
  sectionTitle as sectionTitleStyle,
  fontSize,
  text as textColor,
  verdictPill,
} from "./theme";
import SpaceBackground from "./SpaceBackground";
import ContextBar from "./ContextBar";
import TonightPanel from "./TonightPanel";
import OutlookPanel from "./OutlookPanel";
import BestLocation from "./BestLocation";
import LocationsPage from "./LocationsPage";
import WeatherIcon from "./WeatherIcon";

interface Props {
  onLogout: () => void;
}

interface Location {
  id: number;
  name: string;
  region?: string | null;
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
  verdict?: "good" | "fair" | "poor" | null;
  verdict_reason?: string | null;
}

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
  padding: "1.75rem 1.5rem 3rem",
  display: "grid",
  gap: "1.1rem",
};
const appBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: "2.25rem",
  flexWrap: "wrap",
  paddingBottom: 0,
  marginBottom: "0.4rem",
  borderBottom: "1px solid rgba(148,163,184,0.22)",
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
  ...pillShape,
  background: "rgba(148,163,184,0.12)",
  color: "#cbd5e1",
  lineHeight: 1.2,
  whiteSpace: "nowrap",
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
  ...inset,
  padding: "0.45rem 0.6rem",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "0.75rem",
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
const QUALITY_OPTIONS = ["poor", "fair", "good", "excellent"];

// WMO weather interpretation codes (Open-Meteo `weather_code`) → human text
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

// Group hidden targets by a short reason so the hint reads as one line
// instead of nested parentheses per target
function summarizeHidden(targets: VisibleTarget[]) {
  const groups: Record<string, string[]> = {};
  for (const t of targets) {
    if (t.visible) continue;
    const r = (t.reason ?? "").toLowerCase();
    let label = "not visible";
    if (r.includes("low")) label = "too low";
    else if (r.includes("bright")) label = "sky too bright";
    else if (r.includes("sun")) label = "sun glare";
    else if (r.includes("not up")) label = "not up yet";
    (groups[label] ??= []).push(t.name);
  }
  return Object.entries(groups)
    .map(([label, names]) => `${names.join(", ")} (${label})`)
    .join(" · ");
}
export default function Dashboard({ onLogout }: Props) {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [locations, setLocations] = useState<Location[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [logs, setLogs] = useState<ObservationLog[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [visibleTargets, setVisibleTargets] = useState<VisibleTarget[]>([]);
  // Which newStart value visibleTargets was fetched for — guards against
  // validating the target selection against stale visibility data
  const [targetsForStart, setTargetsForStart] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState("");
  const [editCustomTarget, setEditCustomTarget] = useState("");
  const [editStart, setEditStart] = useState(""); // datetime-local string
  const [editStatus, setEditStatus] = useState("planned");
  const [editVisibleTargets, setEditVisibleTargets] = useState<VisibleTarget[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(
    null,
  );
  // Which session is open is a route, not component state: /sessions/12 is
  // shareable, survives refresh, and Back returns to the list.
  const routeSessionId = /^\/sessions\/(\d+)$/.exec(routerLocation.pathname);
  const selectedSessionId = routeSessionId ? Number(routeSessionId[1]) : null;
  const setSelectedSessionId = useCallback(
    (id: number | null) => navigate(id == null ? "/sessions" : `/sessions/${id}`),
    [navigate],
  );
  const [hoveredSessionId, setHoveredSessionId] = useState<number | null>(null);
  const [sessionFilter, setSessionFilter] = useState<"all" | "planned" | "completed">("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New location form state
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddLog, setShowAddLog] = useState(false);
  const [showSessionDrawer, setShowSessionDrawer] = useState(false);
  // Per-site forecast for this night, lifted from the comparison so the
  // location picker can show cloud cover where the choice is actually made.
  const [locationForecasts, setLocationForecasts] = useState<
    { location_id: number; cloud_cover_percent?: number | null }[]
  >([]);

  // New session form state
  const [newTarget, setNewTarget] = useState("Saturn");
  const [customTarget, setCustomTarget] = useState("");
  const [newStart, setNewStart] = useState("");
  // The night the whole page is about — Tonight, the advisor, and the
  // session form all read this (see ContextBar).
  const [dateStr, setDateStr] = useState(() => {
    // A shared /planner?date=… link should open on that night
    const fromUrl = new URLSearchParams(window.location.search).get("date");
    return fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl)
      ? fromUrl
      : new Intl.DateTimeFormat("en-CA").format(new Date());
  });

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
    if (weather.weather_code != null && WMO_DESCRIPTIONS[weather.weather_code]) {
      return WMO_DESCRIPTIONS[weather.weather_code];
    }
    // Backend sends the placeholder "forecast" as description — not useful
    const desc = (weather.description ?? "").trim();
    if (desc && desc !== "forecast") return desc;
    return "—";
  }
  const selectedLocation = locations.find((l) => l.id === selectedLocationId) ?? null;

  // PUT is a full replace, so the patch is merged over the current row here
  // rather than in the page — the page only knows the fields it edits.
  async function handleSaveLocation(id: number, patch: Partial<Location>) {
    const existing = locations.find((l) => l.id === id);
    if (!existing) return;

    setError(null);
    try {
      const res = await api.put<Location>(`/locations/${id}`, {
        name: patch.name ?? existing.name,
        region: patch.region !== undefined ? patch.region : existing.region ?? null,
        latitude: existing.latitude,
        longitude: existing.longitude,
        timezone: patch.timezone !== undefined ? patch.timezone : existing.timezone ?? null,
        notes: patch.notes !== undefined ? patch.notes : existing.notes ?? null,
      });
      setLocations((prev) => prev.map((l) => (l.id === res.data.id ? res.data : l)));
    } catch (err) {
      console.error(err);
      setError("Failed to update location.");
      throw err;
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
          // A /planner?location=… link wins over the default first site
          const wanted = Number(searchParams.get("location"));
          const match = locRes.data.find((l) => l.id === wanted);
          setSelectedLocationId(match ? match.id : locRes.data[0].id);
        } else {
          setShowAddLocation(true); // first visit: open the form
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

// Keep the planner context in the URL so refresh, Back, and a shared link
// all land on the same site and night. Replace rather than push: changing
// the date shouldn't bury the previous tab behind a stack of history entries.
useEffect(() => {
  if (!routerLocation.pathname.startsWith("/planner")) return;
  if (selectedLocationId == null) return;
  const next = new URLSearchParams(searchParams);
  next.set("location", String(selectedLocationId));
  next.set("date", dateStr);
  if (next.toString() !== searchParams.toString()) {
    setSearchParams(next, { replace: true });
  }
}, [routerLocation.pathname, selectedLocationId, dateStr, searchParams, setSearchParams]);

// Changing the night in the context bar moves the session form with it, so
// the whole page stays on one observing context. Tonight's "Plan session"
// can still overwrite this with a precise time afterwards (which may fall
// after midnight, hence setting it here rather than in an effect that would
// keep dragging it back).
function handleDateChange(next: string) {
  setDateStr(next);
  setNewStart(`${next}T22:00`);
}

// Default the session form to the selected night at 10 PM local, so the
// target list is live immediately instead of showing a dead dropdown
useEffect(() => {
  if (selectedLocationId != null && !newStart) {
    setNewStart(`${dateStr}T22:00`);
  }
}, [selectedLocationId, newStart, dateStr]);
const visibleNowCount = visibleTargets.filter((t) => t.visible).length;
useEffect(() => {
  async function loadTargets() {
    if (!selectedLocationId || !newStart) {
      setVisibleTargets([]);
      setTargetsForStart(null);
      return;
    }

    try {
      const res = await api.get<VisibleTarget[]>("/targets/visible", {
        params: { location_id: selectedLocationId, when_local: newStart, tz },
      });
      setVisibleTargets(res.data);
      setTargetsForStart(newStart);
    } catch (e) {
      console.error(e);
      const detail = isAxiosError(e)
        ? e.response?.data?.detail ?? e.response?.data ?? e.message
        : "Unknown error";
      setError(`Failed to load targets: ${String(detail)}`);
      setVisibleTargets([]);
      setTargetsForStart(null);
    }
  }
  loadTargets();
}, [selectedLocationId, newStart, tz]);
  useEffect(() => {
  // Only validate the selection against visibility data that was actually
  // fetched for the current start time — otherwise a prefilled target gets
  // clobbered to "Custom" while the fetch is still in flight
  if (!newStart || targetsForStart !== newStart) return;

  const visible = visibleTargets.filter((t) => t.visible).map((t) => t.name);

  // If nothing is visible at that time, force the user into Custom
  if (visible.length === 0) {
    if (newTarget !== "Custom") {
      setNewTarget("Custom");
    }
    return;
  }

  // If current selection is no longer valid, pick the first visible
  if (newTarget !== "Custom" && !visible.includes(newTarget)) {
    setNewTarget(visible[0]);
  }
}, [visibleTargets, newTarget, newStart, targetsForStart]);


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

  // Format a UTC instant as a "YYYY-MM-DDTHH:mm" wall-clock string in the
  // given timezone — the same timezone the backend will interpret it in on
  // save. Using browser-local components here would shift the time whenever
  // the browser and the observing location are in different timezones.
  function utcIsoToLocalInput(iso: string, timeZone: string) {
    const d = parseApiDate(iso);
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(d);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
      // hour can be "24" at midnight in some environments; normalize
      const hour = get("hour") === "24" ? "00" : get("hour");
      return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
    } catch {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
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

    // Load logs and weather independently: the forecast API only covers
    // ~16 days out, so a weather failure shouldn't hide the logs.
    try {
      const logsRes = await api.get<ObservationLog[]>(`/sessions/${selectedSessionId}/logs/`);
      if (!cancelled) setLogs(logsRes.data);
    } catch (err) {
      console.error(err);
      if (!cancelled) setError("Failed to load logs for this session.");
    }

    try {
      const weatherRes = await api.get<WeatherInfo>(`/sessions/${selectedSessionId}/weather/`);
      if (!cancelled) setWeather(weatherRes.data);
    } catch (err) {
      console.error(err);
      if (!cancelled) setWeather(null); // panel shows "No weather data."
    }
  })();

  return () => {
    cancelled = true;
  };
}, [selectedSessionId, selectedSession?.scheduled_start, tz]);


  const filteredSessions =
    selectedLocationId == null ? [] : sessions.filter((s) => s.location_id === selectedLocationId);

 

  // A flat, undated list makes "what's next" and "what have I done" the same
  // shape. Split it: what's still ahead of you, soonest first; then history,
  // newest first. Cancelled and past-dated planned sessions are history too —
  // they're no longer things you're going to do.
  const sessionGroups = useMemo(() => {
    const shown =
      sessionFilter === "all"
        ? filteredSessions
        : filteredSessions.filter((s) => s.status === sessionFilter);
    const now = Date.now();
    const at = (s: Session) => Date.parse(s.scheduled_start);
    const isUpcoming = (s: Session) => s.status === "planned" && at(s) >= now;

    const upcoming = shown.filter(isUpcoming).sort((a, b) => at(a) - at(b));
    const past = shown.filter((s) => !isUpcoming(s)).sort((a, b) => at(b) - at(a));

    return [
      { label: "Upcoming", rows: upcoming },
      { label: "Past", rows: past },
    ].filter((g) => g.rows.length > 0);
  }, [filteredSessions, sessionFilter]);

  // A filter that hides the selected session must not leave its detail panel
  // on screen — "No completed sessions" sitting directly above an open
  // PLANNED session is a straight contradiction. Drop the selection instead.
  useEffect(() => {
    if (selectedSessionId == null) return;
    if (!routerLocation.pathname.startsWith("/sessions")) return;
    const visible = sessionGroups.some((g) =>
      g.rows.some((s) => s.id === selectedSessionId),
    );
    // Replace, so clearing a hidden selection doesn't add a history entry
    // the Back button has to walk through.
    if (!visible) navigate("/sessions", { replace: true });
  }, [selectedSessionId, sessionGroups, routerLocation.pathname, navigate]);

  // Per-site counts for the Locations page — a site with history reads
  // differently from one you saved and never used.
  const sessionCountsFor = useCallback(
    (locationId: number) => {
      const mine = sessions.filter((s) => s.location_id === locationId);
      return {
        planned: mine.filter((s) => s.status === "planned").length,
        completed: mine.filter((s) => s.status === "completed").length,
      };
    },
    [sessions],
  );

  

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

  // Created from the search drawer: coordinates and timezone come from the
  // place the user confirmed, so there's nothing to parse or validate here.
  async function handleCreateLocationFromSearch(
    loc: NewLocation,
    useForPlanning: boolean,
  ) {
    const res = await api.post<Location>("/locations/", loc);
    setLocations((prev) => [...prev, res.data]);
    // Adding a site shouldn't silently move where you're planning from
    // unless that's what you asked for.
    if (useForPlanning) setSelectedLocationId(res.data.id);
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

  function handlePlanFromTonight(targetName: string, whenLocal: string) {
    setNewStart(whenLocal);
    setNewTarget(targetName);
    setCustomTarget("");
    // The form lives in a drawer now, so open it over the planner rather
    // than silently prefilling something the user can't see.
    setShowSessionDrawer(true);
  }

  async function handleUpdateSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editStart) {
      setError("Pick a start time.");
      return;
    }
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
      setShowSessionDrawer(false);
      // Planning is finished and there's now a concrete session to review
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
      const payload = {
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


  // Each tab is a stable user goal; the sections below are assembled here so
  // all the shared state (locations, sessions, logs) stays in one place and
  // switching tabs doesn't refetch or reset anything.
  // Creating a session is an action, not a destination: the drawer keeps
  // the list (or the planner) visible behind it, and on success the app
  // navigates to the new session's detail page.
  const newSessionDrawer = (
    <Drawer
      open={showSessionDrawer}
      title="New session"
      onClose={() => setShowSessionDrawer(false)}
    >
        <form onSubmit={handleCreateSession}
            style={{ display: "grid", gap: "0.1rem" }}>
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
                style={{ ...fieldStyle, marginTop: "0.2rem" }}
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
                  ...selectFieldStyle,
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
                <div style={metaLineStyle}>No preset targets are visible at that time. Choose Custom or change the time.</div>
              )}
              {visibleTargets.some(t => !t.visible) && (
                  <div style={{
                      ...metaLineStyle,
                      marginTop: "0.4rem",
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                    }}
                  >
                    Not visible: {summarizeHidden(visibleTargets)}
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
                  style={{ ...fieldStyle, marginTop: "0.2rem" }}
                />
              </label>
            </div>
          )}

        
          <button type="submit" style={{ ...btnPrimary, marginTop: "0.6rem" }}>
            Add Session
          </button>
        </form>
    </Drawer>
  );

  const plannerView = (
    <>
  {/* One observing context for the page: location · night · timezone */}
  {selectedLocationId != null && locations.length > 0 && (
    <ContextBar
      locations={locations}
      selectedLocationId={selectedLocationId}
      onSelectLocation={setSelectedLocationId}
      dateStr={dateStr}
      onDateChange={handleDateChange}
      tz={tz}
      forecasts={locationForecasts}
    />
  )}

  {/* Tonight at a glance — the page's centrepiece */}
  {selectedLocationId != null && (
    <TonightPanel
      locationId={selectedLocationId}
      locationName={selectedLocation?.name}
      tz={tz}
      dateStr={dateStr}
      onPlan={handlePlanFromTonight}
      onPickDate={handleDateChange}
    />
  )}

  {/* Which night to go out — clicking one moves the page's context */}
  {selectedLocationId != null && (
    <OutlookPanel
      locationId={selectedLocationId}
      tz={tz}
      selectedDate={dateStr}
      onPickDate={handleDateChange}
    />
  )}

  {/* Evaluated automatically whenever the night or site changes — the app
      can already work this out, so it shouldn't need a button. The advisor
      now lives inside the Tonight card, directly under the verdict. */}
  {selectedLocationId != null && locations.length > 1 && (
    <BestLocation
      dateStr={dateStr}
      tz={tz}
      selectedLocationId={selectedLocationId}
      onResults={setLocationForecasts}
      onPickLocation={setSelectedLocationId}
    />
  )}

    </>
  );

  const locationsView = (
    <LocationsPage
      locations={locations}
      currentLocationId={selectedLocationId}
      sessionCounts={sessionCountsFor}
      dateStr={dateStr}
      tz={tz}
      onUseForPlanning={(id) => {
        // Choosing a site here is a planning action, so finish the job and
        // take them to the Planner rather than leaving them on a list.
        setSelectedLocationId(id);
        navigate("/planner");
      }}
      onAdd={() => setShowAddLocation(true)}
      onSave={handleSaveLocation}
      onDelete={handleDeleteLocation}
    />
  );

  // One session row. Extracted because the list now renders it under two
  // headings (Upcoming / Past) rather than in a single flat sequence.
  const renderSessionRow = (s: Session) => (
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
                  style={{ ...selectFieldStyle, marginTop: "0.2rem" }}
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
                    Not visible: {summarizeHidden(editVisibleTargets)}
                  </div>
                )}
              </label>

              <label style={{ width: 140, fontSize: "0.8rem" }}>
                Status
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ ...selectFieldStyle, marginTop: "0.2rem" }}
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
                  style={{ ...fieldStyle, marginTop: "0.2rem" }}
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
                style={{ ...fieldStyle, marginTop: "0.2rem" }}
              />
            </label>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="submit" style={btnPrimarySm}>
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingSessionId(null)}
                style={btnSecondarySm}
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

                {/* Location matters once sessions span several sites */}
                <div style={{ fontSize: fontSize.small, color: textColor.secondary }}>
                  {formatSessionTime(s.scheduled_start, tz)}
                  {(() => {
                    const loc = locations.find((l) => l.id === s.location_id);
                    return loc ? ` · ${loc.name}` : "";
                  })()}
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

                  setEditStart(utcIsoToLocalInput(s.scheduled_start, tz));
                }}
                style={btnSecondarySm}
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
                <TrashIcon size={15} />
              </button>
            </div>
          </>
        )}
      </li>
  );

  const sessionsView = (
    <>
  {/* Sessions */}
  <section style={cardStyle}>
    <div style={panelHeaderRow}>
      <h3 style={{ ...sectionTitleStyle, margin: 0 }}>Sessions</h3>
      {/* One dominant action for this tab */}
      <button
        type="button"
        onClick={() => setShowSessionDrawer(true)}
        disabled={!selectedLocationId}
        style={{
          ...btnPrimarySm,
          marginLeft: "auto",
          marginRight: "0.5rem",
          opacity: selectedLocationId ? 1 : 0.5,
          cursor: selectedLocationId ? "pointer" : "not-allowed",
        }}
      >
        + New session
      </button>
      <button
        type="button"
        onClick={handleExportIcs}
        disabled={!selectedLocationId || filteredSessions.length === 0}
        style={{
          ...btnSecondarySm,
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
    </div>

    {/* Deselecting falls back to All, so there's no way to end up looking
        at an empty list you can't explain. */}
    <div style={{ marginBottom: "0.85rem" }}>
      <SegmentedControl
        options={["All", "Planned", "Completed"]}
        value={sessionFilter}
        onChange={(v) =>
          setSessionFilter((v as "all" | "planned" | "completed" | null) ?? "all")
        }
      />
    </div>

    <div
      style={{
        display: "flex",
        gap: "1rem",
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      {/* ~55/45 with the New Session form: the form's fields were
          cramped while this column ran mostly empty. */}
      <div style={{ flex: "1.1 1 340px", minWidth: 300 }}>
        {sessionGroups.map((g) => (
          <div key={g.label} style={{ marginBottom: "1rem" }}>
            <div
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: textColor.muted,
                marginBottom: "0.3rem",
              }}
            >
              {g.label} · {g.rows.length}
            </div>
            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
              {g.rows.map(renderSessionRow)}
            </ul>
          </div>
        ))}

        {sessionGroups.length === 0 && (
          <div style={hintBoxStyle}>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>
              {filteredSessions.length === 0
                ? "No sessions here yet"
                : `No ${sessionFilter} sessions`}
            </div>
            <div style={{ fontSize: fontSize.small, color: textColor.secondary }}>
              {filteredSessions.length === 0
                ? "Use “+ New session”, or “Plan session” on a target in the Tonight card to prefill it."
                : "Switch the filter above to see the rest."}
            </div>
          </div>
        )}
      </div>

      {/* Boxed so the form reads as its own block rather than loose
          fields floating beside a short list. */}
    </div>
  </section>

  {/* Session details: weather + logs */}
  {selectedSessionId && (
    <section style={cardStyle}>
      {/* The target is the subject of this panel, so it leads at title
          size with the status beside it; the date drops to its own
          line, and the forecast states its conclusion rather than
          leaving the user to interpret a cloud percentage. */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <h3
            style={{
              fontSize: fontSize.title,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {selectedSession?.target_name ?? "Session details"}
          </h3>
          {selectedSession && (
            <span style={statusPillStyle(selectedSession.status)}>
              {selectedSession.status}
            </span>
          )}
        </div>

        {selectedSession && (
          <div
            style={{
              fontSize: fontSize.body,
              color: textColor.secondary,
              marginTop: "0.25rem",
            }}
          >
            {formatSessionTime(selectedSession.scheduled_start, tz)}
          </div>
        )}

        {weather?.verdict && weather.verdict_reason && (
          <div
            style={{
              ...verdictPill(weather.verdict),
              marginTop: "0.6rem",
            }}
          >
            {weather.verdict_reason}
          </div>
        )}
      </div>
      <div
        className="flex-cols"
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
            flex: "1.2 1 360px", // grows a bit more than logs
            minWidth: 0,         // .flex-cols handles the phone case
            ...inset,
            padding: "0.85rem 1rem",
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
                    {weather.is_day == null ? "" : weather.is_day ? "Daytime" : "Night"}
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
            minWidth: 0,
            ...inset,
            padding: "0.85rem 1rem",
          }}
        >
          <div style={panelHeaderRow}>
            <h4 style={{ fontSize: "0.95rem", margin: 0 }}>Observation Logs</h4>

            <button
              type="button"
              onClick={() => setShowAddLog(v => !v)}
              style={{
                ...btnSecondarySm,
                background: showAddLog ? "rgba(59,130,246,0.15)" : "transparent",
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
                borderRadius: 12,
                border: line.hairline,
                background: surface.sunken,
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

              <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.6rem" }}>
                <div style={{ fontSize: "0.8rem" }}>
                  <div style={{ marginBottom: "0.3rem" }}>Seeing</div>
                  <SegmentedControl
                    options={QUALITY_OPTIONS}
                    value={newLogSeeing || null}
                    onChange={(v) => setNewLogSeeing(v ?? "")}
                  />
                </div>

                <div style={{ fontSize: "0.8rem" }}>
                  <div style={{ marginBottom: "0.3rem" }}>Transparency</div>
                  <SegmentedControl
                    options={QUALITY_OPTIONS}
                    value={newLogTransparency || null}
                    onChange={(v) => setNewLogTransparency(v ?? "")}
                  />
                </div>

                <div style={{ fontSize: "0.8rem" }}>
                  <div style={{ marginBottom: "0.3rem" }}>Rating</div>
                  <StarRating
                    value={newLogRating === "" ? null : newLogRating}
                    onChange={(v) => setNewLogRating(v ?? "")}
                  />
                </div>
              </div>

              <button type="submit" style={{ ...btnPrimarySm, marginTop: "0.6rem" }}>
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
                    border: line.hairline,
                    background: surface.sunken,
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

                      <div style={{ display: "grid", gap: "0.6rem" }}>
                        <div style={{ fontSize: "0.8rem" }}>
                          <div style={{ marginBottom: "0.3rem" }}>Seeing</div>
                          <SegmentedControl
                            options={QUALITY_OPTIONS}
                            value={editSeeing || null}
                            onChange={(v) => setEditSeeing(v ?? "")}
                          />
                          {editSeeing && !QUALITY_OPTIONS.includes(editSeeing.toLowerCase()) && (
                            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                              Keeping the earlier value “{editSeeing}” until you pick one.
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: "0.8rem" }}>
                          <div style={{ marginBottom: "0.3rem" }}>Transparency</div>
                          <SegmentedControl
                            options={QUALITY_OPTIONS}
                            value={editTransparency || null}
                            onChange={(v) => setEditTransparency(v ?? "")}
                          />
                          {editTransparency && !QUALITY_OPTIONS.includes(editTransparency.toLowerCase()) && (
                            <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.25rem" }}>
                              Keeping the earlier value “{editTransparency}” until you pick one.
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: "0.8rem" }}>
                          <div style={{ marginBottom: "0.3rem" }}>Rating</div>
                          <StarRating
                            value={editRating === "" ? null : editRating}
                            onChange={(v) => setEditRating(v ?? "")}
                          />
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button type="submit" style={btnPrimarySm}>
                          Save
                        </button>

                        <button
                          type="button"
                          onClick={() => setEditingLogId(null)}
                          style={btnSecondarySm}
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
                          <span style={{ ...statValueStyle, textTransform: "capitalize" }}>
                            {log.seeing ?? "—"}
                          </span>
                        </div>
                        <div style={statChipStyle}>
                          <span style={statLabelStyle}>Transparency</span>
                          <span style={{ ...statValueStyle, textTransform: "capitalize" }}>
                            {log.transparency ?? "—"}
                          </span>
                        </div>
                        <div style={statChipStyle}>
                          <span style={statLabelStyle}>Rating</span>
                          <StarRating value={log.rating ?? null} readOnly size="0.95rem" />
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
                        style={{ ...btnSecondarySm, marginTop: "0.6rem" }}
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
    </>
  );

  return (
    <div style={{ ...appShellStyle, position: "relative" }}>
      <SpaceBackground targetName={backgroundTargetName} />
      <div style={{ ...appInnerStyle, position: "relative", zIndex: 1 }}>
        {/* One app bar rather than a brand row stacked above a tab row. The
            tabs used to sit alone on their own line with the whole right-hand
            side empty, which made the shell read as an afterthought above the
            app. Brand, navigation and account now share a single baseline and
            a single rule. */}
        <header className="app-bar" style={appBarStyle}>
          <div style={{ minWidth: 0 }}>
            <div style={pillStyle}>Observation Planner</div>
            <h1
              style={{
                fontSize: "1.32rem",
                fontWeight: 700,
                margin: "0.1rem 0 0",
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              AstroPlanner
            </h1>
          </div>

          <TabNav />

          <button onClick={onLogout} style={{ ...btnSecondarySm, marginLeft: "auto" }}>
            Logout
          </button>
        </header>

        {loading && <div>Loading…</div>}
        {error && <div style={{ color: "#fca5a5" }}>{error}</div>}

        {/* Sections arrive in reading order rather than all at once, so the
            page assembles itself the way you read it. */}
        <div className="stagger">
          <Routes>
            <Route path="/planner" element={plannerView} />
            <Route path="/sessions" element={sessionsView} />
            <Route path="/sessions/:sessionId" element={sessionsView} />
            <Route path="/locations" element={locationsView} />
            <Route path="*" element={<Navigate to="/planner" replace />} />
          </Routes>
        </div>
      </div>
      {newSessionDrawer}
      <AddLocationDrawer
        open={showAddLocation}
        onClose={() => setShowAddLocation(false)}
        nearLat={selectedLocation?.latitude ?? null}
        nearLon={selectedLocation?.longitude ?? null}
        onCreate={handleCreateLocationFromSearch}
      />
    </div>
  );
}
