import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { Welcome } from "./pages/Welcome";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import Dataset from "./pages/Dataset";
import FraudDetection from "./pages/FraudDetection";
import Transactions from "./pages/Transactions";

/**
 * The backend's /auth/login response carries no token/session id
 * (see authService.ts) — just a success flag and the user's name.
 * So there's no server session to check against; auth state is
 * frontend-only, and localStorage is what keeps it alive across a
 * page refresh or a fresh tab, per the current backend architecture.
 */
const AUTH_STORAGE_KEY = "phoenix_auth";

function readStoredAuth(): boolean {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeStoredAuth(authed: boolean) {
  try {
    if (authed) {
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (e.g. private browsing) — auth simply
    // won't persist across a refresh, which is a soft degradation,
    // not a crash.
  }
}

function ProtectedRoute({
  isAuthed,
  children,
}: {
  isAuthed: boolean;
  children: React.ReactElement;
}) {
  if (!isAuthed) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [isAuthed, setIsAuthed] = useState<boolean>(readStoredAuth);

  const handleLogin = () => {
    writeStoredAuth(true);
    setIsAuthed(true);
  };

  const handleLogout = () => {
    writeStoredAuth(false);
    setIsAuthed(false);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Dashboard onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dataset"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Dataset onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/fraud-detection"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <FraudDetection onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Transactions onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
