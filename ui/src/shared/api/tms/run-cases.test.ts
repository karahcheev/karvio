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
  getRunCases,
  getRunCasesPage,
  createRunCase,
  bulkCreateRunCases,
  getRunCase,
  patchRunCase,
  deleteRunCase,
} from "./run-cases";

describe("run-cases api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    fetchAllPageItems.mockReset();
  });

  it("passes run case filters to fetchAllPageItems", async () => {
    fetchAllPageItems.mockResolvedValue([]);

    await getRunCases("run_1", {
      statuses: ["failure"],
      assigneeId: "user_1",
      sortBy: "last_executed_at",
      sortDirection: "desc",
    });

    expect(fetchAllPageItems).toHaveBeenCalledWith("/run-cases", expect.any(URLSearchParams));
    expect(fetchAllPageItems.mock.calls[0][1].toString()).toContain("test_run_id=run_1");
    expect(fetchAllPageItems.mock.calls[0][1].toString()).toContain("status=failure");
    expect(fetchAllPageItems.mock.calls[0][1].toString()).toContain("assignee_id=user_1");
  });

  it("requests a paginated run cases page", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 20, has_next: false });

    await getRunCasesPage({
      testRunId: "run_1",
      page: 2,
      pageSize: 20,
      sortBy: "status",
      sortOrder: "asc",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining("/run-cases?")
    );
    expect(apiRequest.mock.calls[0][0]).toContain("test_run_id=run_1");
    expect(apiRequest.mock.calls[0][0]).toContain("page=2");
    expect(apiRequest.mock.calls[0][0]).toContain("page_size=20");
  });

  it("creates and bulk creates run cases", async () => {
    apiRequest.mockResolvedValue({ id: "rc_1" });
    await createRunCase({
      test_run_id: "run_1",
      test_case_id: "tc_1",
      assignee_id: "user_1",
    });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/run-cases", {
      method: "POST",
      body: JSON.stringify({
        test_run_id: "run_1",
        test_case_id: "tc_1",
        assignee_id: "user_1",
      }),
    });

    apiRequest.mockResolvedValue({ items: [{ id: "rc_2" }, { id: "rc_3" }] });
    await bulkCreateRunCases("run_1", { test_case_ids: ["tc_2", "tc_3"] });

    expect(apiRequest).toHaveBeenNthCalledWith(2, "/run-cases/bulk", {
      method: "POST",
      body: JSON.stringify({
        test_run_id: "run_1",
        test_case_ids: ["tc_2", "tc_3"],
      }),
    });
  });

  it("loads, patches and deletes a run case", async () => {
    apiRequest.mockResolvedValue({ id: "rc_1", history: { items: [], page: 1, page_size: 50, has_next: false } });

    await getRunCase("rc_1");
    await patchRunCase("rc_1", {
      assignee_id: "user_1",
      comment: "ok",
    });
    await deleteRunCase("rc_1");

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/run-cases/rc_1");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/run-cases/rc_1", {
      method: "PATCH",
      body: JSON.stringify({
        assignee_id: "user_1",
        comment: "ok",
      }),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, "/run-cases/rc_1", {
      method: "DELETE",
    });
  });

  it("loads run case with embedded history", async () => {
    apiRequest.mockResolvedValue({
      id: "rc_1",
      history: { items: [], page: 1, page_size: 50, has_next: false },
    });

    await getRunCase("rc_1");
    await getRunCase("rc_1", { historyPage: 2, historyPageSize: 10 });

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/run-cases/rc_1");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/run-cases/rc_1?history_page=2&history_page_size=10");
  });
});
