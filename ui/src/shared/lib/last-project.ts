const LAST_PROJECT_ID_STORAGE_KEY = "tms:lastProjectId";

export function getLastProjectId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem(LAST_PROJECT_ID_STORAGE_KEY) ?? undefined;
}

export function setLastProjectId(projectId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_PROJECT_ID_STORAGE_KEY, projectId);
}

export function clearLastProjectId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LAST_PROJECT_ID_STORAGE_KEY);
}
