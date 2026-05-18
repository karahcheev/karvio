import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchAllPageItems } = vi.hoisted(() => ({
  fetchAllPageItems: vi.fn(),
}));

vi.mock("./helpers", () => ({
  fetchAllPageItems,
}));

import { getProjectMembers, getProjects } from "./projects";

describe("projects api", () => {
  beforeEach(() => {
    fetchAllPageItems.mockReset();
  });

  it("passes sorting params to project list requests", async () => {
    fetchAllPageItems.mockResolvedValue([]);

    await getProjects({
      sortBy: "members_count",
      sortDirection: "desc",
    });

    expect(fetchAllPageItems).toHaveBeenCalledWith("/projects", expect.any(URLSearchParams));
    expect(fetchAllPageItems.mock.calls[0][1].toString()).toBe("sort_by=members_count&sort_order=desc");
  });

  it("passes sorting params to project members requests", async () => {
    fetchAllPageItems.mockResolvedValue([]);

    await getProjectMembers("proj_1", {
      sortBy: "username",
      sortDirection: "asc",
    });

    expect(fetchAllPageItems).toHaveBeenCalledWith("/project-members", expect.any(URLSearchParams));
    expect(fetchAllPageItems.mock.calls[0][1].toString()).toBe(
      "project_id=proj_1&sort_by=username&sort_order=asc"
    );
  });
});
