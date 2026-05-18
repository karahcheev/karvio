// Auth gate: restore session on load; unauthenticated users go to login.
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router";
import { getMe } from "@/shared/api";
import { clearSession, setSessionUser } from "@/shared/auth";

export function ProtectedLayout() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // Bootstrap current user from API; clear session on failure.
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((user) => {
        if (!cancelled) {
          setSessionUser({
            id: user.id,
            username: user.username,
            role: user.role,
            project_memberships: user.project_memberships,
          });
          setAuthenticated(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Loading and redirect states for the protected area.
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--muted-foreground)]">Loading...</div>;
  }
  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
