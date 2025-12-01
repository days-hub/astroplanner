import { useEffect, useState } from "react";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import Dashboard from "./Dashboard";
import { setAuthToken } from "./api";

type Page = "login" | "register";

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [page, setPage] = useState<Page>("login");

  useEffect(() => {
    setAuthToken(token);
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  const handleLogout = () => setToken(null);

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
