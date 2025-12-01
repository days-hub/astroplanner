import type { FormEvent } from "react";
import { useState } from "react";
import BackgroundVideo from "./BackgroundVideo";
import api, { setAuthToken } from "./api";
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
  width: "100%",
  marginTop: "1rem",
  padding: "0.75rem",
  borderRadius: 9999,
  border: "none",
  background:
    "linear-gradient(135deg, #38bdf8 0%, #6366f1 40%, #a855f7 100%)",
  color: "white",
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: "pointer",
  boxShadow: "0 10px 25px rgba(56,189,248,0.35)",
};
interface Props {
  onLogin: (token: string) => void;
  onGoToRegister: () => void;
}
export default function LoginPage({ onLogin, onGoToRegister }: Props) {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("test1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
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
      setError("Login failed. Check email and password.");
    } finally {
      setLoading(false);
    }
  }

 return (
  <div style={{ ...loginPageStyle, position: "relative" }}>
    <BackgroundVideo targetName="global" cycle />
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
        <p style={subtitleStyle}>Login with your account to continue.</p>
      </div>

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
        <button
          type="button"
          onClick={onGoToRegister}
          style={{
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
          }}
        >
          Create an account
        </button>
      </form>
    </div>
  </div>
);
}

