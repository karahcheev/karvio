import { apiRequest } from "@/shared/api/client";
import type {
  AuthProviderCreatePayload,
  AuthProviderDto,
  AuthProviderTestResultDto,
  AuthProviderUpdatePayload,
  PublicAuthConfigDto,
} from "./types";

export async function getPublicAuthConfig(): Promise<PublicAuthConfigDto> {
  return apiRequest<PublicAuthConfigDto>("/auth/config");
}

export async function getAuthProviders(): Promise<AuthProviderDto[]> {
  const result = await apiRequest<{ items: AuthProviderDto[] }>("/auth/providers");
  return result.items;
}

export async function getAuthProvider(providerId: string): Promise<AuthProviderDto> {
  return apiRequest<AuthProviderDto>(`/auth/providers/${providerId}`);
}

export async function createAuthProvider(payload: AuthProviderCreatePayload): Promise<AuthProviderDto> {
  return apiRequest<AuthProviderDto>("/auth/providers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAuthProvider(
  providerId: string,
  payload: AuthProviderUpdatePayload,
): Promise<AuthProviderDto> {
  return apiRequest<AuthProviderDto>(`/auth/providers/${providerId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAuthProvider(providerId: string): Promise<void> {
  await apiRequest<void>(`/auth/providers/${providerId}`, { method: "DELETE" });
}

export async function testAuthProvider(providerId: string): Promise<AuthProviderTestResultDto> {
  return apiRequest<AuthProviderTestResultDto>(`/auth/providers/${providerId}/test`, {
    method: "POST",
  });
}

export async function rotateAuthProviderSecret(
  providerId: string,
  payload: { secret_name: string; value: string | null },
): Promise<AuthProviderDto> {
  return apiRequest<AuthProviderDto>(`/auth/providers/${providerId}/rotate-secret`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
