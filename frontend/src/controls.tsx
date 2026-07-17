// src/controls.tsx
//
// Small structured-input controls for observation logs: tap-once quality
// segments and a star rating, replacing free-text fields.
import type React from "react";

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
      {options.map((opt) => {
        const selected = value?.toLowerCase() === opt.toLowerCase();
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : opt.toLowerCase())}
            style={{
              borderRadius: 9999,
              padding: "0.3rem 0.7rem",
              fontSize: "0.8rem",
              cursor: "pointer",
              border: selected
                ? "1px solid rgba(99,102,241,0.7)"
                : "1px solid rgba(148,163,184,0.35)",
              background: selected ? "rgba(99,102,241,0.25)" : "rgba(2,6,23,0.35)",
              color: selected ? "#e0e7ff" : "#cbd5e1",
              textTransform: "capitalize",
              transition: "background 120ms ease, border-color 120ms ease",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export function StarRating({
  value,
  onChange,
  size = "1.35rem",
  readOnly = false,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: string;
  readOnly?: boolean;
}) {
  const starStyle = (filled: boolean): React.CSSProperties => ({
    fontSize: size,
    lineHeight: 1,
    color: filled ? "#facc15" : "rgba(148,163,184,0.35)",
  });

  if (readOnly) {
    if (value == null) return <span style={{ color: "#9ca3af" }}>—</span>;
    return (
      <span aria-label={`${value} out of 5`} style={{ display: "inline-flex", gap: "0.1rem" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} aria-hidden style={starStyle(n <= value)}>
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <div style={{ display: "inline-flex", gap: "0.15rem" }} aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          title={value === n ? "Clear rating" : `${n}/5`}
          onClick={() => onChange?.(value === n ? null : n)}
          style={{
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            ...starStyle(value != null && n <= value),
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}
