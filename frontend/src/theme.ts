// src/theme.ts
//
// Shared style vocabulary. One primary button, one secondary, one field,
// one card — so every screen reads as the same app.
import type React from "react";

export const card: React.CSSProperties = {
  borderRadius: 16,
  padding: "1rem 1.25rem",
  border: "1px solid rgba(148,163,184,0.35)",
  background: "rgba(15,23,42,0.92)",
  boxShadow: "0 18px 35px rgba(0,0,0,0.55)",
};

export const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "0.75rem",
  marginBottom: "0.6rem",
};

export const sectionTitle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  marginBottom: "0.75rem",
};

export const metaLine: React.CSSProperties = {
  fontSize: "0.78rem",
  color: "#9ca3af",
  marginTop: "0.15rem",
};

export const field: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  borderRadius: 10,
  border: "1px solid #374151",
  backgroundColor: "#020617",
  color: "#e5e7eb",
  fontSize: "0.85rem",
};

export const chip: React.CSSProperties = {
  borderRadius: 9999,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(2,6,23,0.35)",
  padding: "0.3rem 0.75rem",
  fontSize: "0.82rem",
  color: "#cbd5e1",
  whiteSpace: "nowrap",
};

const btnBase: React.CSSProperties = {
  borderRadius: 9999,
  border: "none",
  fontWeight: 600,
  cursor: "pointer",
  padding: "0.5rem 1rem",
  fontSize: "0.85rem",
  lineHeight: 1.2,
};

export const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "linear-gradient(135deg,#38bdf8,#6366f1)",
  color: "white",
  boxShadow: "0 8px 20px rgba(56,189,248,0.25)",
};

export const btnPrimarySm: React.CSSProperties = {
  ...btnPrimary,
  padding: "0.3rem 0.8rem",
  fontSize: "0.8rem",
  boxShadow: "none",
};

export const btnSecondary: React.CSSProperties = {
  ...btnBase,
  fontWeight: 500,
  background: "transparent",
  border: "1px solid rgba(148,163,184,0.6)",
  color: "#e5e7eb",
};

export const btnSecondarySm: React.CSSProperties = {
  ...btnSecondary,
  padding: "0.28rem 0.75rem",
  fontSize: "0.8rem",
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
