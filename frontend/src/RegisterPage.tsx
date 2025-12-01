import type { FormEvent } from "react";
import { useState } from "react";
import api, { setAuthToken } from "./api";

const registerPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  background:
    "radial-gradient(circle at 10% 20%, #1e293b 0, #020617 40%, #000 80%)",
  color: "#e5e7eb",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const registerCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  padding: "2.5rem 2.75rem",
  borderRadius: 16,
  background: "rgba(15, 23, 42, 0.9)",
  boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
  border: "1px solid rgba(148, 163, 184, 0.3)",
};

const titleStyle: React.CSSProperties = {
  fontSize: "2.1rem",
  fontWeight: 800,
  letterSpacing: "0.03em",
  marginBottom: "0.25rem",
};

const subtitleStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  color: "#9ca3af",
  marginBottom: "1.6rem",
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

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "1rem",
  padding: "0.75rem",
  borderRadius: 9999,
  border: "none",
  background:
    "linear-gradient(135deg, #22c55e 0%, #4ade80 45%, #a3e635 100%)",
  color: "#052e16",
  fontWeight: 800,
  fontSize: "0.95rem",
  cursor: "pointer",
  boxShadow: "0 10px 25px rgba(34,197,94,0.22)",
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "0.6rem",
  padding: "0.7rem",
  borderRadius: 9999,
  border: "1px solid rgba(148, 163, 184, 0.5)",
  background: "transparent",
  color: "#e5e7eb",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
};

type RegisterResponse = {
  // if your backend returns a user object only, we’ll still log in after register
  id?: number;
  email?: string;
};

interface Props {
  onRegisteredAndLoggedIn: (token: string) => void;
  onGoToLogin: () => void;
}

export default function RegisterPage({ onRegisteredAndLoggedIn, onGoToLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Please enter an email.");
    if (password.length < 6) return setError("Password should be at least 6 characters.");
    if (password !== password2) return setError("Passwords do not match.");

    setLoading(true);
    try {
      // 1) Register (adjust endpoint/body if yours differs)
      await api.post<RegisterResponse>("/auth/register", {
        email: email.trim(),
        password,
      });

      // 2) Immediately log in
      const body = new URLSearchParams();
      body.append("username", email.trim());
      body.append("password", password);

      const loginRes = await api.post("/auth/login", body, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = loginRes.data.access_token as string;
      setAuthToken(token);
      onRegisteredAndLoggedIn(token);
    } catch (err: any) {
      console.error(err);
      // if FastAPI returns detail, show it
      const msg =
        err?.response?.data?.detail ??
        "Registration failed. That email might already be in use.";
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={registerPageStyle}>
      <div style={registerCardStyle}>
        <div style={{ marginBottom: "1.75rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.2rem 0.6rem",
              borderRadius: 9999,
              background: "rgba(34,197,94,0.15)",
              color: "#86efac",
              fontSize: "0.7rem",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: "0.75rem",
            }}
          >
            <span>✨</span>
            <span>Create account</span>
          </div>

          <h1 style={titleStyle}>AstroPlanner</h1>
          <p style={subtitleStyle}>Make an account to start planning observations.</p>
        </div>

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@cosmos.dev"
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <div style={{ marginBottom: "0.25rem" }}>
            <label style={labelStyle}>Confirm password</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          {error && (
            <div style={{ color: "#fca5a5", fontSize: "0.85rem", marginTop: "0.6rem" }}>
              {error}
            </div>
          )}

          <button type="submit" style={primaryButtonStyle} disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>

          <button type="button" style={secondaryButtonStyle} onClick={onGoToLogin}>
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}
