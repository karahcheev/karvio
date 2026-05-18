const CURRENT_USER_KEY = "tms_current_user";

export type SessionProjectMembership = {
  project_id: string;
  project_name: string;
  role: "viewer" | "tester" | "lead" | "manager";
};

export type SessionUser = {
  id: string;
  username: string;
  role: "user" | "admin";
  project_memberships: SessionProjectMembership[];
};

export function getSessionUser(): SessionUser | null {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SessionUser;
    if (!parsed?.id || !parsed?.username || (parsed.role !== "user" && parsed.role !== "admin")) {
      return null;
    }
    if (!Array.isArray(parsed.project_memberships)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setSessionUser(user: SessionUser): void {
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}
