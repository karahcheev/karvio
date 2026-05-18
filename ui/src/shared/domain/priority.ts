import type { StatusBadgeTone } from "@/shared/ui/StatusBadge";

/** Domain enum for test case priority. Must match backend TestCasePriority. */
export type TestCasePriority = "low" | "medium" | "high" | "critical";

export const PRIORITY_OPTIONS: readonly TestCasePriority[] = ["low", "medium", "high", "critical"] as const;

const PRIORITY_LABELS: Record<TestCasePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const PRIORITY_TONE_MAP: Record<TestCasePriority, StatusBadgeTone> = {
  low: "info",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

export function formatPriorityLabel(priority: TestCasePriority | string | null | undefined): string {
  if (!priority) return "—";
  const normalized = priority.toLowerCase() as TestCasePriority;
  return PRIORITY_LABELS[normalized] ?? priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
}

export function getPriorityTone(priority: string | null | undefined): StatusBadgeTone {
  if (!priority) return "warning";
  const normalized = priority.toLowerCase() as TestCasePriority;
  return PRIORITY_TONE_MAP[normalized] ?? "warning";
}

/** Check if value is a valid TestCasePriority. */
export function isTestCasePriority(value: string): value is TestCasePriority {
  return PRIORITY_OPTIONS.includes(value as TestCasePriority);
}
