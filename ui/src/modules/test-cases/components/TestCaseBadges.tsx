// Tone mappers and labels for test case status, priority, and last run.
import type { ReactNode } from "react";
import type { StatusBadgeTone } from "@/shared/ui/StatusBadge";
import { getPriorityTone as getPriorityToneFromDomain } from "@/shared/domain/priority";

const statusToneMap: Record<string, StatusBadgeTone> = {
  active: "success",
  draft: "neutral",
  archived: "danger",
};

export function getStatusTone(status: string): StatusBadgeTone {
  return statusToneMap[status] ?? "neutral";
}

export function getPriorityTone(priority: string | null | undefined): StatusBadgeTone {
  return getPriorityToneFromDomain(priority);
}

export function formatTestCaseStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getLastStatusLabel(status: string | null): ReactNode {
  if (!status) return null;
  const colors = {
    passed: "text-[var(--status-passed)]",
    failed: "text-[var(--status-failure)]",
    blocked: "text-[var(--status-blocked)]",
  };
  return <span className={`text-xs font-medium ${colors[status as keyof typeof colors]}`}>{status}</span>;
}
