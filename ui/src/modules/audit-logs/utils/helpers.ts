import type { AuditChangeItem } from "./types";
import type { AuditLogDto } from "@/shared/api";
import { IGNORED_CHANGE_FIELDS, WRITE_ACTION_HINTS } from "./constants";

export function formatUtcTimestamp(value: string): string {
  return new Date(value).toISOString().replace("T", " ").slice(0, 19) + "Z";
}

export function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  return JSON.stringify(value, null, 2);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valuesAreEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => valuesAreEqual(item, right[index]));
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of keys) {
      if (!valuesAreEqual(left[key], right[key])) {
        return false;
      }
    }
    return true;
  }

  return false;
}

export function collectChangedFields(
  before: unknown,
  after: unknown,
  basePath = ""
): AuditChangeItem[] {
  if (valuesAreEqual(before, after)) {
    return [];
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLength = Math.max(before.length, after.length);
    const changes: AuditChangeItem[] = [];
    for (let index = 0; index < maxLength; index += 1) {
      const path = `${basePath}[${index}]`;
      changes.push(...collectChangedFields(before[index], after[index], path));
    }
    return changes;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changes: AuditChangeItem[] = [];
    for (const key of keys) {
      const path = basePath ? `${basePath}.${key}` : key;
      changes.push(...collectChangedFields(before[key], after[key], path));
    }
    return changes;
  }

  return [
    {
      path: basePath || "value",
      before,
      after,
    },
  ];
}

export function shouldDisplayChangesForAction(action: string): boolean {
  const normalized = action.toLowerCase();
  if (normalized.includes("delete")) {
    return false;
  }
  return WRITE_ACTION_HINTS.some((hint) => normalized.includes(hint));
}

export function isIgnoredChangePath(path: string): boolean {
  const normalizedPath = path.replace(/\[\d+\]/g, "");
  const lastSegment = normalizedPath.split(".").at(-1) ?? normalizedPath;
  return IGNORED_CHANGE_FIELDS.has(lastSegment);
}

export function mergeUniqueByEventId(current: AuditLogDto[], incoming: AuditLogDto[]): AuditLogDto[] {
  const byId = new Map<string, AuditLogDto>();
  for (const item of current) {
    byId.set(item.event_id, item);
  }
  for (const item of incoming) {
    byId.set(item.event_id, item);
  }
  return [...byId.values()].sort(
    (left, right) => new Date(right.timestamp_utc).getTime() - new Date(left.timestamp_utc).getTime()
  );
}
