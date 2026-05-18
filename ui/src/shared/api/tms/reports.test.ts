import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest, apiFetch } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  apiRequest,
  apiFetch,
}));

import { downloadRunReport, getProjectOverview } from "./reports";

describe("reports api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiFetch.mockReset();
  });

  it("requests project overview with filters", async () => {
    apiRequest.mockResolvedValue({});

    await getProjectOverview("proj_1", {
      createdFrom: "2025-01-01",
      createdTo: "2025-01-31",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/projects/proj_1/overview?created_from=2025-01-01&created_to=2025-01-31"
    );
  });

  it("requests project overview without filters", async () => {
    apiRequest.mockResolvedValue({});

    await getProjectOverview("proj_1");

    expect(apiRequest).toHaveBeenCalledWith("/projects/proj_1/overview");
  });

  it("requests project overview with analytics query params", async () => {
    apiRequest.mockResolvedValue({});

    await getProjectOverview("proj_1", {
      createdFrom: "2025-01-01",
      createdTo: "2025-01-31",
      sections: ["release_stats", "status_trend"],
      topN: 12,
      groupBy: "suite",
      granularity: "week",
      assigneeId: "user_1",
      suiteId: "suite_1",
      environment: "staging",
      build: "v1.2.3",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/projects/proj_1/overview?created_from=2025-01-01&created_to=2025-01-31&sections=release_stats%2Cstatus_trend&top_n=12&group_by=suite&granularity=week&assignee_id=user_1&suite_id=suite_1&environment=staging&build=v1.2.3"
    );
  });

  it("downloads run report via test-runs export", async () => {
    apiFetch.mockResolvedValue(
      new Response(new Blob(), {
        headers: { "content-disposition": 'attachment; filename="test-run-run_1-report.json"' },
      })
    );

    await downloadRunReport("run_1", "json");

    expect(apiFetch).toHaveBeenCalledWith("/test-runs/run_1/export?format=json");
  });
});
