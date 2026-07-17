import axios, { isAxiosError } from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
});

// Turn a FastAPI error payload into something a human can read.
// Pydantic validation errors (422) arrive as an array of {loc, msg} objects;
// most other errors have a string `detail`.
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const lines = detail
        .map((d) => {
          const msg = typeof d?.msg === "string" ? d.msg : null;
          if (!msg) return null;
          const loc = Array.isArray(d?.loc) ? d.loc[d.loc.length - 1] : null;
          return typeof loc === "string"
            ? `${loc.charAt(0).toUpperCase()}${loc.slice(1)}: ${msg}`
            : msg;
        })
        .filter(Boolean);
      if (lines.length > 0) return lines.join(" · ");
    }
  }
  return fallback;
}

// Manage the Authorization header + localStorage in one place
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    localStorage.setItem("token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem("token");
}

// Called when the API rejects our token (expired/invalid), so the app
// can drop back to the login screen instead of showing broken data.
let onUnauthorized: (() => void) | null = null;
export function setOnUnauthorized(handler: (() => void) | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    // A failed login attempt is also a 401 — don't treat it as an expired session
    if (status === 401 && !url.includes("/auth/login")) {
      setAuthToken(null);
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

// Restore session on page load, before any component fires a request
const existing = getStoredToken();
if (existing) {
  api.defaults.headers.common["Authorization"] = `Bearer ${existing}`;
}

export default api;
