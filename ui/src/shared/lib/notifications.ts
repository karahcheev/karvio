import { useSyncExternalStore } from "react";
import { toast } from "sonner";

export type NotificationLevel = "success" | "error";

export type NotificationItem = {
  id: string;
  level: NotificationLevel;
  message: string;
  createdAt: number;
};

type NotificationState = {
  uiEnabled: boolean;
  lastSeenAt: number;
  items: NotificationItem[];
};

type NotificationSnapshot = {
  uiEnabled: boolean;
  unreadCount: number;
  items: NotificationItem[];
};

const STORAGE_UI_ENABLED_KEY = "tms.notifications.uiEnabled";
const STORAGE_LAST_SEEN_KEY = "tms.notifications.lastSeenAt";
const STORAGE_ITEMS_KEY = "tms.notifications.items";
const MAX_ITEMS = 100;

const listeners = new Set<() => void>();

function readBooleanFromStorage(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === "1";
}

function readNumberFromStorage(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readItemsFromStorage(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_ITEMS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is NotificationItem => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as Partial<NotificationItem>;
        return (
          typeof candidate.id === "string" &&
          (candidate.level === "success" || candidate.level === "error") &&
          typeof candidate.message === "string" &&
          typeof candidate.createdAt === "number"
        );
      })
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

const state: NotificationState = {
  uiEnabled: readBooleanFromStorage(STORAGE_UI_ENABLED_KEY, true),
  lastSeenAt: readNumberFromStorage(STORAGE_LAST_SEEN_KEY, Date.now()),
  items: readItemsFromStorage(),
};

let snapshot: NotificationSnapshot = {
  uiEnabled: state.uiEnabled,
  unreadCount: 0,
  items: state.items,
};

function refreshSnapshot() {
  snapshot = {
    uiEnabled: state.uiEnabled,
    unreadCount: state.items.filter((item) => item.createdAt > state.lastSeenAt).length,
    items: state.items,
  };
}

function emit() {
  refreshSnapshot();
  listeners.forEach((listener) => listener());
}

function persistUiEnabled() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_UI_ENABLED_KEY, state.uiEnabled ? "1" : "0");
}

function persistLastSeenAt() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_LAST_SEEN_KEY, String(state.lastSeenAt));
}

function persistItems() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(state.items));
}

function getSnapshot(): NotificationSnapshot {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotificationCenter() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    ...snapshot,
    setUiEnabled: setNotificationsUiEnabled,
    markSeen: markNotificationsSeen,
    clear: clearNotifications,
    dismissNotification,
  };
}

function normalizeMessage(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as { detail?: unknown; message?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail.trim();
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    // Non-JSON response body, use raw text below.
  }

  return trimmed;
}

function pushNotification(level: NotificationLevel, message: string) {
  const entry: NotificationItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    message,
    createdAt: Date.now(),
  };
  state.items = [entry, ...state.items].slice(0, MAX_ITEMS);
  persistItems();
  emit();
}

export function setNotificationsUiEnabled(enabled: boolean) {
  if (state.uiEnabled === enabled) return;
  state.uiEnabled = enabled;
  persistUiEnabled();
  emit();
}

export function markNotificationsSeen() {
  if (state.items.length === 0) return;
  state.lastSeenAt = Date.now();
  persistLastSeenAt();
  emit();
}

export function clearNotifications() {
  if (state.items.length === 0) return;
  state.items = [];
  state.lastSeenAt = Date.now();
  persistItems();
  persistLastSeenAt();
  emit();
}

export function dismissNotification(id: string) {
  if (!state.items.some((item) => item.id === id)) return;
  state.items = state.items.filter((item) => item.id !== id);
  persistItems();
  emit();
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const normalized = normalizeMessage(error.message);
    return normalized || fallback;
  }

  if (typeof error === "string") {
    const normalized = normalizeMessage(error);
    return normalized || fallback;
  }

  return fallback;
}

export function notifySuccess(message: string) {
  pushNotification("success", message);
  if (state.uiEnabled) {
    toast.success(message);
  }
}

export function notifyError(error: unknown, fallback: string) {
  const message = getErrorMessage(error, fallback);
  pushNotification("error", message);
  if (state.uiEnabled) {
    toast.error(message);
  }
}
