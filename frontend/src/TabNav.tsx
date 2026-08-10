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

// No border of its own any more: the app bar it sits in owns the rule, so
// the tabs and the wordmark share one baseline instead of stacking two
// separate horizontal lines down the page.
const navStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.9rem",
};

function linkStyle(active: boolean): React.CSSProperties {
  return {
    // Roomier than before, and the inactive state is secondary rather than
    // muted — the shell was legible but timid against the app beneath it.
    padding: "0.7rem 0.2rem 0.75rem",
    fontSize: fontSize.section,
    fontWeight: active ? 700 : 500,
    color: active ? text.primary : text.secondary,
    textDecoration: "none",
    // Blue, because a tab is a *selection*, not an action. The app already
    // says "blue = chosen" everywhere else — the selected outlook night, the
    // CURRENT site, the active sort chip — and teal was overloaded doing
    // double duty as both "good conditions" and "click me".
    borderBottom: active ? "3px solid #60a5fa" : "3px solid transparent",
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
