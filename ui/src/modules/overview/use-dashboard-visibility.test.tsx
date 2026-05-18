import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useDashboardVisibility } from "./use-dashboard-visibility";
import { DEFAULT_OVERVIEW_WIDGET_ORDER } from "./overview-widget-config";

const STORAGE_KEY = "overview:proj_1:widgets";

function createLocalStorageMock() {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

describe("useDashboardVisibility", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: createLocalStorageMock(),
      configurable: true,
      writable: true,
    });
  });

  it("returns default visible widgets for a project", () => {
    const { result } = renderHook(() => useDashboardVisibility("proj_1"));

    expect(result.current.visibleWidgetOrder).toEqual([...DEFAULT_OVERVIEW_WIDGET_ORDER]);
    expect(result.current.isWidgetVisible("release_stats")).toBe(true);
  });

  it("forces required widgets to stay visible when reading storage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        enabledWidgets: ["pass_rate_trend"],
        widgetOrder: ["pass_rate_trend", "release_stats"],
      }),
    );

    const { result } = renderHook(() => useDashboardVisibility("proj_1"));

    expect(result.current.isWidgetVisible("release_stats")).toBe(true);
    expect(result.current.visibleWidgetOrder).toContain("release_stats");
  });

  it("toggles optional widgets and persists updated state", () => {
    const { result } = renderHook(() => useDashboardVisibility("proj_1"));

    act(() => {
      result.current.toggleWidget("status_distribution");
    });

    expect(result.current.isWidgetVisible("status_distribution")).toBe(false);

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored as string) as { enabledWidgets: string[] };
    expect(parsed.enabledWidgets).not.toContain("status_distribution");
  });

  it("does not toggle required widgets", () => {
    const { result } = renderHook(() => useDashboardVisibility("proj_1"));

    act(() => {
      result.current.toggleWidget("release_stats");
    });

    expect(result.current.isWidgetVisible("release_stats")).toBe(true);
  });
});
