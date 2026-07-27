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

// Body sits at 0.9rem rather than the browser default: the app is dense and
// dark, but anything below ~0.85rem starts costing legibility.
export const fontSize = {
  hero: "2.05rem",
  title: "1.35rem",
  section: "1.05rem",
  body: "0.9rem",
  small: "0.82rem",
} as const;

export const card: React.CSSProperties = {
  borderRadius: 16,
  padding: "1rem 1.25rem",
  border: "1px solid rgba(148,163,184,0.35)",
  background: "rgba(15,23,42,0.92)",
  boxShadow: "0 18px 35px rgba(0,0,0,0.55)",
};

// The Tonight card is the page's centrepiece — a lighter border and a subtle
// lift separate it from the supporting cards without changing the palette.
export const cardFeature: React.CSSProperties = {
  ...card,
  padding: "1.25rem 1.4rem 1.35rem",
  border: "1px solid rgba(148,163,184,0.5)",
  background:
    "linear-gradient(180deg, rgba(23,34,58,0.95) 0%, rgba(15,23,42,0.94) 100%)",
  boxShadow: "0 22px 45px rgba(0,0,0,0.6)",
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

export const field: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.65rem",
  borderRadius: 10,
  border: "1px solid #3d4a5f",
  backgroundColor: "#020617",
  color: text.primary,
  fontSize: fontSize.body,
};

export const chip: React.CSSProperties = {
  borderRadius: 9999,
  border: "1px solid rgba(148,163,184,0.28)",
  background: "rgba(2,6,23,0.35)",
  padding: "0.32rem 0.8rem",
  fontSize: fontSize.small,
  color: text.secondary,
  whiteSpace: "nowrap",
};

const btnBase: React.CSSProperties = {
  borderRadius: 9999,
  border: "none",
  fontWeight: 600,
  cursor: "pointer",
  padding: "0.5rem 1rem",
  fontSize: fontSize.body,
  lineHeight: 1.2,
};

// One primary action per section. Everything else is secondary or a text
// link — when three buttons in view are all gradient-filled, none of them
// reads as the thing to click.
export const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg,#38bdf8,#6366f1)",
  color: "white",
  boxShadow: "0 8px 20px rgba(56,189,248,0.25)",
};

export const btnPrimarySm: React.CSSProperties = {
  ...btnPrimary,
  padding: "0.32rem 0.85rem",
  fontSize: fontSize.small,
  boxShadow: "none",
};

export const btnSecondary: React.CSSProperties = {
  ...btnBase,
  fontWeight: 500,
  background: "transparent",
  border: "1px solid rgba(148,163,184,0.6)",
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
  border: "1px solid rgba(248,113,113,0.22)",
  background: "rgba(248,113,113,0.06)",
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
    borderRadius: 9999,
    fontSize: fontSize.body,
    fontWeight: 600,
    background: v.background,
    border: v.border,
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
