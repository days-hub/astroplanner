// src/CloudTimeline.tsx
//
// Hourly cloud cover across the observing window. One series, so height
// carries the magnitude and a single hue carries the mark — no legend.
// Answers "when does it clear?", which the average alone can't: 40% mean
// cloud is a very different night if it's all in one block.
//
// Every bar is labelled because there are only a handful of them and the
// exact percentage is what a reader wants; the clearest hour is outlined so
// the best moment is findable without comparing bar heights by eye.
import { fontSize, text } from "./theme";

export type CloudPoint = { time_local: string; cloud_cover: number };

interface Props {
  points: CloudPoint[];
  /** Mean across the window, for the caption */
  meanPercent?: number | null;
  /** Plain-language shape of the night, computed server-side */
  trend?: string | null;
}

// Validated against the dark chart surface (lightness band + ≥3:1 contrast).
const MARK = "#3b82f6";
const MARK_BEST = "#7dd3fc";
const TRACK = "rgba(148,163,184,0.16)";
const PLOT_HEIGHT = 104;

export default function CloudTimeline({ points, meanPercent, trend }: Props) {
  if (points.length === 0) return null;

  const values = points.map((p) => p.cloud_cover);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Only worth pointing at a "clearest hour" if it's meaningfully clearer
  const bestIndex = max - min >= 15 ? values.indexOf(min) : -1;

  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ marginBottom: "0.5rem" }}>
        <div style={{ fontSize: fontSize.body, fontWeight: 600, color: text.primary }}>
          {trend ?? "Cloud cover through the night"}
        </div>
        <div style={{ fontSize: fontSize.small, color: text.muted, marginTop: "0.1rem" }}>
          Hourly cloud cover
          {meanPercent != null ? ` · ${meanPercent}% average` : ""}
        </div>
      </figcaption>

      <div
        style={{ display: "flex", alignItems: "flex-end", gap: 4, height: PLOT_HEIGHT }}
        role="img"
        aria-label={
          `Hourly cloud cover: ` +
          points.map((p) => `${p.time_local} ${p.cloud_cover}%`).join(", ")
        }
      >
        {points.map((p, i) => {
          const isBest = i === bestIndex;
          return (
            <div
              key={`${p.time_local}-${i}`}
              title={`${p.time_local} — ${p.cloud_cover}% cloud`}
              style={{
                flex: 1,
                minWidth: 0,
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                background: TRACK,
                borderRadius: 3,
                position: "relative",
              }}
            >
              {/* Value sits above the bar when there's room, inside it when
                  the bar is too tall for a label to fit above. */}
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: p.cloud_cover > 78 ? 4 : undefined,
                  bottom: p.cloud_cover > 78 ? undefined : `calc(${p.cloud_cover}% + 4px)`,
                  textAlign: "center",
                  fontSize: "0.68rem",
                  fontWeight: isBest ? 700 : 600,
                  color: p.cloud_cover > 78 ? "#dbeafe" : text.secondary,
                  pointerEvents: "none",
                }}
              >
                {p.cloud_cover}%
              </span>
              <div
                style={{
                  width: "100%",
                  // Hairline floor so a 0% hour still reads as a measured
                  // value rather than missing data
                  height: `${Math.max(2, p.cloud_cover)}%`,
                  background: isBest ? MARK_BEST : MARK,
                  borderRadius: "3px 3px 0 0",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          marginTop: "0.35rem",
          fontSize: "0.68rem",
          color: text.muted,
        }}
        aria-hidden
      >
        {points.map((p, i) => (
          <div
            key={`label-${p.time_local}-${i}`}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: "center",
              color: i === bestIndex ? text.secondary : text.muted,
              fontWeight: i === bestIndex ? 700 : 400,
            }}
          >
            {p.time_local}
          </div>
        ))}
      </div>

      {/* Direction cue: the bars are cloud, so taller is worse */}
      <div
        style={{
          fontSize: "0.68rem",
          color: text.muted,
          marginTop: "0.35rem",
          textAlign: "right",
        }}
      >
        taller = more cloud
      </div>
    </figure>
  );
}
