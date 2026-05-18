import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest, apiFetch, fetchAllPageItems } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  apiFetch: vi.fn(),
  fetchAllPageItems: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  apiRequest,
  apiFetch,
}));

vi.mock("./helpers", () => ({
  fetchAllPageItems,
}));

import { downloadPerformanceArtifact, getPerformanceRunsPage } from "./performance";

describe("performance api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiFetch.mockReset();
    fetchAllPageItems.mockReset();
  });

  it("requests paginated performance runs with filters", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 25, has_next: false });

    await getPerformanceRunsPage({
      projectId: "proj_1",
      statuses: ["completed"],
      environments: ["staging-eu"],
      page: 1,
      pageSize: 25,
      sortBy: "created_at",
      sortOrder: "desc",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/perf/runs?status=completed&environment=staging-eu&page=1&page_size=25&sort_by=created_at&sort_order=desc&project_id=proj_1"
    );
  });

  it("requests performance runs with include_archived when asked", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 25, has_next: false });

    await getPerformanceRunsPage({
      projectId: "proj_1",
      includeArchived: true,
      page: 1,
      pageSize: 25,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/perf/runs?include_archived=true&page=1&page_size=25&project_id=proj_1"
    );
  });

  it("downloads performance artifact via authenticated api fetch", async () => {
    apiFetch.mockResolvedValue(
      new Response(new Blob(["{}"], { type: "application/json" }), {
        headers: { "content-disposition": "attachment; filename*=UTF-8''summary%20report.json" },
      })
    );

    await downloadPerformanceArtifact("parf_a/b", "fallback.json");

    expect(apiFetch).toHaveBeenCalledWith("/performance-artifacts/parf_a%2Fb");
  });
});
