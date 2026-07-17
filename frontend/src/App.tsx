import { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import Dashboard from "./Dashboard";
import { getStoredToken, setAuthToken, setOnUnauthorized } from "./api";

type Page = "login" | "register";

function App() {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [page, setPage] = useState<Page>("login");

  // If the API rejects our token (expired/invalid), fall back to login
  useEffect(() => {
    setOnUnauthorized(() => setToken(null));
    return () => setOnUnauthorized(null);
  }, []);

  const handleLogout = () => {
    setAuthToken(null);
    setToken(null);
  };

  if (token) return <Dashboard onLogout={handleLogout} />;

  return page === "register" ? (
    <RegisterPage
      onRegisteredAndLoggedIn={(t) => setToken(t)}
      onGoToLogin={() => setPage("login")}
    />
  ) : (
    <LoginPage
      onLogin={(t) => setToken(t)}
      onGoToRegister={() => setPage("register")}
    />
  );
}

export default App;
