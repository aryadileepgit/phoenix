import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { Welcome } from "./pages/Welcome";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Dataset } from "./pages/Dataset";
import { Transactions } from "./pages/Transactions";
import { TransactionDetails } from "./pages/TransactionDetails";
import { Accounts } from "./pages/Accounts";
import { AccountRisk } from "./pages/AccountRisk";
import { Investigation } from "./pages/Investigation";
import { NetworkAnalysis } from "./pages/NetworkAnalysis";
import { SchemaRegistry } from "./pages/SchemaRegistry";
import { DriftMonitoring } from "./pages/DriftMonitoring";
import { AdaptiveLearning } from "./pages/AdaptiveLearning";
import { ModelPerformance } from "./pages/ModelPerformance";
import { Activity } from "./pages/Activity";
import { Settings } from "./pages/Settings";

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
    // localStorage unavailable
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
          path="/transactions"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Transactions onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions/:id"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <TransactionDetails onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Accounts onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account-risk"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <AccountRisk onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/investigation"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Investigation onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/network-analysis"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <NetworkAnalysis onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schema-registry"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <SchemaRegistry onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/drift-monitoring"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <DriftMonitoring onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adaptive-learning"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <AdaptiveLearning onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/model-performance"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <ModelPerformance onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/activity"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Activity onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Settings onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}