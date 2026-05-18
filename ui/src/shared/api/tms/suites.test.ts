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

import { deleteSuite, getSuite, getSuites, getSuitesPage, patchSuite } from "./suites";

describe("suites api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
    fetchAllPageItems.mockReset();
  });

  it("passes suite filters to fetchAllPageItems", async () => {
    fetchAllPageItems.mockResolvedValue([]);

    await getSuites("proj_1", {
      parentId: "suite_root",
      search: " smoke ",
    });

    expect(fetchAllPageItems).toHaveBeenCalledWith("/suites", expect.any(URLSearchParams));
    expect(fetchAllPageItems.mock.calls[0][1].toString()).toBe("parent_id=suite_root&search=smoke&project_id=proj_1");
  });

  it("requests a paginated suites page", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 2, page_size: 15, has_next: false });

    await getSuitesPage({
      projectId: "proj_1",
      parentId: "suite_root",
      page: 2,
      pageSize: 15,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/suites?parent_id=suite_root&page=2&page_size=15&project_id=proj_1"
    );
  });

  it("supports suite detail and mutations", async () => {
    apiRequest.mockResolvedValue({ id: "suite_1" });

    await getSuite("suite_1");
    await patchSuite("suite_1", {
      name: "Regression",
      parent_id: null,
      description: "Updated",
      position: 3,
    });
    await deleteSuite("suite_1");

    expect(apiRequest).toHaveBeenNthCalledWith(1, "/suites/suite_1");
    expect(apiRequest).toHaveBeenNthCalledWith(2, "/suites/suite_1", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Regression",
        parent_id: null,
        description: "Updated",
        position: 3,
      }),
    });
    expect(apiRequest).toHaveBeenNthCalledWith(3, "/suites/suite_1", {
      method: "DELETE",
    });
  });
});
