import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import SpaceBackground from "./SpaceBackground";
import api, { apiErrorMessage, setAuthToken } from "./api";
import { btnPrimary, btnSecondary } from "./theme";
const loginPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background:
    "radial-gradient(circle at 10% 20%, #1e293b 0, #020617 40%, #000 80%)",
  color: "#e5e7eb",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const loginCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  padding: "2.5rem 2.75rem",
  borderRadius: 16,
  background: "rgba(15, 23, 42, 0.9)",
  boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
  border: "1px solid rgba(148, 163, 184, 0.3)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "2.25rem",
  fontWeight: 800,
  letterSpacing: "0.03em",
  marginBottom: "0.25rem",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "#9ca3af",
  marginBottom: "2rem",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 500,
  marginBottom: "0.25rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 9999,
  border: "1px solid #374151",
  backgroundColor: "#020617",
  color: "#e5e7eb",
  fontSize: "0.9rem",
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  ...btnPrimary,
  width: "100%",
  marginTop: "1rem",
  padding: "0.75rem",
  fontSize: "0.95rem",
};

// The demo is the headline call-to-action on the public deployment, so it
// gets its own emerald treatment rather than reusing the login gradient.
const demoButtonStyle: React.CSSProperties = {
  ...btnPrimary,
  width: "100%",
  padding: "0.75rem",
  fontSize: "0.95rem",
  background: "linear-gradient(135deg,#10b981,#0d9488)",
  boxShadow: "0 8px 20px rgba(16,185,129,0.25)",
};
// A text link, not a button: signing in is the secondary path on a demo
// deployment and shouldn't compete with the demo call to action.
const signInLinkStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#9ca3af",
  fontSize: "0.85rem",
  textDecoration: "underline",
  textUnderlineOffset: "0.2em",
  cursor: "pointer",
  fontFamily: "inherit",
};

interface Props {
  onLogin: (token: string) => void;
  onGoToRegister: () => void;
}

type DemoStatus = { enabled: boolean; registration_enabled: boolean };

export default function LoginPage({ onLogin, onGoToRegister }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  // Kept separate from `error` so a demo failure doesn't render inside the
  // login form and read as "your password was wrong".
  const [demoError, setDemoError] = useState<string | null>(null);
  // Hidden behind a link on demo deployments, shown outright otherwise.
  // Starts false and is revealed once /demo/status says demo mode is off,
  // so the form never flashes in before we know which entry points apply.
  const [showLogin, setShowLogin] = useState(false);

  // Ask the server which entry points to show: the demo button when demo
  // mode is on, and the "Create an account" link only where public
  // registration is enabled. Defaults are conservative if the call fails.
  useEffect(() => {
    let alive = true;
    api
      .get<DemoStatus>("/demo/status")
      .then((res) => {
        if (!alive) return;
        setDemoStatus(res.data);
        // No demo on this deployment → the login form is the only way in.
        if (!res.data.enabled) setShowLogin(true);
      })
      .catch(() => {
        if (!alive) return;
        setDemoStatus({ enabled: false, registration_enabled: true });
        setShowLogin(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDemoError(null);
    setLoading(true);

    try {
      // /auth/login expects x-www-form-urlencoded with "username" + "password"
      const body = new URLSearchParams();
      body.append("username", email);
      body.append("password", password);

      const res = await api.post("/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = res.data.access_token as string;
      setAuthToken(token);
      onLogin(token);
    } catch (err) {
      console.error(err);
      setError(apiErrorMessage(err, "Login failed. Check email and password."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setError(null);
    setDemoError(null);
    setDemoLoading(true);
    try {
      // Creates a throwaway seeded account and returns a real JWT — the
      // visitor lands straight in a populated dashboard.
      const res = await api.post("/demo/start");
      const token = res.data.access_token as string;
      setAuthToken(token);
      onLogin(token);
    } catch (err) {
      console.error(err);
      setDemoError(
        apiErrorMessage(err, "Couldn't start the demo. Try again in a moment."),
      );
    } finally {
      setDemoLoading(false);
    }
  }

 return (
  <div style={{ ...loginPageStyle, position: "relative" }}>
    <SpaceBackground targetName="global" />
    <div style={{ ...loginCardStyle, position: "relative", zIndex: 1 }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.2rem 0.6rem",
            borderRadius: 9999,
            background: "rgba(15,118,110,0.2)",
            color: "#6ee7b7",
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginBottom: "0.75rem",
          }}
        >
          <span>🔭</span>
          <span>Observation Planner</span>
        </div>

        <h1 style={titleStyle}>AstroPlanner</h1>
        <p style={subtitleStyle}>
          {demoStatus?.enabled
            ? "Explore instantly with a demo account — no signup."
            : "Login with your account to continue."}
        </p>
      </div>

      {/* On a demo deployment the demo is the call to action and the login
          form collapses behind a link: with signup disabled a visitor can
          never obtain credentials, so leading with an email/password form
          is a dead end. Without demo mode this renders as a plain login. */}
      {demoStatus?.enabled && (
        <div style={{ marginBottom: showLogin ? "1.25rem" : 0 }}>
          <button
            type="button"
            onClick={handleDemo}
            style={demoButtonStyle}
            disabled={demoLoading}
          >
            {demoLoading ? "Starting demo…" : "🚀 Try the demo"}
          </button>
          {demoError ? (
            <p
              style={{
                color: "#fca5a5",
                fontSize: "0.85rem",
                marginTop: "0.5rem",
                marginBottom: 0,
                textAlign: "center",
              }}
            >
              {demoError}
            </p>
          ) : (
            <p style={{ ...subtitleStyle, marginTop: "0.5rem", marginBottom: 0, textAlign: "center" }}>
              Lands in a populated dashboard. No email, nothing to remember.
            </p>
          )}

          {!showLogin && (
            <p style={{ textAlign: "center", marginTop: "1.25rem", marginBottom: 0 }}>
              <button
                type="button"
                onClick={() => setShowLogin(true)}
                style={signInLinkStyle}
              >
                Sign in with an existing account
              </button>
            </p>
          )}
        </div>
      )}

      {showLogin && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@cosmos.dev"
            />
          </div>

          <div style={{ marginBottom: "0.5rem" }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              style={{
                color: "#fca5a5",
                fontSize: "0.85rem",
                marginTop: "0.25rem",
              }}
            >
              {error}
            </div>
          )}

          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? "Logging in…" : "Login"}
          </button>

          {/* Public registration is disabled by design on the hosted demo,
              so the sign-up link only appears where the server allows it. */}
          {demoStatus?.registration_enabled !== false && (
            <button
              type="button"
              onClick={onGoToRegister}
              style={{ ...btnSecondary, width: "100%", marginTop: "0.6rem", padding: "0.7rem", fontSize: "0.9rem" }}
            >
              Create an account
            </button>
          )}
        </form>
      )}
    </div>
  </div>
);
}

