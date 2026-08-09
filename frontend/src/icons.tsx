// src/icons.tsx
//
// The app's icon set: inline SVG, stroked in currentColor. This replaced the
// emoji that used to sit in buttons and chips — emoji render as a different
// illustration on every OS, can't take the text colour beside them, and
// don't sit on a shared baseline, so nothing built from them looks the same
// twice. These are 24×24 outline glyphs (Lucide-style geometry) drawn at
// 1em so they scale with whatever text they accompany.
import type React from "react";

interface IconProps {
  /** Pixel size; defaults to 1em so the icon tracks the ambient font size */
  size?: number | string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

function Svg({
  size = "1em",
  strokeWidth = 2,
  style,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      // Sits on the text baseline instead of floating above it
      style={{ verticalAlign: "-0.125em", flexShrink: 0, ...style }}
    >
      {children}
    </svg>
  );
}

export function RocketIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </Svg>
  );
}

export function TelescopeIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" />
      <path d="m13.56 11.747 4.332-.924" />
      <path d="m16 21-3.105-6.21" />
      <path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z" />
      <path d="m6.158 8.633 1.114 4.456" />
      <path d="m8 21 3.105-6.21" />
      <circle cx="12" cy="13" r="2" />
    </Svg>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}

export function MapPinIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </Svg>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function SparklesIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9.94 15.5a2 2 0 0 0-1.44-1.44l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94a2 2 0 0 0 1.44-1.44l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96l-6.13 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z" />
      <path d="M19 3v4" />
      <path d="M21 5h-4" />
    </Svg>
  );
}

export function StarIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M11.53 2.3a.53.53 0 0 1 .95 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.75a.53.53 0 0 1 .3.91l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0l-4.62 2.43a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .3-.91l5.16-.75a2.12 2.12 0 0 0 1.6-1.16z" />
    </Svg>
  );
}

export function PlanetIcon(p: IconProps) {
  // No standard glyph for "ringed planet", so: a disc with a ring across it.
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="5" />
      <ellipse cx="12" cy="12" rx="10" ry="3.4" transform="rotate(-18 12 12)" />
    </Svg>
  );
}

export function SunsetIcon(p: IconProps) {
  return (
    <Svg {...p}>
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

export function SunriseIcon(p: IconProps) {
  return (
    <Svg {...p}>
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
 * side is fixed — the point is "how much moonlight", which the emoji phases
 * this replaced also only approximated in five coarse steps.
 */
export function MoonIcon({
  frac,
  size = "1em",
  style,
}: {
  frac: number;
  size?: number | string;
  style?: React.CSSProperties;
}) {
  const f = Math.max(0, Math.min(1, frac));
  const R = 9;
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
      style={{ verticalAlign: "-0.125em", flexShrink: 0, ...style }}
    >
      <circle
        cx="12"
        cy="12"
        r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.45"
      />
      {f > 0.02 && <path d={lit} fill="currentColor" />}
    </svg>
  );
}
