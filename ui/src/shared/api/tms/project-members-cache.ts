import type { ProjectMemberDto } from "./types";

const PROJECT_MEMBERS_CACHE_PREFIX = "tms_project_members:";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function buildCacheKey(
  projectId: string,
  params?: { sortBy?: string; sortDirection?: string },
): string {
  const sortBy = params?.sortBy ?? "created_at";
  const sortDirection = params?.sortDirection ?? "desc";
  return `${PROJECT_MEMBERS_CACHE_PREFIX}${projectId}:${sortBy}:${sortDirection}`;
}

export function getCachedProjectMembers(
  projectId: string,
  params?: { sortBy?: string; sortDirection?: string },
): ProjectMemberDto[] | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(buildCacheKey(projectId, params));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProjectMemberDto[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function setCachedProjectMembers(
  projectId: string,
  items: ProjectMemberDto[],
  params?: { sortBy?: string; sortDirection?: string },
): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(buildCacheKey(projectId, params), JSON.stringify(items));
  } catch {
    // Ignore storage failures and fall back to network on next load.
  }
}

export function clearCachedProjectMembers(projectId?: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(PROJECT_MEMBERS_CACHE_PREFIX)) continue;
      if (!projectId || key.startsWith(`${PROJECT_MEMBERS_CACHE_PREFIX}${projectId}:`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  } catch {
    // Ignore storage failures; cache will be refreshed opportunistically.
  }
}
