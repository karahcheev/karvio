import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  apiRequest,
  apiFetch: vi.fn(),
}));

import { getTestCases, getTestCasesPage } from "./test-cases";

describe("test-cases api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("passes sorting params to getTestCasesPage when loading all", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 200, has_next: false, total: 0 });

    await getTestCases("proj_1", {
      sortBy: "suite_name",
      sortDirection: "asc",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      expect.stringContaining("project_id=proj_1")
    );
    expect(apiRequest.mock.calls[0][0]).toContain("sort_by=suite_name");
    expect(apiRequest.mock.calls[0][0]).toContain("sort_order=asc");
  });

  it("passes sorting params to paginated test case requests", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 25, has_next: false, total: 0 });

    await getTestCasesPage({
      projectId: "proj_1",
      page: 1,
      pageSize: 25,
      statuses: ["active"],
      sortBy: "owner_name",
      sortOrder: "desc",
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/test-cases?project_id=proj_1&page=1&page_size=25&status=active&sort_by=owner_name&sort_order=desc"
    );
  });
});
