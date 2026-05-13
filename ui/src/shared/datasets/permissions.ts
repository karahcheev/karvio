import { getSessionUser } from "@/shared/auth";

export type ProjectRole = "viewer" | "tester" | "lead" | "manager";

const ROLE_WEIGHT: Record<ProjectRole, number> = {
  viewer: 1,
  tester: 2,
  lead: 3,
  manager: 4,
};

export function getCurrentProjectRole(projectId: string | undefined): ProjectRole | null {
  if (!projectId) return null;
  const sessionUser = getSessionUser();
  if (!sessionUser) return null;
  if (sessionUser.role === "admin") return "manager";
  return sessionUser.project_memberships.find((membership) => membership.project_id === projectId)?.role ?? null;
}

export function hasProjectRole(projectId: string | undefined, minimumRole: ProjectRole): boolean {
  const currentRole = getCurrentProjectRole(projectId);
  if (!currentRole) return false;
  return ROLE_WEIGHT[currentRole] >= ROLE_WEIGHT[minimumRole];
}
