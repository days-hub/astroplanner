// src/TabNav.tsx
//
// Three top-level destinations, one per stable user goal: decide when to
// observe (Planner), manage plans and records (Sessions), manage sites
// (Locations). Changing a date, filter or selected session is planner state
// or a child route — not a tab switch.
//
// Deliberately quieter than the observing recommendation it sits above: an
// underline and a brightness change, no filled pills competing for attention.
import type React from "react";
import { NavLink } from "react-router-dom";
import { fontSize, text } from "./theme";

const TABS = [
  { to: "/planner", label: "Planner" },
  { to: "/sessions", label: "Sessions" },
  { to: "/locations", label: "Locations" },
];

const navStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.35rem",
  borderBottom: "1px solid rgba(148,163,184,0.22)",
  marginBottom: "0.9rem",
};

function linkStyle(active: boolean): React.CSSProperties {
  return {
    padding: "0.55rem 0.9rem",
    fontSize: fontSize.body,
    fontWeight: active ? 700 : 500,
    color: active ? text.primary : text.muted,
    textDecoration: "none",
    borderBottom: active ? "2px solid #a855f7" : "2px solid transparent",
    marginBottom: -1,
    transition: "color 150ms ease",
  };
}

export default function TabNav() {
  return (
    <nav style={navStyle} aria-label="Main">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          style={({ isActive }) => linkStyle(isActive)}
          // /sessions/:id keeps the Sessions tab active — a detail view is a
          // child of the tab, not a destination of its own.
          end={false}
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
