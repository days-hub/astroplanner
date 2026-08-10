// src/icons.tsx
//
// The app's icon set: inline SVG, duotone, each glyph carrying its own hue.
//
// This replaced emoji, and then had to be redone once: the first pass drew
// flat outlines in `currentColor`, which inherited muted body text and made
// every icon read as a wireframe — technically consistent, visibly deader
// than the emoji it replaced. Emoji were carrying colour *and* fill, and
// removing both without putting anything back is what drained the page.
//
// So: a translucent fill under a full-strength stroke, in a hue that means
// something (sunset warm, moon pale, deep-sky violet). The fill supplies
// body, the stroke supplies definition, and the hue supplies the life the
// outlines were missing — without the cross-platform lottery of emoji.
//
// Every icon still accepts `color` to override, and structural glyphs
// (chevron, trash) deliberately stay on `currentColor` so they tint with
// the control they sit in.
import type React from "react";

interface IconProps {
  /** Pixel size; defaults to 1em so the icon tracks the ambient font size */
  size?: number | string;
  /** Override the glyph's own hue */
  color?: string;
  style?: React.CSSProperties;
}

/** Semantic hues. Warm for the horizon, pale for the Moon, violet for
 *  deep-sky, amber for stars, emerald for the brand marks. */
const HUE = {
  sunset: "#fb923c",
  sunrise: "#fcd34d",
  moon: "#cbd5e1",
  planet: "#fbbf24",
  dso: "#c084fc",
  star: "#fcd34d",
  brand: "#34d399",
  pin: "#f87171",
} as const;

function Svg({
  size = "1em",
  color,
  style,
  strokeWidth = 1.8,
  children,
}: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color ?? "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      // Sits on the text baseline instead of floating above it
      style={{ verticalAlign: "-0.14em", flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

/** The duotone under-layer: same hue as the stroke, dialled right down. */
function Wash({ d, color, opacity = 0.22 }: { d: string; color: string; opacity?: number }) {
  return <path d={d} fill={color} fillOpacity={opacity} stroke="none" />;
}

export function RocketIcon({ color = HUE.brand, ...p }: IconProps) {
  const body = "m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z";
  return (
    <Svg {...p} color={color}>
      <Wash d={body} color={color} />
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d={body} />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </Svg>
  );
}

export function TelescopeIcon({ color = HUE.brand, ...p }: IconProps) {
  const barrel = "M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z";
  return (
    <Svg {...p} color={color}>
      <Wash d={barrel} color={color} opacity={0.3} />
      <path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" />
      <path d="m13.56 11.747 4.332-.924" />
      <path d="m16 21-3.105-6.21" />
      <path d={barrel} />
      <path d="m6.158 8.633 1.114 4.456" />
      <path d="m8 21 3.105-6.21" />
      <circle cx="12" cy="13" r="2" fill={color} fillOpacity={0.3} />
    </Svg>
  );
}

/** Structural, not decorative — inherits the control's colour. */
export function TrashIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" fill="currentColor" fillOpacity={0.14} stroke="none" />
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}

export function MapPinIcon({ color = HUE.pin, ...p }: IconProps) {
  const drop = "M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0";
  return (
    <Svg {...p} color={color}>
      <Wash d={drop} color={color} opacity={0.25} />
      <path d={drop} />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

/** Structural — tints with whatever row it sits in. */
export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...p} strokeWidth={2.2}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function SparklesIcon({ color = HUE.dso, ...p }: IconProps) {
  const big = "M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94a2 2 0 0 0 1.44-1.44l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96l-6.13 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z";
  return (
    <Svg {...p} color={color}>
      <Wash d={big} color={color} opacity={0.28} />
      <path d={big} />
      <path d="M19 3v4" />
      <path d="M21 5h-4" />
    </Svg>
  );
}

export function StarIcon({ color = HUE.star, ...p }: IconProps) {
  const star = "M11.53 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.75a.53.53 0 0 1 .3.91l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0l-4.62 2.43a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.91l5.16-.75a2.12 2.12 0 0 0 1.6-1.16z";
  return (
    <Svg {...p} color={color}>
      <Wash d={star} color={color} opacity={0.3} />
      <path d={star} />
    </Svg>
  );
}

export function PlanetIcon({ color = HUE.planet, ...p }: IconProps) {
  // No standard glyph for "ringed planet": a filled disc with a ring across it.
  return (
    <Svg {...p} color={color}>
      <circle cx="12" cy="12" r="5" fill={color} fillOpacity={0.3} />
      <circle cx="12" cy="12" r="5" />
      <ellipse cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-18 12 12)" />
    </Svg>
  );
}

export function SunsetIcon({ color = HUE.sunset, ...p }: IconProps) {
  return (
    <Svg {...p} color={color}>
      <path d="M16 18a4 4 0 0 0-8 0" fill={color} fillOpacity={0.28} stroke="none" />
      <path d="M12 10V2" />
      <path d="m16 6-4 4-4-4" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </Svg>
  );
}

export function SunriseIcon({ color = HUE.sunrise, ...p }: IconProps) {
  return (
    <Svg {...p} color={color}>
      <path d="M16 18a4 4 0 0 0-8 0" fill={color} fillOpacity={0.28} stroke="none" />
      <path d="M12 2v8" />
      <path d="m8 6 4-4 4 4" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </Svg>
  );
}

/** The Moon at a given illumination, lit from the right.
 *
 * We only know the illuminated fraction, not waxing vs waning, so the lit
 * side is fixed — the point is "how much moonlight", which the five emoji
 * phases this replaced only approximated anyway. A soft halo behind the
 * disc scales with illumination, so a full Moon visibly glows and a new
 * Moon is a bare outline.
 */
export function MoonIcon({
  frac,
  size = "1em",
  color = HUE.moon,
  style,
}: {
  frac: number;
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
}) {
  const f = Math.max(0, Math.min(1, frac));
  const R = 8.5;
  // Terminator: a half-ellipse whose x-radius runs full-left (new) through
  // zero (quarter) to full-right (full). Sweep flips at the quarter mark.
  const rx = Math.abs(2 * f - 1) * R;
  const sweep = f >= 0.5 ? 1 : 0;
  const lit = `M12 ${12 - R} A${R} ${R} 0 0 1 12 ${12 + R} A${rx} ${R} 0 0 ${sweep} 12 ${12 - R} Z`;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      style={{ verticalAlign: "-0.14em", flexShrink: 0, ...style }}
    >
      {/* Halo, proportional to how much light there actually is */}
      {f > 0.15 && (
        <circle cx="12" cy="12" r="11" fill={color} fillOpacity={0.1 * f} />
      )}
      <circle cx="12" cy="12" r={R} fill={color} fillOpacity={0.14} />
      {f > 0.02 && <path d={lit} fill={color} />}
      <circle
        cx="12"
        cy="12"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="1.4"
        opacity="0.65"
      />
    </svg>
  );
}
