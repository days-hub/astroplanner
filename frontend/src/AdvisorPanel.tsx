// src/AdvisorPanel.tsx
//
// "Sky advisor": ask a plain-language question about a night and get an
// answer grounded in the app's own computed data (darkness, moon, targets,
// clouds). Renders nothing unless the backend reports the feature enabled
// (ANTHROPIC_API_KEY set server-side).
import type React from "react";
import { useEffect, useState } from "react";
import api, { apiErrorMessage } from "./api";
import { btnPrimarySm, btnSecondarySm, card, field } from "./theme";

type AdvisorStatus = { enabled: boolean; model: string | null };

type AdvisorResponse = {
  answer: string;
  model: string;
  data: Record<string, unknown>;
};

interface Props {
  locationId: number;
  locationName?: string;
  tz: string;
}

// The status doesn't change while the server runs — fetch it once per page load.
let statusPromise: Promise<AdvisorStatus> | null = null;
function fetchStatus(): Promise<AdvisorStatus> {
  statusPromise ??= api
    .get<AdvisorStatus>("/advisor/status")
    .then((r) => r.data)
    .catch(() => {
      statusPromise = null;
      return { enabled: false, model: null };
    });
  return statusPromise;
}

// "2026-07-24" -> "Friday, July 24". Spelling out the night being asked
// about keeps the date picker from silently governing the answer — otherwise
// it's easy to type "Friday" while the picker still says Tuesday.
function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function todayInTz(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(new Date());
  }
}

const answerStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  lineHeight: 1.55,
  whiteSpace: "pre-wrap",
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(2,6,23,0.35)",
  padding: "0.75rem 0.9rem",
};

const dataStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  lineHeight: 1.4,
  whiteSpace: "pre",
  overflowX: "auto",
  borderRadius: 12,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(2,6,23,0.5)",
  padding: "0.6rem 0.75rem",
  color: "#9ca3af",
  maxHeight: 260,
  overflowY: "auto",
};

export default function AdvisorPanel({ locationId, locationName, tz }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [dateStr, setDateStr] = useState(() => todayInTz(tz));
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdvisorResponse | null>(null);
  const [showData, setShowData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchStatus().then((s) => {
      if (!cancelled) setEnabled(s.enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Answers are about one place and one night — clear when either changes
  useEffect(() => {
    setResult(null);
    setError(null);
    setShowData(false);
  }, [locationId, dateStr]);

  if (!enabled) return null;

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setError(null);
    setResult(null);
    setShowData(false);
    try {
      const res = await api.post<AdvisorResponse>("/advisor/ask", {
        location_id: locationId,
        date_local: dateStr,
        question: q,
        tz,
      });
      setResult(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, "The advisor couldn't answer — try again."));
    } finally {
      setAsking(false);
    }
  }

  return (
    <section style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "0.6rem",
        }}
      >
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
            🔭 Sky advisor{locationName ? ` · ${locationName}` : ""}
          </h3>
          <div style={{ fontSize: "0.78rem", color: "#9ca3af", marginTop: "0.15rem" }}>
            Answers are grounded in this app's computed sky &amp; weather data for{" "}
            <strong style={{ color: "#e5e7eb", fontWeight: 600 }}>{prettyDate(dateStr)}</strong>.
          </div>
        </div>
        <input
          type="date"
          value={dateStr}
          onChange={(e) => e.target.value && setDateStr(e.target.value)}
          style={{ ...field, width: "auto" }}
          aria-label="Night to ask about"
        />
      </div>

      <form onSubmit={ask} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="e.g. What's worth looking at, and when? Is it worth setting up the scope?"
          style={{ ...field, flex: "1 1 260px" }}
        />
        <button type="submit" disabled={asking || !question.trim()} style={btnPrimarySm}>
          {asking ? "Consulting the sky…" : "Ask"}
        </button>
      </form>

      {error && (
        <div style={{ color: "#fca5a5", fontSize: "0.85rem", marginTop: "0.6rem" }}>{error}</div>
      )}

      {result && (
        <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
          <div style={answerStyle}>{result.answer}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              type="button"
              onClick={() => setShowData((s) => !s)}
              style={btnSecondarySm}
            >
              {showData ? "Hide the data behind this" : "Show the data behind this"}
            </button>
            <span style={{ fontSize: "0.72rem", color: "#6b7280" }}>{result.model}</span>
          </div>
          {showData && <pre style={dataStyle}>{JSON.stringify(result.data, null, 2)}</pre>}
        </div>
      )}
    </section>
  );
}
