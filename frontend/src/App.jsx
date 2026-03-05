import { Routes, Route, Navigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VisitorForm from "./pages/VisitorForm";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import AuditEvents from "./pages/AuditEvents";
import ProtectedRoute from "./components/ProtectedRoute";
import ResidentVisitorList from "./pages/ResidentVisitorList";
import GuardVisitorList from "./pages/GuardVisitorList";
import Broadcasts from "./pages/Broadcasts";
// import { useEffect } from "react";

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Login />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/visitor"
        element={
          <ProtectedRoute>
            <VisitorForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AuditEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/resident-visitors"
        element={
          <ProtectedRoute>
            <ResidentVisitorList user={{}} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guard-visitors"
        element={
          <ProtectedRoute allowedRoles={["guard", "admin"]}>
            <GuardVisitorList user={{}} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/broadcasts"
        element={
          <ProtectedRoute>
            <Broadcasts />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" />} />
      {/* <Route
        path="/guard-dashboard"
        element={
          <ProtectedRoute allowedRoles={['guard']}>
            <GuardDashboard />
          </ProtectedRoute>
        }
        /> */}

    </Routes>
  );
}

export default App;
