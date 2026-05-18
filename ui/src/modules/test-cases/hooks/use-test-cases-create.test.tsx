import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTestCasesCreate } from "./use-test-cases-create";

const hoisted = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  patchMutateAsync: vi.fn(),
  replaceMutateAsync: vi.fn(),
  generateMutateAsync: vi.fn(),
  checkDuplicatesMutateAsync: vi.fn(),
  aiStatus: {
    data: { enabled: false, provider: null, model: null } as {
      enabled: boolean;
      provider: string | null;
      model: string | null;
    },
  },
  uploadDraftStepAttachment: vi.fn(),
  uploadTestCaseAttachment: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  useCreateTestCaseMutation: () => ({
    mutateAsync: hoisted.createMutateAsync,
    isPending: false,
  }),
  usePatchTestCaseMutation: () => ({
    mutateAsync: hoisted.patchMutateAsync,
    isPending: false,
  }),
  useReplaceTestCaseStepsMutation: () => ({
    mutateAsync: hoisted.replaceMutateAsync,
    isPending: false,
  }),
  useAiTestCaseStatusQuery: () => hoisted.aiStatus,
  useGenerateAiTestCasesMutation: () => ({
    mutateAsync: hoisted.generateMutateAsync,
    isPending: false,
  }),
  useCheckAiDuplicatesMutation: () => ({
    mutateAsync: hoisted.checkDuplicatesMutateAsync,
    isPending: false,
  }),
  uploadDraftStepAttachment: hoisted.uploadDraftStepAttachment,
  uploadTestCaseAttachment: hoisted.uploadTestCaseAttachment,
}));

vi.mock("@/shared/lib/notifications", () => ({
  notifyError: hoisted.notifyError,
  notifySuccess: hoisted.notifySuccess,
}));

describe("useTestCasesCreate", () => {
  beforeEach(() => {
    hoisted.createMutateAsync.mockReset();
    hoisted.patchMutateAsync.mockReset();
    hoisted.replaceMutateAsync.mockReset();
    hoisted.generateMutateAsync.mockReset();
    hoisted.checkDuplicatesMutateAsync.mockReset();
    hoisted.aiStatus.data = { enabled: false, provider: null, model: null };
    hoisted.uploadDraftStepAttachment.mockReset();
    hoisted.uploadTestCaseAttachment.mockReset();
    hoisted.notifyError.mockReset();
    hoisted.notifySuccess.mockReset();
  });

  it("uploads queued inline step images on create and replaces local markdown placeholders", async () => {
    hoisted.createMutateAsync.mockResolvedValue({
      id: "tc_1",
      title: "Case with image",
    });
    hoisted.uploadDraftStepAttachment.mockResolvedValue({
      id: "att_1",
      filename: "screen.png",
      content_type: "image/png",
      size: 123,
      created_at: "2026-03-31T08:00:00Z",
      target: { type: "draft_step", test_case_id: "tc_1", draft_step_client_id: "local-step-1" },
    });
    hoisted.replaceMutateAsync.mockResolvedValue({
      test_case_id: "tc_1",
      steps: [],
      step_attachments: {},
    });

    const { result } = renderHook(() => useTestCasesCreate("suite_1", "proj_1"));

    act(() => {
      result.current.setNewTestCase((prev) => ({
        ...prev,
        title: "Case with image",
        templateType: "steps",
        steps: [
          {
            id: "local-step-1",
            action: "Open app",
            expectedResult: "App opened",
            persisted: false,
          },
        ],
      }));
    });

    const file = new File(["img"], "screen.png", { type: "image/png" });
    let markdown: string | null = null;
    await act(async () => {
      markdown = await result.current.onStepImageUpload("local-step-1", file);
    });

    expect(markdown).toBe("![screen.png]");

    act(() => {
      result.current.onUpdateStep("local-step-1", "action", `Open app\n${markdown ?? ""}`);
    });

    await act(async () => {
      await result.current.onCreateTestCase();
    });

    expect(hoisted.uploadDraftStepAttachment).toHaveBeenCalledWith("tc_1", "local-step-1", file);
    expect(hoisted.replaceMutateAsync).toHaveBeenCalledTimes(1);

    const replacePayload = hoisted.replaceMutateAsync.mock.calls[0][0];
    expect(replacePayload).toMatchObject({
      testCaseId: "tc_1",
      projectId: "proj_1",
    });
    expect(replacePayload.steps[0].action).toContain("/attachments/att_1");
    expect(replacePayload.steps[0].action).not.toContain("local-image-");
    expect(hoisted.notifyError).not.toHaveBeenCalled();
  });

  it("uploads queued inline precondition images on create and patches markdown with attachment paths", async () => {
    hoisted.createMutateAsync.mockResolvedValue({
      id: "tc_2",
      title: "Case with preconditions image",
    });
    hoisted.uploadTestCaseAttachment.mockResolvedValue({
      id: "att_pre_1",
      filename: "precondition.png",
      content_type: "image/png",
      size: 128,
      created_at: "2026-03-31T08:00:00Z",
      target: { type: "test_case", test_case_id: "tc_2" },
    });
    hoisted.patchMutateAsync.mockResolvedValue({});

    const { result } = renderHook(() => useTestCasesCreate("suite_1", "proj_1"));

    const file = new File(["img"], "precondition.png", { type: "image/png" });
    let placeholder: string | null = null;
    await act(async () => {
      placeholder = await result.current.onPreconditionsImageUpload(file);
    });

    expect(placeholder).toBe("![precondition.png]");

    act(() => {
      result.current.setNewTestCase((prev) => ({
        ...prev,
        title: "Case with preconditions image",
        templateType: "text",
        preconditions: `Open app\n${placeholder ?? ""}`,
      }));
    });

    await act(async () => {
      await result.current.onCreateTestCase();
    });

    expect(hoisted.uploadTestCaseAttachment).toHaveBeenCalledWith("tc_2", file);
    expect(hoisted.patchMutateAsync).toHaveBeenCalledTimes(1);

    const patchPayload = hoisted.patchMutateAsync.mock.calls[0][0];
    expect(patchPayload).toMatchObject({
      testCaseId: "tc_2",
    });
    expect(patchPayload.payload.preconditions).toContain("/attachments/att_pre_1");
    expect(hoisted.notifyError).not.toHaveBeenCalled();
  });

  it("keeps AI controls disabled when the server reports disabled", () => {
    const { result } = renderHook(() => useTestCasesCreate("suite_1", "proj_1"));

    expect(result.current.aiEnabled).toBe(false);
  });

  it("generates AI drafts when enabled", async () => {
    hoisted.aiStatus.data = { enabled: true, provider: "openai", model: "test-model" };
    hoisted.generateMutateAsync.mockResolvedValue({
      draft_test_cases: [
        {
          title: "AI case",
          preconditions: null,
          steps: [{ action: "Do it", expected_result: "It works" }],
          priority: "high",
          test_case_type: "manual",
          tags: ["ai"],
          primary_product_id: null,
          component_coverages: [],
          risk_reason: null,
          suggestion_reason: "Covers the described behavior.",
          ai_confidence: 0.8,
          possible_duplicates: [],
        },
      ],
      source_references: [],
      warnings: [],
    });
    const { result } = renderHook(() => useTestCasesCreate("suite_1", "proj_1"));

    act(() => {
      result.current.onAiSourceTextChange("Generate checkout cases");
    });
    await act(async () => {
      await result.current.onGenerateAiDrafts();
    });

    expect(result.current.aiEnabled).toBe(true);
    expect(result.current.aiDrafts).toHaveLength(1);
    expect(hoisted.generateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: "proj_1",
        suite_id: "suite_1",
        source_text: "Generate checkout cases",
      })
    );
  });

  it("accepts and rejects generated suggestions", () => {
    hoisted.aiStatus.data = { enabled: true, provider: "openai", model: "test-model" };
    const { result } = renderHook(() => useTestCasesCreate("suite_1", "proj_1"));
    const draft = {
      title: "Accepted AI case",
      preconditions: "User is signed in.",
      steps: [{ action: "Open dashboard", expected_result: "Dashboard loads" }],
      priority: "medium" as const,
      test_case_type: "manual" as const,
      tags: ["dashboard"],
      primary_product_id: null,
      component_coverages: [],
      risk_reason: null,
      suggestion_reason: "Covers the happy path.",
      ai_confidence: 0.75,
      possible_duplicates: [],
    };

    act(() => {
      result.current.onAcceptAiDraft(draft);
    });

    expect(result.current.newTestCase.title).toBe("Accepted AI case");
    expect(result.current.newTestCase.steps[0]).toMatchObject({
      action: "Open dashboard",
      expectedResult: "Dashboard loads",
    });
  });

  it("renders duplicate warning state from duplicate checks", async () => {
    hoisted.aiStatus.data = { enabled: true, provider: "openai", model: "test-model" };
    hoisted.checkDuplicatesMutateAsync.mockResolvedValue({
      duplicates: [
        {
          candidate_test_case_id: "tc_1",
          key: "TC-1",
          title: "Existing",
          similarity_score: 0.9,
          reason: "Strong title overlap.",
          matching_fields: ["title"],
          recommendation: "merge",
        },
      ],
      warnings: [],
    });
    const { result } = renderHook(() => useTestCasesCreate("suite_1", "proj_1"));

    act(() => {
      result.current.setNewTestCase((prev) => ({ ...prev, title: "Existing" }));
    });
    await act(async () => {
      result.current.onCheckDuplicates();
    });

    await waitFor(() => expect(result.current.duplicateWarnings).toHaveLength(1));
  });
});
