// Admin-only subtree: non-admins are redirected to workspace home.
import { Navigate, Outlet } from "react-router";
import { getSessionUser } from "@/shared/auth";

export function AdminLayout() {
  const user = getSessionUser();
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
