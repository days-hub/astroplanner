// src/theme.ts
//
// Shared style vocabulary. One primary button, one secondary, one field,
// one card — so every screen reads as the same app.
import type React from "react";

// ---- Text ----------------------------------------------------------------
// Three levels, deliberately few. Secondary is the workhorse for supporting
// detail and is kept bright enough to read at a glance on a laptop; muted is
// reserved for genuinely incidental text (hints, placeholders, provenance).
export const text = {
  primary: "#e8edf5",
  secondary: "#b8c4d4",
  muted: "#8fa0b5",
} as const;

// The interface is information-dense, but it should not become miniature on
// a wide display. Normal copy is 15px and supporting text is 14px; `micro` is
// reserved for chart ticks, legends, and provenance rather than UI labels.
//
// `lead` exists because the Planner had four adjacent levels within a few
// tenths of a rem of each other, and the single most important line — the
// verdict — was the *fourth* largest thing in its own card, behind the night
// label and the window time. One step is now clearly ahead of the rest, and
// supporting text has been pushed down rather than the headline pushed up.
export const fontSize = {
  hero: "2.05rem",   // the login wordmark, nowhere else
  lead: "1.5rem",    // the one conclusion the eye should land on
  title: "1.25rem",  // the strongest supporting figure (the observing window)
  section: "1.125rem",
  body: "0.9375rem",
  small: "0.875rem",
  micro: "0.75rem",  // axis labels, legends, provenance only
} as const;

// ---- What each colour means -----------------------------------------------
// Three jobs, and a colour only ever does one of them:
//
//   emerald, filled   an action you can take   (btnPrimary, Plan session)
//   blue              selection or a moment in time  (chosen row, CURRENT,
//                     active tab, the clear window on both charts)
//   mint / amber /    a condition, as TEXT — never as a filled control, so a
//   red               verdict can't be mistaken for a button
//
// Emerald stays the action colour rather than blue: on a navy page a blue
// call-to-action is technically consistent and visually invisible, which we
// tried and reverted. The overlap that did need fixing was blue vs teal for
// "selected" — that's now blue everywhere.

// ---- Surfaces -------------------------------------------------------------
// Three levels, and only three. Hierarchy comes from these plus spacing;
// borders are the exception, not the default.
//
// This replaced 14 ad-hoc background values and 21 distinct border colours —
// ten of them neutral slate at opacities from 0.18 to 0.60. That wasn't a
// system, it was accretion, and it's why nested cards, rows, chips and inputs
// all carried roughly the same weight: everything was outlined, so nothing
// read as contained by anything else.
export const surface = {
  /** Cards sitting on the page's starfield. */
  raised: "rgba(15,23,42,0.92)",
  /** The page's centrepiece, one step brighter so it leads without a heavier border. */
  feature: "rgba(23,33,55,0.94)",
  /** Rows, wells and groups *inside* a card — recessed, so they need no outline. */
  inset: "rgba(2,6,23,0.38)",
  /** Text inputs: the deepest level, because "type here" wants to read as a hole. */
  sunken: "rgba(2,6,23,0.66)",
} as const;

// ---- Lines ----------------------------------------------------------------
// Only three, each with a job. Anything nested on a card should use surface
// tint and spacing instead of reaching for one of these.
export const line = {
  /** Structural separators and input affordances. */
  hairline: "1px solid rgba(148,163,184,0.16)",
  /** Top-level cards only. The page background is a starfield photograph, so
   *  a card with no edge has no edge — surface tint alone can't hold it. */
  edge: "1px solid rgba(148,163,184,0.28)",
  /** Selected or actively interactive. The strongest outline in the app,
   *  reserved so that "outlined" reliably means "chosen". */
  focus: "1px solid rgba(147,197,253,0.55)",
} as const;

export const card: React.CSSProperties = {
  borderRadius: 16,
  padding: "1rem 1.25rem",
  border: line.edge,
  background: surface.raised,
  boxShadow: "0 18px 35px rgba(0,0,0,0.55)",
};

// The Tonight card is the page's centrepiece. That distinction used to exist
// only as border 0.35 vs 0.50 and an invisible gradient — a token that didn't
// do anything.
//
// Elevation now comes from a hairline of light along the top edge rather than
// from a brighter fill. You read it before you consciously notice it, which is
// the point: pushing the surface brighter would have made this a different
// blue panel rather than simply the most important one. It also suits the
// subject — dark instrumentation catching a little ambient light.
export const cardFeature: React.CSSProperties = {
  ...card,
  padding: "1.25rem 1.4rem 1.35rem",
  background: surface.feature,
  boxShadow: [
    "inset 0 1px 0 rgba(255,255,255,0.055)",
    "0 18px 40px rgba(0,0,0,0.45)",
  ].join(", "),
};

/** A recessed block inside a card: outlook rows, target cards, wells.
 *  Deliberately borderless — the tint and the gap do the containing. */
export const inset: React.CSSProperties = {
  borderRadius: 12,
  background: surface.inset,
  border: "1px solid transparent", // reserved, so :focus/selected can fill it
};

export const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  marginBottom: "0.6rem",
};

export const sectionTitle: React.CSSProperties = {
  fontSize: fontSize.section,
  fontWeight: 600,
  marginBottom: "0.75rem",
};

export const metaLine: React.CSSProperties = {
  fontSize: fontSize.small,
  color: text.secondary,
  marginTop: "0.15rem",
};

// Inputs keep an outline: it isn't decoration here, it's the affordance that
// says "you can type in this". Paired with the deepest surface so the field
// reads as cut into the card.
export const field: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.65rem",
  borderRadius: 10,
  border: line.hairline,
  background: surface.sunken,
  color: text.primary,
  fontSize: fontSize.body,
};

// The dropdown arrow, drawn ourselves. `appearance: none` strips the OS
// widget chrome (the part that made selects look pasted in from another
// app), but it also strips the arrow — and an arrowless select reads as a
// text input that ignores typing.
const selectChevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238fa0b5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export const selectField: React.CSSProperties = {
  ...field,
  WebkitAppearance: "none",
  MozAppearance: "none",
  appearance: "none",
  backgroundImage: selectChevron,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.6rem center",
  backgroundSize: "1em",
  paddingRight: "2.1rem", // room for the chevron
  cursor: "pointer",
};

// Read-only fact chips (sunset, sunrise, moon). Borderless: they sit on a
// card, and the recessed tint is enough to group them.
export const chip: React.CSSProperties = {
  // inline-flex so an SVG icon and its label share a centreline
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  borderRadius: 9999,
  background: surface.inset,
  padding: "0.32rem 0.8rem",
  fontSize: fontSize.small,
  color: text.secondary,
  whiteSpace: "nowrap",
};

// Actions are rounded rectangles, NOT capsules. Every button used to be
// borderRadius 9999, which gave "Plan session" and "PLANNED" the same
// silhouette — the actual cause of the pill-soup look, rather than the number
// of pills. Statuses and filters keep the capsule (see pillShape); anything
// you click to *do* something is a button shape.
const btnBase: React.CSSProperties = {
  borderRadius: 10,
  border: "none",
  fontWeight: 600,
  cursor: "pointer",
  padding: "0.5rem 1rem",
  fontSize: fontSize.body,
  lineHeight: 1.2,
};

/** Capsule geometry, reserved for statuses, badges and compact filters. */
export const pillShape = { borderRadius: 9999 } as const;

// One primary action per section. Everything else is secondary or a text
// link — when three buttons in view are all gradient-filled, none of them
// reads as the thing to click.
export const btnPrimary: React.CSSProperties = {
  ...btnBase,
  // Emerald, deliberately: everything else in the app lives in the navy
  // family, so the one warm-cool pop is what makes an action look like an
  // action. A blue CTA on this background is technically consistent and
  // visually invisible. Selection states stay blue; verdict green is a text
  // label, not a filled pill, so the two don't collide.
  background: "linear-gradient(135deg,#10b981,#0d9488)",
  color: "white",
  boxShadow: "0 8px 20px rgba(16,185,129,0.25)",
};

export const btnPrimarySm: React.CSSProperties = {
  ...btnPrimary,
  padding: "0.32rem 0.85rem",
  fontSize: fontSize.small,
  boxShadow: "none",
};

// A ghost button's outline IS the button, so this one keeps its border.
export const btnSecondary: React.CSSProperties = {
  ...btnBase,
  fontWeight: 500,
  background: "transparent",
  border: "1px solid rgba(148,163,184,0.45)",
  color: text.primary,
};

export const btnSecondarySm: React.CSSProperties = {
  ...btnSecondary,
  padding: "0.3rem 0.8rem",
  fontSize: fontSize.small,
};

export const btnDangerIcon: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "grid",
  placeItems: "center",
  borderRadius: 9,
  border: "1px solid rgba(248,113,113,0.28)",
  background: "rgba(248,113,113,0.08)",
  color: "#fecaca",
  cursor: "pointer",
  padding: 0,
  fontSize: "0.95rem",
  lineHeight: 1,
};

// ---- Conditions verdict --------------------------------------------------
// Colour carries meaning here, so each verdict also ships a word — never
// colour alone.
/** Just the pill CSS for a verdict, without the `label` copy. */
export function verdictPill(
  verdict: "good" | "fair" | "poor",
): React.CSSProperties {
  const v = verdictStyles[verdict];
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.3rem 0.75rem",
    ...pillShape,
    fontSize: fontSize.body,
    fontWeight: 600,
    background: v.background,
    // Tinted, not outlined — matches the other status badges, and keeps
    // "has an outline" meaning "selected" rather than "is a badge".
    color: v.color,
  };
}

export const verdictStyles: Record<
  "good" | "fair" | "poor",
  { label: string; color: string; background: string; border: string }
> = {
  good: {
    label: "Good conditions",
    color: "#6ee7b7",
    background: "rgba(16,185,129,0.14)",
    border: "1px solid rgba(110,231,183,0.4)",
  },
  fair: {
    label: "Fair conditions",
    color: "#fcd34d",
    background: "rgba(245,158,11,0.14)",
    border: "1px solid rgba(252,211,77,0.4)",
  },
  poor: {
    label: "Poor conditions",
    color: "#fca5a5",
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(252,165,165,0.4)",
  },
};
