// src/NightTrack.tsx
//
// The night itself, as one horizontal instrument track: sunset on the left,
// sunrise on the right, twilight shading inward to full astronomical
// darkness, the clear window marked along the bottom, and moonset placed at
// its real time.
//
// This exists because the same three facts used to be three separate chips
// (Sunset 8:28 · Sunrise 6:17 · Moon 4%), which left the reader to assemble
// the only question that matters: does the clear gap actually land inside
// the dark part of the night, and is the Moon up while it does? A track
// answers that at a glance and nothing else on the page could.
//
// Nothing here is inferred. The Moon is drawn only when the API returns a
// real moonset time — placing it from the up-fraction alone would mean
// inventing a position, and every number in this app is meant to be one the
// backend actually computed.
import { MoonIcon } from "./icons";
import { fontSize, text } from "./theme";
import type { CloudPoint } from "./CloudTimeline";

interface Props {
  /** UTC ISO instants from the night payload */
  sunset?: string | null;
  darkStart?: string | null;
  darkEnd?: string | null;
  sunrise?: string | null;
  /** "HH:MM" local */
  clearFrom?: string | null;
  clearTo?: string | null;
  moonsetLocal?: string | null;
  moonIllumination: number;
  /** Fraction of the dark window the Moon is above the horizon, 0..1 */
  moonUpFraction?: number | null;
  /** Hourly local forecast points, overlaid on the same sunset-to-sunrise axis. */
  cloudPoints?: CloudPoint[];
  meanCloudPercent?: number | null;
  tz: string;
}

const W = 600;
const H = 38;

const DUSK = "#334155";      // twilight: sky still washed out
const DARK = "#0b1220";      // full astronomical darkness
const ACCENT = "#60a5fa";    // the clear window, matching the cloud chart
const MOON = "#cbd5e1";

function parseApiDate(s: string) {
  return new Date(/([zZ]|[+-]\d\d:\d\d)$/.test(s) ? s : `${s}Z`);
}

function hhmm(iso: string | null | undefined, tz: string) {
  if (!iso) return null;
  try {
    return parseApiDate(iso).toLocaleTimeString(undefined, {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

export default function NightTrack({
  sunset,
  darkStart,
  darkEnd,
  sunrise,
  clearFrom,
  clearTo,
  moonsetLocal,
  moonIllumination,
  moonUpFraction,
  cloudPoints = [],
  meanCloudPercent,
  tz,
}: Props) {
  // The track spans sunset → sunrise. Without both ends there's no scale to
  // draw against, so it renders nothing rather than guessing one.
  if (!sunset || !sunrise) return null;

  const t0 = parseApiDate(sunset).getTime();
  const t1 = parseApiDate(sunrise).getTime();
  if (!(t1 > t0)) return null;

  const x = (ms: number) => ((ms - t0) / (t1 - t0)) * W;
  const clampX = (v: number) => Math.max(0, Math.min(W, v));

  const dStart = darkStart ? clampX(x(parseApiDate(darkStart).getTime())) : null;
  const dEnd = darkEnd ? clampX(x(parseApiDate(darkEnd).getTime())) : null;

  /** "HH:MM" local → an x position on tonight's axis, unwrapped past midnight. */
  const localToX = (v: string) => {
    const [h, m] = v.split(":").map(Number);
    const d = new Date(t0);
    d.setHours(h, m, 0, 0);
    let ms = d.getTime();
    // Times after midnight land on the following calendar day
    if (ms < t0) ms += 24 * 3600 * 1000;
    return clampX(x(ms));
  };

  let band: { x: number; w: number } | null = null;
  if (clearFrom && clearTo) {
    const a = localToX(clearFrom);
    const b = localToX(clearTo);
    if (b > a) band = { x: a, w: b - a };
  }
  const moonX = moonsetLocal ? localToX(moonsetLocal) : null;
  const visibleCloud = cloudPoints.filter(
    (point) => Math.round(point.cloud_cover) > 0,
  );

  const addHour = (hhmmValue: string) => {
    const [h, m] = hhmmValue.split(":").map(Number);
    return `${String((h + 1) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const label = (v: string | null) => v ?? "—";

  // "up all night" was wrong whenever moon_up_fraction is 0 — that means the
  // Moon never rises during the dark window at all, which is the opposite
  // claim. Three distinct states, and none of them guessed: the fraction and
  // the set time both come from the backend.
  // Phase first, then where it is. "◐ 0%, below the horizon" read like a
  // progress meter; naming the phase makes it a sentence about the sky.
  const phaseName =
    moonIllumination < 0.02
      ? "New Moon"
      : moonIllumination > 0.98
        ? "Full Moon"
        : `Moon ${Math.round(moonIllumination * 100)}%`;
  const moonWhere = moonsetLocal
    ? `sets ${moonsetLocal}`
    : (moonUpFraction ?? 0) <= 0
      ? "below horizon"
      : "up all night";

  return (
    <figure style={{ margin: "0.9rem 0 0" }}>
      <figcaption
        style={{
          fontSize: fontSize.small,
          color: text.muted,
          marginBottom: "0.35rem",
        }}
      >
        Sunset to sunrise
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          `Night from sunset ${label(hhmm(sunset, tz))} to sunrise ${label(hhmm(sunrise, tz))}` +
          (darkStart && darkEnd
            ? `, full darkness ${label(hhmm(darkStart, tz))} to ${label(hhmm(darkEnd, tz))}`
            : ", no full darkness") +
          (clearFrom && clearTo ? `, clear ${clearFrom} to ${clearTo}` : "") +
          (moonsetLocal ? `, Moon sets ${moonsetLocal}` : "")
        }
        style={{ display: "block" }}
      >
        <defs>
          {/* Twilight deepening into darkness and back out again. When the
              night never reaches astronomical dark, the stops collapse and
              the track stays twilight-coloured throughout — which is the
              honest picture of a short summer night. */}
          <linearGradient id="nightGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={DUSK} />
            <stop offset={`${((dStart ?? W * 0.2) / W) * 100}%`} stopColor={DARK} />
            <stop offset={`${((dEnd ?? W * 0.8) / W) * 100}%`} stopColor={DARK} />
            <stop offset="100%" stopColor={DUSK} />
          </linearGradient>
        </defs>

        <rect className="draw-in" x={0} y={0} width={W} height={H} rx={5} fill="url(#nightGrad)" />

        {/* Boundaries of full darkness */}
        {[dStart, dEnd].map((px, i) =>
          px == null ? null : (
            <line
              key={`edge-${i}`}
              x1={px}
              y1={0}
              x2={px}
              y2={H}
              stroke="rgba(148,163,184,0.35)"
              strokeWidth={1}
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}

        {/* Cloud shares the night axis instead of living in a disconnected
            second chart. Each forecast holds for one hour; opacity carries
            magnitude so the twilight/darkness layer remains visible below. */}
        {visibleCloud.map((point) => {
          const x1 = localToX(point.time_local);
          const x2 = localToX(addHour(point.time_local));
          if (x2 <= x1) return null;
          return (
            <rect
              key={`cloud-${point.time_local}`}
              x={x1}
              y={0}
              width={x2 - x1}
              height={H - 6}
              fill="#cbd5e1"
              opacity={0.08 + (Math.min(100, point.cloud_cover) / 100) * 0.42}
            >
              <title>{`${point.time_local} · ${point.cloud_cover}% cloud`}</title>
            </rect>
          );
        })}

        {/* The clear window, same accent and geometry as the cloud chart's */}
        {band && (
          <rect
            className="grow-x"
            style={{ transformOrigin: `${band.x}px center` }}
            x={band.x}
            y={H - 5}
            width={band.w}
            height={4}
            rx={2}
            fill={ACCENT}
          />
        )}

        {/* Moonset, at its computed time */}
        {moonX != null && (
          <line
            x1={moonX}
            y1={0}
            x2={moonX}
            y2={H}
            stroke={MOON}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            opacity={0.8}
          />
        )}
      </svg>

      {(band || visibleCloud.length > 0) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.8rem",
            flexWrap: "wrap",
            fontSize: fontSize.micro,
            color: text.muted,
            marginTop: "0.35rem",
          }}
        >
          {band && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span
                aria-hidden
                style={{ width: 14, height: 3, borderRadius: 2, background: ACCENT }}
              />
              clear window
            </span>
          )}
          {visibleCloud.length > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
              <span
                aria-hidden
                style={{ width: 12, height: 8, borderRadius: 2, background: "rgba(203,213,225,0.38)" }}
              />
              cloud cover
              {meanCloudPercent != null ? ` · ${meanCloudPercent}% average` : ""}
            </span>
          )}
        </div>
      )}

      {/* Endpoints, plus the two facts the track can't spell out */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          fontSize: fontSize.micro,
          color: text.muted,
          marginTop: "0.3rem",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>{label(hhmm(sunset, tz))}</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            color: text.secondary,
          }}
        >
          <MoonIcon frac={moonIllumination} size={12} />
          {phaseName} · {moonWhere}
        </span>
        <span>{label(hhmm(sunrise, tz))}</span>
      </div>
    </figure>
  );
}
