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
  getTestPlans,
  getTestPlansPage,
  getTestPlan,
  createTestPlan,
  patchTestPlan,
  deleteTestPlan,
  createRunFromTestPlan,
} from "./test-plans";

describe("test-plans api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    fetchAllPageItems.mockReset();
  });

  it("fetches test plans by project", async () => {
    fetchAllPageItems.mockResolvedValue([]);

    await getTestPlans("proj_1");

    expect(fetchAllPageItems).toHaveBeenCalledWith("/test-plans", expect.any(URLSearchParams));
    expect(fetchAllPageItems.mock.calls[0][1].toString()).toContain("project_id=proj_1");
  });

  it("requests a paginated test plans page", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 20, has_next: false });

    await getTestPlansPage({
      projectId: "proj_1",
      page: 2,
      pageSize: 20,
    });

    expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("/test-plans?"));
    expect(apiRequest.mock.calls[0][0]).toContain("project_id=proj_1");
    expect(apiRequest.mock.calls[0][0]).toContain("page=2");
    expect(apiRequest.mock.calls[0][0]).toContain("page_size=20");
  });

  it("creates and patches test plans", async () => {
    apiRequest.mockResolvedValue({ id: "tp_1", name: "Plan", suite_ids: ["s1"] });
    await createTestPlan({
      project_id: "proj_1",
      name: "Regression Plan",
      description: "Full regression",
      suite_ids: ["s1", "s2"],
    });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/test-plans", {
      method: "POST",
      body: JSON.stringify({
        project_id: "proj_1",
        name: "Regression Plan",
        description: "Full regression",
        suite_ids: ["s1", "s2"],
      }),
    });

    apiRequest.mockResolvedValue({ id: "tp_1", name: "Updated", suite_ids: ["s1", "s2", "s3"] });
    await patchTestPlan("tp_1", { name: "Updated", suite_ids: ["s1", "s2", "s3"] });

    expect(apiRequest).toHaveBeenNthCalledWith(2, "/test-plans/tp_1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated", suite_ids: ["s1", "s2", "s3"] }),
    });
  });

  it("gets and deletes a test plan", async () => {
    apiRequest.mockResolvedValue({ id: "tp_1", name: "Plan" });

    await getTestPlan("tp_1");
    await deleteTestPlan("tp_1");

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/test-plans/tp_1");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/test-plans/tp_1", {
      method: "DELETE",
    });
  });

  it("creates run from test plan", async () => {
    apiRequest.mockResolvedValue({
      id: "run_1",
      project_id: "proj_1",
      name: "Run from Plan",
      status: "not_started",
    });

    await createRunFromTestPlan("tp_1", {
      name: "Run from Plan",
      description: "Desc",
      environment_id: "env_staging",
      build: "1.0",
      assignee: "user_1",
      start_immediately: true,
    });

    expect(apiRequest).toHaveBeenCalledWith("/test-plans/tp_1/create-run", {
      method: "POST",
      body: JSON.stringify({
        name: "Run from Plan",
        description: "Desc",
        environment_id: "env_staging",
        build: "1.0",
        assignee: "user_1",
        start_immediately: true,
      }),
    });
  });

  it("creates empty test plan payload without suites and cases", async () => {
    apiRequest.mockResolvedValue({ id: "tp_empty", name: "Empty Plan", suite_ids: [], case_ids: [] });

    await createTestPlan({
      project_id: "proj_1",
      name: "Empty Plan",
    });

    expect(apiRequest).toHaveBeenCalledWith("/test-plans", {
      method: "POST",
      body: JSON.stringify({
        project_id: "proj_1",
        name: "Empty Plan",
      }),
    });
  });

  it("creates run from test plan without environment_id", async () => {
    apiRequest.mockResolvedValue({
      id: "run_2",
      project_id: "proj_1",
      name: "Run from Plan (No Env)",
      status: "not_started",
    });

    await createRunFromTestPlan("tp_1", {
      name: "Run from Plan (No Env)",
      start_immediately: false,
    });

    expect(apiRequest).toHaveBeenCalledWith("/test-plans/tp_1/create-run", {
      method: "POST",
      body: JSON.stringify({
        name: "Run from Plan (No Env)",
        start_immediately: false,
      }),
    });
  });
});
