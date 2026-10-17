// src/components/layout/ProtectedRoute.jsx
import { useAuthStore } from "@store/authStore";
import { useUIStore } from "@store/uiStore";
import { useEffect } from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, authorOnly = false }) {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const openAuthModal = useUIStore((s) => s.openAuthModal);

  useEffect(() => {
    if (!loading && !user) {
      openAuthModal("login");
    }
  }, [loading, user]);

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;

  if (authorOnly) {
    const allowed = ["author", "moderator", "admin"].includes(profile?.role);
    if (!allowed) return <Navigate to="/dashboard-upgrade" replace />;
  }

  return children;
}
