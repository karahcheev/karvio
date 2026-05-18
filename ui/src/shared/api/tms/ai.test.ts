import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequest } = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("@/shared/api/client", () => ({
  apiRequest,
}));

import {
  checkAiDuplicates,
  generateAiTestCases,
  getAiSettingsOverview,
  getAiTestCaseStatus,
  getGlobalAiSettings,
  getProjectAiSettings,
  reviewAiTestCase,
  updateGlobalAiSettings,
  updateProjectAiSettings,
} from "./ai";

describe("ai api", () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it("loads AI test case feature status", async () => {
    apiRequest.mockResolvedValue({ enabled: false, provider: null, model: null });

    await getAiTestCaseStatus("proj_1");

    expect(apiRequest).toHaveBeenCalledWith("/ai/test-cases/status?project_id=proj_1");
  });

  it("fetches the AI settings overview list", async () => {
    apiRequest.mockResolvedValue({ items: [] });

    await getAiSettingsOverview();

    expect(apiRequest).toHaveBeenCalledWith("/settings/ai");
  });

  it("fetches and updates global AI settings", async () => {
    apiRequest.mockResolvedValue({});

    await getGlobalAiSettings();
    await updateGlobalAiSettings({
      enabled: true,
      provider: "openai",
      model: "gpt-4o-mini",
      api_key: "sk-global",
      timeout_ms: 30000,
      http_max_retries: 2,
      duplicate_high_threshold: 0.88,
      duplicate_medium_threshold: 0.72,
    });

    expect(apiRequest.mock.calls[0][0]).toBe("/settings/ai/global");
    expect(apiRequest.mock.calls[1][0]).toBe("/settings/ai/global");
    expect(apiRequest.mock.calls[1][1]).toMatchObject({ method: "PUT" });
  });

  it("uses settings endpoints without returning API secrets", async () => {
    apiRequest.mockResolvedValue({});

    await getProjectAiSettings("proj_1");
    await updateProjectAiSettings({
      project_id: "proj_1",
      enabled: true,
      provider: "openai",
      model: "gpt-test",
      api_key: "sk-test",
      timeout_ms: 30000,
      http_max_retries: 2,
      duplicate_high_threshold: 0.88,
      duplicate_medium_threshold: 0.72,
    });

    expect(apiRequest.mock.calls[0][0]).toBe("/settings/ai/proj_1");
    expect(apiRequest.mock.calls[1][0]).toBe("/settings/ai");
    expect(apiRequest.mock.calls[1][1]).toMatchObject({ method: "PUT" });
  });

  it("posts generation, review, and duplicate requests to server-side endpoints", async () => {
    apiRequest.mockResolvedValue({});

    await generateAiTestCases({
      project_id: "proj_1",
      source_text: "Checkout",
      suite_id: null,
      primary_product_id: null,
      component_ids: [],
      test_focus: ["functional"],
      priority_preference: null,
      count: 1,
    });
    await reviewAiTestCase("tc_1", { mode: "all" });
    await checkAiDuplicates({
      project_id: "proj_1",
      test_case: { title: "Checkout", preconditions: null, steps: [], tags: [], component_ids: [] },
      exclude_test_case_id: null,
    });

    expect(apiRequest.mock.calls[0][0]).toBe("/ai/test-cases/generate");
    expect(apiRequest.mock.calls[1][0]).toBe("/ai/test-cases/tc_1/review");
    expect(apiRequest.mock.calls[2][0]).toBe("/ai/test-cases/duplicates/check");
    expect(apiRequest.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });
});
