import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest, fetchAllPageItems } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  fetchAllPageItems: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  apiRequest,
}));

vi.mock("./helpers", () => ({
  fetchAllPageItems,
}));

import {
  getTestRuns,
  getTestRunsPage,
  createTestRun,
  getTestRun,
  importJunitXml,
  importProjectJunitXml,
  patchTestRun,
  deleteTestRun,
} from "./test-runs";

describe("test-runs api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    fetchAllPageItems.mockReset();
  });

  it("passes run filters to fetchAllPageItems", async () => {
    fetchAllPageItems.mockResolvedValue([]);

    await getTestRuns("proj_1", {
      statuses: ["completed"],
      createdBy: "user_1",
      createdFrom: "2025-01-01",
      createdTo: "2025-01-31",
      sortBy: "name",
      sortDirection: "asc",
    });

    expect(fetchAllPageItems).toHaveBeenCalledWith("/test-runs", expect.any(URLSearchParams));
    expect(fetchAllPageItems.mock.calls[0][1].toString()).toBe(
      "status=completed&created_by=user_1&created_from=2025-01-01&created_to=2025-01-31&sort_by=name&sort_order=asc&project_id=proj_1"
    );
  });

  it("requests a paginated test runs page", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 25, has_next: false });

    await getTestRunsPage({
      projectId: "proj_1",
      statuses: ["in_progress"],
      page: 2,
      pageSize: 25,
      sortBy: "status",
      sortOrder: "desc",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/test-runs?status=in_progress&page=2&page_size=25&sort_by=status&sort_order=desc&project_id=proj_1"
    );
  });

  it("getTestRun returns run with summary and status_breakdown (unified from /overview)", async () => {
    apiRequest.mockResolvedValue({
      id: "run_1",
      project_id: "proj_1",
      name: "Run",
      status: "in_progress",
      summary: { total: 5, passed: 3, error: 0, failure: 1, blocked: 0, skipped: 1, pass_rate: 75 },
      status_breakdown: {
        items: [
          { status: "passed", count: 3 },
          { status: "failure", count: 1 },
          { status: "skipped", count: 1 },
        ],
      },
    });

    const run = await getTestRun("run_1");

    expect(apiRequest).toHaveBeenCalledWith("/test-runs/run_1");
    expect(run.summary?.total).toBe(5);
    expect(run.summary?.pass_rate).toBe(75);
    expect(run.status_breakdown?.items).toHaveLength(3);
  });

  it("creates, loads, patches and deletes a test run", async () => {
    apiRequest.mockResolvedValue({ id: "run_1" });

    await createTestRun({
      project_id: "proj_1",
      name: "Sprint 1",
      environment_id: "env_staging",
    });
    await getTestRun("run_1");
    await patchTestRun("run_1", {
      name: "Sprint 1 Updated",
      status: "in_progress",
    });
    await deleteTestRun("run_1");

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/test-runs", {
      method: "POST",
      body: JSON.stringify({
        project_id: "proj_1",
        name: "Sprint 1",
        environment_id: "env_staging",
      }),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/test-runs/run_1");
    expect(apiRequest).toHaveBeenNthCalledWith(3, "/test-runs/run_1", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Sprint 1 Updated",
        status: "in_progress",
      }),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(4, "/test-runs/run_1", {
      method: "DELETE",
    });
  });

  it("creates a test run without environment_id", async () => {
    apiRequest.mockResolvedValue({ id: "run_2" });

    await createTestRun({
      project_id: "proj_1",
      name: "No Env Run",
    });

    expect(apiRequest).toHaveBeenCalledWith("/test-runs", {
      method: "POST",
      body: JSON.stringify({
        project_id: "proj_1",
        name: "No Env Run",
      }),
    });
  });

  it("uploads junit xml report with dry-run flag", async () => {
    apiRequest.mockResolvedValue({ id: "import_1" });
    const file = new File(["<testsuite />"], "report.xml", { type: "application/xml" });

    await importJunitXml("run_1", {
      file,
      dryRun: true,
      createMissingCases: true,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/test-runs/run_1/imports/junit?dry_run=true&create_missing_cases=true",
      {
        method: "POST",
        body: expect.any(FormData),
      }
    );
    const formData = apiRequest.mock.calls[0][1].body as FormData;
    expect(formData.get("file")).toBe(file);
  });

  it("uploads junit xml report on project-level import", async () => {
    apiRequest.mockResolvedValue({ id: "import_2" });
    const file = new File(["<testsuite />"], "project-report.xml", { type: "application/xml" });

    await importProjectJunitXml("proj_1", {
      file,
      createMissingCases: true,
    });

    expect(apiRequest).toHaveBeenCalledWith("/projects/proj_1/imports/junit?create_missing_cases=true", {
      method: "POST",
      body: expect.any(FormData),
    });
  });
});
