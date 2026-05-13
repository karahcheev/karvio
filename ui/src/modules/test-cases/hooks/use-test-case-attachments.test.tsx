import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTestCaseAttachments } from "./use-test-case-attachments";

const hoisted = vi.hoisted(() => ({
  uploadDraftStepAttachment: vi.fn(),
  uploadTestCaseAttachment: vi.fn(),
  deleteTestCaseAttachment: vi.fn(),
  confirmDelete: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock("react-router", () => ({
  useParams: () => ({ testCaseId: "tc_1" }),
}));

vi.mock("@/shared/api", () => ({
  uploadDraftStepAttachment: hoisted.uploadDraftStepAttachment,
  uploadTestCaseAttachment: hoisted.uploadTestCaseAttachment,
  deleteTestCaseAttachment: hoisted.deleteTestCaseAttachment,
}));

vi.mock("@/shared/lib/use-delete-confirmation", () => ({
  useDeleteConfirmation: () => ({
    confirmDelete: hoisted.confirmDelete,
  }),
}));

vi.mock("@/shared/lib/notifications", () => ({
  notifyError: hoisted.notifyError,
  notifySuccess: hoisted.notifySuccess,
}));

describe("useTestCaseAttachments", () => {
  beforeEach(() => {
    hoisted.uploadDraftStepAttachment.mockReset();
    hoisted.uploadTestCaseAttachment.mockReset();
    hoisted.deleteTestCaseAttachment.mockReset();
    hoisted.confirmDelete.mockReset();
    hoisted.notifyError.mockReset();
    hoisted.notifySuccess.mockReset();
  });

  it("uploads inline image for persisted step via draft endpoint and returns markdown without src path", async () => {
    hoisted.uploadDraftStepAttachment.mockResolvedValue({
      id: "att_1",
      filename: "screen.png",
      content_type: "image/png",
      size: 123,
      created_at: "2026-03-31T08:00:00Z",
      target: { type: "draft_step", test_case_id: "tc_1", draft_step_client_id: "step_1" },
    });

    const setStepAttachments = vi.fn();
    const { result } = renderHook(() =>
      useTestCaseAttachments({
        steps: [{ id: "step_1", action: "", expectedResult: "", persisted: true }],
        testCaseAttachments: [],
        setTestCaseAttachments: vi.fn(),
        stepAttachments: {},
        setStepAttachments,
      })
    );

    const file = new File(["png"], "screen.png", { type: "image/png" });
    const markdown = await result.current.handleStepInlineImageUpload("step_1", file);

    expect(hoisted.uploadDraftStepAttachment).toHaveBeenCalledWith("tc_1", "step_1", file);
    expect(markdown).toBe("![screen.png]");
    expect(setStepAttachments).toHaveBeenCalledOnce();
    expect(hoisted.notifyError).not.toHaveBeenCalled();
  });

  it("uploads inline image for preconditions and returns markdown without src path", async () => {
    hoisted.uploadTestCaseAttachment.mockResolvedValue({
      id: "att_case_1",
      filename: "preconditions.png",
      content_type: "image/png",
      size: 123,
      created_at: "2026-03-31T08:00:00Z",
      target: { type: "test_case", test_case_id: "tc_1" },
    });

    const setTestCaseAttachments = vi.fn();
    const { result } = renderHook(() =>
      useTestCaseAttachments({
        steps: [],
        testCaseAttachments: [],
        setTestCaseAttachments,
        stepAttachments: {},
        setStepAttachments: vi.fn(),
      })
    );

    const file = new File(["png"], "preconditions.png", { type: "image/png" });
    const markdown = await result.current.handleCaseInlineImageUpload(file);

    expect(hoisted.uploadTestCaseAttachment).toHaveBeenCalledWith("tc_1", file);
    expect(markdown).toBe("![preconditions.png]");
    expect(setTestCaseAttachments).toHaveBeenCalledOnce();
    expect(hoisted.notifyError).not.toHaveBeenCalled();
  });

  it("removes deleted attachment from both case and step attachment state", async () => {
    hoisted.confirmDelete.mockResolvedValue(true);
    hoisted.deleteTestCaseAttachment.mockResolvedValue(undefined);

    const setTestCaseAttachments = vi.fn();
    const setStepAttachments = vi.fn();
    const { result } = renderHook(() =>
      useTestCaseAttachments({
        steps: [{ id: "step_1", action: "", expectedResult: "", persisted: true }],
        testCaseAttachments: [],
        setTestCaseAttachments,
        stepAttachments: { step_1: [] },
        setStepAttachments,
      })
    );

    const attachment = {
      id: "att_step_1",
      filename: "step.png",
      content_type: "image/png",
      size: 123,
      created_at: "2026-03-31T08:00:00Z",
      target: { type: "step" as const, step_id: "step_1" },
    };

    await result.current.handleCaseAttachmentDelete(attachment);

    expect(hoisted.deleteTestCaseAttachment).toHaveBeenCalledWith("tc_1", "att_step_1");
    expect(setTestCaseAttachments).toHaveBeenCalledOnce();
    expect(setStepAttachments).toHaveBeenCalledOnce();
    expect(hoisted.notifyError).not.toHaveBeenCalled();
  });
});
