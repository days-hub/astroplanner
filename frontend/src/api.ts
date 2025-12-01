import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000",
});

// Manage the Authorization header + localStorage in one place
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    sessionStorage.setItem("token", token);
  } else {
    delete api.defaults.headers.common["Authorization"];
    sessionStorage.removeItem("token");
  }
}
const existing = sessionStorage.getItem("token");
if (existing) {
 api.defaults.headers.common["Authorization"] = `Bearer ${existing}`;
}
export default api;
