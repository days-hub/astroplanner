// src/AdvisorPanel.tsx
//
// "Sky advisor": ask a plain-language question about a night and get an
// answer grounded in the app's own computed data (darkness, moon, targets,
// clouds). Renders nothing unless the backend reports the feature enabled
// (ANTHROPIC_API_KEY set server-side).
import type React from "react";
import { useEffect, useState } from "react";
import api, { apiErrorMessage } from "./api";
import { TelescopeIcon } from "./icons";
import { btnPrimary, btnSecondarySm, card, field, fontSize, line, surface, text } from "./theme";

type AdvisorStatus = { enabled: boolean; model: string | null };

type AdvisorResponse = {
  answer: string;
  model: string;
  data: Record<string, unknown>;
};

/** What the page already knows about the night, used to pick the prompts */
export type AdvisorContext = {
  cloudPercent?: number | null;
  clearHours: number;
  moonIllumination?: number | null;
  moonUpFraction?: number | null;
};

interface Props {
  locationId: number;
  tz: string;
  /** Night to ask about — owned by the page context bar */
  dateStr: string;
  /** Compact form for sitting directly under the recommendation, where it
   *  is part of the decision rather than a widget further down the page. */
  compact?: boolean;
  /** Drives which one-tap questions are offered */
  context?: AdvisorContext;
}

// Questions worth one tap. Deliberately the things a user actually wonders
// after reading a verdict, not a feature tour — and they change with the
// night, because "Is it worth setting up?" is the wrong question under
// solid overcast and "Is there any usable gap?" is the wrong one under a
// clear sky. Reacting to the forecast is what separates this from a chatbot
// bolted onto the page.
const PROMPTS_CLOUDED_OUT = [
  "Is there any usable gap?",
  "What's the next clear night?",
  "Should I cancel my session?",
  "Are any saved locations clearer?",
];

const PROMPTS_BRIGHT_MOON = [
  "What can I still observe?",
  "Is the Moon worth photographing?",
  "Which planet is best?",
  "Is another location better?",
];

const PROMPTS_GOOD_NIGHT = [
  "What should I observe first?",
  "What's the best time?",
  "What's the faintest thing I could try?",
  "Should I drive somewhere darker?",
];

const PROMPTS_DEFAULT = [
  "Is it worth setting up?",
  "What should I observe?",
  "What's the best time?",
  "Should I drive somewhere darker?",
];

function presetPrompts(ctx?: AdvisorContext): string[] {
  if (!ctx) return PROMPTS_DEFAULT;
  // Cloud first: it overrides everything else about the night.
  if (ctx.clearHours <= 0.5 || (ctx.cloudPercent ?? 0) >= 70) return PROMPTS_CLOUDED_OUT;
  // Moonlight only matters when the Moon is actually up in the dark window
  if ((ctx.moonIllumination ?? 0) * (ctx.moonUpFraction ?? 0) >= 0.5)
    return PROMPTS_BRIGHT_MOON;
  if ((ctx.cloudPercent ?? 100) <= 30) return PROMPTS_GOOD_NIGHT;
  return PROMPTS_DEFAULT;
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

const answerStyle: React.CSSProperties = {
  fontSize: "0.95rem",
  lineHeight: 1.6,
  color: text.primary,
  whiteSpace: "pre-wrap",
  borderRadius: 12,
  background: surface.inset,
  padding: "0.75rem 0.9rem",
};

const dataStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  lineHeight: 1.4,
  whiteSpace: "pre",
  overflowX: "auto",
  borderRadius: 12,
  border: line.hairline,
  background: surface.sunken,
  padding: "0.6rem 0.75rem",
  color: text.secondary,
  maxHeight: 260,
  overflowY: "auto",
};

export default function AdvisorPanel({
  locationId,
  tz,
  dateStr,
  compact,
  context,
}: Props) {
  const [enabled, setEnabled] = useState(false);
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

  async function ask(e: React.FormEvent, preset?: string) {
    e.preventDefault();
    const q = (preset ?? question).trim();
    if (!q || asking) return;
    if (preset) setQuestion(preset);
    setAsking(true);
    setError(null);
    setResult(null);
    setShowData(false);
    try {
      const res = await api.post<AdvisorResponse>("/advisor/ask", {
        location_id: locationId,
        date_local: dateStr,
        // The advisor always inherits the page's location and night
        question: q,
        tz,
      });
      setResult(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, "The advisor couldn't answer. Try again."));
    } finally {
      setAsking(false);
    }
  }

  return (
    // Compact mode drops the card chrome so it can sit inside the Tonight
    // panel directly beneath the verdict — questioning the recommendation is
    // part of the decision, not a separate feature further down the page.
    <section style={compact ? { marginTop: "0.9rem" } : card}>
      {/* No date or location control here — the page context bar owns both,
          and the advisor answers for whatever is selected there. */}
      {!compact && (
        <div style={{ marginBottom: "0.7rem" }}>
          <h3 style={{ fontSize: fontSize.section, fontWeight: 600, margin: 0 }}>
            <TelescopeIcon style={{ marginRight: "0.4rem" }} />Sky advisor
          </h3>
          <div
            style={{
              fontSize: fontSize.small,
              color: text.secondary,
              marginTop: "0.2rem",
            }}
          >
            Answers use the selected location and night, the computed sky
            conditions, and the weather forecast. Nothing else.
          </div>
        </div>
      )}

      <form onSubmit={ask} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder={
            compact
              ? "Ask about this night…"
              : "e.g. What's worth looking at, and when? Is it worth setting up the scope?"
          }
          style={{
            ...field,
            flex: "1 1 240px",
            // Inside the Tonight card the verdict is the headline; the ask
            // box supports it and shouldn't compete for the same attention.
            ...(compact
              ? { background: surface.sunken, border: line.hairline }
              : null),
          }}
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          style={compact ? btnSecondarySm : btnPrimary}
        >
          {asking ? "Consulting the sky…" : "Ask"}
        </button>
      </form>

      {/* One-tap versions of what people actually wonder after a verdict.
          Hidden once an answer is on screen so it doesn't crowd the reply. */}
      {!result && !asking && (
        <div
          style={{
            display: "flex",
            gap: "0.4rem",
            flexWrap: "wrap",
            marginTop: "0.5rem",
          }}
        >
          {presetPrompts(context).map((p) => (
            <button
              key={p}
              type="button"
              onClick={(e) => ask(e, p)}
              style={{
                ...btnSecondarySm,
                fontSize: "0.78rem",
                color: text.secondary,
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

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
            <span style={{ fontSize: fontSize.small, color: text.muted }}>
              {result.model}
            </span>
          </div>
          {showData && <pre style={dataStyle}>{JSON.stringify(result.data, null, 2)}</pre>}
        </div>
      )}
    </section>
  );
}
