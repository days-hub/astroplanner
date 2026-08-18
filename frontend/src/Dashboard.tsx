import type React from "react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Drawer from "./Drawer";
import AddLocationDrawer, { type NewLocation } from "./AddLocationDrawer";
import { SegmentedControl, StarRating } from "./controls";
import {
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
  preparation_notes?: string | null;
}
interface ObservationLog {
  id: number;
  notes: string;
  seeing?: string | null;
  transparency?: string | null;
  rating?: number | null;
  equipment?: string | null;
  exposure?: string | null;
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
  maxWidth: 1240,
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
  position: "sticky",
  top: 0,
  zIndex: 30,
  padding: "0.55rem 0.75rem 0",
  marginLeft: "-0.75rem",
  marginRight: "-0.75rem",
  marginBottom: "0.4rem",
  borderRadius: "0 0 14px 14px",
  borderBottom: "1px solid rgba(148,163,184,0.22)",
  background:
    "linear-gradient(180deg, rgba(7,12,25,0.94), rgba(7,12,25,0.82))",
  backdropFilter: "blur(18px) saturate(130%)",
  WebkitBackdropFilter: "blur(18px) saturate(130%)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.22)",
};

const pillStyle: React.CSSProperties = {
  fontSize: fontSize.small,
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  color: "#a855f7",
};
const statusPillBase: React.CSSProperties = {
  fontSize: fontSize.small,
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
  fontSize: fontSize.small,
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
  fontSize: fontSize.small,
  color: "#9ca3af",
};

const statValueStyle: React.CSSProperties = {
  fontSize: fontSize.body,
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
type ObservingContext = {
  date_local: string;
  phase: "active" | "upcoming";
  now_local: string;
  rollover_local?: string | null;
};
const PRESET_TARGETS = [
  "Mercury",
  "Saturn",
  "Jupiter",
  "Mars",
  "Venus",
  "Uranus",
  "Neptune",
  "Moon",
  "Orion Nebula (M42)",
  "Andromeda Galaxy (M31)",
  "Pleiades (M45)",
  "Triangulum Galaxy (M33)",
  "Double Cluster (NGC 869/884)",
  "Crab Nebula (M1)",
  "M35 Open Cluster",
  "Beehive Cluster (M44)",
  "Bode's Galaxy (M81)",
  "Cigar Galaxy (M82)",
  "Owl Nebula (M97)",
  "Messier 106 Galaxy",
  "Sombrero Galaxy (M104)",
  "Black Eye Galaxy (M64)",
  "Sunflower Galaxy (M63)",
  "Whirlpool Galaxy (M51)",
  "Messier 3 Cluster",
  "Pinwheel Galaxy (M101)",
  "Messier 5 Cluster",
  "Hercules Cluster (M13)",
  "Messier 12 Cluster",
  "Messier 10 Cluster",
  "Messier 92 Cluster",
  "Trifid Nebula (M20)",
  "Lagoon Nebula (M8)",
  "Eagle Nebula (M16)",
  "Omega Nebula (M17)",
  "Messier 22 Cluster",
  "Wild Duck Cluster (M11)",
  "Ring Nebula (M57)",
  "Dumbbell Nebula (M27)",
  "Veil Nebula (NGC 6960)",
  "North America Nebula (NGC 7000)",
  "Messier 15 Cluster",
  "Messier 2 Cluster",
  "Blue Snowball Nebula (NGC 7662)",
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
    .map(([label, names]) => {
      const sample = names.slice(0, 3).join(", ");
      const rest = names.length > 3 ? ` +${names.length - 3} more` : "";
      return `${sample}${rest} (${label})`;
    })
    .join(" · ");
}

interface SessionNightInfo {
  dark_start?: string | null;
  dark_end?: string | null;
  sunset?: string | null;
  sunrise?: string | null;
  moon_illumination: number;
  moon_up_fraction?: number | null;
}

type SessionDisplayStatus = "planned" | "completed" | "cancelled" | "missed";

function displaySessionStatus(session: Session): SessionDisplayStatus {
  if (session.status === "planned" && Date.parse(session.scheduled_start) < Date.now()) {
    return "missed";
  }
  if (session.status === "completed" || session.status === "cancelled") {
    return session.status;
  }
  return "planned";
}
export default function Dashboard({ onLogout }: Props) {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // The ?location= deep link is an *initial* condition, read once at mount.
  // It can't go in the loader's dependency array: that effect also triggers
  // the URL rewrite below, so depending on searchParams would refetch every
  // location and session each time the query string changed.
  const initialLocationParam = useRef(searchParams.get("location"));

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
  const [sessionFilter, setSessionFilter] = useState<"all" | SessionDisplayStatus>("all");
  const [sessionSearch, setSessionSearch] = useState("");
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
  const [newPreparationNotes, setNewPreparationNotes] = useState("");
  // The night the whole page is about — Tonight, the advisor, and the
  // session form all read this (see ContextBar).
  const [dateIsAutomatic, setDateIsAutomatic] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("date");
    return !(fromUrl && /^\d{4}-\d{2}-\d{2}$/.test(fromUrl));
  });
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
  const [newLogEquipment, setNewLogEquipment] = useState("");
  const [newLogExposure, setNewLogExposure] = useState("");

  // Edit-log state
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editSeeing, setEditSeeing] = useState("");
  const [editTransparency, setEditTransparency] = useState("");
  const [editRating, setEditRating] = useState<number | "">("");
  const [editEquipment, setEditEquipment] = useState("");
  const [editExposure, setEditExposure] = useState("");
  const [editPreparationNotes, setEditPreparationNotes] = useState("");
  const [sessionTarget, setSessionTarget] = useState<VisibleTarget | null>(null);
  const [sessionNight, setSessionNight] = useState<SessionNightInfo | null>(null);

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
    if (s === "missed") {
      return {
        ...statusPillBase,
        border: "1px solid rgba(251,191,36,0.35)",
        background: "rgba(245,158,11,0.13)",
        color: "#fcd34d",
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
  function formatSessionRowTime(iso: string, timeZone: string) {
    const d = parseApiDate(iso);
    try {
      const datePart = d.toLocaleDateString(undefined, {
        timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const timePart = d.toLocaleTimeString(undefined, {
        timeZone,
        hour: "numeric",
        minute: "2-digit",
      });
      return `${datePart} · ${timePart}`;
    } catch {
      return d.toLocaleString();
    }
  }

  function sessionTimeZone(session: Session) {
    return locations.find((location) => location.id === session.location_id)?.timezone || tz;
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
          const wanted = Number(initialLocationParam.current);
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

// Ask the astronomy layer which evening-date owns the current night. A
// browser calendar flips at midnight, but an observing night runs until the
// selected site's darkness ends. Explicit URL/date choices remain untouched.
useEffect(() => {
  if (selectedLocationId == null || !dateIsAutomatic) return;
  let cancelled = false;

  api.get<ObservingContext>("/targets/observing-context", {
    params: { location_id: selectedLocationId, tz },
  }).then((res) => {
    if (cancelled) return;
    setDateStr(res.data.date_local);
    setNewStart(`${res.data.date_local}T22:00`);
  }).catch((err) => {
    // The local calendar date remains a safe fallback if astronomy lookup is
    // temporarily unavailable; the Tonight card will surface its own error.
    console.error(err);
  });

  return () => {
    cancelled = true;
  };
}, [selectedLocationId, tz, dateIsAutomatic]);

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
  setDateIsAutomatic(false);
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
    const editingSession = sessions.find((session) => session.id === editingSessionId);
    if (!editingSession || !editStart) {
      setEditVisibleTargets([]);
      return;
    }

    const editingTz = locations.find((location) => location.id === editingSession.location_id)?.timezone || tz;

    try {
      const res = await api.get<VisibleTarget[]>("/targets/visible", {
        params: {
          location_id: editingSession.location_id,
          when_local: editStart,
          tz: editingTz,
        },
      });
      setEditVisibleTargets(res.data);
    } catch (e) {
      console.error(e);
      setEditVisibleTargets([]);
    }
  }
  loadEditTargets();
}, [editingSessionId, editStart, sessions, locations, tz]);

  
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
  setShowAddLog(false);
  setEditingLogId(null);
  setEditingSessionId(null);
  if (!selectedSessionId || !selectedSession) {
    setLogs([]);
    setWeather(null);
    setSessionTarget(null);
    setSessionNight(null);
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

    const location = locations.find((item) => item.id === selectedSession.location_id);
    const sessionTz = location?.timezone || tz;
    try {
      const targetRes = await api.get<VisibleTarget[]>("/targets/visible", {
        params: {
          location_id: selectedSession.location_id,
          when: selectedSession.scheduled_start,
        },
      });
      if (!cancelled) {
        setSessionTarget(
          targetRes.data.find(
            (target) => target.name.toLowerCase() === selectedSession.target_name.toLowerCase(),
          ) ?? null,
        );
      }
    } catch (err) {
      console.error(err);
      if (!cancelled) setSessionTarget(null);
    }

    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: sessionTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
      }).formatToParts(parseApiDate(selectedSession.scheduled_start));
      const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
      const owningDate = new Date(Date.UTC(part("year"), part("month") - 1, part("day") - (part("hour") < 12 ? 1 : 0)));
      const nightRes = await api.get<SessionNightInfo>("/targets/night", {
        params: {
          location_id: selectedSession.location_id,
          date_local: owningDate.toISOString().slice(0, 10),
          tz: sessionTz,
        },
      });
      if (!cancelled) setSessionNight(nightRes.data);
    } catch (err) {
      console.error(err);
      if (!cancelled) setSessionNight(null);
    }
  })();

  return () => {
    cancelled = true;
  };
}, [selectedSessionId, selectedSession, locations, tz]);

  const filteredSessions = sessions;
  const showSessionLocations = new Set(filteredSessions.map((session) => session.location_id)).size > 1;

 

  // A flat, undated list makes "what's next" and "what have I done" the same
  // shape. Split it: what's still ahead of you, soonest first; then history,
  // newest first. Cancelled and past-dated planned sessions are history too —
  // they're no longer things you're going to do.
  const sessionGroups = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    const searched = query
      ? filteredSessions.filter((session) => {
          const locationName = locations.find((location) => location.id === session.location_id)?.name ?? "";
          return `${session.target_name} ${locationName}`.toLowerCase().includes(query);
        })
      : filteredSessions;
    const shown = sessionFilter === "all"
      ? searched
      : searched.filter((session) => displaySessionStatus(session) === sessionFilter);
    const now = Date.now();
    const at = (s: Session) => Date.parse(s.scheduled_start);
    const isUpcoming = (s: Session) => displaySessionStatus(s) === "planned" && at(s) >= now;

    const upcoming = shown.filter(isUpcoming).sort((a, b) => at(a) - at(b));
    const past = shown.filter((s) => !isUpcoming(s)).sort((a, b) => at(b) - at(a));

    return [
      { label: "Upcoming", rows: upcoming },
      { label: "Past", rows: past },
    ].filter((g) => g.rows.length > 0);
  }, [filteredSessions, sessionFilter, sessionSearch, locations]);

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
        planned: mine.filter((s) => displaySessionStatus(s) === "planned").length,
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

  function beginEditSession(session: Session) {
    setEditingSessionId(session.id);
    setEditStatus(session.status || "planned");
    const isPreset = PRESET_TARGETS.includes(session.target_name);
    setEditTarget(isPreset ? session.target_name : "Custom");
    setEditCustomTarget(isPreset ? "" : session.target_name);
    setEditStart(utcIsoToLocalInput(session.scheduled_start, sessionTimeZone(session)));
    setEditPreparationNotes(session.preparation_notes ?? "");
  }

  async function handleSessionStatus(status: "planned" | "completed" | "cancelled") {
    if (!selectedSession) return;
    setError(null);
    try {
      const res = await api.patch<Session>(`/sessions/${selectedSession.id}`, { status });
      setSessions((prev) => prev.map((session) => session.id === res.data.id ? res.data : session));
      if (status === "completed") setShowAddLog(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update session status.");
    }
  }

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
        preparation_notes: editPreparationNotes.trim() || null,
      };


      const res = await api.patch<Session>(`/sessions/${editingSessionId}`, payload);

      setSessions((prev) =>
        prev.map((s) => (s.id === editingSessionId ? res.data : s)),
      );
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
        preparation_notes: newPreparationNotes.trim() || null,
      });
      setSessions((prev) => [...prev, res.data]);
      setShowSessionDrawer(false);
      setNewPreparationNotes("");
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
        equipment: newLogEquipment.trim() || null,
        exposure: newLogExposure.trim() || null,
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
      setNewLogEquipment("");
      setNewLogExposure("");
      setSessions((prev) => prev.map((session) =>
        session.id === selectedSessionId ? { ...session, status: "completed" } : session,
      ));
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
        equipment: editEquipment.trim() || null,
        exposure: editExposure.trim() || null,
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
                fontSize: fontSize.small,
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
                fontSize: fontSize.small,
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
                  fontSize: fontSize.small,
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

          <label
            style={{
              display: "block",
              fontSize: fontSize.small,
              marginBottom: "0.2rem",
            }}
          >
            Preparation notes <span style={{ color: textColor.muted }}>(optional)</span>
            <textarea
              value={newPreparationNotes}
              onChange={(e) => setNewPreparationNotes(e.target.value)}
              rows={3}
              placeholder="Gear, eyepieces, filters, or a short observing plan"
              style={{ ...fieldStyle, marginTop: "0.2rem", resize: "vertical" }}
            />
          </label>

        
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

  const renderSimpleSessionRow = (session: Session) => {
    const displayStatus = displaySessionStatus(session);
    const location = locations.find((item) => item.id === session.location_id);
    return (
      <li key={session.id} className="session-row">
        <button
          type="button"
          className="session-row-button"
          onClick={() => setSelectedSessionId(session.id)}
          aria-current={session.id === selectedSessionId ? "true" : undefined}
        >
          <span className="session-row-copy">
            <strong>{session.target_name}</strong>
            <span>
              {formatSessionRowTime(session.scheduled_start, sessionTimeZone(session))}
              {showSessionLocations && location ? ` · ${location.name}` : ""}
            </span>
          </span>
          {displayStatus !== "planned" && (
            <span style={statusPillStyle(displayStatus)}>{displayStatus}</span>
          )}
        </button>
      </li>
    );
  };

  const sessionListPanel = (
  <section className="session-master" style={cardStyle}>
    <div style={{ ...panelHeaderRow, flexWrap: "wrap" }}>
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
        options={["All", "Planned", "Completed", "Missed", "Cancelled"]}
        value={sessionFilter}
        onChange={(v) =>
          setSessionFilter((v as "all" | SessionDisplayStatus | null) ?? "all")
        }
      />
    </div>

    {filteredSessions.length >= 8 && (
      <label className="session-search">
        <span className="sr-only">Search sessions</span>
        <input
          type="search"
          value={sessionSearch}
          onChange={(event) => setSessionSearch(event.target.value)}
          placeholder="Search targets or locations"
          style={fieldStyle}
        />
      </label>
    )}

    <div
      className="session-list-scroll"
      style={{
        minHeight: 0,
        overflowY: "auto",
        paddingRight: "0.2rem",
      }}
    >
      <div style={{ minWidth: 0 }}>
        {sessionGroups.map((g) => (
          <div key={g.label} style={{ marginBottom: "1rem" }}>
            <div
              style={{
                fontSize: fontSize.small,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: textColor.muted,
                marginBottom: "0.3rem",
              }}
            >
              {g.label} · {g.rows.length}
            </div>
            <ul style={{ listStyle: "none", paddingLeft: 0, margin: 0 }}>
              {g.rows.map(renderSimpleSessionRow)}
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

    </div>
  </section>
  );

  const selectedDisplayStatus = selectedSession ? displaySessionStatus(selectedSession) : null;
  const sessionHasStarted = selectedSession
    ? Date.parse(selectedSession.scheduled_start) <= Date.now()
    : false;
  const canAddLog = Boolean(
    selectedSession && sessionHasStarted && selectedDisplayStatus !== "cancelled",
  );
  const sessionLocation = selectedSession
    ? locations.find((location) => location.id === selectedSession.location_id)
    : null;
  const detailTimeZone = selectedSession ? sessionTimeZone(selectedSession) : tz;
  const formatAstronomyTime = (iso?: string | null) => iso
    ? parseApiDate(iso).toLocaleTimeString(undefined, {
        timeZone: detailTimeZone,
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  const sessionDetailPanel = selectedSessionId ? (
    <section className="session-detail" style={cardStyle}>
      <button
        type="button"
        className="session-mobile-back"
        onClick={() => navigate("/sessions", { replace: true })}
        style={{ ...btnSecondarySm, marginBottom: "0.9rem" }}
      >
        ← Sessions
      </button>
      {/* The target is the subject of this panel, so it leads at title
          size with the status beside it; the date drops to its own
          line, and the forecast states its conclusion rather than
          leaving the user to interpret a cloud percentage. */}
      <div className="session-detail-header" style={{ marginBottom: "1rem" }}>
        {selectedSession && (
          <div className="session-detail-actions">
            <button type="button" onClick={() => beginEditSession(selectedSession)} style={btnSecondarySm}>
              Edit
            </button>
            {(selectedDisplayStatus === "planned" || selectedDisplayStatus === "missed") && (
              <button type="button" onClick={() => handleSessionStatus("completed")} style={btnPrimarySm}>
                Mark complete
              </button>
            )}
            {(selectedDisplayStatus === "planned" || selectedDisplayStatus === "missed") && (
              <button type="button" onClick={() => handleSessionStatus("cancelled")} style={btnSecondarySm}>
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={() => handleDeleteSession(selectedSession.id)}
              style={{ ...btnSecondarySm, color: "#fca5a5", borderColor: "rgba(248,113,113,0.4)" }}
            >
              Delete
            </button>
          </div>
        )}
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
            <span style={statusPillStyle(selectedDisplayStatus ?? selectedSession.status)}>
              {selectedDisplayStatus ?? selectedSession.status}
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
            {formatSessionTime(selectedSession.scheduled_start, detailTimeZone)}
            {showSessionLocations && sessionLocation ? ` · ${sessionLocation.name}` : ""}
          </div>
        )}

        {selectedDisplayStatus !== "completed" && weather?.verdict && weather.verdict_reason && (
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
      {selectedSession && editingSessionId === selectedSession.id && (
        <form onSubmit={handleUpdateSession} className="session-edit-panel" style={inset}>
          <div className="session-edit-grid">
            <label>
              Target
              <select value={editTarget} onChange={(e) => setEditTarget(e.target.value)} style={selectFieldStyle}>
                {editVisibleTargets.filter((target) => target.visible).map((target) => (
                  <option key={target.name} value={target.name}>
                    {target.name} (alt {Math.round(target.altitude_deg)}°)
                  </option>
                ))}
                <option value="Custom">Custom</option>
              </select>
            </label>
            <label>
              Start time
              <input
                type="datetime-local"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
                onPointerDown={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()}
                style={fieldStyle}
              />
            </label>
            <label>
              Status
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} style={selectFieldStyle}>
                {SESSION_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
          {editTarget === "Custom" && (
            <label>
              Custom target
              <input value={editCustomTarget} onChange={(e) => setEditCustomTarget(e.target.value)} style={fieldStyle} />
            </label>
          )}
          <label>
            Preparation notes
            <textarea
              value={editPreparationNotes}
              onChange={(e) => setEditPreparationNotes(e.target.value)}
              rows={3}
              style={{ ...fieldStyle, resize: "vertical" }}
            />
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" style={btnPrimarySm}>Save changes</button>
            <button type="button" onClick={() => setEditingSessionId(null)} style={btnSecondarySm}>Close</button>
          </div>
        </form>
      )}
      <div
        className={`session-detail-columns${selectedDisplayStatus === "planned" || selectedDisplayStatus === "missed" ? " session-detail-planned" : ""}`}
        style={{
          alignItems: "flex-start",
        }}
      >
        {/* Weather */}
        <div
          className="session-weather-panel"
          style={{
            minWidth: 0,
            ...inset,
            padding: "0.85rem 1rem",
          }}
        >
          <h4 style={{ fontSize: "0.95rem", marginBottom: "0.35rem" }}>
            {selectedDisplayStatus === "completed" ? "Actual conditions" : "Forecast"}
          </h4>

          <div style={weatherSubtitleStyle}>
            {selectedDisplayStatus === "completed"
              ? "Recorded during this observing session"
              : selectedSession
              ? `Forecast for ${parseApiDate(selectedSession.scheduled_start).toLocaleString(undefined, {
                  timeZone: detailTimeZone,
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}`
              : "Forecast time unavailable"}
          </div>

          {selectedDisplayStatus === "completed" ? (
            logs.length > 0 ? (
              <>
                <div style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.8rem" }}>
                  {logs[0].notes || "Observation recorded"}
                </div>
                <div style={statGridStyle}>
                  <div style={statChipStyle}>
                    <span style={statLabelStyle}>Seeing</span>
                    <span style={{ ...statValueStyle, textTransform: "capitalize" }}>{logs[0].seeing ?? "—"}</span>
                  </div>
                  <div style={statChipStyle}>
                    <span style={statLabelStyle}>Transparency</span>
                    <span style={{ ...statValueStyle, textTransform: "capitalize" }}>{logs[0].transparency ?? "—"}</span>
                  </div>
                  <div style={statChipStyle}>
                    <span style={statLabelStyle}>Rating</span>
                    <StarRating value={logs[0].rating ?? null} readOnly size="0.95rem" />
                  </div>
                </div>
              </>
            ) : (
              <p style={{ color: textColor.secondary }}>No actual conditions have been recorded yet.</p>
            )
          ) : weather ? (
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
                  <div style={{ fontSize: fontSize.small, color: "#9ca3af" }}>
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

          {selectedDisplayStatus !== "completed" && selectedDisplayStatus !== "cancelled" && (
            <div className="session-plan-facts">
              <h4>Observing plan</h4>
              <div className="session-forecast-stats" style={statGridStyle}>
                <div style={statChipStyle}>
                  <span style={statLabelStyle}>Target position</span>
                  <span style={statValueStyle}>
                    {sessionTarget
                      ? `${Math.round(sessionTarget.altitude_deg)}° · ${degToCompass(sessionTarget.azimuth_deg) ?? "—"}`
                      : "—"}
                  </span>
                </div>
                <div style={statChipStyle}>
                  <span style={statLabelStyle}>Moon</span>
                  <span style={statValueStyle}>
                    {sessionNight
                      ? `${Math.round(sessionNight.moon_illumination * 100)}% · ${Math.round((sessionNight.moon_up_fraction ?? 0) * 100)}% of dark window`
                      : "—"}
                  </span>
                </div>
                <div style={{ ...statChipStyle, gridColumn: "1 / -1" }}>
                  <span style={statLabelStyle}>Best dark window</span>
                  <span style={statValueStyle}>
                    {formatAstronomyTime(sessionNight?.dark_start ?? sessionNight?.sunset)}–{formatAstronomyTime(sessionNight?.dark_end ?? sessionNight?.sunrise)}
                  </span>
                </div>
              </div>
              <div className="session-prep-notes">
                <span style={statLabelStyle}>Preparation</span>
                <p>{selectedSession?.preparation_notes || "No preparation notes yet. Use Edit to add gear, filters, or a checklist."}</p>
              </div>
            </div>
          )}

        </div>

        {(selectedDisplayStatus === "planned" || selectedDisplayStatus === "missed") && (
          <div className="session-plan-panel" style={{ ...inset, padding: "0.85rem 1rem" }}>
            <h4 style={{ fontSize: "0.95rem", margin: "0 0 0.35rem" }}>Observing plan</h4>
            <div style={weatherSubtitleStyle}>Astronomy at the scheduled start time</div>
            <div className="session-plan-grid">
              <div className="session-plan-fact">
                <span>Target position</span>
                <strong>
                  {sessionTarget
                    ? `${Math.round(sessionTarget.altitude_deg)}° · ${degToCompass(sessionTarget.azimuth_deg) ?? "—"}`
                    : "—"}
                </strong>
              </div>
              <div className="session-plan-fact">
                <span>Moon interference</span>
                <strong>{sessionNight ? `${Math.round(sessionNight.moon_illumination * 100)}% illuminated` : "—"}</strong>
                {sessionNight && (
                  <small>Above the horizon for {Math.round((sessionNight.moon_up_fraction ?? 0) * 100)}% of darkness</small>
                )}
              </div>
              <div className="session-plan-fact session-plan-window">
                <span>Best dark window</span>
                <strong>
                  {formatAstronomyTime(sessionNight?.dark_start ?? sessionNight?.sunset)}–{formatAstronomyTime(sessionNight?.dark_end ?? sessionNight?.sunrise)}
                </strong>
              </div>
            </div>
            <div className="session-prep-notes">
              <span style={statLabelStyle}>Preparation</span>
              <p>{selectedSession?.preparation_notes || "No preparation notes yet. Use Edit to add gear, filters, or a checklist."}</p>
            </div>
          </div>
        )}

        {/* Logs + Add/Edit */}
        <div
          className="session-logs-panel"
          style={{
            minWidth: 0,
            ...inset,
            padding: "0.85rem 1rem",
          }}
        >
          <div style={panelHeaderRow}>
            <h4 style={{ fontSize: "0.95rem", margin: 0 }}>Observation Logs</h4>

            {canAddLog ? (
              <button
                type="button"
                onClick={() => setShowAddLog(v => !v)}
                style={{
                  ...btnSecondarySm,
                  background: showAddLog ? "rgba(59,130,246,0.15)" : "transparent",
                }}
              >
                {showAddLog
                  ? "Close"
                  : selectedDisplayStatus === "missed"
                    ? "Complete & add log"
                    : "+ Add log"}
              </button>
            ) : (
              <span style={{ fontSize: fontSize.small, color: textColor.muted }}>
                {selectedDisplayStatus === "cancelled" ? "Cancelled" : "Available when session begins"}
              </span>
            )}
          </div>

          {showAddLog && canAddLog && (
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
              <label style={{ display: "block", fontSize: fontSize.small }}>
                Notes
                <textarea
                  value={newLogNotes}
                  onChange={(e) => setNewLogNotes(e.target.value)}
                  rows={3}
                  style={{ ...fieldStyle, marginTop: "0.25rem", resize: "vertical" }}
                />
              </label>

              <div className="session-log-meta-fields">
                <label>
                  Equipment
                  <input
                    value={newLogEquipment}
                    onChange={(event) => setNewLogEquipment(event.target.value)}
                    placeholder="Telescope, eyepiece, camera"
                    style={fieldStyle}
                  />
                </label>
                <label>
                  Exposure
                  <input
                    value={newLogExposure}
                    onChange={(event) => setNewLogExposure(event.target.value)}
                    placeholder="e.g. 30 × 120s, ISO 800"
                    style={fieldStyle}
                  />
                </label>
              </div>

              <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.6rem" }}>
                <div style={{ fontSize: fontSize.small }}>
                  <div style={{ marginBottom: "0.3rem" }}>Seeing</div>
                  <SegmentedControl
                    options={QUALITY_OPTIONS}
                    value={newLogSeeing || null}
                    onChange={(v) => setNewLogSeeing(v ?? "")}
                  />
                </div>

                <div style={{ fontSize: fontSize.small }}>
                  <div style={{ marginBottom: "0.3rem" }}>Transparency</div>
                  <SegmentedControl
                    options={QUALITY_OPTIONS}
                    value={newLogTransparency || null}
                    onChange={(v) => setNewLogTransparency(v ?? "")}
                  />
                </div>

                <div style={{ fontSize: fontSize.small }}>
                  <div style={{ marginBottom: "0.3rem" }}>Rating</div>
                  <StarRating
                    value={newLogRating === "" ? null : newLogRating}
                    onChange={(v) => setNewLogRating(v ?? "")}
                  />
                </div>
              </div>

              <button type="submit" style={{ ...btnPrimarySm, marginTop: "0.6rem" }}>
                {selectedDisplayStatus === "missed" ? "Mark complete & add log" : "Add log"}
              </button>
            </form>
          )}
          {/* Existing logs */}
          {logs.length === 0 ? (
            <div
              style={{
                fontSize: fontSize.small,
                color: "#9ca3af",
                padding: "0.6rem 0.2rem 0.2rem",
              }}
            >
              {canAddLog
                ? "No logs yet. Add one to record what you saw."
                : sessionHasStarted
                  ? "No logs can be added to this cancelled session."
                  : "No logs yet. Logging becomes available when the session begins."}
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
                      <label style={{ fontSize: fontSize.small }}>
                        Notes
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={3}
                          style={{ ...fieldStyle, marginTop: "0.25rem", resize: "vertical" }}
                        />
                      </label>

                      <div className="session-log-meta-fields">
                        <label>
                          Equipment
                          <input value={editEquipment} onChange={(event) => setEditEquipment(event.target.value)} style={fieldStyle} />
                        </label>
                        <label>
                          Exposure
                          <input value={editExposure} onChange={(event) => setEditExposure(event.target.value)} style={fieldStyle} />
                        </label>
                      </div>

                      <div style={{ display: "grid", gap: "0.6rem" }}>
                        <div style={{ fontSize: fontSize.small }}>
                          <div style={{ marginBottom: "0.3rem" }}>Seeing</div>
                          <SegmentedControl
                            options={QUALITY_OPTIONS}
                            value={editSeeing || null}
                            onChange={(v) => setEditSeeing(v ?? "")}
                          />
                          {editSeeing && !QUALITY_OPTIONS.includes(editSeeing.toLowerCase()) && (
                            <div style={{ fontSize: fontSize.small, color: "#9ca3af", marginTop: "0.25rem" }}>
                              Keeping the earlier value “{editSeeing}” until you pick one.
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: fontSize.small }}>
                          <div style={{ marginBottom: "0.3rem" }}>Transparency</div>
                          <SegmentedControl
                            options={QUALITY_OPTIONS}
                            value={editTransparency || null}
                            onChange={(v) => setEditTransparency(v ?? "")}
                          />
                          {editTransparency && !QUALITY_OPTIONS.includes(editTransparency.toLowerCase()) && (
                            <div style={{ fontSize: fontSize.small, color: "#9ca3af", marginTop: "0.25rem" }}>
                              Keeping the earlier value “{editTransparency}” until you pick one.
                            </div>
                          )}
                        </div>

                        <div style={{ fontSize: fontSize.small }}>
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
                        {log.equipment && (
                          <div style={{ ...statChipStyle, gridColumn: "1 / -1" }}>
                            <span style={statLabelStyle}>Equipment</span>
                            <span style={statValueStyle}>{log.equipment}</span>
                          </div>
                        )}
                        {log.exposure && (
                          <div style={{ ...statChipStyle, gridColumn: "1 / -1" }}>
                            <span style={statLabelStyle}>Exposure</span>
                            <span style={statValueStyle}>{log.exposure}</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingLogId(log.id);
                          setEditNotes(log.notes);
                          setEditSeeing(log.seeing ?? "");
                          setEditTransparency(log.transparency ?? "");
                          setEditRating(log.rating ?? "");
                          setEditEquipment(log.equipment ?? "");
                          setEditExposure(log.exposure ?? "");
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
  ) : (
    <section className="session-detail session-detail-empty" style={cardStyle}>
      <div style={{ maxWidth: "24rem", textAlign: "center" }}>
        <h3 style={{ fontSize: fontSize.section, margin: 0 }}>Select a session</h3>
        <p style={{ fontSize: fontSize.body, color: textColor.secondary, margin: "0.45rem 0 0" }}>
          Choose a session to see its planned weather and observation logs.
        </p>
      </div>
    </section>
  );

  const sessionsView = (
    <div className={`session-workspace${selectedSessionId ? " has-selection" : ""}`}>
      {sessionListPanel}
      {sessionDetailPanel}
    </div>
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
