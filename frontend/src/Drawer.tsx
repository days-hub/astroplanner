// src/Drawer.tsx
//
// Right-side panel for short create/edit workflows. Used instead of a
// dedicated route because creating a session or location is an action, not a
// destination — and keeping the list visible behind it makes the creation
// feel lightweight rather than like leaving the page.
import type React from "react";
import { useEffect } from "react";
import { btnSecondarySm, fontSize, line, text } from "./theme";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const scrimStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.6)",
  zIndex: 40,
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(30rem, 100vw)",
  background: "rgba(17,25,44,0.98)",
  borderLeft: line.edge,
  boxShadow: "-24px 0 60px rgba(0,0,0,0.55)",
  zIndex: 41,
  display: "flex",
  flexDirection: "column",
  animation: "slideIn 180ms ease",
};

export default function Drawer({ open, title, onClose, children }: Props) {
  // Escape closes, and the page behind shouldn't scroll under the panel
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div style={scrimStyle} onClick={onClose} aria-hidden />
      <aside style={panelStyle} role="dialog" aria-modal="true" aria-label={title}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "1rem 1.15rem",
            borderBottom: "1px solid rgba(148,163,184,0.22)",
          }}
        >
          <h3 style={{ fontSize: fontSize.section, fontWeight: 600, margin: 0 }}>
            {title}
          </h3>
          <button type="button" onClick={onClose} style={btnSecondarySm}>
            Close
          </button>
        </div>
        <div style={{ padding: "1.15rem", overflowY: "auto", color: text.primary }}>
          {children}
        </div>
      </aside>
    </>
  );
}
