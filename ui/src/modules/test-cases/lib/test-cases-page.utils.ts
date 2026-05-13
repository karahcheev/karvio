import { EXPANDED_SUITES_PARAM, SUITES_COLLAPSED_STORAGE_KEY } from "../utils/constants";

export function parseExpandedSuites(value: string | null): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

export function getStoredSuitesCollapsed(): boolean {
  try {
    return localStorage.getItem(SUITES_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
