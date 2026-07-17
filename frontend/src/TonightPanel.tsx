// src/TonightPanel.tsx
//
// "Tonight at a glance": darkness window, moon, and ranked visible targets
// for the selected location. Clicking a target prefills the New Session form.
import type React from "react";
import { useEffect, useState } from "react";
import api from "./api";
import { btnPrimarySm, card, chip, field } from "./theme";

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

type NightInfo = {
  date: string;
  timezone: string;
  sunset?: string | null;
  dark_start?: string | null;
  dark_end?: string | null;
  sunrise?: string | null;
  moon_illumination: number;
};

interface Props {
  locationId: number;
  locationName?: string;
  tz: string;
  /** Prefill the New Session form with this target + local start time */
  onPlan: (targetName: string, whenLocal: string) => void;
}

const KIND_ICONS: Record<VisibleTarget["kind"], string> = {
  planet: "🪐",
  moon: "🌙",
  dso: "✨",
  star: "⭐",
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

function dateToLocalInput(d: Date, tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const hour = get("hour") === "24" ? "00" : get("hour");
    return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
  } catch {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

// Format the time part of a "YYYY-MM-DDTHH:mm" local string for display —
// it's already wall-clock time in the target tz, so no conversion.
function fmtLocalInput(s: string) {
  const [h, m] = s.slice(11).split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function todayInTz(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(new Date());
  }
}

function degToCompass(deg: number) {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

function moonEmoji(frac: number) {
  if (frac < 0.05) return "🌑";
  if (frac < 0.35) return "🌒";
  if (frac < 0.65) return "🌓";
  if (frac < 0.95) return "🌔";
  return "🌕";
}

const cardStyle = card;
const chipStyle = chip;

const targetCardStyle: React.CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(2,6,23,0.35)",
  padding: "0.6rem 0.7rem",
  display: "grid",
  gap: "0.3rem",
};

export default function TonightPanel({ locationId, locationName, tz, onPlan }: Props) {
  const [dateStr, setDateStr] = useState(() => todayInTz(tz));
  const [night, setNight] = useState<NightInfo | null>(null);
  const [targets, setTargets] = useState<VisibleTarget[]>([]);
  const [suggestedLocal, setSuggestedLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const nightRes = await api.get<NightInfo>("/targets/night", {
          params: { location_id: locationId, date_local: dateStr, tz },
        });
        if (cancelled) return;
        setNight(nightRes.data);

        // Suggest an hour into full darkness; fall back to 10 PM local
        let whenLocal: string;
        const { dark_start, dark_end } = nightRes.data;
        if (dark_start) {
          const start = parseApiDate(dark_start).getTime();
          const end = dark_end ? parseApiDate(dark_end).getTime() : start + 2 * 3600e3;
          const suggested = Math.min(start + 3600e3, (start + end) / 2);
          whenLocal = dateToLocalInput(new Date(suggested), tz);
        } else {
          whenLocal = `${dateStr}T22:00`;
        }
        setSuggestedLocal(whenLocal);

        const targetsRes = await api.get<VisibleTarget[]>("/targets/visible", {
          params: { location_id: locationId, when_local: whenLocal, tz },
        });
        if (cancelled) return;
        setTargets(targetsRes.data);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("Couldn't load tonight's sky for this location.");
          setNight(null);
          setTargets([]);
          setSuggestedLocal(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [locationId, dateStr, tz]);

  const visible = targets.filter((t) => t.visible);
  const hiddenCount = targets.length - visible.length;

  return (
    <section style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "0.6rem",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
            Tonight{locationName ? ` · ${locationName}` : ""}
          </h3>
          {suggestedLocal && (
            <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "0.15rem" }}>
              Sky shown for {fmtLocalInput(suggestedLocal)}
              {night?.dark_start ? " — an hour into full darkness" : " — no full darkness this night"}
            </div>
          )}
        </div>

        <input
          type="date"
          value={dateStr}
          onChange={(e) => e.target.value && setDateStr(e.target.value)}
          style={{ ...field, width: "auto" }}
        />
      </div>

      {night && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <span style={chipStyle}>🌇 Sunset {fmtTime(night.sunset, tz)}</span>
          <span style={chipStyle}>
            🌌 Dark {night.dark_start ? `${fmtTime(night.dark_start, tz)} – ${fmtTime(night.dark_end, tz)}` : "never fully dark"}
          </span>
          <span style={chipStyle}>🌅 Sunrise {fmtTime(night.sunrise, tz)}</span>
          <span style={chipStyle}>
            {moonEmoji(night.moon_illumination)} Moon {Math.round(night.moon_illumination * 100)}%
          </span>
        </div>
      )}

      {loading && <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>Reading the sky…</div>}
      {error && <div style={{ color: "#fca5a5", fontSize: "0.85rem" }}>{error}</div>}

      {!loading && !error && (
        <>
          {visible.length === 0 ? (
            <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
              Nothing on the preset list is well placed at that time — try another date.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                gap: "0.5rem",
              }}
            >
              {visible.map((t) => (
                <div key={t.name} style={targetCardStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
                    <span aria-hidden>{KIND_ICONS[t.kind]}</span>
                    <strong
                      style={{
                        fontSize: "0.88rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name}
                    </strong>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
                    {Math.round(t.altitude_deg)}° high · {degToCompass(t.azimuth_deg)}
                  </div>
                  <button
                    type="button"
                    onClick={() => suggestedLocal && onPlan(t.name, suggestedLocal)}
                    style={{ ...btnPrimarySm, marginTop: "0.15rem", justifySelf: "start" }}
                  >
                    Plan session
                  </button>
                </div>
              ))}
            </div>
          )}

          {hiddenCount > 0 && (
            <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "0.6rem" }}>
              {hiddenCount} other target{hiddenCount === 1 ? " is" : "s are"} below the horizon or washed out at that time.
            </div>
          )}
        </>
      )}
    </section>
  );
}
