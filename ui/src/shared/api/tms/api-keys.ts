import { apiRequest } from "@/shared/api/client";
import type { ApiKeyDto, ApiKeyListDto, ApiKeySecretResponseDto } from "./types";

export async function getMyApiKeys(): Promise<ApiKeyListDto> {
  return apiRequest<ApiKeyListDto>("/users/me/api-keys");
}

export async function createMyApiKey(payload: { name: string; description?: string | null }): Promise<ApiKeySecretResponseDto> {
  return apiRequest<ApiKeySecretResponseDto>("/users/me/api-keys", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function patchMyApiKey(
  apiKeyId: string,
  payload: { name?: string; description?: string | null },
): Promise<ApiKeyDto> {
  return apiRequest<ApiKeyDto>(`/users/me/api-keys/${apiKeyId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function regenerateMyApiKey(apiKeyId: string): Promise<ApiKeySecretResponseDto> {
  return apiRequest<ApiKeySecretResponseDto>(`/users/me/api-keys/${apiKeyId}/regenerate`, {
    method: "POST",
  });
}

export async function deleteMyApiKey(apiKeyId: string): Promise<void> {
  await apiRequest<void>(`/users/me/api-keys/${apiKeyId}`, {
    method: "DELETE",
  });
}
