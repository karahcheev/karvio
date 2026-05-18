import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_OVERVIEW_WIDGET_ORDER,
  OVERVIEW_WIDGET_IDS,
  REQUIRED_OVERVIEW_WIDGET_IDS,
  createDefaultOverviewDashboardPreferences,
  isOverviewWidgetId,
  type OverviewDashboardPreferences,
  type OverviewGranularity,
  type OverviewWidgetId,
} from "./overview-widget-config";

const OVERVIEW_STORAGE_PREFIX = "overview";

type StoredDashboardPreferences = Partial<{
  enabledWidgets: unknown;
  widgetOrder: unknown;
  hiddenSeries: unknown;
  filters: unknown;
}>;

function getStorageKey(projectId: string): string {
  return `${OVERVIEW_STORAGE_PREFIX}:${projectId}:widgets`;
}

function uniqueWidgetIds(values: OverviewWidgetId[]): OverviewWidgetId[] {
  const seen = new Set<OverviewWidgetId>();
  const unique: OverviewWidgetId[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function normalizeWidgetIds(value: unknown): OverviewWidgetId[] {
  if (!Array.isArray(value)) return [];
  return uniqueWidgetIds(value.filter((item): item is OverviewWidgetId => typeof item === "string" && isOverviewWidgetId(item)));
}

function normalizeWidgetOrder(rawOrder: unknown): OverviewWidgetId[] {
  const fromStorage = normalizeWidgetIds(rawOrder);
  return uniqueWidgetIds([...fromStorage, ...DEFAULT_OVERVIEW_WIDGET_ORDER]);
}

function normalizeEnabledWidgets(rawEnabled: unknown, widgetOrder: OverviewWidgetId[]): OverviewWidgetId[] {
  const fromStorage = normalizeWidgetIds(rawEnabled);
  const base = fromStorage.length > 0 ? fromStorage : [...widgetOrder];
  const withRequired = uniqueWidgetIds([...REQUIRED_OVERVIEW_WIDGET_IDS, ...base]);
  return withRequired.filter((widgetId) => widgetOrder.includes(widgetId));
}

function normalizeHiddenSeries(rawHiddenSeries: unknown): Partial<Record<OverviewWidgetId, string[]>> {
  if (!rawHiddenSeries || typeof rawHiddenSeries !== "object") return {};

  const normalized: Partial<Record<OverviewWidgetId, string[]>> = {};
  for (const [key, value] of Object.entries(rawHiddenSeries)) {
    if (!isOverviewWidgetId(key) || !Array.isArray(value)) continue;
    const names = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (names.length > 0) {
      normalized[key] = names;
    }
  }
  return normalized;
}

function normalizeTopN(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const integerValue = Math.floor(value);
  if (integerValue < 1) return undefined;
  return integerValue;
}

function normalizeGranularity(value: unknown): OverviewGranularity | undefined {
  return value === "day" || value === "week" || value === "month" ? value : undefined;
}

function normalizePreferences(raw: unknown): OverviewDashboardPreferences {
  const defaults = createDefaultOverviewDashboardPreferences();

  if (Array.isArray(raw)) {
    const widgetOrder = [...DEFAULT_OVERVIEW_WIDGET_ORDER];
    return {
      enabledWidgets: normalizeEnabledWidgets(raw, widgetOrder),
      widgetOrder,
      hiddenSeries: {},
      filters: {},
    };
  }

  if (!raw || typeof raw !== "object") return defaults;

  const payload = raw as StoredDashboardPreferences;
  const widgetOrder = normalizeWidgetOrder(payload.widgetOrder);
  const enabledWidgets = normalizeEnabledWidgets(payload.enabledWidgets, widgetOrder);
  const hiddenSeries = normalizeHiddenSeries(payload.hiddenSeries);

  const rawFilters = payload.filters;
  const filters = {
    topN: rawFilters && typeof rawFilters === "object" ? normalizeTopN((rawFilters as { topN?: unknown }).topN) : undefined,
    granularity:
      rawFilters && typeof rawFilters === "object"
        ? normalizeGranularity((rawFilters as { granularity?: unknown }).granularity)
        : undefined,
  };

  return {
    enabledWidgets,
    widgetOrder,
    hiddenSeries,
    filters,
  };
}

function readStoredPreferences(projectId: string | undefined): OverviewDashboardPreferences {
  if (!projectId || typeof window === "undefined") {
    return createDefaultOverviewDashboardPreferences();
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(projectId));
    if (!raw) return createDefaultOverviewDashboardPreferences();
    return normalizePreferences(JSON.parse(raw) as unknown);
  } catch {
    return createDefaultOverviewDashboardPreferences();
  }
}

function writeStoredPreferences(projectId: string | undefined, preferences: OverviewDashboardPreferences): void {
  if (!projectId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(projectId), JSON.stringify(preferences));
  } catch {
    // Ignore localStorage quota/security errors.
  }
}

export function useDashboardVisibility(projectId: string | undefined) {
  const [preferences, setPreferences] = useState<OverviewDashboardPreferences>(() => readStoredPreferences(projectId));
  const skipPersistRef = useRef(true);

  useEffect(() => {
    skipPersistRef.current = true;
    setPreferences(readStoredPreferences(projectId));
  }, [projectId]);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    writeStoredPreferences(projectId, preferences);
  }, [preferences, projectId]);

  const enabledSet = useMemo(() => new Set(preferences.enabledWidgets), [preferences.enabledWidgets]);

  const visibleWidgetOrder = useMemo(
    () => preferences.widgetOrder.filter((widgetId) => enabledSet.has(widgetId)),
    [enabledSet, preferences.widgetOrder],
  );

  const isWidgetRequired = useCallback((widgetId: OverviewWidgetId) => REQUIRED_OVERVIEW_WIDGET_IDS.includes(widgetId), []);

  const isWidgetVisible = useCallback((widgetId: OverviewWidgetId) => enabledSet.has(widgetId), [enabledSet]);

  const toggleWidget = useCallback((widgetId: OverviewWidgetId) => {
    if (REQUIRED_OVERVIEW_WIDGET_IDS.includes(widgetId)) return;

    setPreferences((current) => {
      const enabled = new Set(current.enabledWidgets);
      if (enabled.has(widgetId)) enabled.delete(widgetId);
      else enabled.add(widgetId);
      return {
        ...current,
        enabledWidgets: current.widgetOrder.filter((id) => enabled.has(id)),
      };
    });
  }, []);

  const resetDashboardPreferences = useCallback(() => {
    setPreferences(createDefaultOverviewDashboardPreferences());
  }, []);

  return {
    preferences,
    allWidgetIds: OVERVIEW_WIDGET_IDS,
    enabledWidgetIds: preferences.enabledWidgets,
    visibleWidgetOrder,
    isWidgetRequired,
    isWidgetVisible,
    toggleWidget,
    resetDashboardPreferences,
  };
}
