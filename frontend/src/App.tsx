import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, lazy, Suspense } from "react";
import {
  clearToken,
  isTokenValid,
} from "./services/authService";
import { Welcome } from "./pages/Welcome";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { ResetPassword } from "./pages/ResetPassword";
import { RLEvaluation } from "./pages/RLEvaluation";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const Dataset = lazy(() =>
  import("./pages/Dataset").then((m) => ({ default: m.Dataset }))
);
const Transactions = lazy(() =>
  import("./pages/Transactions").then((m) => ({
    default: m.Transactions,
  }))
);
const TransactionDetails = lazy(() =>
  import("./pages/TransactionDetails").then((m) => ({
    default: m.TransactionDetails,
  }))
);
const Accounts = lazy(() =>
  import("./pages/Accounts").then((m) => ({ default: m.Accounts }))
);
const AccountRisk = lazy(() =>
  import("./pages/AccountRisk").then((m) => ({
    default: m.AccountRisk,
  }))
);
const Investigation = lazy(() =>
  import("./pages/Investigation").then((m) => ({
    default: m.Investigation,
  }))
);
const NetworkAnalysis = lazy(() =>
  import("./pages/NetworkAnalysis").then((m) => ({
    default: m.NetworkAnalysis,
  }))
);
const SchemaRegistry = lazy(() =>
  import("./pages/SchemaRegistry").then((m) => ({
    default: m.SchemaRegistry,
  }))
);
const DriftMonitoring = lazy(() =>
  import("./pages/DriftMonitoring").then((m) => ({
    default: m.DriftMonitoring,
  }))
);
const AdaptiveLearning = lazy(() =>
  import("./pages/AdaptiveLearning").then((m) => ({
    default: m.AdaptiveLearning,
  }))
);
const ModelPerformance = lazy(() =>
  import("./pages/ModelPerformance").then((m) => ({
    default: m.ModelPerformance,
  }))
);
const Activity = lazy(() =>
  import("./pages/Activity").then((m) => ({ default: m.Activity }))
);
const Settings = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.Settings }))
);

/*
 * Route guard reads the signed bearer token, not a boolean
 * flag: flipping localStorage no longer grants access, and
 * expired tokens fail closed. The backend re-verifies the
 * signature on every request.
 */
function readStoredAuth(): boolean {
  return isTokenValid();
}

function writeStoredAuth(authed: boolean) {
  if (!authed) {
    clearToken();
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
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">
            Loading…
          </div>
        }
      >
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/rl-evaluation" element={<RLEvaluation onLogout={handleLogout} />} />
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
      </Suspense>
    </BrowserRouter>
  );
}