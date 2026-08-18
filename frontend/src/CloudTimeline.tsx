// src/CloudTimeline.tsx
//
// Hourly cloud through the observing window, drawn as a continuous timeline
// rather than a bar chart. Answers "when does it clear?", which the nightly
// average can't: 40% mean cloud is a very different night if it's all in one
// block.
//
// This has been through three encodings, and the reasons are worth keeping:
//
//   1. Saturated blue bars. Blue reads as *sky*, so a fully overcast night
//      became the most vivid thing on the page — the worst news, loudest.
//   2. Flat grey bars. Correct semantics, no life: cloud is a magnitude and
//      a single fill can't show one.
//   3. Six chunky histogram blocks with a slate ramp. Honest and readable,
//      but visually the least bespoke component on a page that had otherwise
//      stopped looking like a dashboard template.
//
// Now: a stepped area with a soft vertical gradient, a thin lit top edge, and
// the clear window drawn as a continuous bar along the baseline. Stepped, not
// smoothed — the forecast is hourly, and a curve would draw cloud values at
// 23:30 that were never forecast. The window is a real span rather than
// per-hour highlighting, because the API gives its exact boundary times.
import { fontSize, text } from "./theme";

export type CloudPoint = { time_local: string; cloud_cover: number };

interface Props {
  points: CloudPoint[];
  /** Mean across the window, for the caption */
  meanPercent?: number | null;
  /** Plain-language shape of the night, computed server-side */
  trend?: string | null;
  /** The night's clear window ("HH:MM" local) */
  clearFrom?: string | null;
  clearTo?: string | null;
}

// Neutral by design: cloud is the obstacle, so the saturated accent is spent
// on the clear window instead. Ends validated as an ordinal ramp against this
// surface (monotone lightness, dark end 2.29:1 — clears the 2:1 floor).
const CLOUD_TOP = "#a7b4c4";
const CLOUD_BOTTOM = "#475569";
const ACCENT = "#60a5fa";

const W = 600; // viewBox units; the SVG scales to its container
const H = 96;

/** Minutes since the chart's first hour, unwrapped across midnight. */
function minutesFrom(base: string, hhmm: string): number {
  const [bh, bm] = base.split(":").map(Number);
  const [h, m] = hhmm.split(":").map(Number);
  let delta = h * 60 + m - (bh * 60 + bm);
  if (delta < 0) delta += 24 * 60;
  return delta;
}

export default function CloudTimeline({
  points,
  meanPercent,
  trend,
  clearFrom,
  clearTo,
}: Props) {
  if (points.length === 0) return null;

  const calculatedMean = Math.round(
    points.reduce((sum, point) => sum + point.cloud_cover, 0) / points.length,
  );
  const average = meanPercent ?? calculatedMean;
  const isClearAllNight = points.every(
    (point) => Math.round(point.cloud_cover) === 0,
  );

  // A flat 0% plot is five or six copies of the same answer. Keep the
  // conclusion, but remove the chart furniture until the forecast contains
  // variation worth locating in time.
  if (isClearAllNight) {
    return (
      <div
        role="img"
        aria-label={`Clear all night. ${average}% average cloud cover.`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.65rem",
          padding: "0.1rem 0",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            flexShrink: 0,
            borderRadius: 9999,
            background: "#6ee7b7",
            boxShadow: "0 0 14px rgba(110,231,183,0.35)",
          }}
        />
        <div style={{ fontSize: fontSize.body, color: text.primary }}>
          <strong>Clear all night</strong>
          <span style={{ color: text.muted }}> · {average}% average</span>
        </div>
      </div>
    );
  }

  const n = points.length;
  const slot = W / n;
  const y = (pct: number) => H - (Math.max(0, Math.min(100, pct)) / 100) * H;

  // Stepped outline: each hour holds its value for the full hour, so the
  // silhouette is a staircase rather than a curve.
  const steps: string[] = [];
  points.forEach((p, i) => {
    const yy = y(p.cloud_cover);
    steps.push(`${i === 0 ? "M" : "L"} ${(i * slot).toFixed(2)} ${yy.toFixed(2)}`);
    steps.push(`L ${((i + 1) * slot).toFixed(2)} ${yy.toFixed(2)}`);
  });
  const strokePath = steps.join(" ");
  const fillPath = `${strokePath} L ${W} ${H} L 0 ${H} Z`;

  // The clear window as one continuous span, from the real boundary times.
  const base = points[0].time_local;
  let band: { x: number; w: number } | null = null;
  if (clearFrom && clearTo) {
    const total = n * 60;
    const from = minutesFrom(base, clearFrom);
    const to = minutesFrom(base, clearTo);
    if (to > from) {
      const x1 = Math.max(0, (from / total) * W);
      const x2 = Math.min(W, (to / total) * W);
      if (x2 > x1) band = { x: x1, w: x2 - x1 };
    }
  }

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ marginBottom: "0.55rem" }}>
        <div style={{ fontSize: fontSize.body, fontWeight: 600, color: text.primary }}>
          {trend ?? "Cloud cover through the night"}
        </div>
        <div style={{ fontSize: fontSize.small, color: text.muted, marginTop: "0.1rem" }}>
          Hourly cloud cover
          {meanPercent != null ? ` · ${meanPercent}% average` : ""}
        </div>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H + 8}`}
        width="100%"
        height={H + 8}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          "Hourly cloud cover: " +
          points.map((p) => `${p.time_local} ${p.cloud_cover}%`).join(", ") +
          (clearFrom && clearTo ? `. Clear from ${clearFrom} to ${clearTo}.` : "")
        }
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id="cloudFill" x1="0" y1="0" x2="0" y2="1">
            {/* Deliberately faint. At higher opacity a fully overcast
                night filled this panel with bright grey and started
                competing with the recommendation headline — the chart is
                supporting evidence, not the hero. The contour line carries
                readability, so the fill can afford to recede. A 0% night
                nearly disappears, which is the correct amount of visual
                noise for "nothing to worry about". */}
            <stop offset="0%" stopColor={CLOUD_TOP} stopOpacity="0.44" />
            <stop offset="100%" stopColor={CLOUD_BOTTOM} stopOpacity="0.14" />
          </linearGradient>
        </defs>

        {/* Hour gridlines, recessive — they locate a reading without competing */}
        {points.map((p, i) =>
          i === 0 ? null : (
            <line
              key={`grid-${p.time_local}-${i}`}
              x1={i * slot}
              y1={0}
              x2={i * slot}
              y2={H}
              stroke="rgba(148,163,184,0.10)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ),
        )}

        <path className="draw-in" d={fillPath} fill="url(#cloudFill)" />
        {/* The lit top edge — where the cloud deck actually sits */}
        <path
          className="draw-in"
          d={strokePath}
          fill="none"
          stroke={CLOUD_TOP}
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Baseline, and the clear window along it as one real span */}
        <line
          x1={0}
          y1={H}
          x2={W}
          y2={H}
          stroke="rgba(148,163,184,0.22)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {band && (
          <rect
            className="grow-x"
            style={{ transformOrigin: `${band.x}px center` }}
            x={band.x}
            y={H + 1.5}
            width={band.w}
            height={4}
            rx={2}
            fill={ACCENT}
          />
        )}

        {/* Hover readout per hour, across the full column height */}
        {points.map((p, i) => (
          <rect
            key={`hit-${p.time_local}-${i}`}
            x={i * slot}
            y={0}
            width={slot}
            height={H}
            fill="transparent"
          >
            <title>{`${p.time_local} · ${p.cloud_cover}% cloud`}</title>
          </rect>
        ))}
      </svg>

      {/* Time axis with compact per-hour values, weather-timeline style. The
          numbers sit below the plot so the chart stays a clean silhouette. */}
      <div style={{ display: "flex", marginTop: "0.35rem" }}>
        {points.map((p, i) => {
          const mid = (i + 0.5) * slot;
          const lit = band != null && mid >= band.x && mid <= band.x + band.w;
          return (
            <div
              key={`axis-${p.time_local}-${i}`}
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: "center",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <div
                style={{
                  fontSize: fontSize.micro,
                  color: lit ? ACCENT : text.muted,
                  fontWeight: lit ? 700 : 400,
                }}
              >
                {p.time_local}
              </div>
              <div
                style={{
                  fontSize: fontSize.micro,
                  color: text.secondary,
                  marginTop: "0.05rem",
                }}
              >
                {p.cloud_cover}%
              </div>
            </div>
          );
        })}
      </div>

      {band && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: fontSize.micro,
            color: text.muted,
            marginTop: "0.45rem",
          }}
        >
          <span
            aria-hidden
            style={{ width: 14, height: 3, borderRadius: 2, background: ACCENT }}
          />
          clear window
        </div>
      )}
    </figure>
  );
}
