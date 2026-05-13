import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { useUrlHashState } from "./use-url-hash-state";

const WORKSPACE_TABS = ["projects", "users"] as const;
const TEST_CASE_MODES = ["view", "edit"] as const;

function WorkspaceTabsHarness() {
  const location = useLocation();
  const [tab, setTab] = useUrlHashState({
    values: WORKSPACE_TABS,
    defaultValue: "projects",
  });

  return (
    <>
      <div data-testid="value">{tab}</div>
      <div data-testid="hash">{location.hash}</div>
      <button type="button" onClick={() => setTab("projects")}>
        projects
      </button>
      <button type="button" onClick={() => setTab("users")}>
        users
      </button>
    </>
  );
}

function TestCaseModeHarness() {
  const location = useLocation();
  const [mode, setMode] = useUrlHashState({
    values: TEST_CASE_MODES,
    defaultValue: "view",
    omitHashFor: "view",
  });

  return (
    <>
      <div data-testid="value">{mode}</div>
      <div data-testid="hash">{location.hash}</div>
      <button type="button" onClick={() => setMode("view")}>
        view
      </button>
      <button type="button" onClick={() => setMode("edit")}>
        edit
      </button>
    </>
  );
}

describe("useUrlHashState", () => {
  it("reads the current hash as state", () => {
    render(
      <MemoryRouter initialEntries={["/projects-and-users#users"]}>
        <WorkspaceTabsHarness />
      </MemoryRouter>
    );

    expect(screen.getByTestId("value")).toHaveTextContent("users");
    expect(screen.getByTestId("hash")).toHaveTextContent("#users");
  });

  it("canonicalizes the default state into the url hash", async () => {
    render(
      <MemoryRouter initialEntries={["/projects-and-users"]}>
        <WorkspaceTabsHarness />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("value")).toHaveTextContent("projects");
      expect(screen.getByTestId("hash")).toHaveTextContent("#projects");
    });
  });

  it("supports omitting the hash for a default state", async () => {
    render(
      <MemoryRouter initialEntries={["/test-case#edit"]}>
        <TestCaseModeHarness />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "view" }));

    await waitFor(() => {
      expect(screen.getByTestId("value")).toHaveTextContent("view");
      expect(screen.getByTestId("hash")).toHaveTextContent("");
    });
  });
});
