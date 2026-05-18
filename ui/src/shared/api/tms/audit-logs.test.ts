import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  apiRequest,
}));

import { getAuditLogs } from "./audit-logs";

describe("audit-logs api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("passes sorting params to audit logs requests", async () => {
    apiRequest.mockResolvedValue({ items: [], page: 1, page_size: 50, has_next: false });

    await getAuditLogs({
      project_id: "proj_1",
      action: "user.create",
      sort_by: "actor",
      sort_order: "asc",
      page_size: 50,
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/audit-logs?project_id=proj_1&action=user.create&page_size=50&sort_by=actor&sort_order=asc"
    );
  });
});
