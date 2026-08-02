import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { Welcome } from "./pages/Welcome";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import Dataset from './pages/Dataset'


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
  const [isAuthed, setIsAuthed] = useState(false);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login onLogin={() => setIsAuthed(true)} />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute isAuthed={isAuthed}>
              <Dashboard onLogout={() => setIsAuthed(false)} />
            </ProtectedRoute>
          }
        />
        <Route path="/dataset" element={<Dataset />} />  {/* ✅ New route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
