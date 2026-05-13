import { apiFetch, apiRequest } from "@/shared/api/client";
import type { AttachmentDto } from "./types";

export type AttachmentListTarget =
  | { test_case_id: string }
  | { step_id: string }
  | { run_case_id: string }
  | { test_case_id: string; draft_step_client_id: string };

export type AttachmentUploadTarget =
  | { test_case_id: string }
  | { step_id: string }
  | { run_case_id: string }
  | { test_case_id: string; draft_step_client_id: string };

function buildListQuery(target: AttachmentListTarget): string {
  const params = new URLSearchParams();
  if ("test_case_id" in target) params.set("test_case_id", target.test_case_id);
  if ("step_id" in target) params.set("step_id", target.step_id);
  if ("run_case_id" in target) params.set("run_case_id", target.run_case_id);
  if ("draft_step_client_id" in target) params.set("draft_step_client_id", target.draft_step_client_id);
  return params.toString();
}

function buildUploadFormData(target: AttachmentUploadTarget, file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  if ("test_case_id" in target) formData.append("test_case_id", target.test_case_id);
  if ("step_id" in target) formData.append("step_id", target.step_id);
  if ("run_case_id" in target) formData.append("run_case_id", target.run_case_id);
  if ("draft_step_client_id" in target) formData.append("draft_step_client_id", target.draft_step_client_id);
  return formData;
}

export async function listAttachments(target: AttachmentListTarget): Promise<AttachmentDto[]> {
  const query = buildListQuery(target);
  const result = await apiRequest<{ items: AttachmentDto[] }>(`/attachments?${query}`);
  return result.items;
}

export async function uploadAttachment(
  target: AttachmentUploadTarget,
  file: File
): Promise<AttachmentDto> {
  const formData = buildUploadFormData(target, file);
  return apiRequest<AttachmentDto>("/attachments", {
    method: "POST",
    body: formData,
  });
}

export async function deleteAttachment(attachmentId: string): Promise<void> {
  await apiRequest<void>(`/attachments/${attachmentId}`, {
    method: "DELETE",
  });
}

function extractFilename(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }
  const plainMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] ?? fallback;
}

export async function downloadAttachment(
  attachmentId: string,
  fallbackFilename: string
): Promise<void> {
  const response = await apiFetch(`/attachments/${attachmentId}`);
  const blob = await response.blob();
  const filename = extractFilename(response.headers.get("content-disposition"), fallbackFilename);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
